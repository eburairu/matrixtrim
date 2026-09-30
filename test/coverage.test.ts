import { describe, expect, it } from "vitest";
import type { AnalysisReport, CellSummary } from "../src/analyze.js";
import { observedCombinatorialCoverage } from "../src/coverage.js";
import { recommendMatrix } from "../src/recommend.js";

function cubeCells(): CellSummary[] {
  const cells: CellSummary[] = [];
  for (const a of ["0", "1"]) {
    for (const b of ["0", "1"]) {
      for (const c of ["0", "1"]) {
        cells.push({
          cell: `test (${a}, ${b}, ${c})`,
          baseJob: "test",
          axes: { a, b, c },
          axisSource: "workflow-job-name",
          runsObserved: 5,
          successRuns: 5,
          failureRuns: 0,
          otherRuns: 0,
          observations: 0,
          distinctFailures: 0,
          uniqueFailures: 0,
          medianRuntimeSeconds: 10,
        });
      }
    }
  }
  return cells;
}

function report(cells: CellSummary[]): AnalysisReport {
  return {
    repository: "owner/repo",
    workflow: "ci.yml",
    workflowPath: ".github/workflows/ci.yml",
    runsAnalyzed: 5,
    failedJobs: 0,
    ignoredNonMatrixJobs: 0,
    fingerprints: 0,
    logErrors: 0,
    expiredLogs: 0,
    cells,
    clusters: [],
    observations: [],
    matrixJobs: [],
  };
}

describe("combinatorial coverage", () => {
  it("includes 1-wise values and observed pairwise combinations", () => {
    const coverage = observedCombinatorialCoverage(cubeCells(), 2);

    // 3 axes × 2 values = 6 one-wise requirements.
    // C(3, 2) axis pairs × 4 value pairs = 12 pairwise requirements.
    expect(coverage.tokens).toHaveLength(18);
  });

  it("reduces a full 2x2x2 matrix from 8 to 4 at pairwise strength", () => {
    const recommendation = recommendMatrix(report(cubeCells()), {
      maxStrength: 2,
    });

    expect(recommendation.currentCells).toBe(8);
    expect(recommendation.selectedCells).toHaveLength(4);
    expect(recommendation.combinatorialRequirements).toBe(18);
    expect(recommendation.combinatorialCoverage).toBe(1);
    expect(recommendation.historicalRecall).toBeNull();
  });

  it("keeps all 8 cells when 3-wise coverage is required", () => {
    const recommendation = recommendMatrix(report(cubeCells()), {
      maxStrength: 3,
    });

    expect(recommendation.selectedCells).toHaveLength(8);
    expect(recommendation.combinatorialCoverage).toBe(1);
  });
});
