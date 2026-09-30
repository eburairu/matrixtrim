import { describe, expect, it } from "vitest";
import {
  inferAxesFromExpandedJobName,
  workflowMatrixDefinitions,
} from "../src/axes.js";

describe("matrix axis inference", () => {
  it("maps expanded job values to static workflow axis names", () => {
    const workflow = [
      "jobs:",
      "  test:",
      "    name: Test",
      "    strategy:",
      "      matrix:",
      "        os: [ubuntu-latest, windows-latest]",
      "        node: [20, 22]",
    ].join("\n");

    const definitions = workflowMatrixDefinitions(workflow);
    expect(inferAxesFromExpandedJobName("Test (ubuntu-latest, 22)", definitions))
      .toEqual({
        baseJob: "Test",
        axes: { os: "ubuntu-latest", node: "22" },
        source: "workflow-job-name",
      });
  });

  it("keeps one-axis matrix values intact", () => {
    const workflow = [
      "jobs:",
      "  build:",
      "    strategy:",
      "      matrix:",
      "        toxenv: [py311, py312]",
    ].join("\n");

    const definitions = workflowMatrixDefinitions(workflow);
    expect(inferAxesFromExpandedJobName("build (py311)", definitions).axes)
      .toEqual({ toxenv: "py311" });
  });

  it("does not guess dynamic matrices", () => {
    const workflow = [
      "jobs:",
      "  test:",
      "    strategy:",
      "      matrix: ${{ fromJSON(needs.prepare.outputs.matrix) }}",
    ].join("\n");

    const definitions = workflowMatrixDefinitions(workflow);
    expect(inferAxesFromExpandedJobName("test (ubuntu, 22)", definitions).axes)
      .toBeNull();
  });
});
