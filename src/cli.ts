#!/usr/bin/env node
import { readFile, stat, readdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { inspectWorkflow } from "./matrix.js";
import { analyzeRepository } from "./analyze.js";

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
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (!token) {
    throw new Error(
      "analyze requires GH_TOKEN or GITHUB_TOKEN with permission to read Actions logs",
    );
  }

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

  console.log("\nFailure detection by job variant");
  for (const cell of report.cells) {
    console.log(
      `  ${cell.cell}: distinct=${cell.distinctFailures}, unique=${cell.uniqueFailures}, observations=${cell.observations}`,
    );
  }
}

try {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const command = args[0];

  if (command === "analyze") {
    await analyzeCommand(args, json);
  } else if (command === "inspect") {
    await inspectCommand(args[1] ?? ".github/workflows", json);
  } else {
    await inspectCommand(command ?? ".github/workflows", json);
  }
} catch (error) {
  console.error(`matrixtrim: ${(error as Error).message}`);
  process.exitCode = 1;
}
