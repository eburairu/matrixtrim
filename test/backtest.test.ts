import { describe, expect, it } from "vitest";
import type { AnalysisReport } from "../src/analyze.js";
import { backtestHistoryOnly } from "../src/backtest.js";

function makeReport(): AnalysisReport {
  return {
    repository: "owner/repo",
    workflow: "ci.yml",
    runsAnalyzed: 4,
    failedJobs: 4,
    ignoredNonMatrixJobs: 0,
    fingerprints: 3,
    logErrors: 0,
    expiredLogs: 0,
    cells: [
      {
        cell: "test (a)", baseJob: "test", runsObserved: 4, observations: 2,
        distinctFailures: 2, uniqueFailures: 1, medianRuntimeSeconds: 1,
      },
      {
        cell: "test (b)", baseJob: "test", runsObserved: 4, observations: 2,
        distinctFailures: 2, uniqueFailures: 1, medianRuntimeSeconds: 2,
      },
    ],
    clusters: [
      { fingerprint: "f1", signature: ["Error: f1"], cells: ["test (a)", "test (b)"], observations: 2 },
      { fingerprint: "f2", signature: ["Error: f2"], cells: ["test (b)"], observations: 1 },
      { fingerprint: "f3", signature: ["Error: f3"], cells: ["test (a)"], observations: 1 },
    ],
    observations: [
      { runId: 1, runNumber: 1, jobId: 1, cell: "test (a)", baseJob: "test", fingerprint: "f1", signature: ["Error: f1"], evidence: [] },
      { runId: 1, runNumber: 1, jobId: 2, cell: "test (b)", baseJob: "test", fingerprint: "f1", signature: ["Error: f1"], evidence: [] },
      { runId: 3, runNumber: 3, jobId: 3, cell: "test (b)", baseJob: "test", fingerprint: "f2", signature: ["Error: f2"], evidence: [] },
      { runId: 4, runNumber: 4, jobId: 4, cell: "test (a)", baseJob: "test", fingerprint: "f3", signature: ["Error: f3"], evidence: [] },
    ],
  };
}

describe("time holdout backtest", () => {
  it("measures whether training-selected cells catch newer failures", () => {
    const result = backtestHistoryOnly(makeReport(), 50);

    expect(result.trainingRuns).toBe(1);
    expect(result.holdoutRuns).toBe(2);
    expect(result.selectedCells).toEqual(["test (a)"]);
    expect(result.holdoutFingerprints).toBe(2);
    expect(result.coveredHoldoutFingerprints).toBe(1);
    expect(result.holdoutRecall).toBe(0.5);
    expect(result.unseenHoldoutFingerprints).toBe(2);
    expect(result.unseenHoldoutRecall).toBe(0.5);
    expect(result.missed).toHaveLength(1);
    expect(result.missed[0]?.fingerprint).toBe("f2");
  });
});
