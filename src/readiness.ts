import type { AnalysisReport } from "./analyze.js";
import type { BacktestReport, RollingBacktestReport } from "./backtest.js";
import type { RecommendationReport } from "./recommend.js";

export type RecommendationReadinessLevel =
	| "ready"
	| "caution"
	| "diagnostic-only"
	| "blocked";

export type RecommendationReadinessReasonCode =
	| "no-failure-evidence"
	| "sparse-failure-evidence"
	| "unresolved-axis-cells"
	| "incomplete-workflow-render"
	| "incomplete-workflow-match"
	| "dynamic-matrix-present"
	| "unavailable-failed-logs"
	| "workflow-definition-errors"
	| "temporal-validation-unavailable"
	| "temporal-validation-sparse"
	| "temporal-validation-miss"
	| "unseen-failure-miss"
	| "unstable-selection"
	| "historical-coverage-miss"
	| "combinatorial-coverage-miss"
	| "constraint-coverage-miss"
	| "optimizer-unproven"
	| "pricing-incomplete";

export type RecommendationReadinessReason = {
	code: RecommendationReadinessReasonCode;
	severity: "caution" | "diagnostic" | "blocked";
	message: string;
};

export type RecommendationReadinessMetrics = {
	axisResolution: number;
	workflowRenderCoverage: number | null;
	workflowMatchCoverage: number | null;
	fingerprints: number;
	failureEvidenceRuns: number;
	unavailableFailedLogs: number;
	diagnosticWarnings: number;
	optimizerOptimal: boolean | null;
	historicalRecall: number | null;
	combinatorialCoverage: number | null;
	constraintCoverage: number;
	pricingCoverage: number;
	holdoutRecall: number | null;
	unseenHoldoutRecall: number | null;
	rollingValidFolds: number | null;
	rollingWorstHoldoutRecall: number | null;
	rollingUnseenFailureRecall: number | null;
	rollingSelectionStability: number | null;
};

export type RecommendationReadiness = {
	level: RecommendationReadinessLevel;
	automationEligible: boolean;
	metrics: RecommendationReadinessMetrics;
	reasons: RecommendationReadinessReason[];
};

function reason(
	code: RecommendationReadinessReasonCode,
	severity: RecommendationReadinessReason["severity"],
	message: string,
): RecommendationReadinessReason {
	return { code, severity, message };
}

function ratio(numerator: number, denominator: number): number {
	return denominator ? numerator / denominator : 1;
}

export function evaluateRecommendationReadiness(
	analysis: AnalysisReport,
	recommendation: Omit<RecommendationReport, "readiness">,
	backtest: BacktestReport | null = null,
	rolling: RollingBacktestReport | null = null,
): RecommendationReadiness {
	const failureEvidenceRuns = new Set(
		analysis.observations.map((item) => item.runId),
	).size;
	const axisResolved = analysis.cells.filter(
		(cell) => cell.axes !== null,
	).length;
	const constraintCoverage = ratio(
		recommendation.coveredConstraintRequirements,
		recommendation.constraintRequirements,
	);
	const metrics: RecommendationReadinessMetrics = {
		axisResolution: ratio(axisResolved, analysis.cells.length),
		workflowRenderCoverage: analysis.workflowRenderCoverage ?? null,
		workflowMatchCoverage: analysis.workflowMatchCoverage ?? null,
		fingerprints: analysis.fingerprints,
		failureEvidenceRuns,
		unavailableFailedLogs: analysis.expiredLogs + analysis.logErrors,
		diagnosticWarnings: (analysis.diagnostics ?? []).filter(
			(item) => item.severity === "warning",
		).length,
		optimizerOptimal: recommendation.optimizerOptimal,
		historicalRecall: recommendation.historicalRecall,
		combinatorialCoverage: recommendation.combinatorialCoverage,
		constraintCoverage,
		pricingCoverage: recommendation.pricingCoverage,
		holdoutRecall: backtest?.holdoutRecall ?? null,
		unseenHoldoutRecall: backtest?.unseenHoldoutRecall ?? null,
		rollingValidFolds: rolling?.validFolds ?? null,
		rollingWorstHoldoutRecall: rolling?.worstHoldoutRecall ?? null,
		rollingUnseenFailureRecall: rolling?.aggregateUnseenHoldoutRecall ?? null,
		rollingSelectionStability: rolling?.meanPairwiseSelectionJaccard ?? null,
	};
	const reasons: RecommendationReadinessReason[] = [];

	if (!analysis.fingerprints) {
		reasons.push(
			reason(
				"no-failure-evidence",
				"diagnostic",
				"No analyzable historical failure fingerprints were observed; the result is structural diagnostics rather than empirically validated failure optimization.",
			),
		);
	} else if (failureEvidenceRuns < 5) {
		reasons.push(
			reason(
				"sparse-failure-evidence",
				"caution",
				"Only " +
					failureEvidenceRuns +
					" workflow run(s) contributed analyzable failure evidence.",
			),
		);
	}

	if (recommendation.unresolvedAxisCells.length) {
		reasons.push(
			reason(
				"unresolved-axis-cells",
				"diagnostic",
				recommendation.unresolvedAxisCells.length +
					" observed matrix cell(s) still have unresolved axes.",
			),
		);
	}
	if (
		analysis.workflowRenderCoverage != null &&
		analysis.workflowRenderCoverage < 1
	) {
		reasons.push(
			reason(
				"incomplete-workflow-render",
				"diagnostic",
				"Static job-name rendering coverage is " +
					(analysis.workflowRenderCoverage * 100).toFixed(1) +
					"%.",
			),
		);
	}
	if (
		analysis.workflowMatchCoverage != null &&
		analysis.workflowMatchCoverage < 1
	) {
		reasons.push(
			reason(
				"incomplete-workflow-match",
				"diagnostic",
				"Expected static-cell/job-name match coverage is " +
					(analysis.workflowMatchCoverage * 100).toFixed(1) +
					"%.",
			),
		);
	}
	if (analysis.dynamicMatrixDefinitions) {
		reasons.push(
			reason(
				"dynamic-matrix-present",
				"diagnostic",
				analysis.dynamicMatrixDefinitions +
					" dynamic matrix definition(s) are present; automatic static rewrite is not considered ready.",
			),
		);
	}
	if (metrics.unavailableFailedLogs) {
		reasons.push(
			reason(
				"unavailable-failed-logs",
				"diagnostic",
				metrics.unavailableFailedLogs +
					" failed-job log(s) were unavailable or could not be read.",
			),
		);
	}
	if (analysis.workflowDefinitionErrors) {
		reasons.push(
			reason(
				"workflow-definition-errors",
				"diagnostic",
				analysis.workflowDefinitionErrors +
					" historical workflow definition(s) were unavailable.",
			),
		);
	}

	if (
		recommendation.historicalRecall != null &&
		recommendation.historicalRecall < 1
	) {
		reasons.push(
			reason(
				"historical-coverage-miss",
				"blocked",
				"Historical failure recall is below 100%.",
			),
		);
	}
	if (
		recommendation.combinatorialCoverage != null &&
		recommendation.combinatorialCoverage < 1
	) {
		reasons.push(
			reason(
				"combinatorial-coverage-miss",
				"blocked",
				"Observed combinatorial coverage is below 100%.",
			),
		);
	}
	if (constraintCoverage < 1) {
		reasons.push(
			reason(
				"constraint-coverage-miss",
				"blocked",
				"One or more explicit hard constraints are not satisfied.",
			),
		);
	}
	if (
		recommendation.optimizerMode === "auto" &&
		recommendation.optimizerOptimal === false
	) {
		reasons.push(
			reason(
				"optimizer-unproven",
				"blocked",
				"The automatic exact optimizer did not prove optimality inside the configured search budget.",
			),
		);
	} else if (recommendation.optimizerOptimal !== true) {
		reasons.push(
			reason(
				"optimizer-unproven",
				"caution",
				"The selected set does not carry an exact optimality proof.",
			),
		);
	}

	if (backtest && backtest.holdoutRecall < 1) {
		reasons.push(
			reason(
				"temporal-validation-miss",
				"blocked",
				"Single-holdout failure recall is " +
					(backtest.holdoutRecall * 100).toFixed(1) +
					"%.",
			),
		);
	}
	if (
		backtest?.unseenHoldoutRecall != null &&
		backtest.unseenHoldoutRecall < 1
	) {
		reasons.push(
			reason(
				"unseen-failure-miss",
				"blocked",
				"Single-holdout unseen-failure recall is " +
					(backtest.unseenHoldoutRecall * 100).toFixed(1) +
					"%.",
			),
		);
	}

	if (!rolling || rolling.validFolds === 0) {
		reasons.push(
			reason(
				"temporal-validation-unavailable",
				"caution",
				"Rolling temporal validation has no valid fold with analyzable holdout failure evidence.",
			),
		);
	} else {
		if (rolling.validFolds < 2) {
			reasons.push(
				reason(
					"temporal-validation-sparse",
					"caution",
					"Only " + rolling.validFolds + " rolling temporal fold is valid.",
				),
			);
		}
		if (rolling.worstHoldoutRecall != null && rolling.worstHoldoutRecall < 1) {
			reasons.push(
				reason(
					"temporal-validation-miss",
					"blocked",
					"Worst valid rolling-fold failure recall is " +
						(rolling.worstHoldoutRecall * 100).toFixed(1) +
						"%.",
				),
			);
		}
		if (
			rolling.aggregateUnseenHoldoutRecall != null &&
			rolling.aggregateUnseenHoldoutRecall < 1
		) {
			reasons.push(
				reason(
					"unseen-failure-miss",
					"blocked",
					"Rolling unseen-failure recall is " +
						(rolling.aggregateUnseenHoldoutRecall * 100).toFixed(1) +
						"%.",
				),
			);
		}
		if (
			rolling.meanPairwiseSelectionJaccard != null &&
			rolling.meanPairwiseSelectionJaccard < 0.75
		) {
			reasons.push(
				reason(
					"unstable-selection",
					"caution",
					"Selected cell sets vary substantially across rolling folds (mean Jaccard " +
						(rolling.meanPairwiseSelectionJaccard * 100).toFixed(1) +
						"%).",
				),
			);
		}
	}

	if (recommendation.pricingCoverage < 1) {
		reasons.push(
			reason(
				"pricing-incomplete",
				"caution",
				"Runner pricing coverage is " +
					(recommendation.pricingCoverage * 100).toFixed(1) +
					"%; monetary estimates are incomplete.",
			),
		);
	}

	const level: RecommendationReadinessLevel = reasons.some(
		(item) => item.severity === "blocked",
	)
		? "blocked"
		: reasons.some((item) => item.severity === "diagnostic")
			? "diagnostic-only"
			: reasons.some((item) => item.severity === "caution")
				? "caution"
				: "ready";

	return {
		level,
		automationEligible: level === "ready" || level === "caution",
		metrics,
		reasons,
	};
}
