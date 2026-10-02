import type { AnalysisReport, CellSummary } from "./analyze.js";
import type { MatrixTrimConstraints, RequireConstraint } from "./config.js";
import { EMPTY_CONSTRAINTS } from "./config.js";
import { observedCombinatorialCoverage } from "./coverage.js";
import {
	exactWeightedSetCover,
	greedyWeightedSetCover,
	type SetCoverCandidate,
} from "./optimizer.js";
import {
	estimatePricing,
	type PricingEstimate,
	standardRunnerListPriceUsd,
} from "./pricing.js";
import {
	evaluateRecommendationReadiness,
	type RecommendationReadiness,
} from "./readiness.js";

export type RecommendedCell = {
	cell: string;
	baseJob: string;
	medianRuntimeSeconds: number | null;
	runnerLabels?: string[];
	estimatedListPriceUsdPerRun: number | null;
	coveredFailures: number;
	coveredCombinations: number;
};

export type RequirementCategory =
	| "failure"
	| "combinatorial"
	| "job-anchor"
	| "unresolved-safety"
	| "hard-constraint";

export type RequirementSummary = {
	total: number;
	byCategory: Record<RequirementCategory, number>;
	samples: string[];
};

export type ReplacementCoverage = {
	cell: string;
	objectiveCost: number;
	coveredRequirements: number;
};

export type CellDecisionExplanation = {
	cell: string;
	baseJob: string;
	decision: "selected" | "omitted";
	objectiveCost: number;
	medianRuntimeSeconds: number | null;
	uniqueHistoricalFailures: number;
	zeroUniqueHistoricalFailureEvidence: boolean;
	coveredRequirements: RequirementSummary;
	counterfactualUncoveredRequirements?: RequirementSummary;
	indispensable?: boolean;
	replacementCellCount: number;
	replacementCells: ReplacementCoverage[];
	replacementCellsTruncated: boolean;
	reasonCodes: string[];
};

export type OptimizerMode = "auto" | "exact" | "greedy";

export type RecommendationOptions = {
	maxStrength?: number;
	constraints?: MatrixTrimConstraints;
	optimizer?: OptimizerMode;
	exactMaxNodes?: number;
};

export type RecommendationReport = {
	mode: "history+combinatorial";
	algorithm: "exact-branch-and-bound" | "greedy-weighted-set-cover";
	optimizerMode: OptimizerMode;
	optimizerOptimal: boolean | null;
	optimizerSearchNodes: number;
	optimizerFallbackReason?: string;
	greedyObjectiveCost: number;
	selectedObjectiveCost: number;
	optimizerImprovementPercent: number;
	coverageStrength: number;
	currentCells: number;
	selectedCells: RecommendedCell[];
	cellDecisions: CellDecisionExplanation[];
	historicalFingerprints: number;
	coveredFingerprints: number;
	historicalRecall: number | null;
	failureEvents: number;
	failedJobsWithEvents: number;
	multiEventJobs: number;
	combinatorialRequirements: number;
	coveredCombinatorialRequirements: number;
	combinatorialCoverage: number | null;
	unresolvedAxisCells: string[];
	currentEstimatedSeconds: number | null;
	selectedEstimatedSeconds: number | null;
	estimatedComputeReductionPercent: number | null;
	pricingCoverage: number;
	currentEstimatedListPriceUsdPerRun: number | null;
	selectedEstimatedListPriceUsdPerRun: number | null;
	estimatedListPriceReductionPercent: number | null;
	projectedRunsPer30Days: number | null;
	currentProjectedListPriceUsd30Days: number | null;
	selectedProjectedListPriceUsd30Days: number | null;
	pricing: PricingEstimate;
	constraintRequirements: number;
	coveredConstraintRequirements: number;
	keptCells: string[];
	requiredSelectors: number;
	warnings: string[];
	readiness: RecommendationReadiness;
};

function median(values: number[]): number | null {
	if (!values.length) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2
		? sorted[middle]!
		: (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function costFor(cell: CellSummary, fallback: number): number {
	return Math.max(cell.medianRuntimeSeconds ?? fallback, 0.1);
}

function matchesRequireConstraint(
	cell: CellSummary,
	selector: RequireConstraint,
): boolean {
	if (selector.baseJob && cell.baseJob !== selector.baseJob) return false;
	if (!cell.axes) return false;
	return Object.entries(selector.axes).every(
		([key, value]) => cell.axes?.[key] === value,
	);
}

function requirementCategory(token: string): RequirementCategory {
	if (token.startsWith("failure:")) return "failure";
	if (token.startsWith("tw:")) return "combinatorial";
	if (token.startsWith("base:")) return "job-anchor";
	if (token.startsWith("unresolved:")) return "unresolved-safety";
	return "hard-constraint";
}

function summarizeRequirements(tokens: Iterable<string>): RequirementSummary {
	const sorted = [...new Set(tokens)].sort();
	const byCategory: Record<RequirementCategory, number> = {
		failure: 0,
		combinatorial: 0,
		"job-anchor": 0,
		"unresolved-safety": 0,
		"hard-constraint": 0,
	};
	for (const token of sorted) byCategory[requirementCategory(token)]++;
	return {
		total: sorted.length,
		byCategory,
		samples: sorted.slice(0, 8),
	};
}

function replacementCoverage(
	target: Set<string>,
	selectedCells: string[],
	coverageByCell: Map<string, Set<string>>,
	costByCell: Map<string, number>,
): ReplacementCoverage[] {
	const remaining = new Set(target);
	const available = [...selectedCells].sort();
	const replacements: ReplacementCoverage[] = [];

	while (remaining.size) {
		const ranked = available
			.filter((cell) => !replacements.some((item) => item.cell === cell))
			.map((cell) => {
				const coverage = coverageByCell.get(cell) ?? new Set<string>();
				const newlyCovered = [...remaining].filter((token) =>
					coverage.has(token),
				);
				return {
					cell,
					objectiveCost: costByCell.get(cell) ?? 0,
					coveredRequirements: newlyCovered.length,
					newlyCovered,
				};
			})
			.filter((item) => item.coveredRequirements > 0)
			.sort(
				(a, b) =>
					b.coveredRequirements - a.coveredRequirements ||
					a.objectiveCost - b.objectiveCost ||
					a.cell.localeCompare(b.cell),
			);
		const best = ranked[0];
		if (!best) break;
		for (const token of best.newlyCovered) remaining.delete(token);
		replacements.push({
			cell: best.cell,
			objectiveCost: best.objectiveCost,
			coveredRequirements: best.coveredRequirements,
		});
	}

	return replacements;
}

export function recommendMatrix(
	report: AnalysisReport,
	options: RecommendationOptions = {},
): RecommendationReport {
	if (!report.cells.length) {
		throw new Error("no matrix cells were observed");
	}

	const maxStrength = options.maxStrength ?? 2;
	if (!Number.isInteger(maxStrength) || maxStrength < 1 || maxStrength > 4) {
		throw new Error("maxStrength must be an integer from 1 to 4");
	}

	const optimizerMode = options.optimizer ?? "auto";
	if (!["auto", "exact", "greedy"].includes(optimizerMode)) {
		throw new Error("optimizer must be auto, exact, or greedy");
	}
	const exactMaxNodes = options.exactMaxNodes ?? 250_000;
	if (!Number.isInteger(exactMaxNodes) || exactMaxNodes < 1) {
		throw new Error("exactMaxNodes must be a positive integer");
	}

	const knownRuntimes = report.cells
		.map((cell) => cell.medianRuntimeSeconds)
		.filter((value): value is number => value !== null);
	const fallbackCost = median(knownRuntimes) ?? 1;

	const failureCoverage = new Map<string, Set<string>>();
	for (const observation of report.observations) {
		const set = failureCoverage.get(observation.cell) ?? new Set<string>();
		set.add(observation.fingerprint);
		failureCoverage.set(observation.cell, set);
	}

	const combinatorial = observedCombinatorialCoverage(
		report.cells,
		maxStrength,
	);

	const constraints = options.constraints ?? EMPTY_CONSTRAINTS;
	const cellsByName = new Map(report.cells.map((cell) => [cell.cell, cell]));
	const keepCells = [...new Set(constraints.keep)];
	const keepRequirements = keepCells.map((cell, index) => {
		if (!cellsByName.has(cell)) {
			throw new Error(
				`hard keep constraint references an unobserved matrix cell: ${cell}`,
			);
		}
		return {
			cell,
			token: `constraint:keep:${index}`,
		};
	});
	const requireRequirements = constraints.require.map((selector, index) => {
		const matches = report.cells
			.filter((cell) => matchesRequireConstraint(cell, selector))
			.map((cell) => cell.cell);
		if (!matches.length) {
			const base = selector.baseJob ? ` baseJob=${selector.baseJob}` : "";
			const axes = Object.entries(selector.axes)
				.map(([key, value]) => `${key}=${value}`)
				.join(",");
			throw new Error(
				`hard require constraint matched no observed matrix cells:${base} axes=${axes}`,
			);
		}
		return {
			token: `constraint:require:${index}`,
			matches: new Set(matches),
		};
	});
	const constraintTokens = [
		...keepRequirements.map((item) => item.token),
		...requireRequirements.map((item) => item.token),
	];

	const anchors = new Set(report.cells.map((cell) => `base:${cell.baseJob}`));
	const failureTokens = report.clusters.map(
		(cluster) => `failure:${cluster.fingerprint}`,
	);
	const combinatorialTokens = combinatorial.tokens.map((token) => token.id);
	const unresolvedSafetyTokens = combinatorial.unresolvedCells.map(
		(cell) => `unresolved:${cell}`,
	);
	const unresolvedSafetyCells = new Set(combinatorial.unresolvedCells);
	const universe = new Set<string>([
		...anchors,
		...failureTokens,
		...combinatorialTokens,
		...unresolvedSafetyTokens,
		...constraintTokens,
	]);

	const coverageByCell = new Map<string, Set<string>>();
	for (const cell of report.cells) {
		const coverage = new Set<string>([`base:${cell.baseJob}`]);

		for (const fingerprint of failureCoverage.get(cell.cell) ?? []) {
			coverage.add(`failure:${fingerprint}`);
		}
		for (const token of combinatorial.byCell.get(cell.cell) ?? []) {
			coverage.add(token);
		}
		if (unresolvedSafetyCells.has(cell.cell)) {
			coverage.add(`unresolved:${cell.cell}`);
		}
		for (const requirement of keepRequirements) {
			if (requirement.cell === cell.cell) {
				coverage.add(requirement.token);
			}
		}
		for (const requirement of requireRequirements) {
			if (requirement.matches.has(cell.cell)) {
				coverage.add(requirement.token);
			}
		}

		coverageByCell.set(cell.cell, coverage);
	}

	const solverCandidates: SetCoverCandidate[] = report.cells.map((cell) => ({
		id: cell.cell,
		cost: costFor(cell, fallbackCost),
		covers: coverageByCell.get(cell.cell) ?? new Set<string>(),
	}));
	const greedySolution = greedyWeightedSetCover(solverCandidates, universe);

	let selectedSolution = greedySolution;
	let algorithm: RecommendationReport["algorithm"] =
		"greedy-weighted-set-cover";
	let optimizerOptimal: boolean | null =
		optimizerMode === "greedy" ? null : false;
	let optimizerSearchNodes = 0;
	let optimizerFallbackReason: string | undefined;

	if (optimizerMode !== "greedy") {
		const exact = exactWeightedSetCover(solverCandidates, universe, {
			maxNodes: exactMaxNodes,
			initial: greedySolution,
		});
		optimizerSearchNodes = exact.searchNodes;

		if (exact.optimal) {
			selectedSolution = exact;
			algorithm = "exact-branch-and-bound";
			optimizerOptimal = true;
		} else if (optimizerMode === "exact") {
			throw new Error(
				`exact optimizer exceeded node budget (${exactMaxNodes}) before proving optimality`,
			);
		} else {
			optimizerFallbackReason = `Exact optimizer exceeded node budget (${exactMaxNodes}); using deterministic greedy fallback.`;
		}
	}

	const selected = selectedSolution.selected.map((cell) => {
		const match = cellsByName.get(cell);
		if (!match) {
			throw new Error(`optimizer selected unknown matrix cell: ${cell}`);
		}
		return match;
	});
	const optimizerImprovementPercent =
		greedySolution.cost > 0
			? (1 - selectedSolution.cost / greedySolution.cost) * 100
			: 0;

	const selectedNames = new Set(selected.map((cell) => cell.cell));
	const coveredFailures = new Set<string>();
	const coveredCombinations = new Set<string>();
	const coveredConstraints = new Set<string>();

	for (const observation of report.observations) {
		if (selectedNames.has(observation.cell)) {
			coveredFailures.add(observation.fingerprint);
		}
	}
	for (const cell of selected) {
		for (const token of combinatorial.byCell.get(cell.cell) ?? []) {
			coveredCombinations.add(token);
		}
		for (const token of coverageByCell.get(cell.cell) ?? []) {
			if (constraintTokens.includes(token)) {
				coveredConstraints.add(token);
			}
		}
	}

	const objectiveCostByCell = new Map(
		solverCandidates.map((candidate) => [candidate.id, candidate.cost]),
	);
	const selectedCellNames = [...selectedNames].sort();
	const cellDecisions: CellDecisionExplanation[] = [...report.cells]
		.sort((a, b) => a.cell.localeCompare(b.cell))
		.map((cell) => {
			const coverage = new Set(
				[...(coverageByCell.get(cell.cell) ?? [])].filter((token) =>
					universe.has(token),
				),
			);
			const common = {
				cell: cell.cell,
				baseJob: cell.baseJob,
				objectiveCost: objectiveCostByCell.get(cell.cell) ?? 0,
				medianRuntimeSeconds: cell.medianRuntimeSeconds,
				uniqueHistoricalFailures: cell.uniqueFailures,
				zeroUniqueHistoricalFailureEvidence: cell.uniqueFailures === 0,
				coveredRequirements: summarizeRequirements(coverage),
			};

			if (selectedNames.has(cell.cell)) {
				const coveredByOthers = new Set<string>();
				for (const other of selectedCellNames) {
					if (other === cell.cell) continue;
					for (const token of coverageByCell.get(other) ?? []) {
						if (universe.has(token)) coveredByOthers.add(token);
					}
				}
				const uncovered = [...coverage].filter(
					(token) => !coveredByOthers.has(token),
				);
				const counterfactual = summarizeRequirements(uncovered);
				const reasonCodes: string[] = [];
				if (counterfactual.byCategory["hard-constraint"]) {
					reasonCodes.push("counterfactual-hard-constraint");
				}
				if (counterfactual.byCategory["unresolved-safety"]) {
					reasonCodes.push("counterfactual-unresolved-safety");
				}
				if (counterfactual.byCategory.failure) {
					reasonCodes.push("counterfactual-failure-required");
				}
				if (counterfactual.byCategory.combinatorial) {
					reasonCodes.push("counterfactual-combinatorial-required");
				}
				if (counterfactual.byCategory["job-anchor"]) {
					reasonCodes.push("counterfactual-job-anchor");
				}
				if (!reasonCodes.length) reasonCodes.push("cost-efficient-contributor");
				return {
					...common,
					decision: "selected" as const,
					counterfactualUncoveredRequirements: counterfactual,
					indispensable: counterfactual.total > 0,
					replacementCellCount: 0,
					replacementCells: [],
					replacementCellsTruncated: false,
					reasonCodes,
				};
			}

			const replacements = replacementCoverage(
				coverage,
				selectedCellNames,
				coverageByCell,
				objectiveCostByCell,
			);
			const reasonCodes = ["requirements-covered-by-selected"];
			if (cell.uniqueFailures === 0) {
				reasonCodes.push("zero-unique-historical-failure-evidence");
			}
			return {
				...common,
				decision: "omitted" as const,
				replacementCellCount: replacements.length,
				replacementCells: replacements.slice(0, 12),
				replacementCellsTruncated: replacements.length > 12,
				reasonCodes,
			};
		});

	const currentKnown = report.cells.every(
		(cell) => cell.medianRuntimeSeconds !== null,
	);
	const selectedKnown = selected.every(
		(cell) => cell.medianRuntimeSeconds !== null,
	);
	const currentEstimatedSeconds = currentKnown
		? report.cells.reduce((sum, cell) => sum + cell.medianRuntimeSeconds!, 0)
		: null;
	const selectedEstimatedSeconds = selectedKnown
		? selected.reduce((sum, cell) => sum + cell.medianRuntimeSeconds!, 0)
		: null;
	const reduction =
		currentEstimatedSeconds !== null &&
		selectedEstimatedSeconds !== null &&
		currentEstimatedSeconds > 0
			? (1 - selectedEstimatedSeconds / currentEstimatedSeconds) * 100
			: null;

	const pricing = estimatePricing(
		report,
		selected.map((cell) => cell.cell),
	);
	const pricingCoverage = pricing.currentCells
		? pricing.pricedCells / pricing.currentCells
		: 0;
	const currentEstimatedListPriceUsdPerRun = pricing.currentRateCardUsdPerRun;
	const selectedEstimatedListPriceUsdPerRun = pricing.selectedRateCardUsdPerRun;
	const estimatedListPriceReductionPercent = pricing.rateCardReductionPercent;
	const projectedRunsPer30Days = pricing.projectedRunsPer30Days;
	const currentProjectedListPriceUsd30Days =
		pricing.currentRateCardUsdPer30Days;
	const selectedProjectedListPriceUsd30Days =
		pricing.selectedRateCardUsdPer30Days;

	const failureRuns = new Set(report.observations.map((item) => item.runId))
		.size;
	const eventCountsByJob = new Map<number, number>();
	for (const item of report.observations) {
		eventCountsByJob.set(
			item.jobId,
			(eventCountsByJob.get(item.jobId) ?? 0) + 1,
		);
	}
	const multiEventJobs = [...eventCountsByJob.values()].filter(
		(count) => count > 1,
	).length;
	const warnings = [
		"Historical failure coverage does not guarantee detection of unseen future failures.",
		`Combinatorial coverage preserves observed axis combinations up to strength ${maxStrength}; it does not invent combinations absent from the observed matrix.`,
		"Runtime estimates come from matrix jobs observed across completed workflow runs.",
	];

	if (optimizerFallbackReason) {
		warnings.push(optimizerFallbackReason);
	}

	if (constraintTokens.length) {
		warnings.push(
			`Applied ${constraintTokens.length} explicit hard constraint(s): keep=${keepRequirements.length}, require=${requireRequirements.length}.`,
		);
	}

	if (pricingCoverage < 1) {
		warnings.push(
			`Billing classification could be resolved for ${pricing.pricedCells}/${pricing.currentCells} cells; aggregate monetary estimates are omitted unless coverage is complete.`,
		);
	}

	if (!report.fingerprints) {
		warnings.unshift(
			"No analyzable failure fingerprints were observed; selection is based on combinatorial coverage and runtime only.",
		);
	} else if (failureRuns < 5) {
		warnings.unshift(
			`Evidence is sparse: only ${failureRuns} workflow run(s) with analyzable matrix failures contributed failure evidence.`,
		);
	}

	if (combinatorial.unresolvedCells.length) {
		warnings.push(
			`Axis values could not be resolved for ${combinatorial.unresolvedCells.length} cell(s); those cells are retained individually as a safety constraint.`,
		);
	}

	if (report.expiredLogs || report.logErrors) {
		warnings.push(
			`Some failed logs were unavailable (expired=${report.expiredLogs}, errors=${report.logErrors}); failure coverage only includes analyzed logs.`,
		);
	}

	if (report.workflowDefinitionFallbacks) {
		warnings.push(
			`Historical workflow YAML could not be read for ${report.workflowDefinitionFallbacks} revision(s); those runs used the default-branch workflow definition as a fallback.`,
		);
	}
	if (report.workflowDefinitionErrors) {
		warnings.push(
			`Workflow definitions were unavailable for ${report.workflowDefinitionErrors} revision(s); matrix jobs from those revisions may be missing from the analysis.`,
		);
	}
	if (
		report.workflowRenderCoverage !== undefined &&
		report.workflowRenderCoverage !== null &&
		report.workflowRenderCoverage < 1
	) {
		warnings.push(
			`Only ${(report.workflowRenderCoverage * 100).toFixed(1)}% of static workflow matrix cells had renderable job names; recommendation coverage may be incomplete.`,
		);
	}
	if (
		report.workflowMatchCoverage !== undefined &&
		report.workflowMatchCoverage !== null &&
		report.workflowMatchCoverage < 1
	) {
		warnings.push(
			`Only ${(report.workflowMatchCoverage * 100).toFixed(1)}% of expected static matrix cells matched actual GitHub job names; recommendation coverage may be incomplete.`,
		);
	}
	if (report.dynamicMatrixDefinitions) {
		warnings.push(
			`${report.dynamicMatrixDefinitions} dynamic matrix definition(s) could not be statically expanded; observed jobs are still analyzed when they can be identified, but axis coverage may be incomplete when runtime values cannot be recovered safely.`,
		);
	}
	if (
		report.captureEvidenceCandidates &&
		(report.captureEvidenceJobs ?? 0) < report.captureEvidenceCandidates
	) {
		warnings.push(
			`Runtime matrix evidence recovered ${report.captureEvidenceJobs ?? 0}/${report.captureEvidenceCandidates} opted-in unresolved job(s); missing evidence remains unresolved.`,
		);
	}
	if (report.captureEvidenceErrors) {
		warnings.push(
			`${report.captureEvidenceErrors} runtime matrix evidence lookup(s) failed or were conflicting; verify checks: read permission and capture-step execution.`,
		);
	}

	const recommendation: Omit<RecommendationReport, "readiness"> = {
		mode: "history+combinatorial",
		algorithm,
		optimizerMode,
		optimizerOptimal,
		optimizerSearchNodes,
		...(optimizerFallbackReason ? { optimizerFallbackReason } : {}),
		greedyObjectiveCost: greedySolution.cost,
		selectedObjectiveCost: selectedSolution.cost,
		optimizerImprovementPercent,
		coverageStrength: maxStrength,
		currentCells: report.cells.length,
		selectedCells: selected.map((cell) => ({
			cell: cell.cell,
			baseJob: cell.baseJob,
			medianRuntimeSeconds: cell.medianRuntimeSeconds,
			runnerLabels: cell.runnerLabels,
			estimatedListPriceUsdPerRun: standardRunnerListPriceUsd(
				cell.medianRuntimeSeconds,
				cell.runnerLabels,
			),
			coveredFailures: (failureCoverage.get(cell.cell) ?? new Set()).size,
			coveredCombinations: (combinatorial.byCell.get(cell.cell) ?? new Set())
				.size,
		})),
		cellDecisions,
		historicalFingerprints: report.fingerprints,
		coveredFingerprints: coveredFailures.size,
		historicalRecall: report.fingerprints
			? coveredFailures.size / report.fingerprints
			: null,
		failureEvents: report.observations.length,
		failedJobsWithEvents: eventCountsByJob.size,
		multiEventJobs,
		combinatorialRequirements: combinatorial.tokens.length,
		coveredCombinatorialRequirements: coveredCombinations.size,
		combinatorialCoverage: combinatorial.tokens.length
			? coveredCombinations.size / combinatorial.tokens.length
			: null,
		unresolvedAxisCells: combinatorial.unresolvedCells,
		currentEstimatedSeconds,
		selectedEstimatedSeconds,
		estimatedComputeReductionPercent: reduction,
		pricingCoverage,
		currentEstimatedListPriceUsdPerRun,
		selectedEstimatedListPriceUsdPerRun,
		estimatedListPriceReductionPercent,
		projectedRunsPer30Days,
		currentProjectedListPriceUsd30Days,
		selectedProjectedListPriceUsd30Days,
		pricing,
		constraintRequirements: constraintTokens.length,
		coveredConstraintRequirements: coveredConstraints.size,
		keptCells: keepRequirements.map((item) => item.cell),
		requiredSelectors: requireRequirements.length,
		warnings,
	};
	return {
		...recommendation,
		readiness: evaluateRecommendationReadiness(report, recommendation),
	};
}
