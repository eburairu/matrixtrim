import { describe, expect, it } from "vitest";
import type { AnalysisReport } from "../src/analyze.js";
import { recommendHistoryOnly } from "../src/recommend.js";

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
        runsObserved: 5,
        observations: 2,
        distinctFailures: 2,
        uniqueFailures: 0,
        medianRuntimeSeconds: 10,
      },
      {
        cell: "test (fast-a)",
        baseJob: "test",
        runsObserved: 5,
        observations: 1,
        distinctFailures: 1,
        uniqueFailures: 0,
        medianRuntimeSeconds: 3,
      },
      {
        cell: "test (fast-b)",
        baseJob: "test",
        runsObserved: 5,
        observations: 1,
        distinctFailures: 1,
        uniqueFailures: 0,
        medianRuntimeSeconds: 3,
      },
      {
        cell: "lint (node22)",
        baseJob: "lint",
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
    const recommendation = recommendHistoryOnly(report());

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
});
