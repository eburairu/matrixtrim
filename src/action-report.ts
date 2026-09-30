import type { RecommendationReport } from "./recommend.js";
import type { BacktestReport } from "./backtest.js";

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
): string {
  const selected = recommendation.selectedCells
    .map((cell) => `- \`${cell.cell}\` — failures=${cell.coveredFailures}, combinations=${cell.coveredCombinations}, median=${seconds(cell.medianRuntimeSeconds)}, list-price/run=${dollars(cell.estimatedListPriceUsdPerRun)}`)
    .join("\n");

  const historical = recommendation.historicalRecall === null
    ? "n/a (no analyzed failure fingerprints)"
    : `${recommendation.coveredFingerprints}/${recommendation.historicalFingerprints} (${percent(recommendation.historicalRecall)})`;

  const combinatorial = recommendation.combinatorialCoverage === null
    ? "n/a"
    : `${recommendation.coveredCombinatorialRequirements}/${recommendation.combinatorialRequirements} (${percent(recommendation.combinatorialCoverage)})`;

  const reduction = recommendation.estimatedComputeReductionPercent === null
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
        `| Holdout failure recall | ${backtest.coveredHoldoutFingerprints}/${backtest.holdoutFingerprints} (${percent(backtest.holdoutRecall)}) |`,
        `| Unseen-failure recall | ${backtest.unseenHoldoutRecall === null ? "n/a" : `${backtest.coveredUnseenHoldoutFingerprints}/${backtest.unseenHoldoutFingerprints} (${percent(backtest.unseenHoldoutRecall)})`} |`,
        `| Holdout combinatorial coverage | ${backtest.holdoutCombinatorialCoverage === null ? "n/a" : `${backtest.coveredHoldoutCombinatorialRequirements}/${backtest.holdoutCombinatorialRequirements} (${percent(backtest.holdoutCombinatorialCoverage)})`} |`,
      ].join("\n")
    : `| Backtest | unavailable${backtestError ? `: ${backtestError}` : ""} |`;

  const warnings = recommendation.warnings
    .map((warning) => `- ⚠️ ${warning}`)
    .join("\n");

  return `<!-- matrixtrim-report -->
## MatrixTrim analysis

**Repository:** \`${repository}\`  
**Workflow:** \`${workflow ?? "all"}\`  
**Coverage strength:** ${recommendation.coverageStrength}

| Metric | Result |
| --- | ---: |
| Current matrix cells | ${recommendation.currentCells} |
| Suggested cells | ${recommendation.selectedCells.length} |
| Historical failure recall | ${historical} |
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

<details>
<summary>Suggested cells</summary>

${selected || "_No cells selected._"}

</details>

### Interpretation

MatrixTrim measures the historical failure-detection value of CI configurations. A recommendation is **evidence, not proof that removed configurations can never catch a future failure**.

**Billing note:** ${recommendation.pricing.note}

${warnings}

_Generated by MatrixTrim._
`;
}
