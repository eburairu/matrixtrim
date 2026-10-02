import { describe, expect, it } from "vitest";
import type { AnalysisReport } from "../src/analyze.js";
import type { BacktestReport, RollingBacktestReport } from "../src/backtest.js";
import { evaluateRecommendationReadiness } from "../src/readiness.js";
import { recommendMatrix } from "../src/recommend.js";

function analysis(): AnalysisReport {
	const cells = [
		{
			cell: "test (ubuntu)",
			baseJob: "test",
			axes: { os: "ubuntu" },
			axisSource: "workflow-job-name" as const,
			runsObserved: 6,
			successRuns: 5,
			failureRuns: 1,
			otherRuns: 0,
			observations: 3,
			distinctFailures: 1,
			uniqueFailures: 0,
			medianRuntimeSeconds: 10,
			runnerLabels: ["ubuntu-latest"],
		},
		{
			cell: "test (windows)",
			baseJob: "test",
			axes: { os: "windows" },
			axisSource: "workflow-job-name" as const,
			runsObserved: 6,
			successRuns: 5,
			failureRuns: 1,
			otherRuns: 0,
			observations: 3,
			distinctFailures: 1,
			uniqueFailures: 0,
			medianRuntimeSeconds: 12,
			runnerLabels: ["windows-latest"],
		},
	];
	const observations = Array.from({ length: 6 }, (_, index) => ({
		runId: index + 1,
		runNumber: index + 1,
		jobId: 100 + index,
		cell: index % 2 ? "test (windows)" : "test (ubuntu)",
		baseJob: "test",
		fingerprint: "f1",
		signature: ["Error: boom"],
		evidence: ["Error: boom"],
	}));
	const matrixJobs = Array.from({ length: 6 }, (_, index) =>
		cells.map((cell, cellIndex) => ({
			runId: index + 1,
			runNumber: index + 1,
			runConclusion: "success",
			jobId: 1000 + index * 10 + cellIndex,
			cell: cell.cell,
			baseJob: "test",
			axes: cell.axes,
			axisSource: "workflow-job-name" as const,
			conclusion: "success",
			runtimeSeconds: cell.medianRuntimeSeconds,
			runnerLabels: cell.runnerLabels,
		})),
	).flat();
	return {
		repository: "owner/repo",
		repositoryVisibility: "public",
		workflow: "ci.yml",
		workflowPath: ".github/workflows/ci.yml",
		runsAnalyzed: 6,
		failedJobs: 6,
		ignoredNonMatrixJobs: 0,
		fingerprints: 1,
		logErrors: 0,
		expiredLogs: 0,
		workflowDefinitionErrors: 0,
		workflowStaticDefinitionCells: 12,
		workflowRenderedDefinitionCells: 12,
		workflowRenderCoverage: 1,
		workflowExpectedMatrixCells: 12,
		workflowMatchedMatrixCells: 12,
		workflowMatchCoverage: 1,
		inactiveStaticMatrixFamilies: 0,
		dynamicMatrixDefinitions: 0,
		captureEvidenceCandidates: 0,
		captureEvidenceJobs: 0,
		captureEvidenceErrors: 0,
		diagnostics: [],
		runWindowDays: 10,
		projectedRunsPer30Days: 18,
		cells,
		clusters: [
			{
				fingerprint: "f1",
				signature: ["Error: boom"],
				cells: ["test (ubuntu)", "test (windows)"],
				observations: 6,
			},
		],
		observations,
		matrixJobs,
	};
}

function backtest(): BacktestReport {
	return {
		mode: "time-holdout",
		holdoutPercent: 25,
		coverageStrength: 1,
		trainingRuns: 4,
		holdoutRuns: 2,
		selectedCells: ["test (ubuntu)", "test (windows)"],
		optimizerAlgorithm: "exact-branch-and-bound",
		optimizerOptimal: true,
		optimizerSearchNodes: 3,
		trainingFingerprints: 1,
		holdoutFingerprints: 1,
		coveredHoldoutFingerprints: 1,
		holdoutRecall: 1,
		unseenHoldoutFingerprints: 0,
		coveredUnseenHoldoutFingerprints: 0,
		unseenHoldoutRecall: null,
		holdoutCombinatorialRequirements: 2,
		coveredHoldoutCombinatorialRequirements: 2,
		holdoutCombinatorialCoverage: 1,
		missed: [],
		warnings: [],
	};
}

function rolling(): RollingBacktestReport {
	return {
		mode: "rolling-time-validation",
		requestedFolds: 4,
		foldCount: 4,
		validFolds: 3,
		invalidFolds: 1,
		coverageStrength: 1,
		aggregateHoldoutFingerprints: 3,
		aggregateCoveredHoldoutFingerprints: 3,
		aggregateHoldoutRecall: 1,
		worstHoldoutRecall: 1,
		aggregateUnseenHoldoutFingerprints: 1,
		aggregateCoveredUnseenHoldoutFingerprints: 1,
		aggregateUnseenHoldoutRecall: 1,
		worstUnseenHoldoutRecall: 1,
		meanPairwiseSelectionJaccard: 0.9,
		cellSelectionFrequency: [],
		folds: [],
		warnings: [],
	};
}

describe("recommendation readiness", () => {
	it("marks fully resolved, temporally validated evidence as ready", () => {
		const a = analysis();
		const recommendation = recommendMatrix(a, { maxStrength: 1 });
		const result = evaluateRecommendationReadiness(
			a,
			recommendation,
			backtest(),
			rolling(),
		);
		expect(result.level).toBe("ready");
		expect(result.automationEligible).toBe(true);
		expect(result.reasons).toEqual([]);
	});

	it("marks sparse failure evidence as caution", () => {
		const a = analysis();
		a.observations = a.observations.slice(0, 2);
		const recommendation = recommendMatrix(a, { maxStrength: 1 });
		const result = evaluateRecommendationReadiness(
			a,
			recommendation,
			backtest(),
			rolling(),
		);
		expect(result.level).toBe("caution");
		expect(result.reasons.map((item) => item.code)).toContain(
			"sparse-failure-evidence",
		);
	});

	it("marks zero failure evidence as diagnostic-only", () => {
		const a = analysis();
		a.fingerprints = 0;
		a.observations = [];
		a.clusters = [];
		const recommendation = recommendMatrix(a, { maxStrength: 1 });
		const result = evaluateRecommendationReadiness(
			a,
			recommendation,
			null,
			rolling(),
		);
		expect(result.level).toBe("diagnostic-only");
		expect(result.automationEligible).toBe(false);
		expect(result.reasons.map((item) => item.code)).toContain(
			"no-failure-evidence",
		);
	});

	it("blocks automation when temporal validation misses failures", () => {
		const a = analysis();
		const recommendation = recommendMatrix(a, { maxStrength: 1 });
		const validation = rolling();
		validation.worstHoldoutRecall = 0.5;
		const result = evaluateRecommendationReadiness(
			a,
			recommendation,
			backtest(),
			validation,
		);
		expect(result.level).toBe("blocked");
		expect(result.automationEligible).toBe(false);
		expect(result.reasons.map((item) => item.code)).toContain(
			"temporal-validation-miss",
		);
	});
});
