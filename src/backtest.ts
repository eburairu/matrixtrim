import {
	type AnalysisReport,
	type FailureObservation,
	summarizeCells,
} from "./analyze.js";
import type { MatrixTrimConstraints } from "./config.js";
import { observedCombinatorialCoverage } from "./coverage.js";
import { type RecommendationOptions, recommendMatrix } from "./recommend.js";

export type MissedFailure = {
	fingerprint: string;
	signature: string[];
	detectingCells: string[];
	seenInTraining: boolean;
};

export type BacktestReport = {
	mode: "time-holdout";
	holdoutPercent: number;
	coverageStrength: number;
	trainingRuns: number;
	holdoutRuns: number;
	selectedCells: string[];
	optimizerAlgorithm: "exact-branch-and-bound" | "greedy-weighted-set-cover";
	optimizerOptimal: boolean | null;
	optimizerSearchNodes: number;
	trainingFingerprints: number;
	holdoutFingerprints: number;
	coveredHoldoutFingerprints: number;
	holdoutRecall: number;
	unseenHoldoutFingerprints: number;
	coveredUnseenHoldoutFingerprints: number;
	unseenHoldoutRecall: number | null;
	holdoutCombinatorialRequirements: number;
	coveredHoldoutCombinatorialRequirements: number;
	holdoutCombinatorialCoverage: number | null;
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
		failedJobs: new Set(observations.map((item) => item.jobId)).size,
		fingerprints: clusters.length,
		cells,
		clusters,
		observations,
		matrixJobs,
	};
}

export function backtestRecommendation(
	report: AnalysisReport,
	holdoutPercent = 25,
	coverageStrength = 2,
	constraints?: MatrixTrimConstraints,
	optimizerOptions: Pick<
		RecommendationOptions,
		"optimizer" | "exactMaxNodes"
	> = {},
): BacktestReport {
	if (holdoutPercent <= 0 || holdoutPercent >= 100) {
		throw new Error("holdoutPercent must be between 0 and 100");
	}

	const conclusive = (value: string | null | undefined) =>
		value === undefined ||
		["success", "failure", "timed_out", "neutral"].includes(value ?? "");

	const runs = [
		...new Map(
			report.matrixJobs
				.filter((item) => conclusive(item.runConclusion))
				.map((item) => [
					item.runId,
					{ runId: item.runId, runNumber: item.runNumber },
				]),
		).values(),
	].sort((a, b) => a.runNumber - b.runNumber || a.runId - b.runId);

	if (runs.length < 2) {
		throw new Error(
			"backtest requires at least two completed matrix workflow runs",
		);
	}

	const holdoutCount = Math.max(
		1,
		Math.min(runs.length - 1, Math.ceil((runs.length * holdoutPercent) / 100)),
	);
	const split = runs.length - holdoutCount;
	const trainingRunIds = new Set(runs.slice(0, split).map((run) => run.runId));
	const holdoutRunIds = new Set(runs.slice(split).map((run) => run.runId));

	const training = report.observations.filter((item) =>
		trainingRunIds.has(item.runId),
	);
	const holdout = report.observations.filter((item) =>
		holdoutRunIds.has(item.runId),
	);
	if (!training.length || !holdout.length) {
		throw new Error(
			"backtest needs at least one analyzable failure in both the training and holdout windows",
		);
	}

	const trainingReport = subsetReport(report, training, trainingRunIds);
	const holdoutReport = subsetReport(report, holdout, holdoutRunIds);
	const recommendation = recommendMatrix(trainingReport, {
		maxStrength: coverageStrength,
		constraints,
		...optimizerOptions,
	});
	const selected = new Set(
		recommendation.selectedCells.map((cell) => cell.cell),
	);
	const trainingFingerprints = new Set(
		training.map((item) => item.fingerprint),
	);
	const holdoutClusters = clustersFor(holdout);

	const holdoutCombinatorial = observedCombinatorialCoverage(
		holdoutReport.cells,
		coverageStrength,
	);
	const coveredHoldoutCombinations = new Set<string>();
	for (const cell of holdoutReport.cells) {
		if (!selected.has(cell.cell)) continue;
		for (const token of holdoutCombinatorial.byCell.get(cell.cell) ?? []) {
			coveredHoldoutCombinations.add(token);
		}
	}

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
		"Backtesting uses only runs with analyzable failed job logs for failure recall.",
		"Runtime costs and combinatorial constraints are computed from the training window only.",
		`Observed combinatorial coverage is preserved up to strength ${coverageStrength}.`,
	];
	if (recommendation.optimizerFallbackReason) {
		warnings.push(recommendation.optimizerFallbackReason);
	}
	if (recommendation.constraintRequirements) {
		warnings.push(
			`Applied ${recommendation.constraintRequirements} explicit hard constraint(s) to the training recommendation.`,
		);
	}

	return {
		mode: "time-holdout",
		holdoutPercent,
		coverageStrength,
		trainingRuns: trainingRunIds.size,
		holdoutRuns: holdoutRunIds.size,
		selectedCells: [...selected],
		optimizerAlgorithm: recommendation.algorithm,
		optimizerOptimal: recommendation.optimizerOptimal,
		optimizerSearchNodes: recommendation.optimizerSearchNodes,
		trainingFingerprints: trainingFingerprints.size,
		holdoutFingerprints: holdoutClusters.length,
		coveredHoldoutFingerprints: covered,
		holdoutRecall: holdoutClusters.length
			? covered / holdoutClusters.length
			: 0,
		unseenHoldoutFingerprints: unseen,
		coveredUnseenHoldoutFingerprints: coveredUnseen,
		unseenHoldoutRecall: unseen ? coveredUnseen / unseen : null,
		holdoutCombinatorialRequirements: holdoutCombinatorial.tokens.length,
		coveredHoldoutCombinatorialRequirements: coveredHoldoutCombinations.size,
		holdoutCombinatorialCoverage: holdoutCombinatorial.tokens.length
			? coveredHoldoutCombinations.size / holdoutCombinatorial.tokens.length
			: null,
		missed,
		warnings,
	};
}

export type RollingBacktestFold = {
	fold: number;
	status: "valid" | "invalid";
	reason?: string;
	trainingRuns: number;
	holdoutRuns: number;
	selectedCells: string[];
	trainingFingerprints: number;
	holdoutFingerprints: number;
	coveredHoldoutFingerprints: number;
	holdoutRecall: number | null;
	unseenHoldoutFingerprints: number;
	coveredUnseenHoldoutFingerprints: number;
	unseenHoldoutRecall: number | null;
	optimizerAlgorithm?: "exact-branch-and-bound" | "greedy-weighted-set-cover";
	optimizerOptimal?: boolean | null;
	optimizerSearchNodes?: number;
};

export type CellSelectionFrequency = {
	cell: string;
	selectedFolds: number;
	frequency: number;
};

export type RollingBacktestReport = {
	mode: "rolling-time-validation";
	requestedFolds: number;
	foldCount: number;
	validFolds: number;
	invalidFolds: number;
	coverageStrength: number;
	aggregateHoldoutFingerprints: number;
	aggregateCoveredHoldoutFingerprints: number;
	aggregateHoldoutRecall: number | null;
	worstHoldoutRecall: number | null;
	aggregateUnseenHoldoutFingerprints: number;
	aggregateCoveredUnseenHoldoutFingerprints: number;
	aggregateUnseenHoldoutRecall: number | null;
	worstUnseenHoldoutRecall: number | null;
	meanPairwiseSelectionJaccard: number | null;
	cellSelectionFrequency: CellSelectionFrequency[];
	folds: RollingBacktestFold[];
	warnings: string[];
};

function conclusiveRuns(report: AnalysisReport): Array<{
	runId: number;
	runNumber: number;
}> {
	const conclusive = (value: string | null | undefined) =>
		value === undefined ||
		["success", "failure", "timed_out", "neutral"].includes(value ?? "");
	return [
		...new Map(
			report.matrixJobs
				.filter((item) => conclusive(item.runConclusion))
				.map((item) => [
					item.runId,
					{ runId: item.runId, runNumber: item.runNumber },
				]),
		).values(),
	].sort((a, b) => a.runNumber - b.runNumber || a.runId - b.runId);
}

function selectionJaccard(a: string[], b: string[]): number {
	const left = new Set(a);
	const right = new Set(b);
	const union = new Set([...left, ...right]);
	if (!union.size) return 1;
	let intersection = 0;
	for (const cell of left) {
		if (right.has(cell)) intersection++;
	}
	return intersection / union.size;
}

function rollingFold(
	report: AnalysisReport,
	fold: number,
	trainingRunIds: Set<number>,
	holdoutRunIds: Set<number>,
	coverageStrength: number,
	constraints: MatrixTrimConstraints | undefined,
	optimizerOptions: Pick<RecommendationOptions, "optimizer" | "exactMaxNodes">,
): RollingBacktestFold {
	const training = report.observations.filter((item) =>
		trainingRunIds.has(item.runId),
	);
	const holdout = report.observations.filter((item) =>
		holdoutRunIds.has(item.runId),
	);
	const base = {
		fold,
		trainingRuns: trainingRunIds.size,
		holdoutRuns: holdoutRunIds.size,
		selectedCells: [] as string[],
		trainingFingerprints: new Set(training.map((item) => item.fingerprint))
			.size,
		holdoutFingerprints: 0,
		coveredHoldoutFingerprints: 0,
		holdoutRecall: null,
		unseenHoldoutFingerprints: 0,
		coveredUnseenHoldoutFingerprints: 0,
		unseenHoldoutRecall: null,
	};

	if (!holdout.length) {
		return {
			...base,
			status: "invalid",
			reason: "no analyzable failure fingerprints in holdout window",
		};
	}

	const trainingReport = subsetReport(report, training, trainingRunIds);
	if (!trainingReport.cells.length) {
		return {
			...base,
			status: "invalid",
			reason: "no matrix observations in training window",
		};
	}

	try {
		const recommendation = recommendMatrix(trainingReport, {
			maxStrength: coverageStrength,
			constraints,
			...optimizerOptions,
		});
		const selected = new Set(
			recommendation.selectedCells.map((cell) => cell.cell),
		);
		const trainingFingerprints = new Set(
			training.map((item) => item.fingerprint),
		);
		const holdoutClusters = clustersFor(holdout);
		let covered = 0;
		let unseen = 0;
		let coveredUnseen = 0;

		for (const cluster of holdoutClusters) {
			const detected = cluster.cells.some((cell) => selected.has(cell));
			const seenInTraining = trainingFingerprints.has(cluster.fingerprint);
			if (detected) covered++;
			if (!seenInTraining) {
				unseen++;
				if (detected) coveredUnseen++;
			}
		}

		return {
			...base,
			status: "valid",
			selectedCells: [...selected].sort(),
			holdoutFingerprints: holdoutClusters.length,
			coveredHoldoutFingerprints: covered,
			holdoutRecall: covered / holdoutClusters.length,
			unseenHoldoutFingerprints: unseen,
			coveredUnseenHoldoutFingerprints: coveredUnseen,
			unseenHoldoutRecall: unseen ? coveredUnseen / unseen : null,
			optimizerAlgorithm: recommendation.algorithm,
			optimizerOptimal: recommendation.optimizerOptimal,
			optimizerSearchNodes: recommendation.optimizerSearchNodes,
		};
	} catch (error) {
		return {
			...base,
			status: "invalid",
			reason: `training recommendation unavailable: ${(error as Error).message}`,
		};
	}
}

export function rollingBacktestRecommendation(
	report: AnalysisReport,
	requestedFolds = 4,
	coverageStrength = 2,
	constraints?: MatrixTrimConstraints,
	optimizerOptions: Pick<
		RecommendationOptions,
		"optimizer" | "exactMaxNodes"
	> = {},
): RollingBacktestReport {
	if (!Number.isInteger(requestedFolds) || requestedFolds < 2) {
		throw new Error("requestedFolds must be an integer of at least 2");
	}
	const runs = conclusiveRuns(report);
	if (runs.length < 3) {
		throw new Error(
			"rolling backtest requires at least three completed matrix workflow runs",
		);
	}

	const foldCount = Math.min(requestedFolds, runs.length - 1);
	const segmentCount = foldCount + 1;
	const baseSize = Math.floor(runs.length / segmentCount);
	const extra = runs.length % segmentCount;
	const segments: (typeof runs)[] = [];
	let offset = 0;
	for (let index = 0; index < segmentCount; index++) {
		const size = baseSize + (index < extra ? 1 : 0);
		segments.push(runs.slice(offset, offset + size));
		offset += size;
	}

	const folds: RollingBacktestFold[] = [];
	for (let index = 1; index < segments.length; index++) {
		const trainingRuns = segments.slice(0, index).flat();
		const holdoutRuns = segments[index]!;
		folds.push(
			rollingFold(
				report,
				index,
				new Set(trainingRuns.map((run) => run.runId)),
				new Set(holdoutRuns.map((run) => run.runId)),
				coverageStrength,
				constraints,
				optimizerOptions,
			),
		);
	}

	const valid = folds.filter((item) => item.status === "valid");
	const aggregateHoldoutFingerprints = valid.reduce(
		(sum, item) => sum + item.holdoutFingerprints,
		0,
	);
	const aggregateCoveredHoldoutFingerprints = valid.reduce(
		(sum, item) => sum + item.coveredHoldoutFingerprints,
		0,
	);
	const aggregateUnseenHoldoutFingerprints = valid.reduce(
		(sum, item) => sum + item.unseenHoldoutFingerprints,
		0,
	);
	const aggregateCoveredUnseenHoldoutFingerprints = valid.reduce(
		(sum, item) => sum + item.coveredUnseenHoldoutFingerprints,
		0,
	);
	const holdoutRecalls = valid
		.map((item) => item.holdoutRecall)
		.filter((value): value is number => value !== null);
	const unseenRecalls = valid
		.map((item) => item.unseenHoldoutRecall)
		.filter((value): value is number => value !== null);

	const pairwiseJaccards: number[] = [];
	for (let left = 0; left < valid.length; left++) {
		for (let right = left + 1; right < valid.length; right++) {
			pairwiseJaccards.push(
				selectionJaccard(
					valid[left]!.selectedCells,
					valid[right]!.selectedCells,
				),
			);
		}
	}

	const selectionCounts = new Map<string, number>();
	for (const item of valid) {
		for (const cell of item.selectedCells) {
			selectionCounts.set(cell, (selectionCounts.get(cell) ?? 0) + 1);
		}
	}
	const cellSelectionFrequency = [...selectionCounts.entries()]
		.map(([cell, selectedFolds]) => ({
			cell,
			selectedFolds,
			frequency: valid.length ? selectedFolds / valid.length : 0,
		}))
		.sort((a, b) => b.frequency - a.frequency || a.cell.localeCompare(b.cell));

	const warnings = [
		"Rolling validation uses expanding training windows and only newer runs in each holdout fold.",
		"Failure-recall aggregates include only folds with at least one analyzable holdout failure fingerprint.",
		"Training windows may contain zero historical failures; in that case selection is driven by non-failure safety constraints and all holdout fingerprints are unseen.",
	];
	if (valid.length < folds.length) {
		warnings.push(
			`${folds.length - valid.length}/${folds.length} fold(s) were excluded from recall aggregation because they lacked evaluable holdout failure evidence or a valid training recommendation.`,
		);
	}
	if (!valid.length) {
		warnings.push(
			"No rolling fold had analyzable holdout failure evidence; recall and stability metrics are n/a.",
		);
	}

	return {
		mode: "rolling-time-validation",
		requestedFolds,
		foldCount,
		validFolds: valid.length,
		invalidFolds: folds.length - valid.length,
		coverageStrength,
		aggregateHoldoutFingerprints,
		aggregateCoveredHoldoutFingerprints,
		aggregateHoldoutRecall: aggregateHoldoutFingerprints
			? aggregateCoveredHoldoutFingerprints / aggregateHoldoutFingerprints
			: null,
		worstHoldoutRecall: holdoutRecalls.length
			? Math.min(...holdoutRecalls)
			: null,
		aggregateUnseenHoldoutFingerprints,
		aggregateCoveredUnseenHoldoutFingerprints,
		aggregateUnseenHoldoutRecall: aggregateUnseenHoldoutFingerprints
			? aggregateCoveredUnseenHoldoutFingerprints /
				aggregateUnseenHoldoutFingerprints
			: null,
		worstUnseenHoldoutRecall: unseenRecalls.length
			? Math.min(...unseenRecalls)
			: null,
		meanPairwiseSelectionJaccard: pairwiseJaccards.length
			? pairwiseJaccards.reduce((sum, value) => sum + value, 0) /
				pairwiseJaccards.length
			: null,
		cellSelectionFrequency,
		folds,
		warnings,
	};
}
