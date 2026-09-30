import { describe, expect, it } from "vitest";
import { parseMatrixTrimConfig } from "../src/config.js";

describe("MatrixTrim config", () => {
	it("parses keep and require constraints", () => {
		const config = parseMatrixTrimConfig(
			[
				"version: 1",
				"constraints:",
				"  keep:",
				'    - "test (windows-latest, 20)"',
				"  require:",
				"    - axes:",
				"        os: windows-latest",
				"    - baseJob: test",
				"      axes:",
				"        node: 20",
				"        postgres: 14",
			].join("\n"),
		);

		expect(config.constraints.keep).toEqual(["test (windows-latest, 20)"]);
		expect(config.constraints.require).toEqual([
			{ axes: { os: "windows-latest" } },
			{
				baseJob: "test",
				axes: { node: "20", postgres: "14" },
			},
		]);
	});

	it("defaults to version 1 and empty constraints", () => {
		expect(parseMatrixTrimConfig("{}")).toEqual({
			version: 1,
			constraints: { keep: [], require: [] },
		});
	});

	it("rejects malformed selectors", () => {
		expect(() =>
			parseMatrixTrimConfig(
				["constraints:", "  require:", "    - axes: {}"].join("\n"),
			),
		).toThrow(/at least one axis/);
	});

	it("rejects unsupported config versions", () => {
		expect(() => parseMatrixTrimConfig("version: 2")).toThrow(
			/unsupported MatrixTrim config version/,
		);
	});
});
