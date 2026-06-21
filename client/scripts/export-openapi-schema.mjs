import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const apiRoot = fileURLToPath(new URL("../../api/", import.meta.url));
const outputPath = fileURLToPath(
	new URL("../.generated/openapi.json", import.meta.url),
);
const exportScript = [
	"import json",
	"from app.main import app",
	"print(json.dumps(app.openapi()))",
].join("; ");

const result = spawnSync("uv", ["run", "python", "-c", exportScript], {
	cwd: apiRoot,
	encoding: "utf8",
	env: {
		...process.env,
		DATABASE_URL: process.env.DATABASE_URL ?? "sqlite+aiosqlite:///./test.db",
		REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379/0",
		ENVIRONMENT: process.env.ENVIRONMENT ?? "local",
		CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
		PUBLIC_API_BASE_URL:
			process.env.PUBLIC_API_BASE_URL ?? "https://api.example.test",
		AUTH__DISCOVERY_ENDPOINT:
			process.env.AUTH__DISCOVERY_ENDPOINT ??
			"https://example.test/.well-known/openid-configuration",
		AUTH__AUDIENCE: process.env.AUTH__AUDIENCE ?? "kanai-api",
		AI__MODEL_NAME: process.env.AI__MODEL_NAME ?? "openapi-export-model",
		AI__BASE_URL: process.env.AI__BASE_URL ?? "https://ai.example.test/v1",
		AI__API_KEY: process.env.AI__API_KEY ?? "openapi-export-api-key",
	},
});

if (result.status !== 0) {
	process.stderr.write(result.stderr);
	process.exit(result.status ?? 1);
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, result.stdout);

if (result.stderr) {
	process.stderr.write(result.stderr);
}
