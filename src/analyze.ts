import { fingerprintFailure } from "./fingerprint.js";
import { GitHubClient, GitHubHttpError, type WorkflowRun } from "./github.js";

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

export type CellSummary = {
  cell: string;
  baseJob: string;
  runsObserved: number;
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
  runsAnalyzed: number;
  failedJobs: number;
  ignoredNonMatrixJobs: number;
  fingerprints: number;
  logErrors: number;
  expiredLogs: number;
  cells: CellSummary[];
  clusters: FailureCluster[];
  observations: FailureObservation[];
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

  const interestingRuns = runs.filter(
    (run) => !["success", "cancelled", "skipped"].includes(run.conclusion ?? ""),
  );
  const concurrency = options.concurrency ?? 4;

  const jobsByRun = await mapLimit(interestingRuns, concurrency, async (run) => ({
    run,
    jobs: await client.listJobs(run.id),
  }));

  const matrixJobs = jobsByRun.flatMap(({ run, jobs }) => {
    const parsed = jobs.map((job) => ({ job, parsed: splitJobName(job.name) }));
    const matrixBases = new Set(
      parsed.filter(({ parsed }) => parsed.matrixLike).map(({ parsed }) => parsed.baseJob),
    );
    return parsed
      .filter(({ parsed }) => parsed.matrixLike && matrixBases.has(parsed.baseJob))
      .map(({ job, parsed }) => ({
        run,
        job,
        cell: parsed.cell,
        baseJob: parsed.baseJob,
        runtimeSeconds: durationSeconds(job.started_at, job.completed_at),
      }));
  });

  let ignoredNonMatrixJobs = 0;
  const failed = jobsByRun.flatMap(({ run, jobs }) => {
    const parsed = jobs.map((job) => ({ job, parsed: splitJobName(job.name) }));
    const matrixBases = new Set(
      parsed.filter(({ parsed }) => parsed.matrixLike).map(({ parsed }) => parsed.baseJob),
    );
    const failedJobs = parsed.filter(
      ({ job }) => ["failure", "timed_out"].includes(job.conclusion ?? ""),
    );

    if (!matrixBases.size) {
      return failedJobs.map(({ job }) => ({ run, job }));
    }

    const matrixFailures = failedJobs.filter(({ parsed }) =>
      matrixBases.has(parsed.baseJob),
    );
    ignoredNonMatrixJobs += failedJobs.length - matrixFailures.length;
    return matrixFailures.map(({ job }) => ({ run, job }));
  });

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
  const byCell = new Map<string, FailureObservation[]>();
  const matrixByCell = new Map<
    string,
    { baseJob: string; runs: Set<number>; runtimes: number[] }
  >();

  for (const item of matrixJobs) {
    const entry = matrixByCell.get(item.cell) ?? {
      baseJob: item.baseJob,
      runs: new Set<number>(),
      runtimes: [],
    };
    entry.runs.add(item.run.id);
    if (item.runtimeSeconds !== null) entry.runtimes.push(item.runtimeSeconds);
    matrixByCell.set(item.cell, entry);
  }

  for (const item of observations) {
    const cluster = byFingerprint.get(item.fingerprint) ?? [];
    cluster.push(item);
    byFingerprint.set(item.fingerprint, cluster);

    const cellItems = byCell.get(item.cell) ?? [];
    cellItems.push(item);
    byCell.set(item.cell, cellItems);

    if (!matrixByCell.has(item.cell)) {
      matrixByCell.set(item.cell, {
        baseJob: item.baseJob,
        runs: new Set([item.runId]),
        runtimes: [],
      });
    }
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

  const cells = [...matrixByCell.entries()].map(([cell, meta]) => {
    const items = byCell.get(cell) ?? [];
    const fingerprints = new Set(items.map((item) => item.fingerprint));
    return {
      cell,
      baseJob: meta.baseJob,
      runsObserved: meta.runs.size,
      observations: items.length,
      distinctFailures: fingerprints.size,
      uniqueFailures: [...fingerprints].filter(
        (fingerprint) => byFingerprint.get(fingerprint)?.every((item) => item.cell === cell),
      ).length,
      medianRuntimeSeconds: median(meta.runtimes),
    };
  }).sort((a, b) =>
    b.uniqueFailures - a.uniqueFailures ||
    b.distinctFailures - a.distinctFailures ||
    a.cell.localeCompare(b.cell)
  );

  return {
    repository,
    workflow: options.workflow,
    runsAnalyzed: runs.length,
    failedJobs: failed.length,
    ignoredNonMatrixJobs,
    fingerprints: byFingerprint.size,
    logErrors,
    expiredLogs,
    cells,
    clusters,
    observations,
  };
}
