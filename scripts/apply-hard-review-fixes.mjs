#!/usr/bin/env node

import { readFile, rm, writeFile } from "node:fs/promises";

async function edit(path, transform) {
	const before = await readFile(path, "utf8");
	const after = transform(before);
	if (after === before) throw new Error(`No change produced for ${path}`);
	await writeFile(path, after);
}

function replaceExactly(source, before, after, label) {
	const first = source.indexOf(before);
	if (first < 0) throw new Error(`Missing patch target: ${label}`);
	if (source.indexOf(before, first + before.length) >= 0)
		throw new Error(`Patch target is not unique: ${label}`);
	return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
}

function replaceCount(source, before, after, count, label) {
	const actual = source.split(before).length - 1;
	if (actual !== count)
		throw new Error(`Expected ${count} patch targets for ${label}, found ${actual}`);
	return source.split(before).join(after);
}

await edit("ui/src/CommonspaceConversation.tsx", (initial) => {
	let source = initial;
	source = replaceExactly(
		source,
		'\t\t\t\t\t(threadId === undefined || activity.threadId === threadId),',
		'\t\t\t\t\tactivity.threadId === threadId,',
		"exact /stop thread scope",
	);
	source = replaceExactly(
		source,
		'\t\tsetThreadReplyTarget(null);\n\t\tsetPendingThreadImages([]);',
		'\t\tsetThreadReplyTarget(null);\n\t\tsetThreadDraft("");\n\t\tsetPendingThreadImages([]);',
		"thread draft reset",
	);
	source = replaceExactly(
		source,
		'\tconst copyMessageLink = (message: CommonspaceMessage) => {\n\t\tconst link = `commonspace://${message.conversation.kind}/${message.conversation.id}/message/${message.id}`;\n\t\tvoid navigator.clipboard?.writeText(link).catch(() => undefined);\n\t};',
		'\tconst copyMessageLink = (message: CommonspaceMessage) => {\n\t\tconst link = new URL(window.location.href);\n\t\tlink.search = "";\n\t\tlink.hash = "";\n\t\tlink.searchParams.set("conversation", message.conversation.kind);\n\t\tlink.searchParams.set("conversationId", message.conversation.id);\n\t\tlink.searchParams.set("messageId", message.id);\n\t\tif (message.threadId !== undefined)\n\t\t\tlink.searchParams.set("threadId", message.threadId);\n\t\tvoid navigator.clipboard?.writeText(link.toString()).catch(() => undefined);\n\t};',
		"browser message link",
	);
	source = replaceExactly(
		source,
		'"relative grid min-h-0 flex-1 overflow-hidden"',
		'"commonspace-conversation-layout relative grid min-h-0 flex-1 overflow-hidden"',
		"conversation layout class",
	);
	source = replaceExactly(
		source,
		'className="flex min-h-0 min-w-0 flex-col bg-background"',
		'className="commonspace-conversation-primary flex min-h-0 min-w-0 flex-col bg-background"',
		"conversation primary class",
	);
	source = replaceExactly(
		source,
		'className="relative z-20 h-full w-2 cursor-col-resize border-0 bg-transparent after:absolute after:inset-y-0 after:left-[3px] after:w-px after:bg-border hover:after:w-0.5 hover:after:bg-primary"',
		'className="commonspace-thread-resizer relative z-20 h-full w-2 cursor-col-resize border-0 bg-transparent after:absolute after:inset-y-0 after:left-[3px] after:w-px after:bg-border hover:after:w-0.5 hover:after:bg-primary"',
		"thread resizer class",
	);
	source = replaceExactly(
		source,
		'className="relative z-20 flex min-h-0 min-w-[360px] flex-col border-l bg-background"',
		'className="commonspace-thread-panel relative z-20 flex min-h-0 min-w-[360px] flex-col border-l bg-background"',
		"thread panel class",
	);

	const helperAnchor = 'function readAttachedFile(file: File): Promise<SendFileAttachment> {';
	const helperIndex = source.indexOf(helperAnchor);
	if (helperIndex < 0) throw new Error("Missing retry attachment helper anchor");
	const pendingStripIndex = source.indexOf("\nfunction PendingImageStrip", helperIndex);
	if (pendingStripIndex < 0) throw new Error("Missing pending image strip anchor");
	const retryHelpers = `\n\nfunction blobBase64(blob: Blob): Promise<string> {\n\treturn new Promise((resolve, reject) => {\n\t\tconst reader = new FileReader();\n\t\treader.onerror = () => reject(new Error("Could not read stored attachment."));\n\t\treader.onload = () => {\n\t\t\tconst result = reader.result;\n\t\t\tconst marker = ";base64,";\n\t\t\tconst markerIndex = typeof result === "string" ? result.indexOf(marker) : -1;\n\t\t\tif (typeof result !== "string" || markerIndex < 0) {\n\t\t\t\treject(new Error("Could not read stored attachment."));\n\t\t\t\treturn;\n\t\t\t}\n\t\t\tresolve(result.slice(markerIndex + marker.length));\n\t\t};\n\t\treader.readAsDataURL(blob);\n\t});\n}\n\nasync function replayAttachments(message: CommonspaceMessage): Promise<{\n\timages: SendImageAttachment[];\n\tfiles: SendFileAttachment[];\n}> {\n\tconst images = await Promise.all(\n\t\t(message.attachments ?? []).map(async (attachment) => {\n\t\t\tconst response = await fetch(\n\t\t\t\t\`/api/attachments/\${encodeURIComponent(attachment.id)}\`,\n\t\t\t);\n\t\t\tif (!response.ok) throw new Error(\`Could not reload \${attachment.name}.\`);\n\t\t\treturn {\n\t\t\t\tname: attachment.name,\n\t\t\t\tmimeType: attachment.mimeType,\n\t\t\t\tdata: await blobBase64(await response.blob()),\n\t\t\t};\n\t\t}),\n\t);\n\tconst files = await Promise.all(\n\t\t(message.files ?? []).map(async (file) => {\n\t\t\tconst response = await fetch(\`/api/files/\${encodeURIComponent(file.id)}\`);\n\t\t\tif (!response.ok) throw new Error(\`Could not reload \${file.name}.\`);\n\t\t\treturn {\n\t\t\t\tname: file.name,\n\t\t\t\tmimeType: file.mimeType,\n\t\t\t\tdata: await blobBase64(await response.blob()),\n\t\t\t};\n\t\t}),\n\t);\n\treturn { images, files };\n}\n`;
	source = `${source.slice(0, pendingStripIndex)}${retryHelpers}${source.slice(pendingStripIndex)}`;

	source = replaceExactly(
		source,
		'\t\t\ttry {\n\t\t\t\tif (threadId === undefined)\n\t\t\t\t\tawait store.send(\n\t\t\t\t\t\tprevious.text,\n\t\t\t\t\t\tundefined,\n\t\t\t\t\t\t[],\n\t\t\t\t\t\tundefined,\n\t\t\t\t\t\treferencedProjectIds(previous),\n\t\t\t\t\t);\n\t\t\t\telse await store.send(previous.text, threadId);',
		'\t\t\ttry {\n\t\t\t\tconst replay = await replayAttachments(previous);\n\t\t\t\tawait store.send(\n\t\t\t\t\tprevious.text,\n\t\t\t\t\tthreadId,\n\t\t\t\t\treplay.images,\n\t\t\t\t\tundefined,\n\t\t\t\t\treferencedProjectIds(previous),\n\t\t\t\t\treplay.files,\n\t\t\t\t);',
		"retry attachments",
	);
	return source;
});

await edit("ui/src/CommonspaceContextSettings.tsx", (source) =>
	replaceCount(
		source,
		'className="flex min-h-0 min-w-[340px] flex-col border-l bg-background"',
		'className="commonspace-context-settings flex min-h-0 min-w-[340px] flex-col border-l bg-background"',
		2,
		"context settings pane classes",
	),
);

await edit("ui/src/index.css", (source) => {
	const rules = `\n\n@media (max-width: 780px) {\n\t.commonspace-conversation-layout {\n\t\tgrid-template-columns: minmax(0, 1fr) !important;\n\t}\n\n\t.commonspace-conversation-layout:has(.commonspace-thread-panel)\n\t\t.commonspace-conversation-primary,\n\t.commonspace-conversation-layout:has(.commonspace-context-settings)\n\t\t.commonspace-conversation-primary {\n\t\tdisplay: none;\n\t}\n\n\t.commonspace-thread-resizer {\n\t\tdisplay: none;\n\t}\n\n\t.commonspace-thread-panel,\n\t.commonspace-context-settings {\n\t\twidth: 100%;\n\t\tmin-width: 0 !important;\n\t\tborder-left: 0;\n\t}\n}\n`;
	if (source.includes(".commonspace-conversation-layout"))
		throw new Error("Mobile conversation rules already exist");
	return `${source.trimEnd()}${rules}`;
});

await edit("server/src/app.ts", (initial) => {
	let source = initial;
	source = replaceExactly(
		source,
		'function requestBrowserHost(\n\treq: Pick<IncomingMessage, "headers">,\n): string | undefined {\n\treturn firstHeaderValue(req.headers["x-forwarded-host"]) ?? req.headers.host;\n}',
		'function requestBrowserHost(\n\treq: Pick<IncomingMessage, "headers">,\n): string | undefined {\n\treturn firstHeaderValue(req.headers.host);\n}\n\nfunction requestHostIsLoopback(host: string): boolean {\n\ttry {\n\t\tconst hostname = new URL(`http://${host}`).hostname.toLocaleLowerCase();\n\t\treturn (\n\t\t\thostname === "127.0.0.1" ||\n\t\t\thostname === "localhost" ||\n\t\t\thostname === "::1" ||\n\t\t\thostname === "[::1]"\n\t\t);\n\t} catch {\n\t\treturn false;\n\t}\n}',
		"trusted browser host",
	);
	source = replaceExactly(
		source,
		'\tconst host = requestBrowserHost(req);\n\tif (host === undefined) return false;',
		'\tconst host = requestBrowserHost(req);\n\tif (host === undefined || !requestHostIsLoopback(host)) return false;',
		"same-origin loopback host check",
	);
	return source;
});

await edit("server/src/service.ts", (initial) => {
	let source = initial;
	source = replaceExactly(
		source,
		'\tasync mutate(mutation: CommonspaceMutation): Promise<CommonspaceState> {\n\t\treturn this.withAdmission(async () => {\n\t\t\tconst resetScope =',
		'\tasync mutate(mutation: CommonspaceMutation): Promise<CommonspaceState> {\n\t\treturn this.withAdmission(async () => {\n\t\t\tconst previousState = this.state;\n\t\t\tconst resetScope =',
		"mutation rollback snapshot",
	);
	source = replaceExactly(
		source,
		'\t\t\t} else {\n\t\t\t\tconst normalized = await this.normalizeMutation(mutation);\n\t\t\t\tthis.state = applyMutation(this.state, normalized);\n\t\t\t}\n\t\t\tthis.revokeInvalidMcpCredentials();',
		'\t\t\t} else {\n\t\t\t\tconst normalized = await this.normalizeMutation(mutation);\n\t\t\t\tthis.state = applyMutation(this.state, normalized);\n\t\t\t}\n\t\t\ttry {\n\t\t\t\tawait this.persist();\n\t\t\t} catch (error) {\n\t\t\t\tthis.state = previousState;\n\t\t\t\tthrow error;\n\t\t\t}\n\t\t\tthis.revokeInvalidMcpCredentials();',
		"persist mutation before runtime cleanup",
	);
	source = replaceExactly(
		source,
		'\t\t\t}\n\t\t\tawait this.persist();\n\t\t\tthis.broadcastRevision();\n\t\t\treturn this.publicSnapshot();\n\t\t});\n\t}\n\n\tasync send(request: SendMessageRequest)',
		'\t\t\t}\n\t\t\tthis.broadcastRevision();\n\t\t\treturn this.publicSnapshot();\n\t\t});\n\t}\n\n\tasync send(request: SendMessageRequest)',
		"remove post-cleanup mutation persistence",
	);
	source = replaceExactly(
		source,
		'\t\t\tconst prepared = await this.prepareSend(editedRequest);\n\t\t\tprepared.version = {',
		'\t\t\tconst prepared = await this.prepareSend(editedRequest);\n\t\t\tprepared.attachments = await Promise.all(\n\t\t\t\t(currentSource.attachments ?? []).map(async (attachment) => {\n\t\t\t\t\tconst { data } = await this.readImageAttachment(attachment.id);\n\t\t\t\t\treturn {\n\t\t\t\t\t\tmetadata: { ...attachment, id: crypto.randomUUID() },\n\t\t\t\t\t\tdata,\n\t\t\t\t\t};\n\t\t\t\t}),\n\t\t\t);\n\t\t\tprepared.files = await Promise.all(\n\t\t\t\t(currentSource.files ?? []).map(async (file) => {\n\t\t\t\t\tconst { data } = await this.readFileAttachment(file.id);\n\t\t\t\t\treturn { metadata: { ...file, id: crypto.randomUUID() }, data };\n\t\t\t\t}),\n\t\t\t);\n\t\t\tprepared.version = {',
		"preserve edited attachments",
	);
	source = replaceExactly(
		source,
		'\t\t\t\ttext: source.text,\n\t\t\t\tattachments: [],\n\t\t\t\tfiles: [],\n\t\t\t\tagents,',
		'\t\t\t\ttext: source.text,\n\t\t\t\tattachments: await Promise.all(\n\t\t\t\t\t(source.attachments ?? []).map(async (attachment) => {\n\t\t\t\t\t\tconst { data } = await this.readImageAttachment(attachment.id);\n\t\t\t\t\t\treturn { metadata: attachment, data };\n\t\t\t\t\t}),\n\t\t\t\t),\n\t\t\t\tfiles: await Promise.all(\n\t\t\t\t\t(source.files ?? []).map(async (file) => {\n\t\t\t\t\t\tconst { data } = await this.readFileAttachment(file.id);\n\t\t\t\t\t\treturn { metadata: file, data };\n\t\t\t\t\t}),\n\t\t\t\t),\n\t\t\t\tagents,',
		"preserve reroute attachments",
	);
	return source;
});

await rm("scripts/apply-hard-review-fixes.mjs", { force: true });
await rm(".github/workflows/apply-hard-review-fixes.yml", { force: true });
