import { describe, expect, it } from "vitest";
import type { AnalysisReport } from "../src/analyze.js";
import {
  billedMinutes,
  estimatePricing,
  inferStandardRunnerPrice,
  standardRunnerListPriceUsd,
} from "../src/pricing.js";

function report(
  visibility: "public" | "private",
): AnalysisReport {
  return {
    repository: "owner/repo",
    repositoryVisibility: visibility,
    workflow: "ci.yml",
    runsAnalyzed: 2,
    failedJobs: 0,
    ignoredNonMatrixJobs: 0,
    fingerprints: 0,
    logErrors: 0,
    expiredLogs: 0,
    projectedRunsPer30Days: 10,
    cells: [
      {
        cell: "test (ubuntu)",
        baseJob: "test",
        axes: { os: "ubuntu" },
        axisSource: "workflow-job-name",
        runsObserved: 1,
        successRuns: 1,
        failureRuns: 0,
        otherRuns: 0,
        observations: 0,
        distinctFailures: 0,
        uniqueFailures: 0,
        medianRuntimeSeconds: 61,
        runnerLabels: ["ubuntu-latest"],
      },
      {
        cell: "test (macos)",
        baseJob: "test",
        axes: { os: "macos" },
        axisSource: "workflow-job-name",
        runsObserved: 1,
        successRuns: 1,
        failureRuns: 0,
        otherRuns: 0,
        observations: 0,
        distinctFailures: 0,
        uniqueFailures: 0,
        medianRuntimeSeconds: 59,
        runnerLabels: ["macos-latest"],
      },
    ],
    clusters: [],
    observations: [],
    matrixJobs: [
      {
        runId: 1,
        runNumber: 1,
        runConclusion: "success",
        jobId: 1,
        cell: "test (ubuntu)",
        baseJob: "test",
        axes: { os: "ubuntu" },
        axisSource: "workflow-job-name",
        conclusion: "success",
        runtimeSeconds: 61,
        runnerLabels: ["ubuntu-latest"],
      },
      {
        runId: 1,
        runNumber: 1,
        runConclusion: "success",
        jobId: 2,
        cell: "test (macos)",
        baseJob: "test",
        axes: { os: "macos" },
        axisSource: "workflow-job-name",
        conclusion: "success",
        runtimeSeconds: 59,
        runnerLabels: ["macos-latest"],
      },
    ],
  };
}

describe("GitHub-hosted runner pricing model", () => {
  it("recognizes current standard hosted runner labels", () => {
    expect(inferStandardRunnerPrice(["ubuntu-latest"])).toMatchObject({
      sku: "actions_linux",
      usdPerMinute: 0.006,
    });
    expect(inferStandardRunnerPrice(["ubuntu-24.04-arm"])).toMatchObject({
      sku: "actions_linux_arm",
      usdPerMinute: 0.005,
    });
    expect(inferStandardRunnerPrice(["windows-2025"])).toMatchObject({
      sku: "actions_windows",
      usdPerMinute: 0.010,
    });
    expect(inferStandardRunnerPrice(["windows-2025-vs2026"])).toMatchObject({
      sku: "actions_windows",
      usdPerMinute: 0.010,
    });
    expect(inferStandardRunnerPrice(["macos-15-intel"])).toMatchObject({
      sku: "actions_macos",
      usdPerMinute: 0.062,
    });
  });

  it("uses per-job whole-minute rounding", () => {
    expect(billedMinutes(1)).toBe(1);
    expect(billedMinutes(60)).toBe(1);
    expect(billedMinutes(61)).toBe(2);
    expect(standardRunnerListPriceUsd(61, ["ubuntu-latest"])).toBe(0.012);
    expect(standardRunnerListPriceUsd(61, ["macos-latest"])).toBe(0.124);
  });

  it("does not invent prices for self-hosted or unknown runners", () => {
    expect(inferStandardRunnerPrice(["self-hosted", "linux"])).toBeNull();
    expect(inferStandardRunnerPrice(["my-custom-runner"])).toBeNull();
    expect(standardRunnerListPriceUsd(120, ["my-custom-runner"])).toBeNull();
  });

  it("keeps public-repository charge at zero while exposing rate-card value", () => {
    const result = estimatePricing(report("public"), ["test (ubuntu)"]);

    expect(result.currentRateCardUsdPerRun).toBeCloseTo(0.074);
    expect(result.selectedRateCardUsdPerRun).toBeCloseTo(0.012);
    expect(result.currentEstimatedChargeUsdPerRun).toBe(0);
    expect(result.selectedEstimatedChargeUsdPerRun).toBe(0);
    expect(result.currentRateCardUsdPer30Days).toBeCloseTo(0.74);
    expect(result.selectedRateCardUsdPer30Days).toBeCloseTo(0.12);
    expect(result.note).toContain("free in public repositories");
  });

  it("models private-repository overage equivalent before included minutes", () => {
    const result = estimatePricing(report("private"), ["test (ubuntu)"]);

    expect(result.currentEstimatedChargeUsdPerRun).toBeCloseTo(0.074);
    expect(result.selectedEstimatedChargeUsdPerRun).toBeCloseTo(0.012);
    expect(result.estimatedChargeSavingsUsdPerRun).toBeCloseTo(0.062);
    expect(result.note).toContain("before plan-included minutes");
  });

  it("omits 30-day projection when the observed run window is too short", () => {
    const short = report("private");
    short.runWindowDays = 3;
    short.projectedRunsPer30Days = 200;

    const result = estimatePricing(short, ["test (ubuntu)"]);

    expect(result.projectedRunsPer30Days).toBeNull();
    expect(result.currentRateCardUsdPer30Days).toBeNull();
    expect(result.currentEstimatedChargeUsdPer30Days).toBeNull();
    expect(result.note).toContain("<7 days");
  });
});
