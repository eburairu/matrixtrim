import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const workflowsDir = fileURLToPath(
	new URL("../.github/workflows/", import.meta.url),
);
const dependabotPath = fileURLToPath(
	new URL("../.github/dependabot.yml", import.meta.url),
);

describe("workflow supply-chain policy", () => {
	it("pins hosted runner images instead of using moving latest labels", () => {
		const workflowFiles = readdirSync(workflowsDir).filter(
			(name) => name.endsWith(".yml") || name.endsWith(".yaml"),
		);
		for (const file of workflowFiles) {
			const source = readFileSync(`${workflowsDir}/${file}`, "utf8");
			expect(source, file).not.toMatch(/runs-on:\s+[^\n]*-latest\b/);
		}
	});

	it("pins every external GitHub Action to an immutable commit SHA", () => {
		const workflowFiles = readdirSync(workflowsDir).filter(
			(name) => name.endsWith(".yml") || name.endsWith(".yaml"),
		);

		for (const file of workflowFiles) {
			const source = readFileSync(`${workflowsDir}/${file}`, "utf8");
			const uses = [...source.matchAll(/^\s*-\s+uses:\s*([^\s#]+)/gm)];
			for (const match of uses) {
				const spec = match[1]!;
				if (spec.startsWith("./") || spec.startsWith("docker://")) continue;
				const separator = spec.lastIndexOf("@");
				expect(separator, `${file}: ${spec}`).toBeGreaterThan(0);
				expect(spec.slice(separator + 1), `${file}: ${spec}`).toMatch(
					/^[0-9a-f]{40}$/,
				);
			}
		}
	});

	it("tracks both npm and GitHub Action dependency updates", () => {
		const config = parse(readFileSync(dependabotPath, "utf8")) as {
			updates: Array<{ "package-ecosystem": string }>;
		};
		const ecosystems = config.updates.map(
			(entry) => entry["package-ecosystem"],
		);
		expect(ecosystems).toContain("npm");
		expect(ecosystems).toContain("github-actions");
	});
});
