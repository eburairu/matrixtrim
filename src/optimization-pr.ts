import { basename } from "node:path";
import type { AnalysisReport } from "./analyze.js";
import type { BacktestReport } from "./backtest.js";
import type { PullRequestInfo, RepositoryInfo } from "./github.js";
import type { RecommendationReport } from "./recommend.js";
import {
	rewriteWorkflowToSelectedCells,
	type WorkflowRewriteResult,
} from "./rewrite.js";

export type OptimizationPullRequestResult = {
	status: "created" | "updated" | "skipped";
	branch?: string;
	number?: number;
	url?: string;
	reason?: string;
	rewrite?: WorkflowRewriteResult;
};

export type OptimizationPullRequestOptions = {
	allowDiagnosticReadiness?: boolean;
};

export type OptimizationGitHubClient = {
	repositoryInfo(): Promise<RepositoryInfo>;
	file(path: string, ref?: string): Promise<{ text: string; sha: string }>;
	refSha(branch: string): Promise<string | null>;
	createBranch(branch: string, sha: string): Promise<void>;
	updateBranch(branch: string, sha: string): Promise<void>;
	updateFile(
		path: string,
		branch: string,
		sha: string,
		text: string,
		message: string,
	): Promise<void>;
	listOpenPullRequests(
		branch: string,
		base: string,
	): Promise<PullRequestInfo[]>;
	createPullRequest(
		title: string,
		head: string,
		base: string,
		body: string,
	): Promise<PullRequestInfo>;
	updatePullRequest(
		number: number,
		title: string,
		body: string,
	): Promise<PullRequestInfo>;
};

function slug(value: string): string {
	return (
		value
			.toLowerCase()
			.replace(/[^a-z0-9._-]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 48) || "workflow"
	);
}

export function optimizationBranch(workflowPath: string): string {
	return `matrixtrim/optimize-${slug(basename(workflowPath))}`;
}

export function optimizationSafetyReason(
	analysis: AnalysisReport,
	recommendation: RecommendationReport,
	backtest: BacktestReport | null,
	options: OptimizationPullRequestOptions = {},
): string | null {
	if (recommendation.readiness.level === "blocked") {
		const codes = recommendation.readiness.reasons
			.filter((item) => item.severity === "blocked")
			.map((item) => item.code)
			.join(", ");
		return `recommendation readiness is blocked: ${codes}`;
	}
	if (
		recommendation.readiness.level === "diagnostic-only" &&
		!options.allowDiagnosticReadiness
	) {
		const codes = recommendation.readiness.reasons
			.filter((item) => item.severity === "diagnostic")
			.map((item) => item.code)
			.join(", ");
		return `recommendation is diagnostic-only: ${codes}`;
	}
	if (!analysis.workflowPath) {
		return "workflow path could not be resolved";
	}
	if (recommendation.selectedCells.length >= recommendation.currentCells) {
		return "recommendation does not reduce the observed matrix";
	}
	if (analysis.dynamicMatrixDefinitions) {
		return "dynamic matrix definitions are present";
	}
	if (analysis.workflowDefinitionErrors) {
		return "one or more historical workflow definitions were unavailable";
	}
	if (
		analysis.workflowRenderCoverage !== null &&
		analysis.workflowRenderCoverage !== undefined &&
		analysis.workflowRenderCoverage < 1
	) {
		return "not every static matrix cell has a renderable job name";
	}
	if (
		analysis.workflowMatchCoverage !== null &&
		analysis.workflowMatchCoverage !== undefined &&
		analysis.workflowMatchCoverage < 1
	) {
		return "not every expected static matrix cell matched an observed GitHub job";
	}
	if (recommendation.unresolvedAxisCells.length) {
		return "one or more observed matrix cells have unresolved axes";
	}
	if (
		recommendation.historicalRecall !== null &&
		recommendation.historicalRecall < 1
	) {
		return "historical failure recall is below 100%";
	}
	if (
		recommendation.combinatorialCoverage !== null &&
		recommendation.combinatorialCoverage < 1
	) {
		return "combinatorial coverage is below 100%";
	}
	if (
		recommendation.coveredConstraintRequirements <
		recommendation.constraintRequirements
	) {
		return "one or more explicit hard constraints are not satisfied";
	}
	if (
		recommendation.optimizerMode === "auto" &&
		recommendation.optimizerOptimal === false
	) {
		return "exact optimizer did not prove optimality within the node budget";
	}
	if (backtest && backtest.holdoutRecall < 1) {
		return "holdout failure recall is below 100%";
	}
	if (
		backtest?.unseenHoldoutRecall !== null &&
		backtest?.unseenHoldoutRecall !== undefined &&
		backtest.unseenHoldoutRecall < 1
	) {
		return "unseen-failure recall is below 100%";
	}
	if (
		backtest?.holdoutCombinatorialCoverage !== null &&
		backtest?.holdoutCombinatorialCoverage !== undefined &&
		backtest.holdoutCombinatorialCoverage < 1
	) {
		return "holdout combinatorial coverage is below 100%";
	}
	return null;
}

export function optimizationPullRequestBody(
	rewrite: WorkflowRewriteResult,
	recommendation: RecommendationReport,
	backtest: BacktestReport | null,
	backtestError?: string,
): string {
	const jobs = rewrite.jobs
		.map(
			(job) =>
				`- \`${job.jobId}\`: ${job.beforeCells} → ${job.afterCells} cells`,
		)
		.join("\n");

	const holdout = backtest
		? `${(backtest.holdoutRecall * 100).toFixed(1)}%`
		: `not available${backtestError ? ` (${backtestError})` : ""}`;
	const unseen =
		backtest?.unseenHoldoutRecall === null ||
		backtest?.unseenHoldoutRecall === undefined
			? "n/a"
			: `${(backtest.unseenHoldoutRecall * 100).toFixed(1)}%`;

	return `<!-- matrixtrim-optimization-pr -->
## MatrixTrim optimization proposal

This **draft PR** converts the selected static matrix cells to explicit \`matrix.include\` rows. It is intentionally not auto-merged.

### Changes

${jobs}

### Evidence

- Readiness: ${recommendation.readiness.level} (automation=${recommendation.readiness.automationEligible ? "eligible" : "not eligible"})
- Readiness reasons: ${recommendation.readiness.reasons.map((item) => item.code).join(", ") || "none"}
- Optimizer: ${recommendation.algorithm} (mode=${recommendation.optimizerMode}, optimal=${recommendation.optimizerOptimal ?? "n/a"}, nodes=${recommendation.optimizerSearchNodes})
- Optimizer improvement vs greedy: ${recommendation.optimizerImprovementPercent.toFixed(1)}%
- Historical failure recall: ${recommendation.historicalRecall === null ? "n/a" : `${(recommendation.historicalRecall * 100).toFixed(1)}%`}
- Observed combinatorial coverage: ${recommendation.combinatorialCoverage === null ? "n/a" : `${(recommendation.combinatorialCoverage * 100).toFixed(1)}%`}
- Explicit hard constraints: ${recommendation.coveredConstraintRequirements}/${recommendation.constraintRequirements}
- Holdout failure recall: ${holdout}
- Unseen-failure recall: ${unseen}
- Estimated compute reduction: ${recommendation.estimatedComputeReductionPercent === null ? "n/a" : `${recommendation.estimatedComputeReductionPercent.toFixed(1)}%`}
- Standard-runner rate-card reduction: ${recommendation.estimatedListPriceReductionPercent === null ? "n/a" : `${recommendation.estimatedListPriceReductionPercent.toFixed(1)}%`}

### Safety

MatrixTrim only creates this PR when the current workflow is a fully resolved static matrix, every current cell was observed in the analyzed history, historical and combinatorial coverage are preserved, and any available holdout checks pass at 100%.

Review and run the repository's normal CI before merging.
`;
}

export async function createOrUpdateOptimizationPullRequest(
	client: OptimizationGitHubClient,
	analysis: AnalysisReport,
	recommendation: RecommendationReport,
	backtest: BacktestReport | null,
	backtestError?: string,
	options: OptimizationPullRequestOptions = {},
): Promise<OptimizationPullRequestResult> {
	const reason = optimizationSafetyReason(
		analysis,
		recommendation,
		backtest,
		options,
	);
	if (reason) {
		return { status: "skipped", reason };
	}

	const repository = await client.repositoryInfo();
	const base = repository.default_branch;
	if (!base) {
		return {
			status: "skipped",
			reason: "repository default branch is unavailable",
		};
	}

	const workflowPath = analysis.workflowPath!;
	const baseFile = await client.file(workflowPath, base);
	const rewrite = rewriteWorkflowToSelectedCells(
		baseFile.text,
		analysis.cells.map((cell) => cell.cell),
		recommendation.selectedCells.map((cell) => cell.cell),
	);

	if (!rewrite.changed) {
		return {
			status: "skipped",
			reason: "current workflow already matches the recommendation",
			rewrite,
		};
	}

	const baseSha = await client.refSha(base);
	if (!baseSha) {
		return { status: "skipped", reason: "default branch ref is unavailable" };
	}

	const branch = optimizationBranch(workflowPath);
	const existing = await client.listOpenPullRequests(branch, base);
	if (existing[0] && existing[0].draft === false) {
		return {
			status: "skipped",
			branch,
			number: existing[0].number,
			url: existing[0].html_url,
			reason:
				"existing MatrixTrim pull request is no longer a draft; automatic updates are disabled",
			rewrite,
		};
	}

	const branchSha = await client.refSha(branch);
	if (branchSha) {
		await client.updateBranch(branch, baseSha);
	} else {
		await client.createBranch(branch, baseSha);
	}

	const branchFile = await client.file(workflowPath, branch);
	await client.updateFile(
		workflowPath,
		branch,
		branchFile.sha,
		rewrite.workflow,
		"Optimize CI matrix with MatrixTrim",
	);

	const title = "MatrixTrim: propose CI matrix reduction";
	const body = optimizationPullRequestBody(
		rewrite,
		recommendation,
		backtest,
		backtestError,
	);
	let pull: PullRequestInfo;
	let status: "created" | "updated";
	if (existing[0]) {
		pull = await client.updatePullRequest(existing[0].number, title, body);
		status = "updated";
	} else {
		pull = await client.createPullRequest(title, branch, base, body);
		status = "created";
	}

	return {
		status,
		branch,
		number: pull.number,
		url: pull.html_url,
		rewrite,
	};
}
