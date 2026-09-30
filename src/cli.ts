#!/usr/bin/env node
import { readFile, stat, readdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { inspectWorkflow } from "./matrix.js";
import { analyzeRepository } from "./analyze.js";
import { recommendMatrix } from "./recommend.js";
import { backtestRecommendation } from "./backtest.js";

function flagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function filesFor(path: string): Promise<string[]> {
  const info = await stat(path);
  if (info.isFile()) return [path];
  return (await readdir(path))
    .filter((name) => [".yml", ".yaml"].includes(extname(name)))
    .map((name) => resolve(path, name));
}

async function inspectCommand(input: string, json: boolean): Promise<void> {
  const files = await filesFor(resolve(input));
  const report = [];

  for (const file of files) {
    const matrices = inspectWorkflow(await readFile(file, "utf8"));
    if (matrices.length) report.push({ file, matrices });
  }

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (!report.length) {
    console.log("No GitHub Actions matrices found.");
    return;
  }

  for (const item of report) {
    console.log("\n" + item.file);
    for (const m of item.matrices) {
      const axes = Object.entries(m.axes).map(([k, v]) => `${k}=${v}`).join(", ");
      console.log(`  ${m.job}: ${m.baseCells ?? "dynamic"} base cells`);
      console.log(`    axes: ${axes || "(dynamic expression)"}`);
      console.log(`    include=${m.includeEntries}, exclude=${m.excludeRules}`);
    }
  }
}

function parseOptionalInt(
  args: string[],
  flag: string,
  min: number,
  max: number,
): number | undefined {
  const raw = flagValue(args, flag);
  if (raw === undefined) return undefined;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${flag} must be an integer from ${min} to ${max}`);
  }
  return value;
}

function requireGitHubToken(command: string): string {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (!token) {
    throw new Error(
      `${command} requires GH_TOKEN or GITHUB_TOKEN with permission to read Actions logs`,
    );
  }
  return token;
}

async function analyzeCommand(args: string[], json: boolean): Promise<void> {
  const repository = args[1];
  if (!repository) {
    throw new Error(
      "usage: matrixtrim analyze owner/repo [--workflow ci.yml] [--limit 30] [--run ID]",
    );
  }

  const workflow = flagValue(args, "--workflow");
  const limit = parseOptionalInt(args, "--limit", 1, 500) ?? 30;
  const runId = parseOptionalInt(args, "--run", 1, Number.MAX_SAFE_INTEGER);
  const token = requireGitHubToken("analyze");

  const report = await analyzeRepository(repository, {
    limit,
    workflow,
    runId,
    token,
  });

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`Repository: ${report.repository}`);
  console.log(`Workflow:   ${report.workflow ?? "all"}`);
  console.log(`Runs:       ${report.runsAnalyzed}`);
  console.log(`Failed matrix jobs with logs: ${report.observations.length}/${report.failedJobs}`);
  if (report.ignoredNonMatrixJobs) {
    console.log(`Ignored non-matrix failures: ${report.ignoredNonMatrixJobs}`);
  }
  console.log(`Failure fingerprints:  ${report.fingerprints}`);
  if (report.expiredLogs) console.log(`Expired logs:           ${report.expiredLogs}`);
  if (report.logErrors) console.log(`Log fetch errors:       ${report.logErrors}`);

  if (!report.cells.length) {
    console.log("\nNo failed job logs were available in the selected runs.");
    return;
  }

  const shared = report.clusters.filter((cluster) => cluster.cells.length > 1);
  if (shared.length) {
    console.log("\nShared failure clusters");
    for (const cluster of shared.slice(0, 10)) {
      console.log(
        `  ${cluster.fingerprint}: cells=${cluster.cells.length}, observations=${cluster.observations}`,
      );
      if (cluster.signature[0]) console.log(`    ${cluster.signature[0]}`);
    }
  }

  console.log("\nMatrix cell history");
  for (const cell of report.cells) {
    const runtime = cell.medianRuntimeSeconds === null
      ? "runtime=n/a"
      : `runtime=${cell.medianRuntimeSeconds.toFixed(1)}s`;
    const axes = cell.axes
      ? Object.entries(cell.axes).map(([key, value]) => `${key}=${value}`).join(",")
      : "axes=unresolved";
    console.log(
      `  ${cell.cell}: runs=${cell.runsObserved}, success=${cell.successRuns}, failure=${cell.failureRuns}, distinct=${cell.distinctFailures}, unique=${cell.uniqueFailures}, ${runtime}, ${axes}`,
    );
  }
}

async function recommendCommand(args: string[], json: boolean): Promise<void> {
  const repository = args[1];
  if (!repository) {
    throw new Error(
      "usage: matrixtrim recommend owner/repo [--workflow ci.yml] [--limit 100] [--run ID] [--strength 2]",
    );
  }

  const workflow = flagValue(args, "--workflow");
  const limit = parseOptionalInt(args, "--limit", 1, 500) ?? 100;
  const runId = parseOptionalInt(args, "--run", 1, Number.MAX_SAFE_INTEGER);
  const strength = parseOptionalInt(args, "--strength", 1, 4) ?? 2;
  const token = requireGitHubToken("recommend");

  const analysis = await analyzeRepository(repository, {
    limit,
    workflow,
    runId,
    token,
  });
  const recommendation = recommendMatrix(analysis, {
    maxStrength: strength,
  });

  if (json) {
    console.log(JSON.stringify({ analysis, recommendation }, null, 2));
    return;
  }

  console.log(`Repository: ${repository}`);
  console.log("Mode:       history + combinatorial coverage (experimental)");
  console.log(`Strength:   ${recommendation.coverageStrength}`);
  console.log(`Runs:       ${analysis.runsAnalyzed}`);
  if (recommendation.historicalRecall === null) {
    console.log("Historical failure recall: n/a (no analyzed fingerprints)");
  } else {
    console.log(
      `Historical failure recall: ${recommendation.coveredFingerprints}/${recommendation.historicalFingerprints} (${(recommendation.historicalRecall * 100).toFixed(1)}%)`,
    );
  }
  if (recommendation.combinatorialCoverage === null) {
    console.log("Combinatorial coverage: n/a");
  } else {
    console.log(
      `Combinatorial coverage: ${recommendation.coveredCombinatorialRequirements}/${recommendation.combinatorialRequirements} (${(recommendation.combinatorialCoverage * 100).toFixed(1)}%)`,
    );
  }
  console.log(
    `Matrix cells: ${recommendation.currentCells} -> ${recommendation.selectedCells.length}`,
  );

  if (
    recommendation.currentEstimatedSeconds !== null &&
    recommendation.selectedEstimatedSeconds !== null
  ) {
    console.log(
      `Estimated compute: ${recommendation.currentEstimatedSeconds.toFixed(1)}s -> ${recommendation.selectedEstimatedSeconds.toFixed(1)}s`,
    );
    if (recommendation.estimatedComputeReductionPercent !== null) {
      console.log(
        `Estimated reduction: ${recommendation.estimatedComputeReductionPercent.toFixed(1)}%`,
      );
    }
  }

  console.log("\nRecommended cells");
  for (const cell of recommendation.selectedCells) {
    const runtime = cell.medianRuntimeSeconds === null
      ? "n/a"
      : `${cell.medianRuntimeSeconds.toFixed(1)}s`;
    console.log(
      `  ${cell.cell}  failures=${cell.coveredFailures}  combos=${cell.coveredCombinations}  median=${runtime}`,
    );
  }

  console.log("\nWarnings");
  for (const warning of recommendation.warnings) {
    console.log(`  - ${warning}`);
  }
}

async function backtestCommand(args: string[], json: boolean): Promise<void> {
  const repository = args[1];
  if (!repository) {
    throw new Error(
      "usage: matrixtrim backtest owner/repo [--workflow ci.yml] [--limit 100] [--holdout 25] [--strength 2]",
    );
  }

  const workflow = flagValue(args, "--workflow");
  const limit = parseOptionalInt(args, "--limit", 2, 500) ?? 100;
  const holdout = parseOptionalInt(args, "--holdout", 5, 50) ?? 25;
  const strength = parseOptionalInt(args, "--strength", 1, 4) ?? 2;
  const token = requireGitHubToken("backtest");

  const analysis = await analyzeRepository(repository, {
    limit,
    workflow,
    token,
  });
  const result = backtestRecommendation(analysis, holdout, strength);

  if (json) {
    console.log(JSON.stringify({ analysis, backtest: result }, null, 2));
    return;
  }

  console.log(`Repository: ${repository}`);
  console.log("Mode:       time-holdout backtest");
  console.log(`Strength:   ${result.coverageStrength}`);
  console.log(`Runs:       train=${result.trainingRuns}, holdout=${result.holdoutRuns}`);
  console.log(`Selected cells from training: ${result.selectedCells.length}`);
  console.log(
    `Holdout recall: ${result.coveredHoldoutFingerprints}/${result.holdoutFingerprints} (${(result.holdoutRecall * 100).toFixed(1)}%)`,
  );

  if (result.unseenHoldoutRecall !== null) {
    console.log(
      `Unseen-failure recall: ${result.coveredUnseenHoldoutFingerprints}/${result.unseenHoldoutFingerprints} (${(result.unseenHoldoutRecall * 100).toFixed(1)}%)`,
    );
  } else {
    console.log("Unseen-failure recall: n/a (no new fingerprints in holdout)");
  }

  if (result.holdoutCombinatorialCoverage !== null) {
    console.log(
      `Holdout combinatorial coverage: ${result.coveredHoldoutCombinatorialRequirements}/${result.holdoutCombinatorialRequirements} (${(result.holdoutCombinatorialCoverage * 100).toFixed(1)}%)`,
    );
  } else {
    console.log("Holdout combinatorial coverage: n/a");
  }

  console.log("\nTraining-selected cells");
  for (const cell of result.selectedCells) {
    console.log(`  ${cell}`);
  }

  if (result.missed.length) {
    console.log("\nMissed holdout failures");
    for (const missed of result.missed.slice(0, 10)) {
      console.log(
        `  ${missed.fingerprint}: seenInTraining=${missed.seenInTraining}, detectedBy=${missed.detectingCells.join(", ")}`,
      );
      if (missed.signature[0]) console.log(`    ${missed.signature[0]}`);
    }
  }

  console.log("\nWarnings");
  for (const warning of result.warnings) {
    console.log(`  - ${warning}`);
  }
}

try {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const command = args[0];

  if (command === "analyze") {
    await analyzeCommand(args, json);
  } else if (command === "recommend") {
    await recommendCommand(args, json);
  } else if (command === "backtest") {
    await backtestCommand(args, json);
  } else if (command === "inspect") {
    await inspectCommand(args[1] ?? ".github/workflows", json);
  } else {
    await inspectCommand(command ?? ".github/workflows", json);
  }
} catch (error) {
  console.error(`matrixtrim: ${(error as Error).message}`);
  process.exitCode = 1;
}
