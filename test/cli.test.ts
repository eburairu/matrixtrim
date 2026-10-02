import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");
const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const temporaryDirectories: string[] = [];

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

function runCli(args: string[]) {
	return spawnSync(process.execPath, [tsxCli, cli, ...args], {
		encoding: "utf8",
		env: { ...process.env, GH_TOKEN: "", GITHUB_TOKEN: "" },
	});
}

describe("CLI", () => {
	it("inspects a workflow and emits machine-readable JSON", () => {
		const directory = mkdtempSync(join(tmpdir(), "matrixtrim-cli-"));
		temporaryDirectories.push(directory);
		const workflow = join(directory, "ci.yml");
		writeFileSync(
			workflow,
			[
				"jobs:",
				"  test:",
				"    strategy:",
				"      matrix:",
				"        node: [20, 22]",
			].join("\n"),
		);

		const result = runCli(["inspect", workflow, "--json"]);
		expect(result.status).toBe(0);
		const report = JSON.parse(result.stdout);
		expect(report[0].matrices[0]).toMatchObject({
			job: "test",
			baseCells: 2,
			axes: { node: 2 },
		});
	});
	it("returns a non-zero exit code with a useful usage error", () => {
		const result = runCli(["analyze"]);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("usage: matrixtrim analyze owner/repo");
	});

	it("routes doctor to the diagnostic command", () => {
		const result = runCli(["doctor"]);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("usage: matrixtrim doctor owner/repo");
	});
});
