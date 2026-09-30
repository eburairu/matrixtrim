import { appendFile, readFile } from "node:fs/promises";
import { basename } from "node:path";
import { formatActionReport } from "./action-report.js";
import { analyzeRepository } from "./analyze.js";
import { backtestRecommendation } from "./backtest.js";
import { loadRepositoryConfig } from "./config.js";
import { encodeMatrixEvidence } from "./evidence.js";
import { GitHubClient } from "./github.js";
import { createOrUpdateOptimizationPullRequest } from "./optimization-pr.js";
import { type OptimizerMode, recommendMatrix } from "./recommend.js";

function input(name: string): string {
	return (
		process.env[`INPUT_${name.toUpperCase().replace(/-/g, "_")}`]?.trim() ?? ""
	);
}

function intInput(
	name: string,
	fallback: number,
	min: number,
	max: number,
): number {
	const raw = input(name);
	if (!raw) return fallback;
	const value = Number.parseInt(raw, 10);
	if (!Number.isInteger(value) || value < min || value > max) {
		throw new Error(`${name} must be an integer from ${min} to ${max}`);
	}
	return value;
}

function boolInput(name: string, fallback: boolean): boolean {
	const raw = input(name).toLowerCase();
	if (!raw) return fallback;
	if (["true", "1", "yes", "on"].includes(raw)) return true;
	if (["false", "0", "no", "off"].includes(raw)) return false;
	throw new Error(`${name} must be true or false`);
}

function inferWorkflowFile(repository: string): string | undefined {
	const ref = process.env.GITHUB_WORKFLOW_REF;
	if (!ref) return undefined;
	const prefix = `${repository}/`;
	const pathWithRef = ref.startsWith(prefix) ? ref.slice(prefix.length) : ref;
	const at = pathWithRef.indexOf("@");
	const path = at >= 0 ? pathWithRef.slice(0, at) : pathWithRef;
	return path ? basename(path) : undefined;
}

async function eventPullRequestNumber(): Promise<number | undefined> {
	const path = process.env.GITHUB_EVENT_PATH;
	if (!path) return undefined;
	try {
		const event = JSON.parse(await readFile(path, "utf8")) as {
			pull_request?: { number?: number };
			issue?: { number?: number; pull_request?: unknown };
			number?: number;
		};
		return (
			event.pull_request?.number ??
			(event.issue?.pull_request ? event.issue.number : undefined) ??
			event.number
		);
	} catch {
		return undefined;
	}
}

async function writeOutput(
	name: string,
	value: string | number,
): Promise<void> {
	const path = process.env.GITHUB_OUTPUT;
	if (!path) return;
	await appendFile(path, `${name}=${value}\n`, "utf8");
}

function warning(message: string): void {
	console.log(`::warning::${message.replace(/\r?\n/g, " ")}`);
}

function notice(message: string): void {
	console.log(`::notice title=MatrixTrim evidence::${message}`);
}

async function main(): Promise<void> {
	const mode = input("mode") || "analyze";
	if (!["analyze", "capture"].includes(mode)) {
		throw new Error("mode must be analyze or capture");
	}

	if (mode === "capture") {
		const matrixJson = input("matrix");
		if (!matrixJson)
			throw new Error("matrix input is required in capture mode");
		const evidence = encodeMatrixEvidence(
			process.env.GITHUB_JOB ?? "",
			matrixJson,
		);
		notice(evidence);
		await writeOutput("capture-status", "captured");
		return;
	}

	const repository = process.env.GITHUB_REPOSITORY;
	if (!repository) throw new Error("GITHUB_REPOSITORY is not available");

	const token = input("token") || process.env.GITHUB_TOKEN || "";
	if (!token) throw new Error("token input or GITHUB_TOKEN is required");

	const workflow = input("workflow") || inferWorkflowFile(repository);
	const limit = intInput("limit", 100, 2, 500);
	const holdout = intInput("holdout", 25, 5, 50);
	const strength = intInput("strength", 2, 1, 4);
	const optimizerRaw = input("optimizer") || "auto";
	if (!["auto", "exact", "greedy"].includes(optimizerRaw)) {
		throw new Error("optimizer must be auto, exact, or greedy");
	}
	const optimizer = optimizerRaw as OptimizerMode;
	const exactMaxNodes = intInput("exact-max-nodes", 250_000, 1, 10_000_000);
	const configPath = input("config") || ".matrixtrim.yml";
	const comment = boolInput("comment", true);
	const createPr = boolInput("create-pr", false);
	const github = new GitHubClient(repository, token);
	const config = await loadRepositoryConfig(
		github,
		configPath,
		configPath !== ".matrixtrim.yml",
	);

	console.log(
		`MatrixTrim: repository=${repository}, workflow=${workflow ?? "all"}, limit=${limit}, strength=${strength}, optimizer=${optimizer}, exactMaxNodes=${exactMaxNodes}, constraints=${(config?.constraints.keep.length ?? 0) + (config?.constraints.require.length ?? 0)}`,
	);

	const analysis = await analyzeRepository(repository, {
		limit,
		workflow,
		token,
	});
	const recommendation = recommendMatrix(analysis, {
		maxStrength: strength,
		constraints: config?.constraints,
		optimizer,
		exactMaxNodes,
	});

	let backtest = null;
	let backtestError: string | undefined;
	try {
		backtest = backtestRecommendation(
			analysis,
			holdout,
			strength,
			config?.constraints,
			{
				optimizer,
				exactMaxNodes,
			},
		);
	} catch (error) {
		backtestError = (error as Error).message;
		warning(`backtest unavailable: ${backtestError}`);
	}

	const report = formatActionReport(
		repository,
		workflow,
		recommendation,
		backtest,
		backtestError,
	);

	const summaryPath = process.env.GITHUB_STEP_SUMMARY;
	if (summaryPath) {
		await appendFile(summaryPath, report + "\n", "utf8");
	} else {
		console.log(report);
	}

	await writeOutput(
		"capture-evidence-candidates",
		analysis.captureEvidenceCandidates ?? 0,
	);
	await writeOutput("capture-evidence-jobs", analysis.captureEvidenceJobs ?? 0);
	await writeOutput(
		"capture-evidence-errors",
		analysis.captureEvidenceErrors ?? 0,
	);
	await writeOutput("current-cells", recommendation.currentCells);
	await writeOutput("selected-cells", recommendation.selectedCells.length);
	await writeOutput("optimizer-algorithm", recommendation.algorithm);
	await writeOutput(
		"optimizer-optimal",
		recommendation.optimizerOptimal === null
			? ""
			: String(recommendation.optimizerOptimal),
	);
	await writeOutput(
		"optimizer-search-nodes",
		recommendation.optimizerSearchNodes,
	);
	await writeOutput(
		"optimizer-improvement-percent",
		recommendation.optimizerImprovementPercent.toFixed(1),
	);
	await writeOutput(
		"optimizer-fallback-reason",
		recommendation.optimizerFallbackReason ?? "",
	);
	await writeOutput(
		"compute-reduction-percent",
		recommendation.estimatedComputeReductionPercent?.toFixed(1) ?? "",
	);
	await writeOutput(
		"pricing-coverage",
		recommendation.pricingCoverage.toFixed(4),
	);
	await writeOutput(
		"rate-card-usd-per-run-current",
		recommendation.currentEstimatedListPriceUsdPerRun?.toFixed(4) ?? "",
	);
	await writeOutput(
		"rate-card-usd-per-run-selected",
		recommendation.selectedEstimatedListPriceUsdPerRun?.toFixed(4) ?? "",
	);
	await writeOutput(
		"rate-card-reduction-percent",
		recommendation.estimatedListPriceReductionPercent?.toFixed(1) ?? "",
	);
	await writeOutput(
		"projected-30d-rate-card-usd-current",
		recommendation.currentProjectedListPriceUsd30Days?.toFixed(2) ?? "",
	);
	await writeOutput(
		"projected-30d-rate-card-usd-selected",
		recommendation.selectedProjectedListPriceUsd30Days?.toFixed(2) ?? "",
	);
	await writeOutput(
		"repository-visibility",
		recommendation.pricing.repositoryVisibility ?? "",
	);
	await writeOutput(
		"estimated-charge-usd-per-run-current",
		recommendation.pricing.currentEstimatedChargeUsdPerRun?.toFixed(4) ?? "",
	);
	await writeOutput(
		"estimated-charge-usd-per-run-selected",
		recommendation.pricing.selectedEstimatedChargeUsdPerRun?.toFixed(4) ?? "",
	);
	await writeOutput(
		"estimated-charge-reduction-percent",
		recommendation.pricing.estimatedChargeReductionPercent?.toFixed(1) ?? "",
	);
	await writeOutput(
		"projected-30d-estimated-charge-usd-current",
		recommendation.pricing.currentEstimatedChargeUsdPer30Days?.toFixed(2) ?? "",
	);
	await writeOutput(
		"projected-30d-estimated-charge-usd-selected",
		recommendation.pricing.selectedEstimatedChargeUsdPer30Days?.toFixed(2) ??
			"",
	);
	await writeOutput(
		"historical-recall",
		recommendation.historicalRecall?.toFixed(4) ?? "",
	);
	await writeOutput("failure-events", recommendation.failureEvents);
	await writeOutput(
		"failed-jobs-with-events",
		recommendation.failedJobsWithEvents,
	);
	await writeOutput("multi-event-jobs", recommendation.multiEventJobs);
	await writeOutput(
		"combinatorial-coverage",
		recommendation.combinatorialCoverage?.toFixed(4) ?? "",
	);
	await writeOutput(
		"constraint-requirements",
		recommendation.constraintRequirements,
	);
	await writeOutput(
		"constraint-coverage",
		recommendation.constraintRequirements
			? (
					recommendation.coveredConstraintRequirements /
					recommendation.constraintRequirements
				).toFixed(4)
			: "1.0000",
	);
	await writeOutput("holdout-recall", backtest?.holdoutRecall.toFixed(4) ?? "");
	await writeOutput(
		"unseen-failure-recall",
		backtest?.unseenHoldoutRecall?.toFixed(4) ?? "",
	);

	let optimizationStatus = createPr ? "skipped" : "disabled";
	let optimizationNumber = "";
	let optimizationUrl = "";
	let optimizationReason = "";

	if (createPr) {
		const eventName = process.env.GITHUB_EVENT_NAME ?? "";
		if (eventName === "pull_request" || eventName === "pull_request_target") {
			optimizationReason =
				"optimization PR creation is disabled for pull-request-triggered runs";
			warning(optimizationReason);
		} else {
			try {
				const result = await createOrUpdateOptimizationPullRequest(
					github,
					analysis,
					recommendation,
					backtest,
					backtestError,
				);
				optimizationStatus = result.status;
				optimizationNumber = result.number?.toString() ?? "";
				optimizationUrl = result.url ?? "";
				optimizationReason = result.reason ?? "";

				if (result.status === "created" || result.status === "updated") {
					console.log(
						`MatrixTrim optimization PR ${result.status}: ${result.url}`,
					);
				} else if (result.reason) {
					warning(`optimization PR skipped: ${result.reason}`);
				}
			} catch (error) {
				optimizationStatus = "skipped";
				optimizationReason = `optimization PR failed: ${(error as Error).message}`;
				warning(optimizationReason);
			}
		}
	}

	await writeOutput("optimization-pr-status", optimizationStatus);
	await writeOutput("optimization-pr-number", optimizationNumber);
	await writeOutput("optimization-pr-url", optimizationUrl);
	await writeOutput("optimization-pr-reason", optimizationReason);

	if (summaryPath && createPr) {
		const summary = optimizationUrl
			? `\n### Optimization PR\n\n- Status: **${optimizationStatus}**\n- PR: ${optimizationUrl}\n`
			: `\n### Optimization PR\n\n- Status: **${optimizationStatus}**\n- Reason: ${optimizationReason || "not created"}\n`;
		await appendFile(summaryPath, summary, "utf8");
	}

	if (comment) {
		const pullRequest = await eventPullRequestNumber();
		if (pullRequest) {
			try {
				const marker = "<!-- matrixtrim-report -->";
				const comments = await github.listIssueComments(pullRequest);
				const previous = comments.find(
					(item) =>
						item.body?.includes(marker) &&
						(item.user?.login?.endsWith("[bot]") ?? false),
				);
				if (previous) {
					await github.updateIssueComment(previous.id, report);
					console.log(`Updated MatrixTrim comment on PR #${pullRequest}`);
				} else {
					await github.createIssueComment(pullRequest, report);
					console.log(`Created MatrixTrim comment on PR #${pullRequest}`);
				}
			} catch (error) {
				warning(
					`could not create/update PR comment: ${(error as Error).message}. Step Summary is still available.`,
				);
			}
		}
	}
}

void main().catch((error) => {
	console.error(
		`::error::MatrixTrim failed: ${(error as Error).message.replace(/\r?\n/g, " ")}`,
	);
	process.exitCode = 1;
});
