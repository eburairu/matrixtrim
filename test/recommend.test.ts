import { describe, expect, it } from "vitest";
import type { AnalysisReport } from "../src/analyze.js";
import { recommendMatrix } from "../src/recommend.js";

function report(): AnalysisReport {
  return {
    repository: "owner/repo",
    workflow: "ci.yml",
    runsAnalyzed: 10,
    failedJobs: 3,
    ignoredNonMatrixJobs: 0,
    fingerprints: 2,
    logErrors: 0,
    expiredLogs: 0,
    cells: [
      {
        cell: "test (all-in-one)",
        baseJob: "test",
        axes: { mode: "same" },
        axisSource: "workflow-job-name",
        runsObserved: 5,
        observations: 2,
        distinctFailures: 2,
        uniqueFailures: 0,
        medianRuntimeSeconds: 10,
      },
      {
        cell: "test (fast-a)",
        baseJob: "test",
        axes: { mode: "same" },
        axisSource: "workflow-job-name",
        runsObserved: 5,
        observations: 1,
        distinctFailures: 1,
        uniqueFailures: 0,
        medianRuntimeSeconds: 3,
      },
      {
        cell: "test (fast-b)",
        baseJob: "test",
        axes: { mode: "same" },
        axisSource: "workflow-job-name",
        runsObserved: 5,
        observations: 1,
        distinctFailures: 1,
        uniqueFailures: 0,
        medianRuntimeSeconds: 3,
      },
      {
        cell: "lint (node22)",
        baseJob: "lint",
        axes: { node: "22" },
        axisSource: "workflow-job-name",
        runsObserved: 5,
        observations: 0,
        distinctFailures: 0,
        uniqueFailures: 0,
        medianRuntimeSeconds: 1,
      },
    ],
    clusters: [
      {
        fingerprint: "f1",
        signature: ["Error: one"],
        cells: ["test (all-in-one)", "test (fast-a)"],
        observations: 2,
      },
      {
        fingerprint: "f2",
        signature: ["Error: two"],
        cells: ["test (all-in-one)", "test (fast-b)"],
        observations: 2,
      },
    ],
    observations: [
      {
        runId: 1,
        runNumber: 1,
        jobId: 1,
        cell: "test (all-in-one)",
        baseJob: "test",
        fingerprint: "f1",
        signature: ["Error: one"],
        evidence: ["Error: one"],
      },
      {
        runId: 1,
        runNumber: 1,
        jobId: 1,
        cell: "test (all-in-one)",
        baseJob: "test",
        fingerprint: "f2",
        signature: ["Error: two"],
        evidence: ["Error: two"],
      },
      {
        runId: 2,
        runNumber: 2,
        jobId: 2,
        cell: "test (fast-a)",
        baseJob: "test",
        fingerprint: "f1",
        signature: ["Error: one"],
        evidence: ["Error: one"],
      },
      {
        runId: 3,
        runNumber: 3,
        jobId: 3,
        cell: "test (fast-b)",
        baseJob: "test",
        fingerprint: "f2",
        signature: ["Error: two"],
        evidence: ["Error: two"],
      },
    ],
  };
}

describe("history-only recommendation", () => {
  it("keeps failure coverage and one cell per matrix job family", () => {
    const recommendation = recommendMatrix(report(), { maxStrength: 1 });

    expect(recommendation.selectedCells.map((cell) => cell.cell).sort()).toEqual([
      "lint (node22)",
      "test (fast-a)",
      "test (fast-b)",
    ]);
    expect(recommendation.historicalRecall).toBe(1);
    expect(recommendation.currentEstimatedSeconds).toBe(17);
    expect(recommendation.selectedEstimatedSeconds).toBe(7);
    expect(recommendation.estimatedComputeReductionPercent).toBeCloseTo(58.82, 1);
  });

  it("uses exact branch-and-bound by default when optimality is proven", () => {
    const recommendation = recommendMatrix(report(), { maxStrength: 1 });

    expect(recommendation.algorithm).toBe("exact-branch-and-bound");
    expect(recommendation.optimizerMode).toBe("auto");
    expect(recommendation.optimizerOptimal).toBe(true);
    expect(recommendation.optimizerSearchNodes).toBeGreaterThan(0);
    expect(recommendation.selectedObjectiveCost).toBeLessThanOrEqual(
      recommendation.greedyObjectiveCost,
    );
  });

  it("supports greedy-only mode", () => {
    const recommendation = recommendMatrix(report(), {
      maxStrength: 1,
      optimizer: "greedy",
    });

    expect(recommendation.algorithm).toBe("greedy-weighted-set-cover");
    expect(recommendation.optimizerOptimal).toBeNull();
    expect(recommendation.optimizerSearchNodes).toBe(0);
  });

  it("falls back in auto mode when exact search exceeds the node budget", () => {
    const recommendation = recommendMatrix(report(), {
      maxStrength: 1,
      optimizer: "auto",
      exactMaxNodes: 1,
    });

    expect(recommendation.algorithm).toBe("greedy-weighted-set-cover");
    expect(recommendation.optimizerOptimal).toBe(false);
    expect(recommendation.optimizerFallbackReason).toMatch(/node budget/);
    expect(recommendation.warnings.join("\n")).toMatch(/greedy fallback/);
  });

  it("fails exact mode rather than silently returning an unproven solution", () => {
    expect(() =>
      recommendMatrix(report(), {
        maxStrength: 1,
        optimizer: "exact",
        exactMaxNodes: 1,
      })
    ).toThrow(/before proving optimality/);
  });

  it("is stable when input cell order changes", () => {
    const original = recommendMatrix(report(), { maxStrength: 1 });
    const reversedInput = report();
    reversedInput.cells = [...reversedInput.cells].reverse();
    const reversed = recommendMatrix(reversedInput, { maxStrength: 1 });

    expect(reversed.selectedCells.map((cell) => cell.cell).sort()).toEqual(
      original.selectedCells.map((cell) => cell.cell).sort(),
    );
    expect(reversed.selectedEstimatedSeconds).toBe(
      original.selectedEstimatedSeconds,
    );
  });

  it("keeps an explicitly pinned cell even when it is more expensive", () => {
    const recommendation = recommendMatrix(report(), {
      maxStrength: 1,
      constraints: {
        keep: ["test (all-in-one)"],
        require: [],
      },
    });

    expect(recommendation.selectedCells.map((cell) => cell.cell)).toContain(
      "test (all-in-one)",
    );
    expect(recommendation.constraintRequirements).toBe(1);
    expect(recommendation.coveredConstraintRequirements).toBe(1);
    expect(recommendation.keptCells).toEqual(["test (all-in-one)"]);
  });

  it("requires a specific multi-axis compatibility combination", () => {
    const input = report();
    input.fingerprints = 0;
    input.clusters = [];
    input.observations = [];
    input.cells = [
      {
        cell: "test (linux, 20)",
        baseJob: "test",
        axes: { os: "linux", node: "20" },
        axisSource: "workflow-job-name",
        runsObserved: 5,
        observations: 0,
        distinctFailures: 0,
        uniqueFailures: 0,
        medianRuntimeSeconds: 1,
      },
      {
        cell: "test (linux, 22)",
        baseJob: "test",
        axes: { os: "linux", node: "22" },
        axisSource: "workflow-job-name",
        runsObserved: 5,
        observations: 0,
        distinctFailures: 0,
        uniqueFailures: 0,
        medianRuntimeSeconds: 1,
      },
      {
        cell: "test (windows, 20)",
        baseJob: "test",
        axes: { os: "windows", node: "20" },
        axisSource: "workflow-job-name",
        runsObserved: 5,
        observations: 0,
        distinctFailures: 0,
        uniqueFailures: 0,
        medianRuntimeSeconds: 1,
      },
      {
        cell: "test (windows, 22)",
        baseJob: "test",
        axes: { os: "windows", node: "22" },
        axisSource: "workflow-job-name",
        runsObserved: 5,
        observations: 0,
        distinctFailures: 0,
        uniqueFailures: 0,
        medianRuntimeSeconds: 100,
      },
    ];

    const unconstrained = recommendMatrix(input, { maxStrength: 1 });
    expect(
      unconstrained.selectedCells.map((cell) => cell.cell),
    ).not.toContain("test (windows, 22)");

    const constrained = recommendMatrix(input, {
      maxStrength: 1,
      constraints: {
        keep: [],
        require: [
          {
            baseJob: "test",
            axes: { os: "windows", node: "22" },
          },
        ],
      },
    });

    expect(constrained.selectedCells.map((cell) => cell.cell)).toContain(
      "test (windows, 22)",
    );
    expect(constrained.constraintRequirements).toBe(1);
    expect(constrained.coveredConstraintRequirements).toBe(1);
  });

  it("fails closed when an explicit constraint matches nothing", () => {
    expect(() =>
      recommendMatrix(report(), {
        maxStrength: 1,
        constraints: {
          keep: [],
          require: [{ axes: { os: "plan9" } }],
        },
      })
    ).toThrow(/matched no observed matrix cells/);

    expect(() =>
      recommendMatrix(report(), {
        maxStrength: 1,
        constraints: {
          keep: ["test (missing)"],
          require: [],
        },
      })
    ).toThrow(/unobserved matrix cell/);
  });

  it("retains every cell whose matrix axes cannot be resolved", () => {
    const input = report();
    input.cells.push({
      cell: "test custom-name",
      baseJob: "test",
      axes: null,
      axisSource: "unavailable",
      runsObserved: 5,
      observations: 0,
      distinctFailures: 0,
      uniqueFailures: 0,
      medianRuntimeSeconds: 2,
    });

    const recommendation = recommendMatrix(input, { maxStrength: 1 });

    expect(
      recommendation.selectedCells.map((cell) => cell.cell),
    ).toContain("test custom-name");
    expect(recommendation.warnings.join("\n")).toContain(
      "retained individually as a safety constraint",
    );
  });
});
