import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const generatedClientDir = fileURLToPath(
	new URL("../src/api/openapi-client/", import.meta.url),
);
const tsNoCheck = "// @ts-nocheck\n";

async function markTypeScriptFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });

	await Promise.all(
		entries.map(async (entry) => {
			const path = join(directory, entry.name);

			if (entry.isDirectory()) {
				await markTypeScriptFiles(path);
				return;
			}

			if (!entry.isFile() || !entry.name.endsWith(".ts")) {
				return;
			}

			const content = await readFile(path, "utf8");

			if (content.startsWith(tsNoCheck)) {
				return;
			}

			await writeFile(path, `${tsNoCheck}${content}`);
		}),
	);
}

await markTypeScriptFiles(generatedClientDir);
