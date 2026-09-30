import { describe, expect, it } from "vitest";
import {
  inferAxesFromExpandedJobName,
  workflowMatrixDefinitions,
} from "../src/axes.js";

describe("matrix axis inference", () => {
  it("maps default expanded job values to static workflow axis names", () => {
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
        baseJob: "test",
        axes: { os: "ubuntu-latest", node: "22" },
        source: "workflow-rendered-name",
      });
  });

  it("renders direct matrix expressions in custom job names", () => {
    const workflow = [
      "jobs:",
      "  tests:",
      '    name: "Python ${{ matrix.python-version }}"',
      "    strategy:",
      "      matrix:",
      '        python-version: ["3.12", "3.13"]',
    ].join("\n");

    const definitions = workflowMatrixDefinitions(workflow);
    expect(inferAxesFromExpandedJobName("Python 3.13", definitions))
      .toEqual({
        baseJob: "tests",
        axes: { "python-version": "3.13" },
        source: "workflow-rendered-name",
      });
  });

  it("renders format() expressions with multiple axes", () => {
    const workflow = [
      "jobs:",
      "  test:",
      "    name: ${{ format('{0} {1}', matrix.os, matrix.python) }}",
      "    strategy:",
      "      matrix:",
      "        os: [ubuntu, windows]",
      "        python: [3.12, 3.13]",
    ].join("\n");

    const definitions = workflowMatrixDefinitions(workflow);
    expect(inferAxesFromExpandedJobName("windows 3.13", definitions))
      .toEqual({
        baseJob: "test",
        axes: { os: "windows", python: "3.13" },
        source: "workflow-rendered-name",
      });
  });

  it("supports fallback expressions and include-only matrices", () => {
    const workflow = [
      "jobs:",
      "  tests:",
      "    name: ${{ matrix.name || matrix.python }}",
      "    strategy:",
      "      matrix:",
      "        include:",
      "          - {python: '3.14'}",
      "          - {name: Windows, python: '3.14', os: windows-latest}",
      "          - {name: PyPy, python: 'pypy-3.11'}",
    ].join("\n");

    const definitions = workflowMatrixDefinitions(workflow);

    expect(inferAxesFromExpandedJobName("3.14", definitions).source)
      .toBe("workflow-rendered-name");
    expect(inferAxesFromExpandedJobName("Windows", definitions).axes)
      .toMatchObject({ name: "Windows", python: "3.14", os: "windows-latest" });
    expect(inferAxesFromExpandedJobName("PyPy", definitions).axes)
      .toMatchObject({ name: "PyPy", python: "pypy-3.11" });
  });

  it("renders nested matrix object values", () => {
    const workflow = [
      "jobs:",
      "  test:",
      "    name: Test ${{ matrix.platform.os }} / ${{ matrix.python }}",
      "    strategy:",
      "      matrix:",
      "        platform:",
      "          - {os: ubuntu-latest, arch: x64}",
      "          - {os: windows-latest, arch: x64}",
      "        python: [3.13, 3.14]",
    ].join("\n");

    const definitions = workflowMatrixDefinitions(workflow);
    const result = inferAxesFromExpandedJobName(
      "Test windows-latest / 3.14",
      definitions,
    );

    expect(result.baseJob).toBe("test");
    expect(result.source).toBe("workflow-rendered-name");
    expect(result.axes?.python).toBe("3.14");
    expect(result.axes?.platform).toContain("windows-latest");
  });

  it("matches reusable-workflow child jobs by caller matrix prefix", () => {
    const workflow = [
      "jobs:",
      "  test:",
      "    name: TS CI / Test / ubuntu",
      "    strategy:",
      "      matrix:",
      "        node: ['22.13.0', '24.0.0']",
      "        test_chunk: ['1', '2']",
      "    uses: ./.github/workflows/test.yml",
    ].join("\n");

    const definitions = workflowMatrixDefinitions(workflow);
    const result = inferAxesFromExpandedJobName(
      "TS CI / Test / ubuntu (24.0.0, 2) / Node 24 / chunk 2/2",
      definitions,
    );

    expect(result).toEqual({
      baseJob: "test",
      axes: { node: "24.0.0", test_chunk: "2" },
      source: "workflow-rendered-name",
    });
  });

  it("matches GitHub include semantics without merging standalone include rows", () => {
    const workflow = [
      "jobs:",
      "  test:",
      "    name: ${{ matrix.fruit }}-${{ matrix.animal || 'none' }}-${{ matrix.color || 'none' }}",
      "    strategy:",
      "      matrix:",
      "        fruit: [apple, pear]",
      "        animal: [cat, dog]",
      "        include:",
      "          - {color: green}",
      "          - {color: pink, animal: cat}",
      "          - {fruit: banana}",
      "          - {fruit: banana, animal: cat}",
    ].join("\n");

    const [definition] = workflowMatrixDefinitions(workflow);
    expect(definition?.expectedCells).toBe(6);
    expect(definition?.cells.map((cell) => cell.axes)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fruit: "banana" }),
        expect.objectContaining({ fruit: "banana", animal: "cat" }),
      ]),
    );
  });

  it("applies exclude before include expansion", () => {
    const workflow = [
      "jobs:",
      "  test:",
      "    strategy:",
      "      matrix:",
      "        os: [ubuntu, windows]",
      "        node: [20, 22]",
      "        exclude:",
      "          - {os: windows, node: 20}",
    ].join("\n");

    const [definition] = workflowMatrixDefinitions(workflow);
    expect(definition?.expectedCells).toBe(3);
    expect(definition?.renderedCells).toBe(3);
    expect(definition?.cells.map((cell) => cell.name)).not.toContain(
      "test (windows, 20)",
    );
  });

  it("evaluates equality and boolean operators in rendered job names", () => {
    const workflow = [
      "jobs:",
      "  build:",
      "    name: Build ${{ matrix.os }} (${{ matrix.target }}${{ matrix.os == 'linux' && format(' - {0}', matrix.manylinux == 'auto' && 'manylinux' || matrix.manylinux) || '' }})",
      "    strategy:",
      "      matrix:",
      "        os: [linux]",
      "        target: [undefined]",
      "        manylinux: [auto]",
      "        include:",
      "          - {os: linux, target: i686, manylinux: auto}",
      "          - {os: linux, target: x86_64, manylinux: musllinux_1_1}",
      "        exclude:",
      "          - {target: undefined}",
    ].join("\n");

    const definitions = workflowMatrixDefinitions(workflow);
    expect(definitions[0]?.cells.map((cell) => cell.name)).toEqual([
      "Build linux (i686 - manylinux)",
      "Build linux (x86_64 - musllinux_1_1)",
    ]);
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
