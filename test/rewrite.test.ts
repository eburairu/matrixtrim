import { describe, expect, it } from "vitest";
import { workflowMatrixDefinitions } from "../src/axes.js";
import { rewriteWorkflowToSelectedCells } from "../src/rewrite.js";

describe("workflow rewrite", () => {
	it("uses excludes when a sparse static selection is the smallest exact form", () => {
		const workflow = [
			"name: CI",
			"jobs:",
			"  test:",
			"    name: Test ${{ matrix.os }} / ${{ matrix.node }}",
			"    strategy:",
			"      fail-fast: false",
			"      matrix:",
			"        os: [ubuntu, windows]",
			"        node: [20, 22]",
			"    runs-on: ${{ matrix.os }}",
			"    steps:",
			"      - run: node --version",
			"",
		].join("\n");

		const definitions = workflowMatrixDefinitions(workflow);
		const observed = definitions[0]!.cells.map((cell) => cell.name);
		const selected = ["Test ubuntu / 20", "Test windows / 22"];

		const result = rewriteWorkflowToSelectedCells(workflow, observed, selected);

		expect(result.changed).toBe(true);
		expect(result.jobs).toEqual([
			{
				jobId: "test",
				beforeCells: 4,
				afterCells: 2,
				mode: "exclude",
			},
		]);
		expect(result.workflow).toContain("fail-fast: false");
		expect(result.workflow).toContain("exclude:");
		expect(result.workflow).not.toContain("include:");

		const after = workflowMatrixDefinitions(result.workflow);
		expect(after[0]!.cells.map((cell) => cell.name).sort()).toEqual(
			[...selected].sort(),
		);
	});

	it("preserves include-derived fields required by matrix expressions", () => {
		const workflow = [
			"jobs:",
			"  test:",
			"    name: ${{ matrix.name }}",
			"    strategy:",
			"      matrix:",
			"        os: [ubuntu, windows]",
			"        include:",
			"          - {os: ubuntu, name: Linux, experimental: false}",
			"          - {os: windows, name: Windows, experimental: true}",
			"    runs-on: ${{ matrix.os }}",
			"    continue-on-error: ${{ matrix.experimental }}",
			"",
		].join("\n");

		const definitions = workflowMatrixDefinitions(workflow);
		const observed = definitions[0]!.cells.map((cell) => cell.name);

		const result = rewriteWorkflowToSelectedCells(workflow, observed, [
			"Windows",
		]);

		expect(result.jobs[0]?.mode).toBe("explicit-include");
		expect(result.workflow).toContain("experimental: true");
		expect(result.workflow).toContain("name: Windows");
		expect(workflowMatrixDefinitions(result.workflow)[0]!.cells).toHaveLength(
			1,
		);
	});

	it("prunes unused axis values when that exactly represents the selection", () => {
		const workflow = [
			"jobs:",
			"  test:",
			"    name: Test ${{ matrix.os }} / ${{ matrix.node }}",
			"    strategy:",
			"      matrix:",
			"        os: [ubuntu, windows]",
			"        node: [20, 22]",
			"",
		].join("\n");

		const definitions = workflowMatrixDefinitions(workflow);
		const observed = definitions[0]!.cells.map((cell) => cell.name);
		const selected = ["Test ubuntu / 20", "Test ubuntu / 22"];
		const result = rewriteWorkflowToSelectedCells(workflow, observed, selected);

		expect(result.jobs[0]?.mode).toBe("axis-pruning");
		expect(result.workflow).toContain("os:");
		expect(result.workflow).not.toContain("windows");
		expect(
			workflowMatrixDefinitions(result.workflow)[0]!
				.cells.map((cell) => cell.name)
				.sort(),
		).toEqual([...selected].sort());
	});

	it("combines axis pruning with excludes for a compact exact rewrite", () => {
		const workflow = [
			"jobs:",
			"  test:",
			"    name: Test ${{ matrix.os }} / ${{ matrix.node }}",
			"    strategy:",
			"      matrix:",
			"        os: [ubuntu, windows, macos]",
			"        node: [20, 22, 24]",
			"",
		].join("\n");

		const definitions = workflowMatrixDefinitions(workflow);
		const observed = definitions[0]!.cells.map((cell) => cell.name);
		const selected = [
			"Test ubuntu / 20",
			"Test ubuntu / 22",
			"Test windows / 20",
		];
		const result = rewriteWorkflowToSelectedCells(workflow, observed, selected);

		expect(result.jobs[0]?.mode).toBe("axis-pruning+exclude");
		expect(result.workflow).not.toContain("macos");
		expect(result.workflow).not.toContain("24");
		expect(result.workflow).toContain("exclude:");
		expect(
			workflowMatrixDefinitions(result.workflow)[0]!
				.cells.map((cell) => cell.name)
				.sort(),
		).toEqual([...selected].sort());
	});

	it("refuses to mutate when the current workflow contains unobserved cells", () => {
		const workflow = [
			"jobs:",
			"  test:",
			"    strategy:",
			"      matrix:",
			"        node: [20, 22]",
			"",
		].join("\n");

		expect(() =>
			rewriteWorkflowToSelectedCells(workflow, ["test (20)"], ["test (20)"]),
		).toThrow(/were not observed/);
	});

	it("refuses recommendations containing cells absent from the current workflow", () => {
		const workflow = [
			"jobs:",
			"  test:",
			"    strategy:",
			"      matrix:",
			"        node: [20, 22]",
			"",
		].join("\n");

		expect(() =>
			rewriteWorkflowToSelectedCells(
				workflow,
				["test (20)", "test (22)"],
				["test (20)", "test (18)"],
			),
		).toThrow(/historical cell/);
	});
});
