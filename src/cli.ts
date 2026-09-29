#!/usr/bin/env node
import { readFile, stat, readdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { inspectWorkflow } from "./matrix.js";

const input = process.argv[2] ?? ".github/workflows";
const json = process.argv.includes("--json");

async function filesFor(path: string): Promise<string[]> {
  const info = await stat(path);
  if (info.isFile()) return [path];
  return (await readdir(path))
    .filter((name) => [".yml", ".yaml"].includes(extname(name)))
    .map((name) => resolve(path, name));
}

try {
  const files = await filesFor(resolve(input));
  const report = [];
  for (const file of files) {
    const matrices = inspectWorkflow(await readFile(file, "utf8"));
    if (matrices.length) report.push({ file, matrices });
  }

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (!report.length) {
    console.log("No GitHub Actions matrices found.");
  } else {
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
} catch (error) {
  console.error(`matrixtrim: ${(error as Error).message}`);
  process.exitCode = 1;
}
