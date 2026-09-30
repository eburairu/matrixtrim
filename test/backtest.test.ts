import { describe, expect, it } from "vitest";
import type { AnalysisReport } from "../src/analyze.js";
import { backtestRecommendation } from "../src/backtest.js";

function makeReport(): AnalysisReport {
  return {
    repository: "owner/repo",
    workflow: "ci.yml",
    workflowPath: ".github/workflows/ci.yml",
    runsAnalyzed: 4,
    failedJobs: 4,
    ignoredNonMatrixJobs: 0,
    fingerprints: 3,
    logErrors: 0,
    expiredLogs: 0,
    cells: [
      {
        cell: "test (a)", baseJob: "test", axes: { env: "a" },
        axisSource: "workflow-job-name", runsObserved: 4,
        successRuns: 3, failureRuns: 1, otherRuns: 0, observations: 2,
        distinctFailures: 2, uniqueFailures: 1, medianRuntimeSeconds: 1,
      },
      {
        cell: "test (b)", baseJob: "test", axes: { env: "b" },
        axisSource: "workflow-job-name", runsObserved: 4,
        successRuns: 2, failureRuns: 2, otherRuns: 0, observations: 2,
        distinctFailures: 2, uniqueFailures: 1, medianRuntimeSeconds: 2,
      },
    ],
    clusters: [
      { fingerprint: "f1", signature: ["Error: f1"], cells: ["test (a)", "test (b)"], observations: 2 },
      { fingerprint: "f2", signature: ["Error: f2"], cells: ["test (b)"], observations: 1 },
      { fingerprint: "f3", signature: ["Error: f3"], cells: ["test (a)"], observations: 1 },
    ],
    observations: [
      { runId: 1, runNumber: 1, jobId: 11, cell: "test (a)", baseJob: "test", fingerprint: "f1", signature: ["Error: f1"], evidence: [] },
      { runId: 1, runNumber: 1, jobId: 12, cell: "test (b)", baseJob: "test", fingerprint: "f1", signature: ["Error: f1"], evidence: [] },
      { runId: 3, runNumber: 3, jobId: 31, cell: "test (b)", baseJob: "test", fingerprint: "f2", signature: ["Error: f2"], evidence: [] },
      { runId: 4, runNumber: 4, jobId: 41, cell: "test (a)", baseJob: "test", fingerprint: "f3", signature: ["Error: f3"], evidence: [] },
    ],
    matrixJobs: [
      { runId: 1, runNumber: 1, jobId: 11, cell: "test (a)", baseJob: "test", axes: { env: "a" }, axisSource: "workflow-job-name", conclusion: "failure", runtimeSeconds: 1 },
      { runId: 1, runNumber: 1, jobId: 12, cell: "test (b)", baseJob: "test", axes: { env: "b" }, axisSource: "workflow-job-name", conclusion: "failure", runtimeSeconds: 2 },
      { runId: 2, runNumber: 2, jobId: 21, cell: "test (a)", baseJob: "test", axes: { env: "a" }, axisSource: "workflow-job-name", conclusion: "success", runtimeSeconds: 1 },
      { runId: 2, runNumber: 2, jobId: 22, cell: "test (b)", baseJob: "test", axes: { env: "b" }, axisSource: "workflow-job-name", conclusion: "success", runtimeSeconds: 2 },
      { runId: 3, runNumber: 3, jobId: 31, cell: "test (b)", baseJob: "test", axes: { env: "b" }, axisSource: "workflow-job-name", conclusion: "failure", runtimeSeconds: 2 },
      { runId: 3, runNumber: 3, jobId: 32, cell: "test (a)", baseJob: "test", axes: { env: "a" }, axisSource: "workflow-job-name", conclusion: "success", runtimeSeconds: 100 },
      { runId: 4, runNumber: 4, jobId: 41, cell: "test (a)", baseJob: "test", axes: { env: "a" }, axisSource: "workflow-job-name", conclusion: "failure", runtimeSeconds: 100 },
      { runId: 4, runNumber: 4, jobId: 42, cell: "test (b)", baseJob: "test", axes: { env: "b" }, axisSource: "workflow-job-name", conclusion: "success", runtimeSeconds: 1 },
    ],
  };
}

describe("time holdout backtest", () => {
  it("selects using only training-window runtimes and tests newer failures", () => {
    const result = backtestRecommendation(makeReport(), 50);

    expect(result.trainingRuns).toBe(2);
    expect(result.holdoutRuns).toBe(2);
    expect(result.coverageStrength).toBe(2);
    expect(result.selectedCells.sort()).toEqual(["test (a)", "test (b)"]);
    expect(result.holdoutFingerprints).toBe(2);
    expect(result.coveredHoldoutFingerprints).toBe(2);
    expect(result.holdoutRecall).toBe(1);
    expect(result.unseenHoldoutFingerprints).toBe(2);
    expect(result.unseenHoldoutRecall).toBe(1);
    expect(result.holdoutCombinatorialRequirements).toBe(2);
    expect(result.coveredHoldoutCombinatorialRequirements).toBe(2);
    expect(result.holdoutCombinatorialCoverage).toBe(1);
    expect(result.missed).toHaveLength(0);
  });

  it("applies the same explicit constraints to the training recommendation", () => {
    const result = backtestRecommendation(
      makeReport(),
      50,
      2,
      {
        keep: ["test (a)"],
        require: [],
      },
    );

    expect(result.selectedCells).toContain("test (a)");
    expect(result.warnings.join("\n")).toContain(
      "Applied 1 explicit hard constraint",
    );
  });
});
