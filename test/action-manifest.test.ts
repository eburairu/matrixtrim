import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

describe("GitHub Action manifest", () => {
	it("parses action.yml and exposes expected readiness outputs", async () => {
		const text = await readFile(
			new URL("../action.yml", import.meta.url),
			"utf8",
		);
		const manifest = parse(text) as {
			name?: string;
			runs?: { using?: string; main?: string };
			outputs?: Record<string, { description?: string }>;
		};

		expect(manifest.name).toBe("MatrixTrim");
		expect(manifest.runs?.using).toBe("node24");
		expect(manifest.runs?.main).toBe("action-dist/index.cjs");
		expect(manifest.outputs?.["readiness-level"]?.description).toContain(
			"diagnostic-only",
		);
	});
});
