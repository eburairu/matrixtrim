import { describe, expect, it } from "vitest";
import type { AnalysisReport } from "../src/analyze.js";
import {
	backtestRecommendation,
	rollingBacktestRecommendation,
} from "../src/backtest.js";

function makeReport(): AnalysisReport {
	return {
		repository: "owner/repo",
		workflow: "ci.yml",
		workflowPath: ".github/workflows/ci.yml",
		runsAnalyzed: 4,
		failedJobs: 4,
		ignoredNonMatrixJobs: 0,
		fingerprints: 3,
		logErrors: 0,
		expiredLogs: 0,
		cells: [
			{
				cell: "test (a)",
				baseJob: "test",
				axes: { env: "a" },
				axisSource: "workflow-job-name",
				runsObserved: 4,
				successRuns: 3,
				failureRuns: 1,
				otherRuns: 0,
				observations: 2,
				distinctFailures: 2,
				uniqueFailures: 1,
				medianRuntimeSeconds: 1,
			},
			{
				cell: "test (b)",
				baseJob: "test",
				axes: { env: "b" },
				axisSource: "workflow-job-name",
				runsObserved: 4,
				successRuns: 2,
				failureRuns: 2,
				otherRuns: 0,
				observations: 2,
				distinctFailures: 2,
				uniqueFailures: 1,
				medianRuntimeSeconds: 2,
			},
		],
		clusters: [
			{
				fingerprint: "f1",
				signature: ["Error: f1"],
				cells: ["test (a)", "test (b)"],
				observations: 2,
			},
			{
				fingerprint: "f2",
				signature: ["Error: f2"],
				cells: ["test (b)"],
				observations: 1,
			},
			{
				fingerprint: "f3",
				signature: ["Error: f3"],
				cells: ["test (a)"],
				observations: 1,
			},
		],
		observations: [
			{
				runId: 1,
				runNumber: 1,
				jobId: 11,
				cell: "test (a)",
				baseJob: "test",
				fingerprint: "f1",
				signature: ["Error: f1"],
				evidence: [],
			},
			{
				runId: 1,
				runNumber: 1,
				jobId: 12,
				cell: "test (b)",
				baseJob: "test",
				fingerprint: "f1",
				signature: ["Error: f1"],
				evidence: [],
			},
			{
				runId: 3,
				runNumber: 3,
				jobId: 31,
				cell: "test (b)",
				baseJob: "test",
				fingerprint: "f2",
				signature: ["Error: f2"],
				evidence: [],
			},
			{
				runId: 4,
				runNumber: 4,
				jobId: 41,
				cell: "test (a)",
				baseJob: "test",
				fingerprint: "f3",
				signature: ["Error: f3"],
				evidence: [],
			},
		],
		matrixJobs: [
			{
				runId: 1,
				runNumber: 1,
				jobId: 11,
				cell: "test (a)",
				baseJob: "test",
				axes: { env: "a" },
				axisSource: "workflow-job-name",
				conclusion: "failure",
				runtimeSeconds: 1,
			},
			{
				runId: 1,
				runNumber: 1,
				jobId: 12,
				cell: "test (b)",
				baseJob: "test",
				axes: { env: "b" },
				axisSource: "workflow-job-name",
				conclusion: "failure",
				runtimeSeconds: 2,
			},
			{
				runId: 2,
				runNumber: 2,
				jobId: 21,
				cell: "test (a)",
				baseJob: "test",
				axes: { env: "a" },
				axisSource: "workflow-job-name",
				conclusion: "success",
				runtimeSeconds: 1,
			},
			{
				runId: 2,
				runNumber: 2,
				jobId: 22,
				cell: "test (b)",
				baseJob: "test",
				axes: { env: "b" },
				axisSource: "workflow-job-name",
				conclusion: "success",
				runtimeSeconds: 2,
			},
			{
				runId: 3,
				runNumber: 3,
				jobId: 31,
				cell: "test (b)",
				baseJob: "test",
				axes: { env: "b" },
				axisSource: "workflow-job-name",
				conclusion: "failure",
				runtimeSeconds: 2,
			},
			{
				runId: 3,
				runNumber: 3,
				jobId: 32,
				cell: "test (a)",
				baseJob: "test",
				axes: { env: "a" },
				axisSource: "workflow-job-name",
				conclusion: "success",
				runtimeSeconds: 100,
			},
			{
				runId: 4,
				runNumber: 4,
				jobId: 41,
				cell: "test (a)",
				baseJob: "test",
				axes: { env: "a" },
				axisSource: "workflow-job-name",
				conclusion: "failure",
				runtimeSeconds: 100,
			},
			{
				runId: 4,
				runNumber: 4,
				jobId: 42,
				cell: "test (b)",
				baseJob: "test",
				axes: { env: "b" },
				axisSource: "workflow-job-name",
				conclusion: "success",
				runtimeSeconds: 1,
			},
		],
	};
}

describe("time holdout backtest", () => {
	it("selects using only training-window runtimes and tests newer failures", () => {
		const result = backtestRecommendation(makeReport(), 50);

		expect(result.trainingRuns).toBe(2);
		expect(result.holdoutRuns).toBe(2);
		expect(result.coverageStrength).toBe(2);
		expect(result.selectedCells.sort()).toEqual(["test (a)", "test (b)"]);
		expect(result.holdoutFingerprints).toBe(2);
		expect(result.coveredHoldoutFingerprints).toBe(2);
		expect(result.holdoutRecall).toBe(1);
		expect(result.unseenHoldoutFingerprints).toBe(2);
		expect(result.unseenHoldoutRecall).toBe(1);
		expect(result.holdoutCombinatorialRequirements).toBe(2);
		expect(result.coveredHoldoutCombinatorialRequirements).toBe(2);
		expect(result.holdoutCombinatorialCoverage).toBe(1);
		expect(result.missed).toHaveLength(0);
	});

	it("applies the same explicit constraints to the training recommendation", () => {
		const result = backtestRecommendation(makeReport(), 50, 2, {
			keep: ["test (a)"],
			require: [],
		});

		expect(result.selectedCells).toContain("test (a)");
		expect(result.warnings.join("\n")).toContain(
			"Applied 1 explicit hard constraint",
		);
	});
});

describe("rolling temporal backtest", () => {
	it("evaluates newer folds without requiring failure evidence in every holdout", () => {
		const result = rollingBacktestRecommendation(makeReport(), 3);

		expect(result.foldCount).toBe(3);
		expect(result.validFolds).toBe(2);
		expect(result.invalidFolds).toBe(1);
		expect(result.aggregateHoldoutFingerprints).toBe(2);
		expect(result.aggregateCoveredHoldoutFingerprints).toBe(2);
		expect(result.aggregateHoldoutRecall).toBe(1);
		expect(result.worstHoldoutRecall).toBe(1);
		expect(result.aggregateUnseenHoldoutRecall).toBe(1);
		expect(result.meanPairwiseSelectionJaccard).toBe(1);
		expect(result.cellSelectionFrequency).toEqual([
			{ cell: "test (a)", selectedFolds: 2, frequency: 1 },
			{ cell: "test (b)", selectedFolds: 2, frequency: 1 },
		]);
		expect(result.folds[0]).toMatchObject({
			status: "invalid",
			reason: "no analyzable failure fingerprints in holdout window",
		});
	});

	it("returns null recall and stability when no fold has holdout failure evidence", () => {
		const report = makeReport();
		report.observations = report.observations.filter(
			(item) => item.runId === 1,
		);
		const result = rollingBacktestRecommendation(report, 3);

		expect(result.validFolds).toBe(0);
		expect(result.aggregateHoldoutRecall).toBeNull();
		expect(result.worstHoldoutRecall).toBeNull();
		expect(result.aggregateUnseenHoldoutRecall).toBeNull();
		expect(result.meanPairwiseSelectionJaccard).toBeNull();
		expect(result.cellSelectionFrequency).toEqual([]);
	});

	it("does not leak newer holdout runtimes into an earlier fold selection", () => {
		const report = makeReport();
		for (const job of report.matrixJobs) job.axes = { env: "same" };
		const result = rollingBacktestRecommendation(report, 2);

		expect(result.folds[0]).toMatchObject({
			status: "valid",
			trainingRuns: 2,
			holdoutRuns: 1,
			selectedCells: ["test (a)"],
			holdoutRecall: 0,
		});
	});
});
