import type { BacktestReport, RollingBacktestReport } from "./backtest.js";
import type { RecommendationReport } from "./recommend.js";

const percent = (value: number | null): string =>
	value === null ? "n/a" : `${(value * 100).toFixed(1)}%`;

const seconds = (value: number | null): string =>
	value === null ? "n/a" : `${value.toFixed(1)}s`;

const dollars = (value: number | null, digits = 3): string =>
	value === null ? "n/a" : `$${value.toFixed(digits)}`;

export function formatActionReport(
	repository: string,
	workflow: string | undefined,
	recommendation: RecommendationReport,
	backtest: BacktestReport | null,
	backtestError?: string,
	rollingBacktest?: RollingBacktestReport | null,
	rollingBacktestError?: string,
): string {
	const selected = recommendation.selectedCells
		.map(
			(cell) =>
				`- \`${cell.cell}\` — failures=${cell.coveredFailures}, combinations=${cell.coveredCombinations}, median=${seconds(cell.medianRuntimeSeconds)}, list-price/run=${dollars(cell.estimatedListPriceUsdPerRun)}`,
		)
		.join("\n");

	const historical =
		recommendation.historicalRecall === null
			? "n/a (no analyzed failure fingerprints)"
			: `${recommendation.coveredFingerprints}/${recommendation.historicalFingerprints} (${percent(recommendation.historicalRecall)})`;

	const combinatorial =
		recommendation.combinatorialCoverage === null
			? "n/a"
			: `${recommendation.coveredCombinatorialRequirements}/${recommendation.combinatorialRequirements} (${percent(recommendation.combinatorialCoverage)})`;

	const reduction =
		recommendation.estimatedComputeReductionPercent === null
			? "n/a"
			: `${recommendation.estimatedComputeReductionPercent.toFixed(1)}%`;

	const listPricePerRun =
		recommendation.currentEstimatedListPriceUsdPerRun === null ||
		recommendation.selectedEstimatedListPriceUsdPerRun === null
			? "n/a"
			: `${dollars(recommendation.currentEstimatedListPriceUsdPerRun)} → ${dollars(recommendation.selectedEstimatedListPriceUsdPerRun)}`;
	const listPriceReduction =
		recommendation.estimatedListPriceReductionPercent === null
			? "n/a"
			: `${recommendation.estimatedListPriceReductionPercent.toFixed(1)}%`;
	const projected30d =
		recommendation.currentProjectedListPriceUsd30Days === null ||
		recommendation.selectedProjectedListPriceUsd30Days === null ||
		recommendation.projectedRunsPer30Days === null
			? "n/a"
			: `${dollars(recommendation.currentProjectedListPriceUsd30Days, 2)} → ${dollars(recommendation.selectedProjectedListPriceUsd30Days, 2)} (${recommendation.projectedRunsPer30Days.toFixed(1)} runs)`;

	const estimatedChargePerRun =
		recommendation.pricing.currentEstimatedChargeUsdPerRun === null ||
		recommendation.pricing.selectedEstimatedChargeUsdPerRun === null
			? "n/a"
			: `${dollars(recommendation.pricing.currentEstimatedChargeUsdPerRun)} → ${dollars(recommendation.pricing.selectedEstimatedChargeUsdPerRun)}`;
	const estimatedChargeReduction =
		recommendation.pricing.estimatedChargeReductionPercent === null
			? "n/a"
			: `${recommendation.pricing.estimatedChargeReductionPercent.toFixed(1)}%`;
	const projectedCharge30d =
		recommendation.pricing.currentEstimatedChargeUsdPer30Days === null ||
		recommendation.pricing.selectedEstimatedChargeUsdPer30Days === null ||
		recommendation.pricing.projectedRunsPer30Days === null
			? "n/a"
			: `${dollars(recommendation.pricing.currentEstimatedChargeUsdPer30Days, 2)} → ${dollars(recommendation.pricing.selectedEstimatedChargeUsdPer30Days, 2)} (${recommendation.pricing.projectedRunsPer30Days.toFixed(1)} runs)`;
	const repositoryVisibility =
		recommendation.pricing.repositoryVisibility ?? "unknown";

	const backtestRows = backtest
		? [
				`| Holdout optimizer | ${backtest.optimizerAlgorithm} (optimal=${backtest.optimizerOptimal ?? "n/a"}, nodes=${backtest.optimizerSearchNodes}) |`,
				`| Holdout failure recall | ${backtest.coveredHoldoutFingerprints}/${backtest.holdoutFingerprints} (${percent(backtest.holdoutRecall)}) |`,
				`| Unseen-failure recall | ${backtest.unseenHoldoutRecall === null ? "n/a" : `${backtest.coveredUnseenHoldoutFingerprints}/${backtest.unseenHoldoutFingerprints} (${percent(backtest.unseenHoldoutRecall)})`} |`,
				`| Holdout combinatorial coverage | ${backtest.holdoutCombinatorialCoverage === null ? "n/a" : `${backtest.coveredHoldoutCombinatorialRequirements}/${backtest.holdoutCombinatorialRequirements} (${percent(backtest.holdoutCombinatorialCoverage)})`} |`,
			].join("\n")
		: `| Backtest | unavailable${backtestError ? `: ${backtestError}` : ""} |`;

	const decisionLines = recommendation.cellDecisions
		.slice(0, 40)
		.map((decision) => {
			if (decision.decision === "selected") {
				const uncovered =
					decision.counterfactualUncoveredRequirements?.total ?? 0;
				return `- **KEEP** \`${decision.cell}\` — reasons=${decision.reasonCodes.join(", ")}, uncovered-if-removed=${uncovered}, objective-cost=${decision.objectiveCost.toFixed(1)}`;
			}
			const replacements = decision.replacementCells
				.map((item) => `\`${item.cell}\``)
				.join(", ");
			return `- **OMIT** \`${decision.cell}\` — reasons=${decision.reasonCodes.join(", ")}, replaced-by=${replacements || "n/a"}, objective-cost=${decision.objectiveCost.toFixed(1)}`;
		})
		.join("\n");
	const decisionTruncation =
		recommendation.cellDecisions.length > 40
			? `\n\n_Showing 40/${recommendation.cellDecisions.length} decisions. The complete structured explanations are available from the JSON CLI output._`
			: "";
	const rollingRows = rollingBacktest
		? [
				`| Rolling valid folds | ${rollingBacktest.validFolds}/${rollingBacktest.foldCount} |`,
				`| Rolling aggregate failure recall | ${rollingBacktest.aggregateHoldoutRecall === null ? "n/a" : `${rollingBacktest.aggregateCoveredHoldoutFingerprints}/${rollingBacktest.aggregateHoldoutFingerprints} (${percent(rollingBacktest.aggregateHoldoutRecall)})`} |`,
				`| Rolling worst-fold recall | ${percent(rollingBacktest.worstHoldoutRecall)} |`,
				`| Rolling unseen-failure recall | ${rollingBacktest.aggregateUnseenHoldoutRecall === null ? "n/a" : `${rollingBacktest.aggregateCoveredUnseenHoldoutFingerprints}/${rollingBacktest.aggregateUnseenHoldoutFingerprints} (${percent(rollingBacktest.aggregateUnseenHoldoutRecall)})`} |`,
				`| Selection stability (mean Jaccard) | ${percent(rollingBacktest.meanPairwiseSelectionJaccard)} |`,
			].join("\n")
		: `| Rolling validation | unavailable${rollingBacktestError ? `: ${rollingBacktestError}` : ""} |`;

	const warnings = recommendation.warnings
		.map((warning) => `- ⚠️ ${warning}`)
		.join("\n");
	const readinessReasons = recommendation.readiness.reasons.length
		? recommendation.readiness.reasons
				.map((item) => `- \`${item.code}\` — ${item.message}`)
				.join("\n")
		: "- No readiness downgrade reasons.";

	return `<!-- matrixtrim-report -->
## MatrixTrim analysis

**Repository:** \`${repository}\`<br>
**Workflow:** \`${workflow ?? "all"}\`<br>
**Coverage strength:** ${recommendation.coverageStrength}

| Metric | Result |
| --- | ---: |
| Recommendation readiness | **${recommendation.readiness.level}** (automation=${recommendation.readiness.automationEligible ? "eligible" : "not eligible"}) |
| Current matrix cells | ${recommendation.currentCells} |
| Suggested cells | ${recommendation.selectedCells.length} |
| Optimizer | ${recommendation.algorithm} (mode=${recommendation.optimizerMode}, optimal=${recommendation.optimizerOptimal ?? "n/a"}, nodes=${recommendation.optimizerSearchNodes}) |
| Optimizer improvement vs greedy | ${recommendation.optimizerImprovementPercent.toFixed(1)}% |
| Historical failure recall | ${historical} |
| Failure events | ${recommendation.failureEvents} |
| Failed jobs with events | ${recommendation.failedJobsWithEvents} |
| Multi-event jobs | ${recommendation.multiEventJobs} |
| Observed combinatorial coverage | ${combinatorial} |
| Explicit hard constraints | ${recommendation.coveredConstraintRequirements}/${recommendation.constraintRequirements} |
| Estimated compute | ${seconds(recommendation.currentEstimatedSeconds)} → ${seconds(recommendation.selectedEstimatedSeconds)} |
| Estimated compute reduction | ${reduction} |
| Pricing coverage | ${percent(recommendation.pricingCoverage)} |
| Repository visibility | ${repositoryVisibility} |
| Standard runner rate-card / run | ${listPricePerRun} |
| Rate-card reduction | ${listPriceReduction} |
| Projected 30-day rate-card equivalent | ${projected30d} |
| Estimated GitHub charge / run | ${estimatedChargePerRun} |
| Estimated GitHub charge reduction | ${estimatedChargeReduction} |
| Projected 30-day GitHub charge | ${projectedCharge30d} |
${backtestRows}
${rollingRows}

<details>
<summary>Suggested cells</summary>

${selected || "_No cells selected._"}

</details>

### Readiness

${readinessReasons}
<details>
<summary>Why cells were kept or omitted</summary>

${decisionLines || "_No cell decision explanations available._"}${decisionTruncation}

</details>

### Interpretation

MatrixTrim measures the historical failure-detection value of CI configurations. A recommendation is **evidence, not proof that removed configurations can never catch a future failure**.

**Billing note:** ${recommendation.pricing.note}

${warnings}

_Generated by MatrixTrim._
`;
}
