import type { AnalysisReport, CellSummary } from "./analyze.js";
import { observedCombinatorialCoverage } from "./coverage.js";

export type RecommendedCell = {
  cell: string;
  baseJob: string;
  medianRuntimeSeconds: number | null;
  coveredFailures: number;
  coveredCombinations: number;
};

export type RecommendationOptions = {
  maxStrength?: number;
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
  combinatorialRequirements: number;
  coveredCombinatorialRequirements: number;
  combinatorialCoverage: number | null;
  unresolvedAxisCells: string[];
  currentEstimatedSeconds: number | null;
  selectedEstimatedSeconds: number | null;
  estimatedComputeReductionPercent: number | null;
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

  const anchors = new Set(report.cells.map((cell) => `base:${cell.baseJob}`));
  const failureTokens = report.clusters.map(
    (cluster) => `failure:${cluster.fingerprint}`,
  );
  const combinatorialTokens = combinatorial.tokens.map((token) => token.id);
  const universe = new Set<string>([
    ...anchors,
    ...failureTokens,
    ...combinatorialTokens,
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
          cell.cell.localeCompare(best.cell) < 0)
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

  // Greedy selection can leave a cell redundant after later choices.
  for (let index = selected.length - 1; index >= 0; index--) {
    const without = selected.filter((_, i) => i !== index);
    const covered = new Set<string>();
    for (const cell of without) {
      for (const item of coverageByCell.get(cell.cell) ?? []) {
        covered.add(item);
      }
    }
    if ([...universe].every((item) => covered.has(item))) {
      selected.splice(index, 1);
    }
  }

  const selectedNames = new Set(selected.map((cell) => cell.cell));
  const coveredFailures = new Set<string>();
  const coveredCombinations = new Set<string>();

  for (const observation of report.observations) {
    if (selectedNames.has(observation.cell)) {
      coveredFailures.add(observation.fingerprint);
    }
  }
  for (const cell of selected) {
    for (const token of combinatorial.byCell.get(cell.cell) ?? []) {
      coveredCombinations.add(token);
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

  const failureRuns = new Set(
    report.observations.map((item) => item.runId),
  ).size;
  const warnings = [
    "Historical failure coverage does not guarantee detection of unseen future failures.",
    `Combinatorial coverage preserves observed axis combinations up to strength ${maxStrength}; it does not invent combinations absent from the observed matrix.`,
    "Runtime estimates come from matrix jobs observed across completed workflow runs.",
  ];

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
      `Axis values could not be resolved for ${combinatorial.unresolvedCells.length} cell(s); combinatorial constraints do not cover those cells unless needed for failure or job-family coverage.`,
    );
  }

  if (report.expiredLogs || report.logErrors) {
    warnings.push(
      `Some failed logs were unavailable (expired=${report.expiredLogs}, errors=${report.logErrors}); failure coverage only includes analyzed logs.`,
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
      coveredFailures: (failureCoverage.get(cell.cell) ?? new Set()).size,
      coveredCombinations: (combinatorial.byCell.get(cell.cell) ?? new Set())
        .size,
    })),
    historicalFingerprints: report.fingerprints,
    coveredFingerprints: coveredFailures.size,
    historicalRecall: report.fingerprints
      ? coveredFailures.size / report.fingerprints
      : null,
    combinatorialRequirements: combinatorial.tokens.length,
    coveredCombinatorialRequirements: coveredCombinations.size,
    combinatorialCoverage: combinatorial.tokens.length
      ? coveredCombinations.size / combinatorial.tokens.length
      : null,
    unresolvedAxisCells: combinatorial.unresolvedCells,
    currentEstimatedSeconds,
    selectedEstimatedSeconds,
    estimatedComputeReductionPercent: reduction,
    warnings,
  };
}
