import { describe, expect, it } from "vitest";
import { formatActionReport } from "../src/action-report.js";
import type { RecommendationReport } from "../src/recommend.js";
import type { BacktestReport } from "../src/backtest.js";

describe("GitHub Action report", () => {
  it("renders recommendation and backtest metrics", () => {
    const recommendation: RecommendationReport = {
      mode: "history+combinatorial",
      algorithm: "greedy-weighted-set-cover",
      coverageStrength: 2,
      currentCells: 8,
      selectedCells: [
        {
          cell: "test (ubuntu, 20)",
          baseJob: "test",
          medianRuntimeSeconds: 10,
          coveredFailures: 2,
          coveredCombinations: 4,
        },
      ],
      historicalFingerprints: 2,
      coveredFingerprints: 2,
      historicalRecall: 1,
      combinatorialRequirements: 12,
      coveredCombinatorialRequirements: 12,
      combinatorialCoverage: 1,
      unresolvedAxisCells: [],
      currentEstimatedSeconds: 80,
      selectedEstimatedSeconds: 40,
      estimatedComputeReductionPercent: 50,
      warnings: ["example warning"],
    };

    const backtest: BacktestReport = {
      mode: "time-holdout",
      holdoutPercent: 25,
      coverageStrength: 2,
      trainingRuns: 6,
      holdoutRuns: 2,
      selectedCells: ["test (ubuntu, 20)"],
      trainingFingerprints: 2,
      holdoutFingerprints: 2,
      coveredHoldoutFingerprints: 2,
      holdoutRecall: 1,
      unseenHoldoutFingerprints: 1,
      coveredUnseenHoldoutFingerprints: 1,
      unseenHoldoutRecall: 1,
      holdoutCombinatorialRequirements: 12,
      coveredHoldoutCombinatorialRequirements: 12,
      holdoutCombinatorialCoverage: 1,
      missed: [],
      warnings: [],
    };

    const report = formatActionReport(
      "owner/repo",
      "ci.yml",
      recommendation,
      backtest,
    );

    expect(report).toContain("<!-- matrixtrim-report -->");
    expect(report).toContain("| Current matrix cells | 8 |");
    expect(report).toContain("| Suggested cells | 1 |");
    expect(report).toContain("| Estimated compute reduction | 50.0% |");
    expect(report).toContain("| Holdout failure recall | 2/2 (100.0%) |");
    expect(report).toContain("evidence, not proof");
  });
});
