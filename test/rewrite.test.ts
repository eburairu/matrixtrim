import { describe, expect, it } from "vitest";
import { rewriteWorkflowToSelectedCells } from "../src/rewrite.js";
import { workflowMatrixDefinitions } from "../src/axes.js";

describe("workflow rewrite", () => {
  it("replaces a static cartesian matrix with explicit selected include rows", () => {
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
      { jobId: "test", beforeCells: 4, afterCells: 2 },
    ]);
    expect(result.workflow).toContain("fail-fast: false");

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

    const result = rewriteWorkflowToSelectedCells(
      workflow,
      observed,
      ["Windows"],
    );

    expect(result.workflow).toContain("experimental: true");
    expect(result.workflow).toContain("name: Windows");
    expect(workflowMatrixDefinitions(result.workflow)[0]!.cells).toHaveLength(1);
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
      rewriteWorkflowToSelectedCells(
        workflow,
        ["test (20)"],
        ["test (20)"],
      )
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
      )
    ).toThrow(/historical cell/);
  });
});
