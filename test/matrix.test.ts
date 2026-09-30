import { describe, expect, it } from "vitest";
import { inspectWorkflow } from "../src/matrix.js";

describe("inspectWorkflow", () => {
	it("finds static matrix dimensions", () => {
		const source = [
			"jobs:",
			"  test:",
			"    strategy:",
			"      matrix:",
			"        os: [ubuntu-latest, windows-latest, macos-latest]",
			"        node: [20, 22, 24]",
			"        exclude:",
			"          - os: macos-latest",
			"            node: 20",
		].join("\n");

		expect(inspectWorkflow(source)).toEqual([
			{
				job: "test",
				axes: { os: 3, node: 3 },
				baseCells: 9,
				excludeRules: 1,
				includeEntries: 0,
				dynamic: false,
			},
		]);
	});
	it("reports whole dynamic matrix expressions instead of dropping them", () => {
		const source = [
			"jobs:",
			"  test:",
			"    strategy:",
			"      matrix: ${{ fromJSON(needs.prepare.outputs.matrix) }}",
		].join("\n");

		expect(inspectWorkflow(source)).toEqual([
			{
				job: "test",
				axes: {},
				baseCells: null,
				excludeRules: 0,
				includeEntries: 0,
				dynamic: true,
			},
		]);
	});

	it("flags runtime expressions nested inside matrix arrays", () => {
		const source = [
			"jobs:",
			"  test:",
			"    strategy:",
			"      matrix:",
			"        os: [ubuntu, windows]",
			"        node: [20, '${{ inputs.node }}']",
		].join("\n");

		expect(inspectWorkflow(source)).toEqual([
			{
				job: "test",
				axes: { os: 2, node: 2 },
				baseCells: null,
				excludeRules: 0,
				includeEntries: 0,
				dynamic: true,
			},
		]);
	});
});
