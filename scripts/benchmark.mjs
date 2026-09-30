import { access, readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { analyzeRepository } from "../dist/analyze.js";
import { GitHubClient } from "../dist/github.js";
import { recommendMatrix } from "../dist/recommend.js";
import { backtestRecommendation } from "../dist/backtest.js";

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function isConclusiveRun(run) {
  return ["success", "failure", "timed_out", "neutral"].includes(
    run.conclusion ?? "",
  );
}

const targetsPath = arg("--targets", "benchmark/targets.json");
const snapshotPath = arg("--snapshot", "benchmark/snapshot.json");
const outputPath = arg("--output", "benchmark/results.json");
const markdownPath = arg("--markdown", "benchmark/results.md");
const limit = Number.parseInt(arg("--limit", "20"), 10);
const strength = Number.parseInt(arg("--strength", "2"), 10);
const holdout = Number.parseInt(arg("--holdout", "25"), 10);
const refreshSnapshot = hasFlag("--refresh-snapshot");
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

if (!token) {
  throw new Error("GH_TOKEN or GITHUB_TOKEN is required");
}

const targets = JSON.parse(await readFile(targetsPath, "utf8"));

async function captureSnapshot() {
  const capturedTargets = [];
  for (const target of targets) {
    process.stderr.write(
      `[snapshot] ${target.repository} / ${target.workflow}\n`,
    );
    const client = new GitHubClient(target.repository, token);
    const candidates = await client.listRuns(limit * 3, target.workflow);
    const runs = candidates.filter(isConclusiveRun).slice(0, limit);
    if (runs.length < limit) {
      process.stderr.write(
        `[snapshot] warning: only ${runs.length}/${limit} conclusive runs found for ${target.repository}\n`,
      );
    }
    capturedTargets.push({
      ...target,
      runIds: runs.map((run) => run.id),
      runNumbers: runs.map((run) => run.run_number),
      headShas: runs.map((run) => run.head_sha),
    });
  }

  const captured = {
    capturedAt: new Date().toISOString(),
    limit,
    targets: capturedTargets,
  };
  await writeFile(snapshotPath, JSON.stringify(captured, null, 2) + "\n");
  return captured;
}

let snapshot;
if (refreshSnapshot || !(await exists(snapshotPath))) {
  snapshot = await captureSnapshot();
} else {
  snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  if (snapshot.limit !== limit) {
    throw new Error(
      `snapshot limit is ${snapshot.limit}, requested limit is ${limit}; rerun with --refresh-snapshot`,
    );
  }
}

const results = [];

for (const target of snapshot.targets) {
  const started = performance.now();
  const row = {
    ...target,
    status: "unknown",
    runIds: target.runIds,
    limit,
    strength,
    holdout,
  };

  try {
    process.stderr.write(`[benchmark] ${target.repository} / ${target.workflow}\n`);
    const analysis = await analyzeRepository(target.repository, {
      workflow: target.workflow,
      limit: target.runIds.length,
      runIds: target.runIds,
      token,
      concurrency: 4,
    });

    row.runsAnalyzed = analysis.runsAnalyzed;
    row.matrixCells = analysis.cells.length;
    row.fingerprints = analysis.fingerprints;
    row.failedJobs = analysis.failedJobs;
    row.failureEvents = analysis.observations.length;
    row.analyzedFailedJobs = new Set(
      analysis.observations.map((item) => item.jobId),
    ).size;
    const eventsByJob = new Map();
    for (const item of analysis.observations) {
      eventsByJob.set(item.jobId, (eventsByJob.get(item.jobId) ?? 0) + 1);
    }
    row.multiEventJobs = [...eventsByJob.values()].filter(
      (count) => count > 1,
    ).length;
    row.expiredLogs = analysis.expiredLogs;
    row.logErrors = analysis.logErrors;
    row.workflowDefinitionFallbacks =
      analysis.workflowDefinitionFallbacks ?? 0;
    row.workflowDefinitionErrors =
      analysis.workflowDefinitionErrors ?? 0;
    row.workflowStaticDefinitionCells =
      analysis.workflowStaticDefinitionCells ?? 0;
    row.workflowRenderedDefinitionCells =
      analysis.workflowRenderedDefinitionCells ?? 0;
    row.workflowRenderCoverage =
      analysis.workflowRenderCoverage ?? null;
    row.workflowExpectedMatrixCells =
      analysis.workflowExpectedMatrixCells ?? 0;
    row.workflowMatchedMatrixCells =
      analysis.workflowMatchedMatrixCells ?? 0;
    row.workflowMatchCoverage =
      analysis.workflowMatchCoverage ?? null;
    row.inactiveStaticMatrixFamilies =
      analysis.inactiveStaticMatrixFamilies ?? 0;
    row.dynamicMatrixDefinitions =
      analysis.dynamicMatrixDefinitions ?? 0;
    row.failureEvidenceRuns = new Set(
      analysis.observations.map((item) => item.runId),
    ).size;

    if (!analysis.cells.length) {
      row.status = "unresolved";
      row.reason = "No matrix cells could be recovered from the pinned completed runs.";
      results.push(row);
      continue;
    }

    const recommendation = recommendMatrix(analysis, {
      maxStrength: strength,
    });

    row.selectedCells = recommendation.selectedCells.length;
    row.axisResolvedCells =
      analysis.cells.length - recommendation.unresolvedAxisCells.length;
    row.axisResolvedPercent =
      analysis.cells.length
        ? (row.axisResolvedCells / analysis.cells.length) * 100
        : 0;
    row.historicalRecall = recommendation.historicalRecall;
    row.combinatorialCoverage = recommendation.combinatorialCoverage;
    row.computeReductionPercent =
      recommendation.estimatedComputeReductionPercent;
    row.currentEstimatedSeconds = recommendation.currentEstimatedSeconds;
    row.selectedEstimatedSeconds = recommendation.selectedEstimatedSeconds;
    row.combinatorialRequirements =
      recommendation.combinatorialRequirements;
    row.repositoryVisibility =
      recommendation.pricing.repositoryVisibility;
    row.pricingCoverage = recommendation.pricingCoverage;
    row.currentRateCardUsdPerRun =
      recommendation.pricing.currentRateCardUsdPerRun;
    row.selectedRateCardUsdPerRun =
      recommendation.pricing.selectedRateCardUsdPerRun;
    row.rateCardReductionPercent =
      recommendation.pricing.rateCardReductionPercent;
    row.currentEstimatedChargeUsdPerRun =
      recommendation.pricing.currentEstimatedChargeUsdPerRun;
    row.selectedEstimatedChargeUsdPerRun =
      recommendation.pricing.selectedEstimatedChargeUsdPerRun;
    row.projectedRunsPer30Days =
      recommendation.pricing.projectedRunsPer30Days;
    row.currentRateCardUsdPer30Days =
      recommendation.pricing.currentRateCardUsdPer30Days;
    row.selectedRateCardUsdPer30Days =
      recommendation.pricing.selectedRateCardUsdPer30Days;
    row.currentEstimatedChargeUsdPer30Days =
      recommendation.pricing.currentEstimatedChargeUsdPer30Days;
    row.selectedEstimatedChargeUsdPer30Days =
      recommendation.pricing.selectedEstimatedChargeUsdPer30Days;

    try {
      const backtest = backtestRecommendation(
        analysis,
        holdout,
        strength,
      );
      row.backtest = {
        trainingRuns: backtest.trainingRuns,
        holdoutRuns: backtest.holdoutRuns,
        holdoutRecall: backtest.holdoutRecall,
        unseenFailureRecall: backtest.unseenHoldoutRecall,
        unseenHoldoutFingerprints: backtest.unseenHoldoutFingerprints,
        holdoutCombinatorialCoverage:
          backtest.holdoutCombinatorialCoverage,
      };
    } catch (error) {
      row.backtest = null;
      row.backtestReason = error.message;
    }

    if (recommendation.unresolvedAxisCells.length === analysis.cells.length) {
      row.status = "partial";
      row.reason = "Matrix cells were found, but axis values could not be recovered.";
    } else if (recommendation.unresolvedAxisCells.length) {
      row.status = "partial";
      row.reason = `${recommendation.unresolvedAxisCells.length} observed cell(s) have unresolved axes.`;
    } else if (row.workflowDefinitionErrors) {
      row.status = "partial";
      row.reason = `${row.workflowDefinitionErrors} historical workflow definition(s) were unavailable.`;
    } else if (
      row.workflowRenderCoverage !== null &&
      row.workflowRenderCoverage < 1
    ) {
      row.status = "partial";
      row.reason =
        `Only ${(row.workflowRenderCoverage * 100).toFixed(1)}% of static workflow matrix cells had renderable job names.`;
    } else if (
      row.workflowMatchCoverage !== null &&
      row.workflowMatchCoverage < 1
    ) {
      row.status = "partial";
      row.reason =
        `Only ${(row.workflowMatchCoverage * 100).toFixed(1)}% of expected static matrix cells matched actual GitHub job names.`;
    } else if (row.dynamicMatrixDefinitions) {
      row.status = "partial";
      row.reason =
        `${row.dynamicMatrixDefinitions} dynamic matrix definition(s) could not be statically expanded.`;
    } else if (row.workflowDefinitionFallbacks) {
      row.status = "fallback";
      row.reason = `${row.workflowDefinitionFallbacks} historical workflow definition(s) used the default-branch fallback.`;
    } else {
      row.status = "resolved";
    }
  } catch (error) {
    row.status = "error";
    row.reason = error.message;
  } finally {
    row.elapsedSeconds = (performance.now() - started) / 1000;
    if (!results.includes(row)) results.push(row);
  }

  await writeFile(outputPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    snapshotCapturedAt: snapshot.capturedAt,
    snapshotPath,
    limit,
    strength,
    holdout,
    results,
  }, null, 2) + "\n");
}

function pct(value) {
  return value === null || value === undefined
    ? "n/a"
    : `${(value * 100).toFixed(1)}%`;
}

function pctRaw(value) {
  return value === null || value === undefined
    ? "n/a"
    : `${value.toFixed(1)}%`;
}

function usd(value, digits = 3) {
  return value === null || value === undefined
    ? "n/a"
    : `$${value.toFixed(digits)}`;
}

function usdPair(current, selected) {
  return current === null || current === undefined ||
    selected === null || selected === undefined
    ? "n/a"
    : `${usd(current)} → ${usd(selected)}`;
}

const resolvedCount = results.filter((row) => row.status === "resolved").length;
const partialCount = results.filter((row) => row.status === "partial").length;
const unresolvedCount = results.filter((row) => row.status === "unresolved").length;
const errorCount = results.filter((row) => row.status === "error").length;
const validatedReductions = results.filter(
  (row) =>
    row.status === "resolved" &&
    (row.computeReductionPercent ?? 0) > 0,
);

const lines = [
  "# MatrixTrim OSS benchmark",
  "",
  `Run snapshot captured: ${snapshot.capturedAt}`,
  "",
  `Settings: ${limit} pinned conclusive completed runs per repository, strength=${strength}, holdout=${holdout}%.`,
  "",
  "Results are based on pinned workflow run IDs in benchmark/snapshot.json. Re-running without --refresh-snapshot uses the same run set.",
  "",
  `Resolution status: **${resolvedCount}/${results.length} resolved**, **${partialCount} partial**, **${unresolvedCount} unresolved**, **${errorCount} errors**.`,
  "",
  "Only rows marked resolved are treated as validated reduction results. Partial rows are diagnostic only, even when their apparent reduction is large.",
  "",
  "All benchmark targets are public OSS repositories. For standard GitHub-hosted runners, estimated GitHub charge is therefore $0; rate-card values are comparison-only and show the monetary value of equivalent private-repository overage usage.",
  "",
  "Validated non-zero reductions in this snapshot:",
  "",
  ...validatedReductions.map(
    (row) =>
      `- **${row.repository}**: ${row.matrixCells} → ${row.selectedCells} cells, ${pctRaw(row.computeReductionPercent)} estimated compute reduction; standard-runner rate-card ${usdPair(row.currentRateCardUsdPerRun, row.selectedRateCardUsdPerRun)} per run; estimated GitHub charge ${usdPair(row.currentEstimatedChargeUsdPerRun, row.selectedEstimatedChargeUsdPerRun)} per run.`,
  ),
  "",
  "| Repository | Status | Cells | Selected | Axis resolved | Workflow render | Job match | Failed jobs | Failure events | Multi-event jobs | Fingerprints | Historical recall | Holdout recall | Unseen recall | Compute reduction | Pricing coverage | Rate-card/run | Est. charge/run |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
];

for (const row of results) {
  const selected = row.selectedCells ?? "n/a";
  const axis = row.axisResolvedPercent === undefined
    ? "n/a"
    : `${row.axisResolvedPercent.toFixed(0)}%`;
  const workflowRender = row.workflowRenderCoverage === null ||
    row.workflowRenderCoverage === undefined
    ? "n/a"
    : `${(row.workflowRenderCoverage * 100).toFixed(0)}%`;
  const workflowMatch = row.workflowMatchCoverage === null ||
    row.workflowMatchCoverage === undefined
    ? "n/a"
    : `${(row.workflowMatchCoverage * 100).toFixed(0)}%`;
  lines.push(
    `| ${row.repository} | ${row.status} | ${row.matrixCells ?? "n/a"} | ${selected} | ${axis} | ${workflowRender} | ${workflowMatch} | ${row.failedJobs ?? "n/a"} | ${row.failureEvents ?? "n/a"} | ${row.multiEventJobs ?? "n/a"} | ${row.fingerprints ?? "n/a"} | ${pct(row.historicalRecall)} | ${pct(row.backtest?.holdoutRecall)} | ${pct(row.backtest?.unseenFailureRecall)} | ${pctRaw(row.computeReductionPercent)} | ${pct(row.pricingCoverage)} | ${usdPair(row.currentRateCardUsdPerRun, row.selectedRateCardUsdPerRun)} | ${usdPair(row.currentEstimatedChargeUsdPerRun, row.selectedEstimatedChargeUsdPerRun)} |`,
  );
}

lines.push("", "## Notes", "");
for (const row of results) {
  if (row.reason || row.backtestReason) {
    lines.push(
      `- **${row.repository}**: ${[row.reason, row.backtestReason ? `backtest: ${row.backtestReason}` : null].filter(Boolean).join(" ")}`,
    );
  }
}

await writeFile(markdownPath, lines.join("\n") + "\n");
console.log(lines.join("\n"));
