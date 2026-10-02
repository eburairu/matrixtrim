import { describe, expect, it } from "vitest";
import { formatActionReport } from "../src/action-report.js";
import type { BacktestReport, RollingBacktestReport } from "../src/backtest.js";
import type { RecommendationReport } from "../src/recommend.js";

describe("GitHub Action report", () => {
	it("renders recommendation and backtest metrics", () => {
		const recommendation: RecommendationReport = {
			mode: "history+combinatorial",
			algorithm: "exact-branch-and-bound",
			optimizerMode: "auto",
			optimizerOptimal: true,
			optimizerSearchNodes: 42,
			greedyObjectiveCost: 50,
			selectedObjectiveCost: 40,
			optimizerImprovementPercent: 20,
			coverageStrength: 2,
			currentCells: 8,
			selectedCells: [
				{
					cell: "test (ubuntu, 20)",
					baseJob: "test",
					medianRuntimeSeconds: 10,
					runnerLabels: ["ubuntu-latest"],
					estimatedListPriceUsdPerRun: 0.006,
					coveredFailures: 2,
					coveredCombinations: 4,
				},
			],
			historicalFingerprints: 2,
			coveredFingerprints: 2,
			historicalRecall: 1,
			failureEvents: 3,
			failedJobsWithEvents: 2,
			multiEventJobs: 1,
			combinatorialRequirements: 12,
			coveredCombinatorialRequirements: 12,
			combinatorialCoverage: 1,
			unresolvedAxisCells: [],
			currentEstimatedSeconds: 80,
			selectedEstimatedSeconds: 40,
			estimatedComputeReductionPercent: 50,
			pricingCoverage: 1,
			currentEstimatedListPriceUsdPerRun: 0.048,
			selectedEstimatedListPriceUsdPerRun: 0.006,
			estimatedListPriceReductionPercent: 87.5,
			projectedRunsPer30Days: 100,
			currentProjectedListPriceUsd30Days: 4.8,
			selectedProjectedListPriceUsd30Days: 0.6,
			pricing: {
				repositoryVisibility: "public",
				currentCells: 8,
				pricedCells: 8,
				selectedCells: 1,
				selectedPricedCells: 1,
				unpricedCells: [],
				currentRateCardUsdPerRun: 0.048,
				selectedRateCardUsdPerRun: 0.006,
				rateCardSavingsUsdPerRun: 0.042,
				rateCardReductionPercent: 87.5,
				currentEstimatedChargeUsdPerRun: 0,
				selectedEstimatedChargeUsdPerRun: 0,
				estimatedChargeSavingsUsdPerRun: 0,
				estimatedChargeReductionPercent: null,
				projectedRunsPer30Days: 100,
				currentRateCardUsdPer30Days: 4.8,
				selectedRateCardUsdPer30Days: 0.6,
				currentEstimatedChargeUsdPer30Days: 0,
				selectedEstimatedChargeUsdPer30Days: 0,
				note: "Standard GitHub-hosted runners are free in public repositories.",
			},
			constraintRequirements: 2,
			coveredConstraintRequirements: 2,
			keptCells: ["test (ubuntu, 20)"],
			requiredSelectors: 1,
			warnings: ["example warning"],
		};

		const backtest: BacktestReport = {
			mode: "time-holdout",
			holdoutPercent: 25,
			coverageStrength: 2,
			trainingRuns: 6,
			holdoutRuns: 2,
			selectedCells: ["test (ubuntu, 20)"],
			optimizerAlgorithm: "exact-branch-and-bound",
			optimizerOptimal: true,
			optimizerSearchNodes: 21,
			trainingFingerprints: 2,
			holdoutFingerprints: 2,
			coveredHoldoutFingerprints: 2,
			holdoutRecall: 1,
			unseenHoldoutFingerprints: 1,
			coveredUnseenHoldoutFingerprints: 1,
			unseenHoldoutRecall: 1,
			holdoutCombinatorialRequirements: 12,
			coveredHoldoutCombinatorialRequirements: 12,
			holdoutCombinatorialCoverage: 1,
			missed: [],
			warnings: [],
		};

		const rollingBacktest: RollingBacktestReport = {
			mode: "rolling-time-validation",
			requestedFolds: 4,
			foldCount: 4,
			validFolds: 3,
			invalidFolds: 1,
			coverageStrength: 2,
			aggregateHoldoutFingerprints: 6,
			aggregateCoveredHoldoutFingerprints: 5,
			aggregateHoldoutRecall: 5 / 6,
			worstHoldoutRecall: 0.5,
			aggregateUnseenHoldoutFingerprints: 3,
			aggregateCoveredUnseenHoldoutFingerprints: 2,
			aggregateUnseenHoldoutRecall: 2 / 3,
			worstUnseenHoldoutRecall: 0.5,
			meanPairwiseSelectionJaccard: 0.75,
			cellSelectionFrequency: [
				{ cell: "test (ubuntu, 20)", selectedFolds: 3, frequency: 1 },
			],
			folds: [],
			warnings: [],
		};

		const report = formatActionReport(
			"owner/repo",
			"ci.yml",
			recommendation,
			backtest,
			undefined,
			rollingBacktest,
		);

		expect(report).toContain("<!-- matrixtrim-report -->");
		expect(report).toContain("| Current matrix cells | 8 |");
		expect(report).toContain("| Suggested cells | 1 |");
		expect(report).toContain(
			"| Optimizer | exact-branch-and-bound (mode=auto, optimal=true, nodes=42) |",
		);
		expect(report).toContain("| Optimizer improvement vs greedy | 20.0% |");
		expect(report).toContain(
			"| Holdout optimizer | exact-branch-and-bound (optimal=true, nodes=21) |",
		);
		expect(report).toContain("| Failure events | 3 |");
		expect(report).toContain("| Failed jobs with events | 2 |");
		expect(report).toContain("| Multi-event jobs | 1 |");
		expect(report).toContain("| Explicit hard constraints | 2/2 |");
		expect(report).toContain("| Estimated compute reduction | 50.0% |");
		expect(report).toContain("| Pricing coverage | 100.0% |");
		expect(report).toContain(
			"| Standard runner rate-card / run | $0.048 → $0.006 |",
		);
		expect(report).toContain(
			"| Projected 30-day rate-card equivalent | $4.80 → $0.60 (100.0 runs) |",
		);
		expect(report).toContain(
			"| Estimated GitHub charge / run | $0.000 → $0.000 |",
		);
		expect(report).toContain("| Estimated GitHub charge reduction | n/a |");
		expect(report).toContain(
			"Standard GitHub-hosted runners are free in public repositories.",
		);
		expect(report).toContain("| Holdout failure recall | 2/2 (100.0%) |");
		expect(report).toContain("| Rolling valid folds | 3/4 |");
		expect(report).toContain(
			"| Rolling aggregate failure recall | 5/6 (83.3%) |",
		);
		expect(report).toContain("| Rolling worst-fold recall | 50.0% |");
		expect(report).toContain("| Selection stability (mean Jaccard) | 75.0% |");
		expect(report).toContain("evidence, not proof");
	});
});
