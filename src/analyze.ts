import { fingerprintFailure } from "./fingerprint.js";
import { GitHubClient, GitHubHttpError, type WorkflowRun } from "./github.js";
import {
  inferAxesFromExpandedJobName,
  workflowMatrixDefinitions,
  type MatrixDefinition,
} from "./axes.js";

export type FailureObservation = {
  runId: number;
  runNumber: number;
  jobId: number;
  cell: string;
  baseJob: string;
  fingerprint: string;
  signature: string[];
  evidence: string[];
};

export type MatrixJobObservation = {
  runId: number;
  runNumber: number;
  jobId: number;
  cell: string;
  baseJob: string;
  axes: Record<string, string> | null;
  axisSource: "workflow-job-name" | "unavailable";
  conclusion: string | null;
  runtimeSeconds: number | null;
};

export type CellSummary = {
  cell: string;
  baseJob: string;
  axes: Record<string, string> | null;
  axisSource: "workflow-job-name" | "unavailable";
  runsObserved: number;
  successRuns: number;
  failureRuns: number;
  otherRuns: number;
  observations: number;
  distinctFailures: number;
  uniqueFailures: number;
  medianRuntimeSeconds: number | null;
};

export type FailureCluster = {
  fingerprint: string;
  signature: string[];
  cells: string[];
  observations: number;
};

export type AnalysisReport = {
  repository: string;
  workflow?: string;
  workflowPath?: string;
  runsAnalyzed: number;
  failedJobs: number;
  ignoredNonMatrixJobs: number;
  fingerprints: number;
  logErrors: number;
  expiredLogs: number;
  cells: CellSummary[];
  clusters: FailureCluster[];
  observations: FailureObservation[];
  matrixJobs: MatrixJobObservation[];
};

function splitJobName(
  name: string,
): { baseJob: string; cell: string; matrixLike: boolean } {
  const match = name.match(/^(.*?)\s+\((.+)\)$/);
  return match
    ? { baseJob: match[1]!.trim(), cell: name, matrixLike: true }
    : { baseJob: name, cell: name, matrixLike: false };
}

function durationSeconds(
  startedAt: string | null,
  completedAt: string | null,
): number | null {
  if (!startedAt || !completedAt) return null;
  const value = (Date.parse(completedAt) - Date.parse(startedAt)) / 1000;
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

async function mapLimit<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]!, index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

function knownMatrixBase(
  baseJob: string,
  definitions: MatrixDefinition[],
): boolean {
  if (!definitions.length) return true;
  return definitions.some(
    (definition) =>
      definition.displayName === baseJob || definition.jobId === baseJob,
  );
}

export function summarizeCells(
  matrixJobs: MatrixJobObservation[],
  observations: FailureObservation[],
): CellSummary[] {
  const byFingerprint = new Map<string, FailureObservation[]>();
  const byCellFailure = new Map<string, FailureObservation[]>();

  for (const item of observations) {
    const cluster = byFingerprint.get(item.fingerprint) ?? [];
    cluster.push(item);
    byFingerprint.set(item.fingerprint, cluster);

    const failures = byCellFailure.get(item.cell) ?? [];
    failures.push(item);
    byCellFailure.set(item.cell, failures);
  }

  const matrixByCell = new Map<
    string,
    {
      baseJob: string;
      axes: Record<string, string> | null;
      axisSource: "workflow-job-name" | "unavailable";
      runs: Set<number>;
      successRuns: Set<number>;
      failureRuns: Set<number>;
      otherRuns: Set<number>;
      runtimes: number[];
    }
  >();

  for (const item of matrixJobs) {
    const entry = matrixByCell.get(item.cell) ?? {
      baseJob: item.baseJob,
      axes: item.axes,
      axisSource: item.axisSource,
      runs: new Set<number>(),
      successRuns: new Set<number>(),
      failureRuns: new Set<number>(),
      otherRuns: new Set<number>(),
      runtimes: [],
    };

    entry.runs.add(item.runId);
    if (item.conclusion === "success") {
      entry.successRuns.add(item.runId);
    } else if (["failure", "timed_out"].includes(item.conclusion ?? "")) {
      entry.failureRuns.add(item.runId);
    } else {
      entry.otherRuns.add(item.runId);
    }
    if (item.runtimeSeconds !== null) entry.runtimes.push(item.runtimeSeconds);

    if (entry.axisSource === "unavailable" && item.axisSource !== "unavailable") {
      entry.axes = item.axes;
      entry.axisSource = item.axisSource;
    }
    matrixByCell.set(item.cell, entry);
  }

  for (const item of observations) {
    if (!matrixByCell.has(item.cell)) {
      matrixByCell.set(item.cell, {
        baseJob: item.baseJob,
        axes: null,
        axisSource: "unavailable",
        runs: new Set([item.runId]),
        successRuns: new Set(),
        failureRuns: new Set([item.runId]),
        otherRuns: new Set(),
        runtimes: [],
      });
    }
  }

  return [...matrixByCell.entries()].map(([cell, meta]) => {
    const items = byCellFailure.get(cell) ?? [];
    const fingerprints = new Set(items.map((item) => item.fingerprint));
    return {
      cell,
      baseJob: meta.baseJob,
      axes: meta.axes,
      axisSource: meta.axisSource,
      runsObserved: meta.runs.size,
      successRuns: meta.successRuns.size,
      failureRuns: meta.failureRuns.size,
      otherRuns: meta.otherRuns.size,
      observations: items.length,
      distinctFailures: fingerprints.size,
      uniqueFailures: [...fingerprints].filter(
        (fingerprint) =>
          byFingerprint.get(fingerprint)?.every((item) => item.cell === cell),
      ).length,
      medianRuntimeSeconds: median(meta.runtimes),
    };
  }).sort((a, b) =>
    b.uniqueFailures - a.uniqueFailures ||
    b.distinctFailures - a.distinctFailures ||
    a.cell.localeCompare(b.cell)
  );
}

export async function analyzeRepository(
  repository: string,
  options: {
    limit: number;
    workflow?: string;
    token?: string;
    runId?: number;
    concurrency?: number;
  },
): Promise<AnalysisReport> {
  const client = new GitHubClient(repository, options.token);
  const runs: WorkflowRun[] = options.runId
    ? [await client.getRun(options.runId)]
    : await client.listRuns(options.limit, options.workflow);
  const concurrency = options.concurrency ?? 4;

  let workflowPath: string | undefined;
  let definitions: MatrixDefinition[] = [];
  const workflowPaths = [...new Set(runs.map((run) => run.path).filter(Boolean))];
  if (workflowPaths.length === 1 && runs[0]) {
    workflowPath = workflowPaths[0];
    try {
      const workflowText = await client.fileText(workflowPath, runs[0].head_sha);
      definitions = workflowMatrixDefinitions(workflowText);
    } catch {
      definitions = [];
    }
  }

  // Job metadata is intentionally fetched for every completed run, including
  // successful runs. Failure logs are downloaded only for failed matrix jobs.
  const jobsByRun = await mapLimit(runs, concurrency, async (run) => ({
    run,
    jobs: await client.listJobs(run.id),
  }));

  const matrixJobs: MatrixJobObservation[] = [];
  const matrixJobIds = new Set<number>();

  for (const { run, jobs } of jobsByRun) {
    for (const job of jobs) {
      const parsed = splitJobName(job.name);
      if (!parsed.matrixLike || !knownMatrixBase(parsed.baseJob, definitions)) {
        continue;
      }
      const inferred = inferAxesFromExpandedJobName(job.name, definitions);
      matrixJobIds.add(job.id);
      matrixJobs.push({
        runId: run.id,
        runNumber: run.run_number,
        jobId: job.id,
        cell: parsed.cell,
        baseJob: parsed.baseJob,
        axes: inferred.axes,
        axisSource: inferred.source,
        conclusion: job.conclusion,
        runtimeSeconds: durationSeconds(job.started_at, job.completed_at),
      });
    }
  }

  const allFailedJobs = jobsByRun.flatMap(({ run, jobs }) =>
    jobs
      .filter((job) => ["failure", "timed_out"].includes(job.conclusion ?? ""))
      .map((job) => ({ run, job })),
  );
  const failed = allFailedJobs.filter(({ job }) => matrixJobIds.has(job.id));
  const ignoredNonMatrixJobs = allFailedJobs.length - failed.length;

  let logErrors = 0;
  let expiredLogs = 0;

  const observations = (
    await mapLimit(failed, concurrency, async ({ run, job }) => {
      try {
        const log = await client.jobLog(job.id);
        const fingerprint = fingerprintFailure(log);
        const { baseJob, cell } = splitJobName(job.name);
        return {
          runId: run.id,
          runNumber: run.run_number,
          jobId: job.id,
          cell,
          baseJob,
          fingerprint: fingerprint.id,
          signature: fingerprint.signature,
          evidence: fingerprint.evidence,
        } satisfies FailureObservation;
      } catch (error) {
        if (error instanceof GitHubHttpError && error.status === 410) {
          expiredLogs++;
        } else {
          logErrors++;
        }
        return null;
      }
    })
  ).filter((item): item is FailureObservation => item !== null);

  const byFingerprint = new Map<string, FailureObservation[]>();
  for (const item of observations) {
    const cluster = byFingerprint.get(item.fingerprint) ?? [];
    cluster.push(item);
    byFingerprint.set(item.fingerprint, cluster);
  }

  const clusters = [...byFingerprint.entries()]
    .map(([fingerprint, items]) => ({
      fingerprint,
      signature: items[0]!.signature,
      cells: [...new Set(items.map((item) => item.cell))].sort(),
      observations: items.length,
    }))
    .sort((a, b) =>
      b.cells.length - a.cells.length ||
      b.observations - a.observations ||
      a.fingerprint.localeCompare(b.fingerprint)
    );

  const cells = summarizeCells(matrixJobs, observations);

  return {
    repository,
    workflow: options.workflow,
    workflowPath,
    runsAnalyzed: runs.length,
    failedJobs: failed.length,
    ignoredNonMatrixJobs,
    fingerprints: byFingerprint.size,
    logErrors,
    expiredLogs,
    cells,
    clusters,
    observations,
    matrixJobs,
  };
}
