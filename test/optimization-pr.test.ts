import { describe, expect, it } from "vitest";
import type { AnalysisReport } from "../src/analyze.js";
import {
	createOrUpdateOptimizationPullRequest,
	type OptimizationGitHubClient,
	optimizationBranch,
	optimizationSafetyReason,
} from "../src/optimization-pr.js";
import type { RecommendationReport } from "../src/recommend.js";

const workflow = [
	"jobs:",
	"  test:",
	"    strategy:",
	"      matrix:",
	"        node: [20, 22]",
	"",
].join("\n");

function analysis(): AnalysisReport {
	return {
		repository: "owner/repo",
		repositoryVisibility: "public",
		workflow: "ci.yml",
		workflowPath: ".github/workflows/ci.yml",
		runsAnalyzed: 20,
		failedJobs: 1,
		ignoredNonMatrixJobs: 0,
		fingerprints: 1,
		logErrors: 0,
		expiredLogs: 0,
		workflowDefinitionErrors: 0,
		workflowRenderCoverage: 1,
		workflowMatchCoverage: 1,
		dynamicMatrixDefinitions: 0,
		cells: [
			{
				cell: "test (20)",
				baseJob: "test",
				axes: { node: "20" },
				axisSource: "workflow-job-name",
				runsObserved: 20,
				successRuns: 19,
				failureRuns: 1,
				otherRuns: 0,
				observations: 1,
				distinctFailures: 1,
				uniqueFailures: 1,
				medianRuntimeSeconds: 30,
			},
			{
				cell: "test (22)",
				baseJob: "test",
				axes: { node: "22" },
				axisSource: "workflow-job-name",
				runsObserved: 20,
				successRuns: 20,
				failureRuns: 0,
				otherRuns: 0,
				observations: 0,
				distinctFailures: 0,
				uniqueFailures: 0,
				medianRuntimeSeconds: 30,
			},
		],
		clusters: [],
		observations: [],
		matrixJobs: [],
	};
}

function recommendation(): RecommendationReport {
	return {
		mode: "history+combinatorial",
		algorithm: "exact-branch-and-bound",
		optimizerMode: "auto",
		optimizerOptimal: true,
		optimizerSearchNodes: 3,
		greedyObjectiveCost: 30,
		selectedObjectiveCost: 30,
		optimizerImprovementPercent: 0,
		coverageStrength: 1,
		currentCells: 2,
		cellDecisions: [],
		selectedCells: [
			{
				cell: "test (20)",
				baseJob: "test",
				medianRuntimeSeconds: 30,
				estimatedListPriceUsdPerRun: null,
				coveredFailures: 1,
				coveredCombinations: 1,
			},
		],
		historicalFingerprints: 1,
		coveredFingerprints: 1,
		historicalRecall: 1,
		failureEvents: 1,
		failedJobsWithEvents: 1,
		multiEventJobs: 0,
		combinatorialRequirements: 1,
		coveredCombinatorialRequirements: 1,
		combinatorialCoverage: 1,
		unresolvedAxisCells: [],
		currentEstimatedSeconds: 60,
		selectedEstimatedSeconds: 30,
		estimatedComputeReductionPercent: 50,
		pricingCoverage: 0,
		currentEstimatedListPriceUsdPerRun: null,
		selectedEstimatedListPriceUsdPerRun: null,
		estimatedListPriceReductionPercent: null,
		projectedRunsPer30Days: null,
		currentProjectedListPriceUsd30Days: null,
		selectedProjectedListPriceUsd30Days: null,
		pricing: {
			repositoryVisibility: "public",
			currentCells: 2,
			pricedCells: 0,
			selectedCells: 1,
			selectedPricedCells: 0,
			unpricedCells: ["test (20)", "test (22)"],
			currentRateCardUsdPerRun: null,
			selectedRateCardUsdPerRun: null,
			rateCardSavingsUsdPerRun: null,
			rateCardReductionPercent: null,
			currentEstimatedChargeUsdPerRun: null,
			selectedEstimatedChargeUsdPerRun: null,
			estimatedChargeSavingsUsdPerRun: null,
			estimatedChargeReductionPercent: null,
			projectedRunsPer30Days: null,
			currentRateCardUsdPer30Days: null,
			selectedRateCardUsdPer30Days: null,
			currentEstimatedChargeUsdPer30Days: null,
			selectedEstimatedChargeUsdPer30Days: null,
			note: "test",
		},
		constraintRequirements: 0,
		coveredConstraintRequirements: 0,
		keptCells: [],
		requiredSelectors: 0,
		warnings: [],
		readiness: {
			level: "caution",
			automationEligible: true,
			metrics: {
				axisResolution: 1,
				workflowRenderCoverage: 1,
				workflowMatchCoverage: 1,
				fingerprints: 1,
				failureEvidenceRuns: 5,
				unavailableFailedLogs: 0,
				diagnosticWarnings: 0,
				optimizerOptimal: true,
				historicalRecall: 1,
				combinatorialCoverage: 1,
				constraintCoverage: 1,
				pricingCoverage: 0,
				holdoutRecall: null,
				unseenHoldoutRecall: null,
				rollingValidFolds: null,
				rollingWorstHoldoutRecall: null,
				rollingUnseenFailureRecall: null,
				rollingSelectionStability: null,
			},
			reasons: [
				{
					code: "pricing-incomplete",
					severity: "caution",
					message: "test",
				},
			],
		},
	};
}

function client(existing = false): OptimizationGitHubClient & {
	calls: string[];
} {
	const calls: string[] = [];
	return {
		calls,
		async repositoryInfo() {
			calls.push("repositoryInfo");
			return { private: false, visibility: "public", default_branch: "main" };
		},
		async file(path, ref) {
			calls.push(`file:${path}@${ref}`);
			return { text: workflow, sha: "file-sha" };
		},
		async refSha(branch) {
			calls.push(`refSha:${branch}`);
			if (branch === "main") return "base-sha";
			return existing ? "old-branch-sha" : null;
		},
		async createBranch(branch, sha) {
			calls.push(`createBranch:${branch}@${sha}`);
		},
		async updateBranch(branch, sha) {
			calls.push(`updateBranch:${branch}@${sha}`);
		},
		async updateFile(path, branch, _sha, text) {
			calls.push(`updateFile:${path}@${branch}`);
			expect(text).toContain("include:");
			expect(text).toContain("node: 20");
			expect(text).not.toContain("node: 22");
		},
		async listOpenPullRequests(branch, base) {
			calls.push(`listPR:${branch}->${base}`);
			return existing
				? [
						{
							number: 7,
							html_url: "https://example/pr/7",
							state: "open",
							draft: true,
						},
					]
				: [];
		},
		async createPullRequest(_title, head, base, body) {
			calls.push(`createPR:${head}->${base}`);
			expect(body).toContain("2 → 1 cells");
			return {
				number: 8,
				html_url: "https://example/pr/8",
				state: "open",
				draft: true,
			};
		},
		async updatePullRequest(number, _title, body) {
			calls.push(`updatePR:${number}`);
			expect(body).toContain("2 → 1 cells");
			return {
				number,
				html_url: `https://example/pr/${number}`,
				state: "open",
				draft: true,
			};
		},
	};
}

describe("optimization pull requests", () => {
	it("uses a deterministic MatrixTrim branch", () => {
		expect(optimizationBranch(".github/workflows/CI Tests.yml")).toBe(
			"matrixtrim/optimize-ci-tests.yml",
		);
	});

	it("creates a draft optimization PR on a fresh branch", async () => {
		const github = client(false);
		const result = await createOrUpdateOptimizationPullRequest(
			github,
			analysis(),
			recommendation(),
			null,
			"no holdout evidence",
		);

		expect(result.status).toBe("created");
		expect(result.number).toBe(8);
		expect(result.url).toBe("https://example/pr/8");
		expect(github.calls).toContain(
			"createBranch:matrixtrim/optimize-ci.yml@base-sha",
		);
		expect(github.calls).toContain(
			"updateFile:.github/workflows/ci.yml@matrixtrim/optimize-ci.yml",
		);
	});

	it("resets and updates the existing MatrixTrim PR branch", async () => {
		const github = client(true);
		const result = await createOrUpdateOptimizationPullRequest(
			github,
			analysis(),
			recommendation(),
			null,
		);

		expect(result.status).toBe("updated");
		expect(result.number).toBe(7);
		expect(github.calls).toContain(
			"updateBranch:matrixtrim/optimize-ci.yml@base-sha",
		);
		expect(github.calls).toContain("updatePR:7");
	});

	it("stops updating an existing PR after it leaves draft state", async () => {
		const github = client(true);
		github.listOpenPullRequests = async (branch, base) => {
			github.calls.push(`listPR:${branch}->${base}`);
			return [
				{
					number: 7,
					html_url: "https://example/pr/7",
					state: "open",
					draft: false,
				},
			];
		};

		const result = await createOrUpdateOptimizationPullRequest(
			github,
			analysis(),
			recommendation(),
			null,
		);

		expect(result.status).toBe("skipped");
		expect(result.reason).toMatch(/no longer a draft/);
		expect(github.calls.some((call) => call.startsWith("updateBranch:"))).toBe(
			false,
		);
		expect(github.calls.some((call) => call.startsWith("updateFile:"))).toBe(
			false,
		);
	});

	it("skips auto-mode PR creation when exact optimality was not proven", async () => {
		const rec = recommendation();
		rec.algorithm = "greedy-weighted-set-cover";
		rec.optimizerOptimal = false;
		rec.optimizerSearchNodes = 250_001;
		rec.optimizerFallbackReason =
			"Exact optimizer exceeded node budget; using deterministic greedy fallback.";

		expect(optimizationSafetyReason(analysis(), rec, null)).toMatch(
			/did not prove optimality/,
		);

		const github = client(false);
		const result = await createOrUpdateOptimizationPullRequest(
			github,
			analysis(),
			rec,
			null,
		);

		expect(result.status).toBe("skipped");
		expect(github.calls).toEqual([]);
	});

	it("requires an explicit override for diagnostic-only readiness", () => {
		const rec = recommendation();
		rec.readiness = {
			...rec.readiness,
			level: "diagnostic-only",
			automationEligible: false,
			reasons: [
				{
					code: "no-failure-evidence",
					severity: "diagnostic",
					message: "test",
				},
			],
		};

		expect(optimizationSafetyReason(analysis(), rec, null)).toMatch(
			/diagnostic-only/,
		);
		expect(
			optimizationSafetyReason(analysis(), rec, null, {
				allowDiagnosticReadiness: true,
			}),
		).toBeNull();
	});

	it("skips mutation when the matrix is not fully resolved", async () => {
		const a = analysis();
		a.workflowMatchCoverage = 0.9;

		expect(optimizationSafetyReason(a, recommendation(), null)).toMatch(
			/not every expected static matrix cell/,
		);

		const github = client(false);
		const result = await createOrUpdateOptimizationPullRequest(
			github,
			a,
			recommendation(),
			null,
		);

		expect(result.status).toBe("skipped");
		expect(github.calls).toEqual([]);
	});
});
