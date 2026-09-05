import { readFileSync } from "node:fs";
import { z } from "zod";

export const COMMONSPACE_VERSION = z
	.object({ version: z.string().min(1) })
	.parse(
		JSON.parse(
			readFileSync(new URL("../package.json", import.meta.url), "utf8"),
		),
	).version;
