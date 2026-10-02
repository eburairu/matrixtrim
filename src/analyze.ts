import {
	applyCapturedMatrixEvidence,
	type CellSummary,
	type FailureObservation,
	isConclusiveConclusion,
	type MatrixJobObservation,
	summarizeCells,
} from "./analysis-summary.js";
import {
	type AxisInferenceFailureReason,
	axesFromMatrixEvidence,
	diagnoseAxesFromExpandedJobName,
	type MatrixDefinition,
	workflowMatrixDefinitions,
} from "./axes.js";
import {
	type AnalysisDiagnostic,
	type AnalysisDiagnosticCode,
	captureEvidenceDiagnostic,
	captureRemediation,
	compactDiagnostics,
} from "./diagnostics.js";
import { decodeMatrixEvidence, type MatrixEvidence } from "./evidence.js";
import { fingerprintFailures } from "./fingerprint.js";
import { GitHubClient, GitHubHttpError, type WorkflowRun } from "./github.js";

export type {
	AxisSource,
	CellSummary,
	FailureObservation,
	MatrixJobObservation,
} from "./analysis-summary.js";
export {
	applyCapturedMatrixEvidence,
	summarizeCells,
} from "./analysis-summary.js";
export type { AnalysisDiagnostic } from "./diagnostics.js";

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
	captureEvidenceCandidates?: number;
	captureEvidenceJobs?: number;
	captureEvidenceErrors?: number;
	diagnostics?: AnalysisDiagnostic[];
	runWindowDays?: number | null;
	projectedRunsPer30Days?: number | null;
	cells: CellSummary[];
	clusters: FailureCluster[];
	observations: FailureObservation[];
	matrixJobs: MatrixJobObservation[];
};

function splitJobName(name: string): {
	baseJob: string;
	cell: string;
	matrixLike: boolean;
} {
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

const AXIS_DIAGNOSTIC_CODES: Record<
	AxisInferenceFailureReason,
	AnalysisDiagnosticCode
> = {
	"ambiguous-rendered-name": "axis-ambiguous-rendered-name",
	"ambiguous-dynamic-name": "axis-ambiguous-dynamic-name",
	"job-name-not-matrix-shaped": "axis-job-name-not-matrix-shaped",
	"matrix-definition-not-found": "axis-definition-not-found",
	"axis-names-unavailable": "axis-names-unavailable",
	"axis-value-count-mismatch": "axis-value-count-mismatch",
	"opaque-dynamic-job-name": "axis-opaque-dynamic-job-name",
};

function axisDiagnosticMessage(reason: AxisInferenceFailureReason): string {
	return {
		"ambiguous-rendered-name":
			"More than one static matrix cell renders to this job name, so axis values cannot be assigned uniquely.",
		"ambiguous-dynamic-name":
			"More than one dynamic matrix name template matches this job name, so axis values cannot be assigned uniquely.",
		"job-name-not-matrix-shaped":
			"The observed job name does not expose a matrix suffix or a supported deterministic name template.",
		"matrix-definition-not-found":
			"No matrix definition matches the observed job-name prefix.",
		"axis-names-unavailable":
			"The runtime matrix values are visible in the job name, but the workflow does not expose stable axis names.",
		"axis-value-count-mismatch":
			"The number of values rendered in the job name does not match the known matrix axis count.",
		"opaque-dynamic-job-name":
			"The dynamic matrix job uses a name that does not expose runtime axis values.",
	}[reason];
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
	const diagnostics: AnalysisDiagnostic[] = [];
	let repositoryVisibility: AnalysisReport["repositoryVisibility"];
	try {
		const info = await client.repositoryInfo();
		repositoryVisibility =
			info.visibility ?? (info.private ? "private" : "public");
	} catch {
		repositoryVisibility = undefined;
	}

	const runs: WorkflowRun[] = options.runIds?.length
		? await mapLimit(options.runIds, concurrency, (runId) =>
				client.getRun(runId),
			)
		: options.runId
			? [await client.getRun(options.runId)]
			: await client.listRuns(options.limit, options.workflow);

	let workflowPath: string | undefined;
	const workflowPaths = [
		...new Set(runs.map((run) => run.path).filter(Boolean)),
	];
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

	const definitionInputs = [
		...new Map(
			runs
				.filter((run) => run.path && run.head_sha)
				.map((run) => [`${run.path}@${run.head_sha}`, run]),
		).values(),
	];

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
	const definitionsByRunId = new Map(
		runs.map((run) => [
			run.id,
			definitionsByRevision.get(`${run.path}@${run.head_sha}`) ?? [],
		]),
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

	if (workflowDefinitionFallbacks) {
		diagnostics.push({
			code: "workflow-definition-fallback",
			severity: "warning",
			scope: "workflow",
			message:
				"One or more historical workflow revisions were unavailable; the default-branch workflow definition was used instead.",
			occurrences: workflowDefinitionFallbacks,
		});
	}
	if (workflowDefinitionErrors) {
		diagnostics.push({
			code: "workflow-definition-unavailable",
			severity: "warning",
			scope: "workflow",
			message:
				"One or more historical workflow definitions could not be loaded, so matrix classification may be incomplete.",
			occurrences: workflowDefinitionErrors,
		});
	}

	for (const definition of revisionDefinitions) {
		if (
			!definition.dynamic &&
			definition.renderedCells < definition.expectedCells
		) {
			diagnostics.push({
				code: "static-name-render-incomplete",
				severity: "warning",
				scope: "definition",
				jobId: definition.jobId,
				message:
					"Some static matrix cells could not be rendered to deterministic GitHub job names.",
				details: {
					expectedCells: definition.expectedCells,
					renderedCells: definition.renderedCells,
				},
			});
		}
		if (
			definition.dynamic &&
			definition.axes.length === 0 &&
			!definition.captureEvidence
		) {
			diagnostics.push({
				code: "dynamic-matrix-capture-not-configured",
				severity: "warning",
				scope: "definition",
				jobId: definition.jobId,
				message:
					"This dynamic matrix does not expose stable axis names and has no MatrixTrim runtime evidence capture step.",
				remediation: captureRemediation(definition.jobId),
			});
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
	const matrixJobById = new Map<number, MatrixJobObservation>();
	const axisFailureByJobId = new Map<number, AxisInferenceFailureReason>();
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
							job.name === cell.name || job.name.startsWith(`${cell.name} / `),
					),
				).length;

				if (matched === 0) {
					inactiveStaticMatrixFamilies++;
					continue;
				}

				workflowExpectedMatrixCells += definition.expectedCells;
				workflowMatchedMatrixCells += matched;
				if (matched < definition.expectedCells) {
					const unmatched = definition.cells
						.filter(
							(cell) =>
								!jobs.some(
									(job) =>
										job.name === cell.name ||
										job.name.startsWith(`${cell.name} / `),
								),
						)
						.map((cell) => cell.name)
						.slice(0, 5);
					diagnostics.push({
						code: "static-cell-job-match-incomplete",
						severity: "warning",
						scope: "definition",
						jobId: definition.jobId,
						message:
							"Some expected static matrix cells did not match actual GitHub job names in an active matrix family.",
						details: {
							expectedCells: definition.expectedCells,
							matchedCells: matched,
							unmatchedSamples: unmatched,
						},
					});
				}
			}
		}

		for (const job of jobs) {
			const parsed = splitJobName(job.name);
			const inferred = diagnoseAxesFromExpandedJobName(job.name, definitions);
			const renderedMatch = inferred.source !== "unavailable";
			const fallbackDefinition = definitions.find(
				(definition) =>
					definition.displayName === parsed.baseJob ||
					definition.jobId === parsed.baseJob,
			);
			const defaultNameFallback =
				parsed.matrixLike && (!definitions.length || !!fallbackDefinition);
			const exactDynamicDefinition = definitions.find(
				(definition) =>
					definition.dynamic &&
					definition.captureEvidence &&
					(definition.displayName === job.name ||
						definition.jobId === job.name),
			);

			if (!renderedMatch && !defaultNameFallback && !exactDynamicDefinition) {
				continue;
			}
			if (inferred.reason) {
				axisFailureByJobId.set(job.id, inferred.reason);
			}

			const observation: MatrixJobObservation = {
				runId: run.id,
				runNumber: run.run_number,
				runConclusion: run.conclusion,
				jobId: job.id,
				cell: job.name,
				baseJob: renderedMatch
					? inferred.baseJob
					: (exactDynamicDefinition?.jobId ??
						fallbackDefinition?.jobId ??
						parsed.baseJob),
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

	const captureCandidates = matrixJobs.filter((observation) => {
		if (observation.axes !== null) return false;
		return (
			definitionsByRunId
				.get(observation.runId)
				?.some(
					(definition) =>
						definition.dynamic &&
						definition.captureEvidence &&
						definition.jobId === observation.baseJob,
				) ?? false
		);
	});
	let captureEvidenceJobs = 0;
	let captureEvidenceErrors = 0;

	await mapLimit(
		captureCandidates,
		Math.min(concurrency, 4),
		async (observation) => {
			try {
				const annotations = await client.listCheckRunAnnotations(
					observation.jobId,
				);
				const matches = annotations
					.map((annotation) => decodeMatrixEvidence(annotation.message))
					.filter(
						(evidence): evidence is MatrixEvidence =>
							evidence !== null && evidence.jobId === observation.baseJob,
					);
				if (!matches.length) {
					diagnostics.push(
						captureEvidenceDiagnostic(
							"missing",
							observation.baseJob,
							observation.cell,
						),
					);
					return;
				}

				const unique = new Map(
					matches.map((evidence) => [
						JSON.stringify(axesFromMatrixEvidence(evidence.matrix)),
						evidence,
					]),
				);
				if (unique.size !== 1) {
					captureEvidenceErrors++;
					diagnostics.push(
						captureEvidenceDiagnostic(
							"conflict",
							observation.baseJob,
							observation.cell,
						),
					);
					return;
				}

				applyCapturedMatrixEvidence(observation, [...unique.values()][0]!);
				captureEvidenceJobs++;
			} catch {
				captureEvidenceErrors++;
				diagnostics.push(
					captureEvidenceDiagnostic(
						"fetch-error",
						observation.baseJob,
						observation.cell,
					),
				);
			}
		},
	);

	for (const observation of matrixJobs) {
		if (observation.axes !== null) continue;
		const reason = axisFailureByJobId.get(observation.jobId);
		if (!reason) continue;
		const definition = definitionsByRunId
			.get(observation.runId)
			?.find((item) => item.jobId === observation.baseJob);
		diagnostics.push({
			code: AXIS_DIAGNOSTIC_CODES[reason],
			severity: "warning",
			scope: "cell",
			jobId: observation.baseJob,
			cell: observation.cell,
			message: axisDiagnosticMessage(reason),
			...(definition?.dynamic
				? { remediation: captureRemediation(observation.baseJob) }
				: {}),
		});
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
				return fingerprints.map(
					(fingerprint) =>
						({
							runId: run.id,
							runNumber: run.run_number,
							jobId: job.id,
							cell: matrixJob.cell,
							baseJob: matrixJob.baseJob,
							fingerprint: fingerprint.id,
							signature: fingerprint.signature,
							evidence: fingerprint.evidence,
						}) satisfies FailureObservation,
				);
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
		.sort(
			(a, b) =>
				b.cells.length - a.cells.length ||
				b.observations - a.observations ||
				a.fingerprint.localeCompare(b.fingerprint),
		);

	const cells = summarizeCells(matrixJobs, observations);

	const conclusiveRunTimes = runs
		.filter((run) => isConclusiveConclusion(run.conclusion))
		.map((run) => Date.parse(run.created_at))
		.filter((value) => Number.isFinite(value))
		.sort((a, b) => a - b);
	const runWindowDays =
		conclusiveRunTimes.length >= 2
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
		captureEvidenceCandidates: captureCandidates.length,
		captureEvidenceJobs,
		captureEvidenceErrors,
		diagnostics: compactDiagnostics(diagnostics),
		runWindowDays,
		projectedRunsPer30Days,
		cells,
		clusters,
		observations,
		matrixJobs,
	};
}
