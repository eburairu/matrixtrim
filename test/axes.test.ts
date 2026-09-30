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

  it("recovers axes from custom names for whole dynamic matrices", () => {
    const workflow = [
      "jobs:",
      "  prepare:",
      "    runs-on: ubuntu-latest",
      "  test:",
      '    name: "Test ${{ matrix.os }} / Node ${{ matrix.node }}"',
      "    needs: prepare",
      "    strategy:",
      "      matrix: ${{ fromJSON(needs.prepare.outputs.matrix) }}",
    ].join("\n");

    const definitions = workflowMatrixDefinitions(workflow);
    expect(definitions).toHaveLength(1);
    expect(definitions[0]).toMatchObject({
      jobId: "test",
      dynamic: true,
      axes: ["os", "node"],
      expectedCells: 0,
    });
    expect(inferAxesFromExpandedJobName("Test windows / Node 22", definitions))
      .toEqual({
        baseJob: "test",
        axes: { os: "windows", node: "22" },
        source: "workflow-rendered-name",
      });
  });

  it("marks dynamic jobs with an explicit capture-evidence step", () => {
    const workflow = [
      "jobs:",
      "  test:",
      "    name: opaque runtime cell",
      "    strategy:",
      "      matrix: ${{ fromJSON(needs.prepare.outputs.matrix) }}",
      "    steps:",
      "      - uses: eburairu/matrixtrim@v0",
      "        with:",
      "          mode: capture",
      "          matrix: ${{ toJSON(matrix) }}",
    ].join("\n");

    const definitions = workflowMatrixDefinitions(workflow);
    const [definition] = definitions;
    expect(definition).toMatchObject({
      jobId: "test",
      dynamic: true,
      captureEvidence: true,
    });
    expect(inferAxesFromExpandedJobName("test (node22, safe)", definitions))
      .toMatchObject({
        baseJob: "test",
        axes: null,
        source: "unavailable",
      });
  });

  it("recovers observed values from mixed literal/runtime axis arrays", () => {
    const workflow = [
      "jobs:",
      "  test:",
      "    name: Test io_uring on Linux ${{ matrix.kernel_version }}",
      "    strategy:",
      "      matrix:",
      "        kernel_version:",
      "          - ${{ needs.prepare.outputs.kernel_version }}",
      "          - '4.19.325'",
    ].join("\n");

    const definitions = workflowMatrixDefinitions(workflow);
    expect(definitions[0]).toMatchObject({
      jobId: "test",
      dynamic: true,
      axes: ["kernel_version"],
      expectedCells: 0,
    });
    expect(inferAxesFromExpandedJobName(
      "Test io_uring on Linux 7.2.8 / build",
      definitions,
    )).toEqual({
      baseJob: "test",
      axes: { kernel_version: "7.2.8" },
      source: "workflow-rendered-name",
    });
  });

  it("recovers known axis order for partially dynamic matrices", () => {
    const workflow = [
      "jobs:",
      "  test:",
      "    strategy:",
      "      matrix:",
      "        os: [ubuntu, windows]",
      "        node: ${{ fromJSON(needs.prepare.outputs.nodes) }}",
    ].join("\n");

    const definitions = workflowMatrixDefinitions(workflow);
    expect(definitions[0]).toMatchObject({
      jobId: "test",
      dynamic: true,
      axes: ["os", "node"],
    });
    expect(inferAxesFromExpandedJobName("test (windows, 24)", definitions))
      .toEqual({
        baseJob: "test",
        axes: { os: "windows", node: "24" },
        source: "workflow-job-name",
      });
  });

  it("recovers dynamic axes from format() job names", () => {
    const workflow = [
      "jobs:",
      "  test:",
      "    name: ${{ format('Test {0} / {1}', matrix.os, matrix.python) }}",
      "    strategy:",
      "      matrix: ${{ fromJSON(needs.prepare.outputs.matrix) }}",
    ].join("\n");

    const definitions = workflowMatrixDefinitions(workflow);
    expect(inferAxesFromExpandedJobName("Test ubuntu / 3.13", definitions))
      .toEqual({
        baseJob: "test",
        axes: { os: "ubuntu", python: "3.13" },
        source: "workflow-rendered-name",
      });
  });

  it("treats runtime include expressions as dynamic without losing axis order", () => {
    const workflow = [
      "jobs:",
      "  test:",
      "    strategy:",
      "      matrix:",
      "        os: [ubuntu, windows]",
      "        node: [20, 22]",
      "        include: ${{ fromJSON(needs.prepare.outputs.extra) }}",
    ].join("\n");

    const definitions = workflowMatrixDefinitions(workflow);
    expect(definitions[0]).toMatchObject({
      jobId: "test",
      dynamic: true,
      axes: ["os", "node"],
      expectedCells: 0,
    });
    expect(inferAxesFromExpandedJobName("test (windows, 22)", definitions).axes)
      .toEqual({ os: "windows", node: "22" });
  });

  it("supports common GitHub expression functions in static job names", () => {
    const workflow = [
      "jobs:",
      "  test:",
      "    name: ${{ contains(matrix.os, 'win') && 'Windows' || 'Other' }}-${{ startsWith(matrix.node, '2') }}-${{ endsWith(matrix.node, '2') }}-${{ join(fromJSON(matrix.tags), '+') }}-${{ fromJSON(matrix.enabled) && 'on' || 'off' }}",
      "    strategy:",
      "      matrix:",
      "        os: [windows]",
      "        node: ['22']",
      "        tags: ['[\"fast\",\"unit\"]']",
      "        enabled: ['true']",
    ].join("\n");

    const [definition] = workflowMatrixDefinitions(workflow);
    expect(definition?.cells.map((cell) => cell.name)).toEqual([
      "Windows-true-true-fast+unit-on",
    ]);
  });

  it("supports relational operators, case(), and object filters", () => {
    const workflow = [
      "jobs:",
      "  test:",
      "    name: ${{ case(fromJSON(matrix.node) >= 22, join(matrix.target.variants.*.name, '+'), 'legacy') }}",
      "    strategy:",
      "      matrix:",
      "        node: ['22']",
      "        target:",
      "          - variants:",
      "              - {name: linux}",
      "              - {name: arm64}",
    ].join("\n");

    const [definition] = workflowMatrixDefinitions(workflow);
    expect(definition?.cells.map((cell) => cell.name)).toEqual([
      "linux+arm64",
    ]);
  });

  it("uses GitHub-style case-insensitive string equality and toJSON", () => {
    const workflow = [
      "jobs:",
      "  test:",
      "    name: ${{ matrix.os == 'WINDOWS' && toJSON(matrix.enabled) || 'no' }}",
      "    strategy:",
      "      matrix:",
      "        os: [windows]",
      "        enabled: [true]",
    ].join("\n");

    const [definition] = workflowMatrixDefinitions(workflow);
    expect(definition?.cells.map((cell) => cell.name)).toEqual(["true"]);
  });

  it("parses escaped single-quote and extended numeric literals", () => {
    const workflow = [
      "jobs:",
      "  test:",
      "    name: ${{ 0x10 == 16 && 1e2 >= 100 && 'It''s valid' || 'bad' }}",
      "    strategy:",
      "      matrix:",
      "        only: [one]",
    ].join("\n");

    const [definition] = workflowMatrixDefinitions(workflow);
    expect(definition?.cells.map((cell) => cell.name)).toEqual(["It's valid"]);
  });

  it("supports bracket matrix references", () => {
    const workflow = [
      "jobs:",
      "  test:",
      "    name: Python ${{ matrix['python-version'] }} on ${{ matrix[\"os\"] }}",
      "    strategy:",
      "      matrix:",
      "        python-version: ['3.13']",
      "        os: [ubuntu]",
    ].join("\n");

    const definitions = workflowMatrixDefinitions(workflow);
    expect(inferAxesFromExpandedJobName("Python 3.13 on ubuntu", definitions))
      .toEqual({
        baseJob: "test",
        axes: { "python-version": "3.13", os: "ubuntu" },
        source: "workflow-rendered-name",
      });
  });

  it("safely inverts a dynamic axis with a literal fallback", () => {
    const workflow = [
      "jobs:",
      "  test:",
      "    name: Runtime ${{ matrix.runtime || 'default' }}",
      "    strategy:",
      "      matrix: ${{ fromJSON(needs.prepare.outputs.matrix) }}",
    ].join("\n");

    const definitions = workflowMatrixDefinitions(workflow);
    expect(inferAxesFromExpandedJobName("Runtime node22", definitions)).toEqual({
      baseJob: "test",
      axes: { runtime: "node22" },
      source: "workflow-rendered-name",
    });
    expect(inferAxesFromExpandedJobName("Runtime default", definitions).axes)
      .toBeNull();
  });
});
