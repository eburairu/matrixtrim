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
