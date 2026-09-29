import { parse } from "yaml";

export type MatrixSummary = {
  job: string;
  axes: Record<string, number>;
  baseCells: number | null;
  excludeRules: number;
  includeEntries: number;
  dynamic: boolean;
};

export function inspectWorkflow(text: string): MatrixSummary[] {
  const doc = parse(text) as Record<string, unknown> | null;
  const jobs = (doc?.jobs ?? {}) as Record<string, any>;
  const result: MatrixSummary[] = [];

  for (const [job, spec] of Object.entries(jobs)) {
    const matrix = spec?.strategy?.matrix;
    if (!matrix || typeof matrix !== "object") continue;

    const axes: Record<string, number> = {};
    let dynamic = false;
    for (const [key, value] of Object.entries(matrix)) {
      if (key === "include" || key === "exclude") continue;
      if (Array.isArray(value)) axes[key] = value.length;
      else dynamic = true;
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
