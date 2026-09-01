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

await edit("packages/shared/src/contracts.ts", (source) =>
	replaceExactly(
		source,
		'export type UpdateRoutingConfigurationRequest =\n\t| { provider: "harness"; harnessAgentId: string }\n\t| {\n\t\t\tprovider: "openai-compatible";\n\t\t\tmodel: string;\n\t\t\tbaseUrl?: string;\n\t\t\t/** Omit to preserve the saved key, provide a value to replace it, or null to clear it. */\n\t\t\tapiKey?: string | null;\n\t  };',
		'export type UpdateRoutingConfigurationRequest =\n\t| { provider: "harness"; harnessAgentId: string }\n\t| {\n\t\t\tprovider: "openai-compatible";\n\t\t\tmodel: string;\n\t\t\tbaseUrl?: string;\n\t\t\t/** Omit to preserve the saved key, provide a value to replace it, or null to clear it. */\n\t\t\tapiKey?: string | null;\n\t  };\n\nexport interface UpdateWorkspaceSettingsRequest {\n\trouting: UpdateRoutingConfigurationRequest;\n\tdefaults: CommonspaceDefaults;\n}',
		"workspace settings request contract",
	),
);

await edit("server/src/service.ts", (initial) => {
	let source = initial;
	source = replaceExactly(
		source,
		'\tUpdateRoutingConfigurationRequest,\n\tUpdateThreadContextRequest,',
		'\tUpdateRoutingConfigurationRequest,\n\tUpdateThreadContextRequest,\n\tUpdateWorkspaceSettingsRequest,',
		"service workspace settings import",
	);
	const oldRouting = `\trouting(): CommonspaceRoutingConfiguration {\n\t\treturn this.publicRoutingConfiguration();\n\t}\n\n\tasync updateRoutingConfiguration(\n\t\trequest: UpdateRoutingConfigurationRequest,\n\t): Promise<CommonspaceRoutingConfiguration> {\n\t\tif (\n\t\t\trequest.provider !== "harness" &&\n\t\t\trequest.provider !== "openai-compatible"\n\t\t) {\n\t\t\tthrow new Error("unsupported routing provider");\n\t\t}\n\t\tconst model =\n\t\t\trequest.provider === "openai-compatible"\n\t\t\t\t? request.model.normalize("NFKC").trim()\n\t\t\t\t: this.routingConfiguration.model;\n\t\tif (model.length > 200) throw new Error("routing model is too long");\n\t\tconst harnessAgentId =\n\t\t\trequest.provider === "harness"\n\t\t\t\t? request.harnessAgentId.trim() || null\n\t\t\t\t: null;\n\t\tif (\n\t\t\trequest.provider === "harness" &&\n\t\t\t(harnessAgentId === null ||\n\t\t\t\t!this.state.agents.some((agent) => agent.id === harnessAgentId))\n\t\t) {\n\t\t\tthrow new Error("routing harness must be a configured agent");\n\t\t}\n\t\tif (request.provider === "openai-compatible" && model === "")\n\t\t\tthrow new Error("routing model is required");\n\t\tconst baseUrl =\n\t\t\trequest.provider === "openai-compatible"\n\t\t\t\t? normalizedRoutingBaseUrl(request.baseUrl)\n\t\t\t\t: this.routingConfiguration.baseUrl;\n\t\tconst requestedApiKey =\n\t\t\trequest.provider === "openai-compatible" ? request.apiKey : undefined;\n\t\tconst apiKey =\n\t\t\trequestedApiKey === undefined\n\t\t\t\t? baseUrl === this.routingConfiguration.baseUrl\n\t\t\t\t\t? this.routingConfiguration.apiKey\n\t\t\t\t\t: undefined\n\t\t\t\t: requestedApiKey === null || requestedApiKey.trim() === ""\n\t\t\t\t\t? undefined\n\t\t\t\t\t: requestedApiKey.trim().slice(0, 10_000);\n\t\tconst next: PrivateRoutingConfiguration = {\n\t\t\tprovider: request.provider,\n\t\t\tmodel,\n\t\t\tharnessAgentId,\n\t\t\tbaseUrl,\n\t\t};\n\t\tif (apiKey !== undefined) next.apiKey = apiKey;\n\t\tawait this.persistRoutingConfiguration(next);\n\t\tthis.routingConfiguration = next;\n\t\treturn this.publicRoutingConfiguration();\n\t}\n`;
	const newRouting = `\trouting(): CommonspaceRoutingConfiguration {\n\t\treturn this.publicRoutingConfiguration();\n\t}\n\n\tprivate prepareRoutingConfiguration(\n\t\trequest: UpdateRoutingConfigurationRequest,\n\t): PrivateRoutingConfiguration {\n\t\tif (\n\t\t\trequest.provider !== "harness" &&\n\t\t\trequest.provider !== "openai-compatible"\n\t\t) {\n\t\t\tthrow new Error("unsupported routing provider");\n\t\t}\n\t\tconst model =\n\t\t\trequest.provider === "openai-compatible"\n\t\t\t\t? request.model.normalize("NFKC").trim()\n\t\t\t\t: this.routingConfiguration.model;\n\t\tif (model.length > 200) throw new Error("routing model is too long");\n\t\tconst harnessAgentId =\n\t\t\trequest.provider === "harness"\n\t\t\t\t? request.harnessAgentId.trim() || null\n\t\t\t\t: null;\n\t\tif (\n\t\t\trequest.provider === "harness" &&\n\t\t\t(harnessAgentId === null ||\n\t\t\t\t!this.state.agents.some((agent) => agent.id === harnessAgentId))\n\t\t) {\n\t\t\tthrow new Error("routing harness must be a configured agent");\n\t\t}\n\t\tif (request.provider === "openai-compatible" && model === "")\n\t\t\tthrow new Error("routing model is required");\n\t\tconst baseUrl =\n\t\t\trequest.provider === "openai-compatible"\n\t\t\t\t? normalizedRoutingBaseUrl(request.baseUrl)\n\t\t\t\t: this.routingConfiguration.baseUrl;\n\t\tconst requestedApiKey =\n\t\t\trequest.provider === "openai-compatible" ? request.apiKey : undefined;\n\t\tconst apiKey =\n\t\t\trequestedApiKey === undefined\n\t\t\t\t? baseUrl === this.routingConfiguration.baseUrl\n\t\t\t\t\t? this.routingConfiguration.apiKey\n\t\t\t\t\t: undefined\n\t\t\t\t: requestedApiKey === null || requestedApiKey.trim() === ""\n\t\t\t\t\t? undefined\n\t\t\t\t\t: requestedApiKey.trim().slice(0, 10_000);\n\t\tconst next: PrivateRoutingConfiguration = {\n\t\t\tprovider: request.provider,\n\t\t\tmodel,\n\t\t\tharnessAgentId,\n\t\t\tbaseUrl,\n\t\t};\n\t\tif (apiKey !== undefined) next.apiKey = apiKey;\n\t\treturn next;\n\t}\n\n\tvalidateRoutingConfiguration(\n\t\trequest: UpdateRoutingConfigurationRequest,\n\t): CommonspaceDiagnostics["inference"] {\n\t\tconst candidate = this.prepareRoutingConfiguration(request);\n\t\tconst routingUrl = new URL(candidate.baseUrl);\n\t\tconst localRoutingHost =\n\t\t\troutingUrl.hostname === "localhost" ||\n\t\t\troutingUrl.hostname === "127.0.0.1" ||\n\t\t\troutingUrl.hostname === "::1";\n\t\treturn {\n\t\t\tprovider: candidate.provider,\n\t\t\tlocation:\n\t\t\t\tcandidate.provider === "harness" || localRoutingHost ? "local" : "remote",\n\t\t\tconfigured:\n\t\t\t\tcandidate.provider === "harness"\n\t\t\t\t\t? this.state.agents.some((agent) => agent.id === candidate.harnessAgentId)\n\t\t\t\t\t: candidate.model !== "",\n\t\t\tsends: [\n\t\t\t\t"message text",\n\t\t\t\t"Agent labels",\n\t\t\t\t"Project labels",\n\t\t\t\t"shared context",\n\t\t\t\t"routing corrections",\n\t\t\t],\n\t\t};\n\t}\n\n\tasync updateRoutingConfiguration(\n\t\trequest: UpdateRoutingConfigurationRequest,\n\t): Promise<CommonspaceRoutingConfiguration> {\n\t\tconst next = this.prepareRoutingConfiguration(request);\n\t\tawait this.persistRoutingConfiguration(next);\n\t\tthis.routingConfiguration = next;\n\t\treturn this.publicRoutingConfiguration();\n\t}\n\n\tasync updateWorkspaceSettings(\n\t\trequest: UpdateWorkspaceSettingsRequest,\n\t): Promise<CommonspaceBootstrap> {\n\t\treturn this.withAdmission(async () => {\n\t\t\tconst previousState = this.state;\n\t\t\tconst previousRouting = this.routingConfiguration;\n\t\t\tconst nextRouting = this.prepareRoutingConfiguration(request.routing);\n\t\t\tconst defaultsMutation: Extract<\n\t\t\t\tCommonspaceMutation,\n\t\t\t\t{ action: "set-defaults" }\n\t\t\t> = { action: "set-defaults", ...request.defaults };\n\t\t\tconst normalizedDefaults = await this.normalizeMutation(defaultsMutation);\n\t\t\tconst nextState = applyMutation(this.state, normalizedDefaults);\n\n\t\t\tawait this.persistRoutingConfiguration(nextRouting);\n\t\t\tthis.state = nextState;\n\t\t\ttry {\n\t\t\t\tawait this.persist();\n\t\t\t} catch (error) {\n\t\t\t\tthis.state = previousState;\n\t\t\t\ttry {\n\t\t\t\t\tawait this.persistRoutingConfiguration(previousRouting);\n\t\t\t\t} catch (rollbackError) {\n\t\t\t\t\tthrow new AggregateError(\n\t\t\t\t\t\t[error, rollbackError],\n\t\t\t\t\t\t"workspace settings failed and routing rollback also failed",\n\t\t\t\t\t);\n\t\t\t\t}\n\t\t\t\tthrow error;\n\t\t\t}\n\t\t\tthis.routingConfiguration = nextRouting;\n\t\t\tthis.broadcastRevision();\n\t\t\treturn this.bootstrap();\n\t\t});\n\t}\n`;
	source = replaceExactly(source, oldRouting, newRouting, "routing validation and transactional settings");
	return source;
});

await edit("server/src/app.ts", (initial) => {
	let source = initial;
	source = replaceExactly(
		source,
		'\ttype UpdateRoutingConfigurationRequest,\n\ttype UpdateThreadContextRequest,',
		'\ttype UpdateRoutingConfigurationRequest,\n\ttype UpdateThreadContextRequest,\n\ttype UpdateWorkspaceSettingsRequest,',
		"app workspace settings import",
	);
	source = replaceExactly(
		source,
		'const contextRequestSchema =\n\trequestSchema<UpdateChannelContextRequest>(contextRequestShape);',
		'const workspaceSettingsSchema = requestSchema<UpdateWorkspaceSettingsRequest>(\n\tz.object({\n\t\trouting: routingConfigurationSchema,\n\t\tdefaults: z.object({\n\t\t\tmodel: z.string().nullable(),\n\t\t\treasoning: reasoningSchema,\n\t\t\tmaxAgentsPerTurn: z.number(),\n\t\t\tmemoryThreads: z.number(),\n\t\t}),\n\t}),\n);\nconst contextRequestSchema =\n\trequestSchema<UpdateChannelContextRequest>(contextRequestShape);',
		"workspace settings schema",
	);
	const anchor = `\tapp.put("/api/routing", requireSameOrigin, async (req, res) => {\n\t\ttry {\n\t\t\tres.json(\n\t\t\t\tawait service.updateRoutingConfiguration(\n\t\t\t\t\troutingConfigurationSchema.parse(req.body),\n\t\t\t\t),\n\t\t\t);\n\t\t} catch (error) {\n\t\t\tres.status(400).json({\n\t\t\t\tcode: "routing_configuration_failed",\n\t\t\t\terror: requestErrorMessage(error),\n\t\t\t});\n\t\t}\n\t});\n`;
	const replacement = `${anchor}\n\tapp.post("/api/routing/validate", requireSameOrigin, (req, res) => {\n\t\ttry {\n\t\t\tres.json(\n\t\t\t\tservice.validateRoutingConfiguration(\n\t\t\t\t\troutingConfigurationSchema.parse(req.body),\n\t\t\t\t),\n\t\t\t);\n\t\t} catch (error) {\n\t\t\tres.status(400).json({\n\t\t\t\tcode: "routing_validation_failed",\n\t\t\t\terror: requestErrorMessage(error),\n\t\t\t});\n\t\t}\n\t});\n\n\tapp.put("/api/settings", requireSameOrigin, async (req, res) => {\n\t\ttry {\n\t\t\tres.json(\n\t\t\t\tawait service.updateWorkspaceSettings(\n\t\t\t\t\tworkspaceSettingsSchema.parse(req.body),\n\t\t\t\t),\n\t\t\t);\n\t\t} catch (error) {\n\t\t\tres.status(400).json({\n\t\t\t\tcode: "workspace_settings_failed",\n\t\t\t\terror: requestErrorMessage(error),\n\t\t\t});\n\t\t}\n\t});\n`;
	source = replaceExactly(source, anchor, replacement, "routing validation and workspace settings endpoints");
	return source;
});

await edit("ui/src/commonspace-store.ts", (initial) => {
	let source = initial;
	source = replaceExactly(
		source,
		'\tUpdateRoutingConfigurationRequest,\n\tUpdateThreadContextRequest,',
		'\tUpdateRoutingConfigurationRequest,\n\tUpdateThreadContextRequest,\n\tUpdateWorkspaceSettingsRequest,',
		"store workspace settings import",
	);
	const anchor = `\tasync updateRoutingConfiguration(\n\t\trequest: UpdateRoutingConfigurationRequest,\n\t): Promise<void> {\n\t\ttry {\n\t\t\tconst routing = await requestJson<CommonspaceRoutingConfiguration>(\n\t\t\t\t"/api/routing",\n\t\t\t\t{\n\t\t\t\t\tmethod: "PUT",\n\t\t\t\t\tbody: JSON.stringify(request),\n\t\t\t\t},\n\t\t\t);\n\t\t\tconst bootstrap = this.snapshot.bootstrap;\n\t\t\tconst next = { ...this.snapshot, error: null };\n\t\t\tif (bootstrap !== null) next.bootstrap = { ...bootstrap, routing };\n\t\t\tthis.set({\n\t\t\t\t...next,\n\t\t\t});\n\t\t} catch (error) {\n\t\t\tthis.set({\n\t\t\t\t...this.snapshot,\n\t\t\t\terror: error instanceof Error ? error.message : String(error),\n\t\t\t});\n\t\t\tthrow error;\n\t\t}\n\t}\n`;
	const addition = `${anchor}\n\tasync validateRoutingConfiguration(\n\t\trequest: UpdateRoutingConfigurationRequest,\n\t): Promise<CommonspaceDiagnostics["inference"]> {\n\t\treturn requestJson<CommonspaceDiagnostics["inference"]>(\n\t\t\t"/api/routing/validate",\n\t\t\t{ method: "POST", body: JSON.stringify(request) },\n\t\t);\n\t}\n\n\tasync updateWorkspaceSettings(\n\t\trequest: UpdateWorkspaceSettingsRequest,\n\t): Promise<void> {\n\t\ttry {\n\t\t\tconst result = await requestJson<CommonspaceBootstrap>("/api/settings", {\n\t\t\t\tmethod: "PUT",\n\t\t\t\tbody: JSON.stringify(request),\n\t\t\t});\n\t\t\tconst merged = this.mergeBootstrap(result);\n\t\t\tthis.set({\n\t\t\t\t...this.snapshot,\n\t\t\t\tbootstrap: merged,\n\t\t\t\tactiveProjectId: this.resolveActiveProject(merged),\n\t\t\t\terror: null,\n\t\t\t});\n\t\t} catch (error) {\n\t\t\tthis.set({\n\t\t\t\t...this.snapshot,\n\t\t\t\terror: error instanceof Error ? error.message : String(error),\n\t\t\t});\n\t\t\tthrow error;\n\t\t}\n\t}\n`;
	source = replaceExactly(source, anchor, addition, "store validation and transactional settings methods");
	return source;
});

await edit("ui/src/CommonspaceSidebar.tsx", (initial) => {
	let source = initial;
	source = replaceExactly(
		source,
		'\ttype CommonspaceWorkspaceArchive,\n\tDEFAULT_COMMONSPACE_NOTIFICATION_SETTINGS,',
		'\ttype CommonspaceWorkspaceArchive,\n\ttype UpdateRoutingConfigurationRequest,\n\tDEFAULT_COMMONSPACE_NOTIFICATION_SETTINGS,',
		"sidebar routing request import",
	);
	source = source.replace('\n\tconst [pinOverrides, setPinOverrides] = useState<Record<string, boolean>>({});', '');
	const pinFunctions = /\n\tconst collectionPinned = \([\s\S]*?\n\t};\n\tconst toggleCollectionPinned = \([\s\S]*?\n\t};/u;
	if (!pinFunctions.test(source)) throw new Error("Missing fake pin helper block");
	source = source.replace(pinFunctions, '');
	source = source.replace(/\n\t\t\t\t\t\t\tpinned=\{collectionPinned\([^\n]+\)\}/gu, '');
	source = source.replace(/\n\t\t\t\t\t\t\tonTogglePinned=\{\(\) => \{\n\t\t\t\t\t\t\t\ttoggleCollectionPinned\([^\n]+\);\n\t\t\t\t\t\t\t\}\}/gu, '');
	if (source.includes("collectionPinned(") || source.includes("toggleCollectionPinned("))
		throw new Error("Fake pin references remain");

	source = replaceExactly(
		source,
		'\tconst saveDefaults = async (event: FormEvent) => {\n\t\tevent.preventDefault();\n\t\tconst routingUpdate =\n\t\t\troutingProvider === "harness"\n\t\t\t\t? {\n\t\t\t\t\t\tprovider: "harness" as const,\n\t\t\t\t\t\tharnessAgentId: routingHarnessAgentId,\n\t\t\t\t\t}\n\t\t\t\t: {\n\t\t\t\t\t\tprovider: "openai-compatible" as const,\n\t\t\t\t\t\tmodel: routingModel,\n\t\t\t\t\t\tbaseUrl: routingBaseUrl,\n\t\t\t\t\t\t...(clearRoutingApiKey\n\t\t\t\t\t\t\t? { apiKey: null }\n\t\t\t\t\t\t\t: routingApiKey.trim() === ""\n\t\t\t\t\t\t\t\t? {}\n\t\t\t\t\t\t\t\t: { apiKey: routingApiKey }),\n\t\t\t\t\t};\n\t\tawait store.updateRoutingConfiguration(routingUpdate);\n\t\tawait store.mutate({\n\t\t\taction: "set-defaults",\n\t\t\tmodel: defaultModel || null,\n\t\t\treasoning: defaultReasoning,\n\t\t\tmaxAgentsPerTurn: defaultMaxAgents,\n\t\t\tmemoryThreads: defaultMemoryThreads,\n\t\t});\n\t\tsetSettingsOpen(false);\n\t};',
		'\tconst routingUpdateRequest = (): UpdateRoutingConfigurationRequest =>\n\t\troutingProvider === "harness"\n\t\t\t? { provider: "harness", harnessAgentId: routingHarnessAgentId }\n\t\t\t: {\n\t\t\t\t\tprovider: "openai-compatible",\n\t\t\t\t\tmodel: routingModel,\n\t\t\t\t\tbaseUrl: routingBaseUrl,\n\t\t\t\t\t...(clearRoutingApiKey\n\t\t\t\t\t\t? { apiKey: null }\n\t\t\t\t\t\t: routingApiKey.trim() === ""\n\t\t\t\t\t\t\t? {}\n\t\t\t\t\t\t\t: { apiKey: routingApiKey }),\n\t\t\t\t};\n\n\tconst saveDefaults = async (event: FormEvent) => {\n\t\tevent.preventDefault();\n\t\tawait store.updateWorkspaceSettings({\n\t\t\trouting: routingUpdateRequest(),\n\t\t\tdefaults: {\n\t\t\t\tmodel: defaultModel || null,\n\t\t\t\treasoning: defaultReasoning,\n\t\t\t\tmaxAgentsPerTurn: defaultMaxAgents,\n\t\t\t\tmemoryThreads: defaultMemoryThreads,\n\t\t\t},\n\t\t});\n\t\tsetSettingsOpen(false);\n\t};',
		"transactional workspace settings UI",
	);
	source = replaceExactly(
		source,
		'\tconst [inferenceCheckStatus, setInferenceCheckStatus] = useState<\n\t\tstring | null\n\t>(null);',
		'\tconst [inferenceCheckStatus, setInferenceCheckStatus] = useState<\n\t\tstring | null\n\t>(null);\n\tconst [inferenceCheckOk, setInferenceCheckOk] = useState<boolean | null>(null);',
		"inference validation status state",
	);
	source = replaceExactly(
		source,
		'\tconst checkInferenceConfiguration = async () => {\n\t\tif (inferenceChecking) return;\n\t\tsetInferenceChecking(true);\n\t\tsetInferenceCheckStatus("Checking configuration…");\n\t\ttry {\n\t\t\tconst result = await store.diagnostics();\n\t\t\tsetInferenceCheckStatus(\n\t\t\t\tresult.inference.configured\n\t\t\t\t\t? `Configuration verified · ${result.inference.provider}`\n\t\t\t\t\t: "Configuration needs attention",\n\t\t\t);\n\t\t} catch {\n\t\t\tsetInferenceCheckStatus("Configuration check failed");\n\t\t} finally {\n\t\t\tsetInferenceChecking(false);\n\t\t}\n\t};',
		'\tconst checkInferenceConfiguration = async () => {\n\t\tif (inferenceChecking) return;\n\t\tsetInferenceChecking(true);\n\t\tsetInferenceCheckOk(null);\n\t\tsetInferenceCheckStatus("Checking unsaved configuration…");\n\t\ttry {\n\t\t\tconst result = await store.validateRoutingConfiguration(\n\t\t\t\troutingUpdateRequest(),\n\t\t\t);\n\t\t\tsetInferenceCheckOk(result.configured);\n\t\t\tsetInferenceCheckStatus(\n\t\t\t\tresult.configured\n\t\t\t\t\t? `Configuration is valid · ${result.provider}`\n\t\t\t\t\t: "Configuration needs attention",\n\t\t\t);\n\t\t} catch {\n\t\t\tsetInferenceCheckOk(false);\n\t\t\tsetInferenceCheckStatus("Configuration check failed");\n\t\t} finally {\n\t\t\tsetInferenceChecking(false);\n\t\t}\n\t};',
		"unsaved inference validation",
	);
	const effectsAnchor = '\tuseEffect(() => {\n\t\tvoid store.refresh();\n\t}, [store]);';
	source = replaceExactly(
		source,
		effectsAnchor,
		`${effectsAnchor}\n\tuseEffect(() => {\n\t\tsetInferenceCheckStatus(null);\n\t\tsetInferenceCheckOk(null);\n\t}, [\n\t\troutingProvider,\n\t\troutingHarnessAgentId,\n\t\troutingModel,\n\t\troutingBaseUrl,\n\t\troutingApiKey,\n\t\tclearRoutingApiKey,\n\t]);`,
		"clear stale inference validation",
	);
	source = replaceExactly(
		source,
		'\t\t\t\t\t<span className="absolute top-0 right-0 inline-flex min-h-[30px] items-center gap-2 rounded-full border px-2.5 font-mono text-xs text-muted-foreground">\n\t\t\t\t\t\t<i\n\t\t\t\t\t\t\tclassName="size-[7px] rounded-full bg-[var(--status-success)]"\n\t\t\t\t\t\t\taria-hidden="true"\n\t\t\t\t\t\t/>\n\t\t\t\t\t\tConfigured\n\t\t\t\t\t</span>',
		'\t\t\t\t\t<span className="absolute top-0 right-0 inline-flex min-h-[30px] items-center gap-2 rounded-full border px-2.5 font-mono text-xs text-muted-foreground">\n\t\t\t\t\t\t<i className="size-[7px] rounded-full bg-muted-foreground" aria-hidden="true" />\n\t\t\t\t\t\tSaved configuration\n\t\t\t\t\t</span>',
		"non-misleading saved settings badge",
	);
	source = replaceExactly(
		source,
		'\t\t\t\t\t\t\t<p\n\t\t\t\t\t\t\t\tclassName="mt-3 inline-flex items-center gap-2 text-xs text-[var(--status-success)]"\n\t\t\t\t\t\t\t\trole="status"\n\t\t\t\t\t\t\t\taria-label="Inference configuration status"\n\t\t\t\t\t\t\t>\n\t\t\t\t\t\t\t\t<span aria-hidden="true">✓</span>\n\t\t\t\t\t\t\t\t{inferenceCheckStatus}\n\t\t\t\t\t\t\t</p>',
		'\t\t\t\t\t\t\t<p\n\t\t\t\t\t\t\t\tclassName={cn(\n\t\t\t\t\t\t\t\t\t"mt-3 inline-flex items-center gap-2 text-xs",\n\t\t\t\t\t\t\t\t\tinferenceCheckOk === true\n\t\t\t\t\t\t\t\t\t\t? "text-[var(--status-success)]"\n\t\t\t\t\t\t\t\t\t\t: inferenceCheckOk === false\n\t\t\t\t\t\t\t\t\t\t\t? "text-destructive"\n\t\t\t\t\t\t\t\t\t\t\t: "text-muted-foreground",\n\t\t\t\t\t\t\t\t)}\n\t\t\t\t\t\t\t\trole="status"\n\t\t\t\t\t\t\t\taria-label="Inference configuration status"\n\t\t\t\t\t\t\t>\n\t\t\t\t\t\t\t\t<span aria-hidden="true">\n\t\t\t\t\t\t\t\t\t{inferenceCheckOk === true ? "✓" : inferenceCheckOk === false ? "!" : "…"}\n\t\t\t\t\t\t\t\t</span>\n\t\t\t\t\t\t\t\t{inferenceCheckStatus}\n\t\t\t\t\t\t\t</p>',
		"truthful validation status styling",
	);
	return source;
});

await rm("scripts/apply-settings-review-fixes.mjs", { force: true });
await rm(".github/workflows/apply-settings-review-fixes.yml", { force: true });
