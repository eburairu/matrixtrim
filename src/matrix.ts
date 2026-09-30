import { parse } from "yaml";

export type MatrixSummary = {
  job: string;
  axes: Record<string, number>;
  baseCells: number | null;
  excludeRules: number;
  includeEntries: number;
  dynamic: boolean;
};

function hasRuntimeExpression(value: unknown): boolean {
  if (typeof value === "string") return value.includes("${{");
  if (Array.isArray(value)) return value.some(hasRuntimeExpression);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .some(hasRuntimeExpression);
  }
  return false;
}

export function inspectWorkflow(text: string): MatrixSummary[] {
  const doc = parse(text) as Record<string, unknown> | null;
  const jobs = (doc?.jobs ?? {}) as Record<string, any>;
  const result: MatrixSummary[] = [];

  for (const [job, spec] of Object.entries(jobs)) {
    const matrix = spec?.strategy?.matrix;
    if (!matrix) continue;

    if (typeof matrix !== "object" || Array.isArray(matrix)) {
      if (typeof matrix === "string" && matrix.includes("${{")) {
        result.push({
          job,
          axes: {},
          baseCells: null,
          excludeRules: 0,
          includeEntries: 0,
          dynamic: true,
        });
      }
      continue;
    }

    const axes: Record<string, number> = {};
    let dynamic =
      ("include" in matrix && !Array.isArray(matrix.include)) ||
      ("exclude" in matrix && !Array.isArray(matrix.exclude)) ||
      hasRuntimeExpression(matrix.include) ||
      hasRuntimeExpression(matrix.exclude);
    for (const [key, value] of Object.entries(matrix)) {
      if (key === "include" || key === "exclude") continue;
      if (Array.isArray(value)) {
        axes[key] = value.length;
        if (hasRuntimeExpression(value)) dynamic = true;
      } else {
        dynamic = true;
      }
    }

    const sizes = Object.values(axes);
    const baseCells = dynamic ? null : sizes.reduce((n, size) => n * size, 1);
    result.push({
      job,
      axes,
      baseCells,
      excludeRules: Array.isArray(matrix.exclude) ? matrix.exclude.length : 0,
      includeEntries: Array.isArray(matrix.include) ? matrix.include.length : 0,
      dynamic,
    });
  }
  return result;
}
