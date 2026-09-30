import { axesFromMatrixEvidence } from "./axes.js";
import type { MatrixEvidence } from "./evidence.js";

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

export type AxisSource =
	| "workflow-rendered-name"
	| "workflow-job-name"
	| "capture-evidence"
	| "unavailable";

export type MatrixJobObservation = {
	runId: number;
	runNumber: number;
	runConclusion?: string | null;
	jobId: number;
	cell: string;
	baseJob: string;
	axes: Record<string, string> | null;
	axisSource: AxisSource;
	conclusion: string | null;
	runtimeSeconds: number | null;
	runnerLabels?: string[];
};

export type CellSummary = {
	cell: string;
	baseJob: string;
	axes: Record<string, string> | null;
	axisSource: AxisSource;
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

export function isConclusiveConclusion(conclusion: string | null): boolean {
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

export function applyCapturedMatrixEvidence(
	observation: MatrixJobObservation,
	evidence: MatrixEvidence,
): void {
	const axes = axesFromMatrixEvidence(evidence.matrix);
	const suffix = Object.entries(axes)
		.map(([axis, value]) => `${axis}=${value}`)
		.join(", ");
	observation.baseJob = evidence.jobId;
	observation.axes = axes;
	observation.axisSource = "capture-evidence";
	observation.cell = `${observation.cell} [${suffix}]`;
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
			axisSource: AxisSource;
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

		if (
			entry.axisSource === "unavailable" &&
			item.axisSource !== "unavailable"
		) {
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

	return [...matrixByCell.entries()]
		.map(([cell, meta]) => {
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
				uniqueFailures: [...fingerprints].filter((fingerprint) =>
					byFingerprint.get(fingerprint)?.every((item) => item.cell === cell),
				).length,
				medianRuntimeSeconds: median(meta.runtimes),
				runnerLabels:
					[...meta.runnerLabelSets.values()].sort(
						(a, b) =>
							b.count - a.count ||
							JSON.stringify(a.labels).localeCompare(JSON.stringify(b.labels)),
					)[0]?.labels ?? [],
			};
		})
		.sort(
			(a, b) =>
				b.uniqueFailures - a.uniqueFailures ||
				b.distinctFailures - a.distinctFailures ||
				a.cell.localeCompare(b.cell),
		);
}
