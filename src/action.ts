import { appendFile, readFile } from "node:fs/promises";
import { basename } from "node:path";
import { analyzeRepository } from "./analyze.js";
import { recommendMatrix } from "./recommend.js";
import { backtestRecommendation } from "./backtest.js";
import { formatActionReport } from "./action-report.js";
import { GitHubClient } from "./github.js";

function input(name: string): string {
  return process.env[`INPUT_${name.toUpperCase().replace(/-/g, "_")}`]?.trim() ?? "";
}

function intInput(name: string, fallback: number, min: number, max: number): number {
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
    return event.pull_request?.number ??
      (event.issue?.pull_request ? event.issue.number : undefined) ??
      event.number;
  } catch {
    return undefined;
  }
}

async function writeOutput(name: string, value: string | number): Promise<void> {
  const path = process.env.GITHUB_OUTPUT;
  if (!path) return;
  await appendFile(path, `${name}=${value}\n`, "utf8");
}

function warning(message: string): void {
  console.log(`::warning::${message.replace(/\r?\n/g, " ")}`);
}

async function main(): Promise<void> {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) throw new Error("GITHUB_REPOSITORY is not available");

  const token = input("token") || process.env.GITHUB_TOKEN || "";
  if (!token) throw new Error("token input or GITHUB_TOKEN is required");

  const workflow = input("workflow") || inferWorkflowFile(repository);
  const limit = intInput("limit", 100, 2, 500);
  const holdout = intInput("holdout", 25, 5, 50);
  const strength = intInput("strength", 2, 1, 4);
  const comment = boolInput("comment", true);

  console.log(
    `MatrixTrim: repository=${repository}, workflow=${workflow ?? "all"}, limit=${limit}, strength=${strength}`,
  );

  const analysis = await analyzeRepository(repository, {
    limit,
    workflow,
    token,
  });
  const recommendation = recommendMatrix(analysis, {
    maxStrength: strength,
  });

  let backtest = null;
  let backtestError: string | undefined;
  try {
    backtest = backtestRecommendation(analysis, holdout, strength);
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

  await writeOutput("current-cells", recommendation.currentCells);
  await writeOutput("selected-cells", recommendation.selectedCells.length);
  await writeOutput(
    "compute-reduction-percent",
    recommendation.estimatedComputeReductionPercent?.toFixed(1) ?? "",
  );
  await writeOutput(
    "historical-recall",
    recommendation.historicalRecall?.toFixed(4) ?? "",
  );
  await writeOutput(
    "combinatorial-coverage",
    recommendation.combinatorialCoverage?.toFixed(4) ?? "",
  );
  await writeOutput(
    "holdout-recall",
    backtest?.holdoutRecall.toFixed(4) ?? "",
  );
  await writeOutput(
    "unseen-failure-recall",
    backtest?.unseenHoldoutRecall?.toFixed(4) ?? "",
  );

  if (comment) {
    const pullRequest = await eventPullRequestNumber();
    if (pullRequest) {
      try {
        const client = new GitHubClient(repository, token);
        const marker = "<!-- matrixtrim-report -->";
        const comments = await client.listIssueComments(pullRequest);
        const previous = comments.find(
          (item) =>
            item.body?.includes(marker) &&
            (item.user?.login?.endsWith("[bot]") ?? false),
        );
        if (previous) {
          await client.updateIssueComment(previous.id, report);
          console.log(`Updated MatrixTrim comment on PR #${pullRequest}`);
        } else {
          await client.createIssueComment(pullRequest, report);
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
