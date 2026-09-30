import { parse } from "yaml";

type MatrixValue = string | number | boolean | null | Record<string, unknown>;

export type ExpandedMatrixCell = {
  name: string;
  axes: Record<string, string>;
};

export type MatrixDefinition = {
  jobId: string;
  displayName: string;
  axes: string[];
  dynamic: boolean;
  expectedCells: number;
  renderedCells: number;
  cells: ExpandedMatrixCell[];
};

export type AxisInference = {
  baseJob: string;
  axes: Record<string, string> | null;
  source: "workflow-rendered-name" | "workflow-job-name" | "unavailable";
};

function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(",")}}`;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

function cartesian(
  entries: Array<[string, MatrixValue[]]>,
): Array<Record<string, MatrixValue>> {
  let rows: Array<Record<string, MatrixValue>> = [{}];
  for (const [axis, values] of entries) {
    rows = rows.flatMap((row) =>
      values.map((value) => ({ ...row, [axis]: value })),
    );
  }
  return rows;
}

function matchesRule(
  row: Record<string, MatrixValue>,
  rule: Record<string, unknown>,
): boolean {
  return Object.entries(rule).every(
    ([key, value]) => key in row && deepEqual(row[key], value),
  );
}

function expandStaticMatrix(
  matrix: Record<string, unknown>,
): {
  rows: Array<Record<string, MatrixValue>>;
  axes: string[];
  dynamic: boolean;
} {
  const axisEntries: Array<[string, MatrixValue[]]> = [];
  let dynamic = false;

  for (const [key, value] of Object.entries(matrix)) {
    if (key === "include" || key === "exclude") continue;
    if (!Array.isArray(value)) {
      dynamic = true;
      continue;
    }
    axisEntries.push([key, value as MatrixValue[]]);
  }

  if (dynamic) {
    return { rows: [], axes: axisEntries.map(([key]) => key), dynamic: true };
  }

  const originalAxes = axisEntries.map(([key]) => key);
  let baseRows = cartesian(axisEntries);

  const exclude = Array.isArray(matrix.exclude)
    ? matrix.exclude.filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === "object" && !Array.isArray(item),
      )
    : [];
  baseRows = baseRows.filter(
    (row) => !exclude.some((rule) => matchesRule(row, rule)),
  );

  const include = Array.isArray(matrix.include)
    ? matrix.include.filter(
        (item): item is Record<string, MatrixValue> =>
          !!item && typeof item === "object" && !Array.isArray(item),
      )
    : [];

  let rows: Array<Record<string, MatrixValue>>;
  if (!originalAxes.length && include.length) {
    rows = include.map((item) => ({ ...item }));
  } else {
    const derived = baseRows.map((original) => ({
      original,
      current: { ...original },
    }));
    const extras: Array<Record<string, MatrixValue>> = [];

    for (const addition of include) {
      let applied = false;
      for (const item of derived) {
        const compatible = originalAxes.every(
          (axis) =>
            !(axis in addition) ||
            deepEqual(item.original[axis], addition[axis]),
        );
        if (!compatible) continue;
        item.current = { ...item.current, ...addition };
        applied = true;
      }
      if (!applied) {
        // GitHub does not apply later include entries to standalone include
        // rows that could not be merged into an original matrix combination.
        extras.push({ ...addition });
      }
    }

    rows = [...derived.map((item) => item.current), ...extras];
  }

  // include-only matrices are common. Treat scalar include keys as axes so
  // their compatibility signal is not silently discarded.
  const inferredIncludeAxes = originalAxes.length
    ? []
    : [...new Set(
        rows.flatMap((row) =>
          Object.entries(row)
            .filter(([, value]) =>
              value === null ||
              ["string", "number", "boolean"].includes(typeof value)
            )
            .map(([key]) => key),
        ),
      )];

  return {
    rows,
    axes: [...originalAxes, ...inferredIncludeAxes],
    dynamic: false,
  };
}

function getPath(
  row: Record<string, MatrixValue>,
  path: string,
): unknown {
  const parts = path.split(".");
  let value: unknown = row;
  for (const part of parts) {
    if (!value || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

function splitArgs(text: string): string[] {
  const result: string[] = [];
  let start = 0;
  let depth = 0;
  let quote: "'" | '"' | null = null;

  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (quote) {
      if (char === quote && text[index - 1] !== "\\") quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      result.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  result.push(text.slice(start).trim());
  return result;
}

function hasWrappingParentheses(text: string): boolean {
  if (!text.startsWith("(") || !text.endsWith(")")) return false;
  let depth = 0;
  let quote: "'" | '"' | null = null;

  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (quote) {
      if (char === quote && text[index - 1] !== "\\") quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (depth === 0 && index < text.length - 1) return false;
  }
  return depth === 0;
}

function evalExpression(
  expression: string,
  row: Record<string, MatrixValue>,
): unknown {
  let expr = expression.trim();
  while (hasWrappingParentheses(expr)) {
    expr = expr.slice(1, -1).trim();
  }

  const fallback = splitTopLevel(expr, "||");
  if (fallback.length > 1) {
    let last: unknown = "";
    for (const part of fallback) {
      const value = evalExpression(part, row);
      last = value;
      if (value) return value;
    }
    return last;
  }

  const andParts = splitTopLevel(expr, "&&");
  if (andParts.length > 1) {
    let last: unknown = true;
    for (const part of andParts) {
      const value = evalExpression(part, row);
      last = value;
      if (!value) return value;
    }
    return last;
  }

  const notEqual = splitTopLevel(expr, "!=");
  if (notEqual.length === 2) {
    return !deepEqual(
      evalExpression(notEqual[0]!, row),
      evalExpression(notEqual[1]!, row),
    );
  }

  const equal = splitTopLevel(expr, "==");
  if (equal.length === 2) {
    return deepEqual(
      evalExpression(equal[0]!, row),
      evalExpression(equal[1]!, row),
    );
  }

  if (expr.startsWith("!")) {
    return !evalExpression(expr.slice(1), row);
  }

  const formatMatch = expr.match(/^format\((.*)\)$/s);
  if (formatMatch) {
    const args = splitArgs(formatMatch[1]!);
    if (!args.length) return undefined;
    const template = evalExpression(args[0]!, row);
    if (typeof template !== "string") return undefined;
    const values = args.slice(1).map((arg) => evalExpression(arg, row));
    if (values.some((value) => value === undefined)) return undefined;
    return template.replace(/\{(\d+)\}/g, (_, index) =>
      String(values[Number(index)] ?? ""),
    );
  }

  const matrixMatch = expr.match(/^matrix\.([A-Za-z0-9_.-]+)$/);
  if (matrixMatch) {
    return getPath(row, matrixMatch[1]!);
  }

  if (
    (expr.startsWith("'") && expr.endsWith("'")) ||
    (expr.startsWith('"') && expr.endsWith('"'))
  ) {
    return expr.slice(1, -1);
  }
  if (expr === "true") return true;
  if (expr === "false") return false;
  if (expr === "null") return null;
  if (/^-?\d+(?:\.\d+)?$/.test(expr)) return Number(expr);

  return undefined;
}

function splitTopLevel(text: string, operator: string): string[] {
  const result: string[] = [];
  let start = 0;
  let depth = 0;
  let quote: "'" | '"' | null = null;

  for (let index = 0; index <= text.length - operator.length; index++) {
    const char = text[index]!;
    if (quote) {
      if (char === quote && text[index - 1] !== "\\") quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (depth === 0 && text.slice(index, index + operator.length) === operator) {
      result.push(text.slice(start, index).trim());
      start = index + operator.length;
      index += operator.length - 1;
    }
  }

  if (!result.length) return [text.trim()];
  result.push(text.slice(start).trim());
  return result;
}

function renderName(
  template: string,
  row: Record<string, MatrixValue>,
): string | null {
  let failed = false;
  const rendered = template.replace(/\$\{\{([\s\S]*?)\}\}/g, (_, expression) => {
    const value = evalExpression(String(expression), row);
    if (value === undefined || (value !== null && typeof value === "object")) {
      failed = true;
      return "";
    }
    return String(value ?? "");
  });
  return failed ? null : rendered;
}

function axesForRow(
  row: Record<string, MatrixValue>,
  axisNames: string[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const axis of axisNames) {
    if (!(axis in row)) continue;
    result[axis] = stableStringify(row[axis]);
  }
  return result;
}

function defaultExpandedName(
  label: string,
  row: Record<string, MatrixValue>,
  axisNames: string[],
): string {
  const values = axisNames
    .filter((axis) => axis in row)
    .map((axis) => stableStringify(row[axis]));
  return values.length ? `${label} (${values.join(", ")})` : label;
}

export function workflowMatrixDefinitions(text: string): MatrixDefinition[] {
  const doc = parse(text) as Record<string, unknown> | null;
  const jobs = (doc?.jobs ?? {}) as Record<string, any>;
  const definitions: MatrixDefinition[] = [];

  for (const [jobId, spec] of Object.entries(jobs)) {
    const matrix = spec?.strategy?.matrix;
    if (!matrix || typeof matrix !== "object" || Array.isArray(matrix)) continue;

    const expanded = expandStaticMatrix(matrix);
    const rawName = typeof spec?.name === "string" ? spec.name : jobId;
    const cells: ExpandedMatrixCell[] = [];

    if (!expanded.dynamic) {
      for (const row of expanded.rows) {
        const name = typeof spec?.name === "string"
          ? spec.name.includes("matrix.")
            ? renderName(spec.name, row)
            : defaultExpandedName(spec.name, row, expanded.axes)
          : defaultExpandedName(jobId, row, expanded.axes);
        if (!name) continue;
        cells.push({
          name,
          axes: axesForRow(row, expanded.axes),
        });
      }
    }

    const displayName = rawName.includes("${{") ? jobId : rawName;
    definitions.push({
      jobId,
      displayName,
      axes: expanded.axes,
      dynamic: expanded.dynamic,
      expectedCells: expanded.dynamic ? 0 : expanded.rows.length,
      renderedCells: cells.length,
      cells,
    });
  }

  return definitions;
}

export function inferAxesFromExpandedJobName(
  name: string,
  definitions: MatrixDefinition[],
): AxisInference {
  const exactMatches = definitions.flatMap((definition) =>
    definition.cells
      .filter(
        (cell) => cell.name === name || name.startsWith(`${cell.name} / `),
      )
      .map((cell) => ({ definition, cell })),
  );

  if (exactMatches.length === 1) {
    const match = exactMatches[0]!;
    return {
      baseJob: match.definition.jobId,
      axes: match.cell.axes,
      source: "workflow-rendered-name",
    };
  }

  const match = name.match(/^(.*?)\s+\((.*)\)$/);
  if (!match) {
    return { baseJob: name, axes: null, source: "unavailable" };
  }

  const baseJob = match[1]!.trim();
  const inner = match[2]!.trim();
  const definition = definitions.find(
    (candidate) => candidate.displayName === baseJob || candidate.jobId === baseJob,
  );
  if (!definition || definition.dynamic || !definition.axes.length) {
    return { baseJob, axes: null, source: "unavailable" };
  }

  const values = definition.axes.length === 1
    ? [inner]
    : inner.split(",").map((value) => value.trim());

  if (values.length !== definition.axes.length) {
    return { baseJob, axes: null, source: "unavailable" };
  }

  return {
    baseJob: definition.jobId,
    axes: Object.fromEntries(
      definition.axes.map((axis, index) => [axis, values[index] ?? ""]),
    ),
    source: "workflow-job-name",
  };
}
