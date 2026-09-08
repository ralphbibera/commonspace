import { constants } from "node:fs";
import { open, realpath, stat } from "node:fs/promises";
import { basename, isAbsolute, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { CommonspaceFileAttachment } from "@commonspace/shared";
import { credentialBearingFileName } from "./credential-files.js";

export { credentialBearingFileName } from "./credential-files.js";

export const MAX_FILE_ATTACHMENTS = 8;
export const MAX_FILE_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const MAX_FILE_ATTACHMENTS_BYTES = 16 * 1024 * 1024;

export interface AgentGeneratedFile {
	name: string;
	uri: string;
	mimeType?: string;
	size?: number;
}

export interface PreparedFileAttachment {
	metadata: CommonspaceFileAttachment;
	data: Buffer;
}

export interface BoundedAttachmentReader {
	read(
		buffer: Buffer,
		offset: number,
		length: number,
		position: number,
	): Promise<number>;
	size(): Promise<number>;
}

export async function readBoundedAttachmentBytes(
	reader: BoundedAttachmentReader,
	expectedSize: number,
): Promise<Buffer | null> {
	const buffer = Buffer.allocUnsafe(expectedSize + 1);
	let offset = 0;
	while (offset < buffer.length) {
		const length = buffer.length - offset;
		const bytesRead = await reader.read(buffer, offset, length, offset);
		if (bytesRead < 0 || bytesRead > length)
			throw new Error("attachment reader returned an invalid byte count");
		if (bytesRead === 0) break;
		offset += bytesRead;
	}
	if (offset !== expectedSize || (await reader.size()) !== expectedSize)
		return null;
	return buffer.subarray(0, expectedSize);
}

export async function prepareAgentFileAttachments(
	files: readonly AgentGeneratedFile[] | undefined,
	allowedRoots: readonly string[],
	onInvalid: () => void,
): Promise<PreparedFileAttachment[]> {
	const prepared: PreparedFileAttachment[] = [];
	let totalBytes = 0;
	for (const candidate of files?.slice(0, MAX_FILE_ATTACHMENTS) ?? []) {
		try {
			const url = new URL(candidate.uri);
			if (url.protocol !== "file:") continue;
			const sourcePath = fileURLToPath(url);
			const sourceName = basename(sourcePath).normalize("NFKC");
			if (credentialBearingFileName(sourceName)) continue;
			const path = await realpath(sourcePath);
			const resolvedName = basename(path).normalize("NFKC");
			if (credentialBearingFileName(resolvedName)) continue;
			const insideAllowedRoot = allowedRoots.some((root) => {
				const child = relative(root, path);
				return child === "" || (!child.startsWith("..") && !isAbsolute(child));
			});
			if (!insideAllowedRoot) continue;
			const requestedName = candidate.name.normalize("NFKC").trim();
			const name = requestedName === "" ? basename(path) : requestedName;
			if (
				name.includes("/") ||
				name.includes("\\") ||
				credentialBearingFileName(name)
			)
				continue;
			const mimeType =
				candidate.mimeType?.trim().toLocaleLowerCase() ??
				"application/octet-stream";
			if (
				!/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/u.test(
					mimeType,
				)
			)
				continue;
			const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
			try {
				const info = await file.stat();
				if (
					!info.isFile() ||
					info.size < 1 ||
					info.size > MAX_FILE_ATTACHMENT_BYTES
				)
					continue;
				if ((await realpath(path)) !== path) continue;
				const current = await stat(path);
				if (current.dev !== info.dev || current.ino !== info.ino) continue;
				const data = await readBoundedAttachmentBytes(
					{
						read: async (buffer, offset, length, position) =>
							(await file.read(buffer, offset, length, position)).bytesRead,
						size: async () => (await file.stat()).size,
					},
					info.size,
				);
				if (data === null) continue;
				totalBytes += data.length;
				if (totalBytes > MAX_FILE_ATTACHMENTS_BYTES) break;
				prepared.push({
					metadata: {
						id: crypto.randomUUID(),
						name,
						mimeType,
						size: data.length,
					},
					data,
				});
			} finally {
				await file.close();
			}
		} catch {
			onInvalid();
		}
	}
	return prepared;
}
