import {
  summarizeCells,
  type AnalysisReport,
  type FailureObservation,
} from "./analyze.js";
import { recommendHistoryOnly } from "./recommend.js";

export type MissedFailure = {
  fingerprint: string;
  signature: string[];
  detectingCells: string[];
  seenInTraining: boolean;
};

export type BacktestReport = {
  mode: "time-holdout";
  holdoutPercent: number;
  trainingRuns: number;
  holdoutRuns: number;
  selectedCells: string[];
  trainingFingerprints: number;
  holdoutFingerprints: number;
  coveredHoldoutFingerprints: number;
  holdoutRecall: number;
  unseenHoldoutFingerprints: number;
  coveredUnseenHoldoutFingerprints: number;
  unseenHoldoutRecall: number | null;
  missed: MissedFailure[];
  warnings: string[];
};

function clustersFor(observations: FailureObservation[]) {
  const byFingerprint = new Map<string, FailureObservation[]>();
  for (const item of observations) {
    const list = byFingerprint.get(item.fingerprint) ?? [];
    list.push(item);
    byFingerprint.set(item.fingerprint, list);
  }
  return [...byFingerprint.entries()].map(([fingerprint, items]) => ({
    fingerprint,
    signature: items[0]!.signature,
    cells: [...new Set(items.map((item) => item.cell))].sort(),
    observations: items.length,
  }));
}

function subsetReport(
  source: AnalysisReport,
  observations: FailureObservation[],
  runIds: Set<number>,
): AnalysisReport {
  const clusters = clustersFor(observations);
  const byFingerprint = new Map(
    clusters.map((cluster) => [cluster.fingerprint, new Set(cluster.cells)]),
  );
  const byCell = new Map<string, FailureObservation[]>();
  for (const item of observations) {
    const list = byCell.get(item.cell) ?? [];
    list.push(item);
    byCell.set(item.cell, list);
  }

  const matrixJobs = source.matrixJobs.filter((item) => runIds.has(item.runId));
  const cells = summarizeCells(matrixJobs, observations);

  return {
    ...source,
    runsAnalyzed: runIds.size,
    failedJobs: observations.length,
    fingerprints: clusters.length,
    cells,
    clusters,
    observations,
    matrixJobs,
  };
}

export function backtestHistoryOnly(
  report: AnalysisReport,
  holdoutPercent = 25,
): BacktestReport {
  if (holdoutPercent <= 0 || holdoutPercent >= 100) {
    throw new Error("holdoutPercent must be between 0 and 100");
  }

  const runs = [...new Map(
    report.matrixJobs.map((item) => [
      item.runId,
      { runId: item.runId, runNumber: item.runNumber },
    ]),
  ).values()].sort((a, b) => a.runNumber - b.runNumber || a.runId - b.runId);

  if (runs.length < 2) {
    throw new Error("backtest requires at least two completed matrix workflow runs");
  }

  const holdoutCount = Math.max(
    1,
    Math.min(runs.length - 1, Math.ceil(runs.length * holdoutPercent / 100)),
  );
  const split = runs.length - holdoutCount;
  const trainingRunIds = new Set(runs.slice(0, split).map((run) => run.runId));
  const holdoutRunIds = new Set(runs.slice(split).map((run) => run.runId));

  const training = report.observations.filter((item) => trainingRunIds.has(item.runId));
  const holdout = report.observations.filter((item) => holdoutRunIds.has(item.runId));
  if (!training.length || !holdout.length) {
    throw new Error("backtest split produced an empty training or holdout set");
  }

  const trainingReport = subsetReport(report, training, trainingRunIds);
  const recommendation = recommendHistoryOnly(trainingReport);
  const selected = new Set(recommendation.selectedCells.map((cell) => cell.cell));
  const trainingFingerprints = new Set(training.map((item) => item.fingerprint));
  const holdoutClusters = clustersFor(holdout);

  let covered = 0;
  let unseen = 0;
  let coveredUnseen = 0;
  const missed: MissedFailure[] = [];

  for (const cluster of holdoutClusters) {
    const detected = cluster.cells.some((cell) => selected.has(cell));
    const seenInTraining = trainingFingerprints.has(cluster.fingerprint);
    if (detected) covered++;
    if (!seenInTraining) {
      unseen++;
      if (detected) coveredUnseen++;
    }
    if (!detected) {
      missed.push({
        fingerprint: cluster.fingerprint,
        signature: cluster.signature,
        detectingCells: cluster.cells,
        seenInTraining,
      });
    }
  }

  const warnings = [
    "Backtesting uses only runs with analyzable failed job logs.",
    "Runtime costs for selection are computed from the training window only.",
    "Pairwise/t-wise matrix coverage is not enforced yet.",
  ];

  return {
    mode: "time-holdout",
    holdoutPercent,
    trainingRuns: trainingRunIds.size,
    holdoutRuns: holdoutRunIds.size,
    selectedCells: [...selected],
    trainingFingerprints: trainingFingerprints.size,
    holdoutFingerprints: holdoutClusters.length,
    coveredHoldoutFingerprints: covered,
    holdoutRecall: holdoutClusters.length ? covered / holdoutClusters.length : 0,
    unseenHoldoutFingerprints: unseen,
    coveredUnseenHoldoutFingerprints: coveredUnseen,
    unseenHoldoutRecall: unseen ? coveredUnseen / unseen : null,
    missed,
    warnings,
  };
}
