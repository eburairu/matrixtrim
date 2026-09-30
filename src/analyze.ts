import { fingerprintFailures } from "./fingerprint.js";
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
  runConclusion?: string | null;
  jobId: number;
  cell: string;
  baseJob: string;
  axes: Record<string, string> | null;
  axisSource: "workflow-rendered-name" | "workflow-job-name" | "unavailable";
  conclusion: string | null;
  runtimeSeconds: number | null;
  runnerLabels?: string[];
};

export type CellSummary = {
  cell: string;
  baseJob: string;
  axes: Record<string, string> | null;
  axisSource: "workflow-rendered-name" | "workflow-job-name" | "unavailable";
  runsObserved: number;
  successRuns: number;
  failureRuns: number;
  otherRuns: number;
  observations: number;
  distinctFailures: number;
  uniqueFailures: number;
  medianRuntimeSeconds: number | null;
  runnerLabels?: string[];
};

export type FailureCluster = {
  fingerprint: string;
  signature: string[];
  cells: string[];
  observations: number;
};

export type AnalysisReport = {
  repository: string;
  repositoryVisibility?: "public" | "private" | "internal" | string;
  workflow?: string;
  workflowPath?: string;
  runsAnalyzed: number;
  failedJobs: number;
  ignoredNonMatrixJobs: number;
  fingerprints: number;
  logErrors: number;
  expiredLogs: number;
  workflowDefinitionFallbacks?: number;
  workflowDefinitionErrors?: number;
  workflowStaticDefinitionCells?: number;
  workflowRenderedDefinitionCells?: number;
  workflowRenderCoverage?: number | null;
  workflowExpectedMatrixCells?: number;
  workflowMatchedMatrixCells?: number;
  workflowMatchCoverage?: number | null;
  inactiveStaticMatrixFamilies?: number;
  dynamicMatrixDefinitions?: number;
  runWindowDays?: number | null;
  projectedRunsPer30Days?: number | null;
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

function isConclusiveConclusion(conclusion: string | null): boolean {
  return ["success", "failure", "timed_out", "neutral"].includes(
    conclusion ?? "",
  );
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
      axisSource: "workflow-rendered-name" | "workflow-job-name" | "unavailable";
      runs: Set<number>;
      successRuns: Set<number>;
      failureRuns: Set<number>;
      otherRuns: Set<number>;
      runtimes: number[];
      runnerLabelSets: Map<string, { labels: string[]; count: number }>;
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
      runtimes: [] as number[],
      runnerLabelSets: new Map<string, { labels: string[]; count: number }>(),
    };

    entry.runs.add(item.runId);
    if (item.conclusion === "success") {
      entry.successRuns.add(item.runId);
    } else if (["failure", "timed_out"].includes(item.conclusion ?? "")) {
      entry.failureRuns.add(item.runId);
    } else {
      entry.otherRuns.add(item.runId);
    }
    if (
      item.runtimeSeconds !== null &&
      isConclusiveConclusion(item.conclusion)
    ) {
      entry.runtimes.push(item.runtimeSeconds);
    }
    if (item.runnerLabels?.length) {
      const labels = [...item.runnerLabels].sort();
      const key = JSON.stringify(labels);
      const current = entry.runnerLabelSets.get(key);
      entry.runnerLabelSets.set(key, {
        labels,
        count: (current?.count ?? 0) + 1,
      });
    }

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
        otherRuns: new Set<number>(),
        runtimes: [] as number[],
        runnerLabelSets: new Map<string, { labels: string[]; count: number }>(),
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
      runnerLabels: [...meta.runnerLabelSets.values()]
        .sort((a, b) =>
          b.count - a.count ||
          JSON.stringify(a.labels).localeCompare(JSON.stringify(b.labels))
        )[0]?.labels ?? [],
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
    runIds?: number[];
    concurrency?: number;
  },
): Promise<AnalysisReport> {
  const client = new GitHubClient(repository, options.token);
  const concurrency = options.concurrency ?? 4;
  let repositoryVisibility: AnalysisReport["repositoryVisibility"];
  try {
    const info = await client.repositoryInfo();
    repositoryVisibility = info.visibility ?? (info.private ? "private" : "public");
  } catch {
    repositoryVisibility = undefined;
  }

  const runs: WorkflowRun[] = options.runIds?.length
    ? await mapLimit(options.runIds, concurrency, (runId) => client.getRun(runId))
    : options.runId
      ? [await client.getRun(options.runId)]
      : await client.listRuns(options.limit, options.workflow);

  let workflowPath: string | undefined;
  const workflowPaths = [...new Set(runs.map((run) => run.path).filter(Boolean))];
  if (workflowPaths.length === 1) {
    workflowPath = workflowPaths[0];
  }

  // Resolve the workflow definition at each run's own head SHA. Matrix shape
  // and job naming frequently change over time; applying today's workflow to
  // old job names can silently misclassify historical cells. Some PR/fork SHAs
  // cannot be read through the base repository contents API, so keep an
  // explicit default-branch fallback and report when it was required.
  const defaultDefinitionResults = await mapLimit(
    workflowPaths,
    concurrency,
    async (path) => {
      try {
        const workflowText = await client.fileText(path);
        return {
          path,
          ok: true,
          definitions: workflowMatrixDefinitions(workflowText),
        };
      } catch {
        return {
          path,
          ok: false,
          definitions: [] as MatrixDefinition[],
        };
      }
    },
  );
  const defaultDefinitionsByPath = new Map(
    defaultDefinitionResults.map((item) => [item.path, item]),
  );

  const definitionInputs = [...new Map(
    runs
      .filter((run) => run.path && run.head_sha)
      .map((run) => [`${run.path}@${run.head_sha}`, run]),
  ).values()];

  const definitionResults = await mapLimit(
    definitionInputs,
    concurrency,
    async (run) => {
      const key = `${run.path}@${run.head_sha}`;
      try {
        const workflowText = await client.fileText(run.path, run.head_sha);
        return {
          key,
          definitions: workflowMatrixDefinitions(workflowText),
          usedFallback: false,
          error: false,
        };
      } catch {
        const fallback = defaultDefinitionsByPath.get(run.path);
        if (fallback?.ok) {
          return {
            key,
            definitions: fallback.definitions,
            usedFallback: true,
            error: false,
          };
        }
        return {
          key,
          definitions: [] as MatrixDefinition[],
          usedFallback: false,
          error: true,
        };
      }
    },
  );
  const definitionsByRevision = new Map(
    definitionResults.map((item) => [item.key, item.definitions]),
  );
  const workflowDefinitionFallbacks = definitionResults.filter(
    (item) => item.usedFallback,
  ).length;
  const workflowDefinitionErrors = definitionResults.filter(
    (item) => item.error,
  ).length;
  const revisionDefinitions = definitionResults.flatMap(
    (item) => item.definitions,
  );
  const workflowStaticDefinitionCells = revisionDefinitions.reduce(
    (sum, definition) => sum + definition.expectedCells,
    0,
  );
  const workflowRenderedDefinitionCells = revisionDefinitions.reduce(
    (sum, definition) => sum + definition.renderedCells,
    0,
  );
  const workflowRenderCoverage = workflowStaticDefinitionCells
    ? workflowRenderedDefinitionCells / workflowStaticDefinitionCells
    : null;
  const dynamicMatrixDefinitions = revisionDefinitions.filter(
    (definition) => definition.dynamic,
  ).length;

  // Job metadata is intentionally fetched for every completed run, including
  // successful runs. Failure logs are downloaded only for failed matrix jobs.
  const jobsByRun = await mapLimit(runs, concurrency, async (run) => ({
    run,
    jobs: await client.listJobs(run.id),
  }));

  const matrixJobs: MatrixJobObservation[] = [];
  const matrixJobIds = new Set<number>();
  const matrixJobById = new Map<number, MatrixJobObservation>();
  let workflowExpectedMatrixCells = 0;
  let workflowMatchedMatrixCells = 0;
  let inactiveStaticMatrixFamilies = 0;

  for (const { run, jobs } of jobsByRun) {
    const definitions =
      definitionsByRevision.get(`${run.path}@${run.head_sha}`) ?? [];

    if (isConclusiveConclusion(run.conclusion)) {
      for (const definition of definitions) {
        if (definition.dynamic) continue;

        const matched = definition.cells.filter((cell) =>
          jobs.some(
            (job) =>
              job.name === cell.name ||
              job.name.startsWith(`${cell.name} / `),
          ),
        ).length;

        if (matched === 0) {
          inactiveStaticMatrixFamilies++;
          continue;
        }

        workflowExpectedMatrixCells += definition.expectedCells;
        workflowMatchedMatrixCells += matched;
      }
    }

    for (const job of jobs) {
      const parsed = splitJobName(job.name);
      const inferred = inferAxesFromExpandedJobName(job.name, definitions);
      const renderedMatch = inferred.source !== "unavailable";
      const defaultNameFallback =
        parsed.matrixLike && knownMatrixBase(parsed.baseJob, definitions);

      if (!renderedMatch && !defaultNameFallback) {
        continue;
      }

      const observation: MatrixJobObservation = {
        runId: run.id,
        runNumber: run.run_number,
        runConclusion: run.conclusion,
        jobId: job.id,
        cell: job.name,
        baseJob: renderedMatch ? inferred.baseJob : parsed.baseJob,
        axes: inferred.axes,
        axisSource: inferred.source,
        conclusion: job.conclusion,
        runtimeSeconds: durationSeconds(job.started_at, job.completed_at),
        runnerLabels: job.labels ?? [],
      };

      matrixJobIds.add(job.id);
      matrixJobs.push(observation);
      matrixJobById.set(job.id, observation);
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
        const fingerprints = fingerprintFailures(log);
        const matrixJob = matrixJobById.get(job.id);
        if (!matrixJob) {
          throw new Error(`matrix job metadata missing for job ${job.id}`);
        }
        return fingerprints.map((fingerprint) => ({
          runId: run.id,
          runNumber: run.run_number,
          jobId: job.id,
          cell: matrixJob.cell,
          baseJob: matrixJob.baseJob,
          fingerprint: fingerprint.id,
          signature: fingerprint.signature,
          evidence: fingerprint.evidence,
        } satisfies FailureObservation));
      } catch (error) {
        if (error instanceof GitHubHttpError && error.status === 410) {
          expiredLogs++;
        } else {
          logErrors++;
        }
        return [] as FailureObservation[];
      }
    })
  ).flat();

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

  const conclusiveRunTimes = runs
    .filter((run) => isConclusiveConclusion(run.conclusion))
    .map((run) => Date.parse(run.created_at))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  const runWindowDays = conclusiveRunTimes.length >= 2
    ? (conclusiveRunTimes.at(-1)! - conclusiveRunTimes[0]!) /
      (24 * 60 * 60 * 1000)
    : null;
  const projectedRunsPer30Days =
    runWindowDays !== null && runWindowDays >= 7
      ? ((conclusiveRunTimes.length - 1) / runWindowDays) * 30
      : null;

  return {
    repository,
    repositoryVisibility,
    workflow: options.workflow,
    workflowPath,
    runsAnalyzed: runs.length,
    failedJobs: failed.length,
    ignoredNonMatrixJobs,
    fingerprints: byFingerprint.size,
    logErrors,
    expiredLogs,
    workflowDefinitionFallbacks,
    workflowDefinitionErrors,
    workflowStaticDefinitionCells,
    workflowRenderedDefinitionCells,
    workflowRenderCoverage,
    workflowExpectedMatrixCells,
    workflowMatchedMatrixCells,
    workflowMatchCoverage: workflowExpectedMatrixCells
      ? workflowMatchedMatrixCells / workflowExpectedMatrixCells
      : null,
    inactiveStaticMatrixFamilies,
    dynamicMatrixDefinitions,
    runWindowDays,
    projectedRunsPer30Days,
    cells,
    clusters,
    observations,
    matrixJobs,
  };
}
