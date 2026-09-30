import type { AnalysisReport, CellSummary } from "./analyze.js";
import type { MatrixTrimConstraints, RequireConstraint } from "./config.js";
import { EMPTY_CONSTRAINTS } from "./config.js";
import { observedCombinatorialCoverage } from "./coverage.js";
import {
  estimatePricing,
  standardRunnerListPriceUsd,
  type PricingEstimate,
} from "./pricing.js";

export type RecommendedCell = {
  cell: string;
  baseJob: string;
  medianRuntimeSeconds: number | null;
  runnerLabels?: string[];
  estimatedListPriceUsdPerRun: number | null;
  coveredFailures: number;
  coveredCombinations: number;
};

export type RecommendationOptions = {
  maxStrength?: number;
  constraints?: MatrixTrimConstraints;
};

export type RecommendationReport = {
  mode: "history+combinatorial";
  algorithm: "greedy-weighted-set-cover";
  coverageStrength: number;
  currentCells: number;
  selectedCells: RecommendedCell[];
  historicalFingerprints: number;
  coveredFingerprints: number;
  historicalRecall: number | null;
  failureEvents: number;
  failedJobsWithEvents: number;
  multiEventJobs: number;
  combinatorialRequirements: number;
  coveredCombinatorialRequirements: number;
  combinatorialCoverage: number | null;
  unresolvedAxisCells: string[];
  currentEstimatedSeconds: number | null;
  selectedEstimatedSeconds: number | null;
  estimatedComputeReductionPercent: number | null;
  pricingCoverage: number;
  currentEstimatedListPriceUsdPerRun: number | null;
  selectedEstimatedListPriceUsdPerRun: number | null;
  estimatedListPriceReductionPercent: number | null;
  projectedRunsPer30Days: number | null;
  currentProjectedListPriceUsd30Days: number | null;
  selectedProjectedListPriceUsd30Days: number | null;
  pricing: PricingEstimate;
  constraintRequirements: number;
  coveredConstraintRequirements: number;
  keptCells: string[];
  requiredSelectors: number;
  warnings: string[];
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function costFor(cell: CellSummary, fallback: number): number {
  return Math.max(cell.medianRuntimeSeconds ?? fallback, 0.1);
}

function stableCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function matchesRequireConstraint(
  cell: CellSummary,
  selector: RequireConstraint,
): boolean {
  if (selector.baseJob && cell.baseJob !== selector.baseJob) return false;
  if (!cell.axes) return false;
  return Object.entries(selector.axes).every(
    ([key, value]) => cell.axes?.[key] === value,
  );
}

export function recommendMatrix(
  report: AnalysisReport,
  options: RecommendationOptions = {},
): RecommendationReport {
  if (!report.cells.length) {
    throw new Error("no matrix cells were observed");
  }

  const maxStrength = options.maxStrength ?? 2;
  if (!Number.isInteger(maxStrength) || maxStrength < 1 || maxStrength > 4) {
    throw new Error("maxStrength must be an integer from 1 to 4");
  }

  const knownRuntimes = report.cells
    .map((cell) => cell.medianRuntimeSeconds)
    .filter((value): value is number => value !== null);
  const fallbackCost = median(knownRuntimes) ?? 1;

  const failureCoverage = new Map<string, Set<string>>();
  for (const observation of report.observations) {
    const set = failureCoverage.get(observation.cell) ?? new Set<string>();
    set.add(observation.fingerprint);
    failureCoverage.set(observation.cell, set);
  }

  const combinatorial = observedCombinatorialCoverage(
    report.cells,
    maxStrength,
  );

  const constraints = options.constraints ?? EMPTY_CONSTRAINTS;
  const cellsByName = new Map(report.cells.map((cell) => [cell.cell, cell]));
  const keepCells = [...new Set(constraints.keep)];
  const keepRequirements = keepCells.map((cell, index) => {
    if (!cellsByName.has(cell)) {
      throw new Error(
        `hard keep constraint references an unobserved matrix cell: ${cell}`,
      );
    }
    return {
      cell,
      token: `constraint:keep:${index}`,
    };
  });
  const requireRequirements = constraints.require.map((selector, index) => {
    const matches = report.cells
      .filter((cell) => matchesRequireConstraint(cell, selector))
      .map((cell) => cell.cell);
    if (!matches.length) {
      const base = selector.baseJob ? ` baseJob=${selector.baseJob}` : "";
      const axes = Object.entries(selector.axes)
        .map(([key, value]) => `${key}=${value}`)
        .join(",");
      throw new Error(
        `hard require constraint matched no observed matrix cells:${base} axes=${axes}`,
      );
    }
    return {
      token: `constraint:require:${index}`,
      matches: new Set(matches),
    };
  });
  const constraintTokens = [
    ...keepRequirements.map((item) => item.token),
    ...requireRequirements.map((item) => item.token),
  ];

  const anchors = new Set(report.cells.map((cell) => `base:${cell.baseJob}`));
  const failureTokens = report.clusters.map(
    (cluster) => `failure:${cluster.fingerprint}`,
  );
  const combinatorialTokens = combinatorial.tokens.map((token) => token.id);
  const unresolvedSafetyTokens = combinatorial.unresolvedCells.map(
    (cell) => `unresolved:${cell}`,
  );
  const unresolvedSafetyCells = new Set(combinatorial.unresolvedCells);
  const universe = new Set<string>([
    ...anchors,
    ...failureTokens,
    ...combinatorialTokens,
    ...unresolvedSafetyTokens,
    ...constraintTokens,
  ]);

  const coverageByCell = new Map<string, Set<string>>();
  for (const cell of report.cells) {
    const coverage = new Set<string>([`base:${cell.baseJob}`]);

    for (const fingerprint of failureCoverage.get(cell.cell) ?? []) {
      coverage.add(`failure:${fingerprint}`);
    }
    for (const token of combinatorial.byCell.get(cell.cell) ?? []) {
      coverage.add(token);
    }
    if (unresolvedSafetyCells.has(cell.cell)) {
      coverage.add(`unresolved:${cell.cell}`);
    }
    for (const requirement of keepRequirements) {
      if (requirement.cell === cell.cell) {
        coverage.add(requirement.token);
      }
    }
    for (const requirement of requireRequirements) {
      if (requirement.matches.has(cell.cell)) {
        coverage.add(requirement.token);
      }
    }

    coverageByCell.set(cell.cell, coverage);
  }

  const uncovered = new Set(universe);
  const selected: CellSummary[] = [];
  const remaining = new Map(report.cells.map((cell) => [cell.cell, cell]));

  while (uncovered.size) {
    let best: CellSummary | undefined;
    let bestNew: string[] = [];
    let bestScore = -1;

    for (const cell of remaining.values()) {
      const newlyCovered = [...(coverageByCell.get(cell.cell) ?? [])]
        .filter((item) => uncovered.has(item));
      if (!newlyCovered.length) continue;

      const score = newlyCovered.length / costFor(cell, fallbackCost);
      if (
        score > bestScore ||
        (score === bestScore && newlyCovered.length > bestNew.length) ||
        (score === bestScore &&
          newlyCovered.length === bestNew.length &&
          best &&
          stableCompare(cell.cell, best.cell) < 0)
      ) {
        best = cell;
        bestNew = newlyCovered;
        bestScore = score;
      }
    }

    if (!best) break;
    selected.push(best);
    remaining.delete(best.cell);
    for (const item of bestNew) uncovered.delete(item);
  }

  if (uncovered.size) {
    throw new Error(
      `unable to satisfy ${uncovered.size} hard/coverage requirement(s)`,
    );
  }

  // Greedy selection can leave cells redundant after later choices.
  // Remove the most expensive redundant cells first so the result does not
  // depend on Map insertion order, Node/ICU locale behavior, or greedy order.
  let pruned = true;
  while (pruned) {
    pruned = false;
    const candidates = [...selected].sort((a, b) => {
      const costDelta = costFor(b, fallbackCost) - costFor(a, fallbackCost);
      if (costDelta !== 0) return costDelta;
      return stableCompare(a.cell, b.cell);
    });

    for (const candidate of candidates) {
      const without = selected.filter((cell) => cell.cell !== candidate.cell);
      const covered = new Set<string>();
      for (const cell of without) {
        for (const item of coverageByCell.get(cell.cell) ?? []) {
          covered.add(item);
        }
      }
      if ([...universe].every((item) => covered.has(item))) {
        const index = selected.findIndex(
          (cell) => cell.cell === candidate.cell,
        );
        if (index >= 0) selected.splice(index, 1);
        pruned = true;
        break;
      }
    }
  }

  const selectedNames = new Set(selected.map((cell) => cell.cell));
  const coveredFailures = new Set<string>();
  const coveredCombinations = new Set<string>();
  const coveredConstraints = new Set<string>();

  for (const observation of report.observations) {
    if (selectedNames.has(observation.cell)) {
      coveredFailures.add(observation.fingerprint);
    }
  }
  for (const cell of selected) {
    for (const token of combinatorial.byCell.get(cell.cell) ?? []) {
      coveredCombinations.add(token);
    }
    for (const token of coverageByCell.get(cell.cell) ?? []) {
      if (constraintTokens.includes(token)) {
        coveredConstraints.add(token);
      }
    }
  }

  const currentKnown = report.cells.every(
    (cell) => cell.medianRuntimeSeconds !== null,
  );
  const selectedKnown = selected.every(
    (cell) => cell.medianRuntimeSeconds !== null,
  );
  const currentEstimatedSeconds = currentKnown
    ? report.cells.reduce(
        (sum, cell) => sum + cell.medianRuntimeSeconds!,
        0,
      )
    : null;
  const selectedEstimatedSeconds = selectedKnown
    ? selected.reduce(
        (sum, cell) => sum + cell.medianRuntimeSeconds!,
        0,
      )
    : null;
  const reduction =
    currentEstimatedSeconds !== null &&
    selectedEstimatedSeconds !== null &&
    currentEstimatedSeconds > 0
      ? (1 - selectedEstimatedSeconds / currentEstimatedSeconds) * 100
      : null;

  const pricing = estimatePricing(
    report,
    selected.map((cell) => cell.cell),
  );
  const pricingCoverage = pricing.currentCells
    ? pricing.pricedCells / pricing.currentCells
    : 0;
  const currentEstimatedListPriceUsdPerRun =
    pricing.currentRateCardUsdPerRun;
  const selectedEstimatedListPriceUsdPerRun =
    pricing.selectedRateCardUsdPerRun;
  const estimatedListPriceReductionPercent =
    pricing.rateCardReductionPercent;
  const projectedRunsPer30Days = pricing.projectedRunsPer30Days;
  const currentProjectedListPriceUsd30Days =
    pricing.currentRateCardUsdPer30Days;
  const selectedProjectedListPriceUsd30Days =
    pricing.selectedRateCardUsdPer30Days;

  const failureRuns = new Set(
    report.observations.map((item) => item.runId),
  ).size;
  const eventCountsByJob = new Map<number, number>();
  for (const item of report.observations) {
    eventCountsByJob.set(
      item.jobId,
      (eventCountsByJob.get(item.jobId) ?? 0) + 1,
    );
  }
  const multiEventJobs = [...eventCountsByJob.values()].filter(
    (count) => count > 1,
  ).length;
  const warnings = [
    "Historical failure coverage does not guarantee detection of unseen future failures.",
    `Combinatorial coverage preserves observed axis combinations up to strength ${maxStrength}; it does not invent combinations absent from the observed matrix.`,
    "Runtime estimates come from matrix jobs observed across completed workflow runs.",
  ];

  if (constraintTokens.length) {
    warnings.push(
      `Applied ${constraintTokens.length} explicit hard constraint(s): keep=${keepRequirements.length}, require=${requireRequirements.length}.`,
    );
  }

  if (pricingCoverage < 1) {
    warnings.push(
      `Billing classification could be resolved for ${pricing.pricedCells}/${pricing.currentCells} cells; aggregate monetary estimates are omitted unless coverage is complete.`,
    );
  }

  if (!report.fingerprints) {
    warnings.unshift(
      "No analyzable failure fingerprints were observed; selection is based on combinatorial coverage and runtime only.",
    );
  } else if (failureRuns < 5) {
    warnings.unshift(
      `Evidence is sparse: only ${failureRuns} workflow run(s) with analyzable matrix failures contributed failure evidence.`,
    );
  }

  if (combinatorial.unresolvedCells.length) {
    warnings.push(
      `Axis values could not be resolved for ${combinatorial.unresolvedCells.length} cell(s); those cells are retained individually as a safety constraint.`,
    );
  }

  if (report.expiredLogs || report.logErrors) {
    warnings.push(
      `Some failed logs were unavailable (expired=${report.expiredLogs}, errors=${report.logErrors}); failure coverage only includes analyzed logs.`,
    );
  }

  if (report.workflowDefinitionFallbacks) {
    warnings.push(
      `Historical workflow YAML could not be read for ${report.workflowDefinitionFallbacks} revision(s); those runs used the default-branch workflow definition as a fallback.`,
    );
  }
  if (report.workflowDefinitionErrors) {
    warnings.push(
      `Workflow definitions were unavailable for ${report.workflowDefinitionErrors} revision(s); matrix jobs from those revisions may be missing from the analysis.`,
    );
  }
  if (
    report.workflowRenderCoverage !== undefined &&
    report.workflowRenderCoverage !== null &&
    report.workflowRenderCoverage < 1
  ) {
    warnings.push(
      `Only ${(report.workflowRenderCoverage * 100).toFixed(1)}% of static workflow matrix cells had renderable job names; recommendation coverage may be incomplete.`,
    );
  }
  if (
    report.workflowMatchCoverage !== undefined &&
    report.workflowMatchCoverage !== null &&
    report.workflowMatchCoverage < 1
  ) {
    warnings.push(
      `Only ${(report.workflowMatchCoverage * 100).toFixed(1)}% of expected static matrix cells matched actual GitHub job names; recommendation coverage may be incomplete.`,
    );
  }
  if (report.dynamicMatrixDefinitions) {
    warnings.push(
      `${report.dynamicMatrixDefinitions} dynamic matrix definition(s) could not be statically expanded; recommendation coverage may be incomplete.`,
    );
  }

  return {
    mode: "history+combinatorial",
    algorithm: "greedy-weighted-set-cover",
    coverageStrength: maxStrength,
    currentCells: report.cells.length,
    selectedCells: selected.map((cell) => ({
      cell: cell.cell,
      baseJob: cell.baseJob,
      medianRuntimeSeconds: cell.medianRuntimeSeconds,
      runnerLabels: cell.runnerLabels,
      estimatedListPriceUsdPerRun: standardRunnerListPriceUsd(
        cell.medianRuntimeSeconds,
        cell.runnerLabels,
      ),
      coveredFailures: (failureCoverage.get(cell.cell) ?? new Set()).size,
      coveredCombinations: (combinatorial.byCell.get(cell.cell) ?? new Set())
        .size,
    })),
    historicalFingerprints: report.fingerprints,
    coveredFingerprints: coveredFailures.size,
    historicalRecall: report.fingerprints
      ? coveredFailures.size / report.fingerprints
      : null,
    failureEvents: report.observations.length,
    failedJobsWithEvents: eventCountsByJob.size,
    multiEventJobs,
    combinatorialRequirements: combinatorial.tokens.length,
    coveredCombinatorialRequirements: coveredCombinations.size,
    combinatorialCoverage: combinatorial.tokens.length
      ? coveredCombinations.size / combinatorial.tokens.length
      : null,
    unresolvedAxisCells: combinatorial.unresolvedCells,
    currentEstimatedSeconds,
    selectedEstimatedSeconds,
    estimatedComputeReductionPercent: reduction,
    pricingCoverage,
    currentEstimatedListPriceUsdPerRun,
    selectedEstimatedListPriceUsdPerRun,
    estimatedListPriceReductionPercent,
    projectedRunsPer30Days,
    currentProjectedListPriceUsd30Days,
    selectedProjectedListPriceUsd30Days,
    pricing,
    constraintRequirements: constraintTokens.length,
    coveredConstraintRequirements: coveredConstraints.size,
    keptCells: keepRequirements.map((item) => item.cell),
    requiredSelectors: requireRequirements.length,
    warnings,
  };
}
