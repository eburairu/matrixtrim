import { parse } from "yaml";

export type MatrixDefinition = {
  jobId: string;
  displayName: string;
  axes: string[];
  dynamic: boolean;
};

export type AxisInference = {
  baseJob: string;
  axes: Record<string, string> | null;
  source: "workflow-job-name" | "unavailable";
};

export function workflowMatrixDefinitions(text: string): MatrixDefinition[] {
  const doc = parse(text) as Record<string, unknown> | null;
  const jobs = (doc?.jobs ?? {}) as Record<string, any>;
  const definitions: MatrixDefinition[] = [];

  for (const [jobId, spec] of Object.entries(jobs)) {
    const matrix = spec?.strategy?.matrix;
    if (!matrix || typeof matrix !== "object") continue;

    const axes: string[] = [];
    let dynamic = false;
    for (const [key, value] of Object.entries(matrix)) {
      if (key === "include" || key === "exclude") continue;
      axes.push(key);
      if (!Array.isArray(value)) dynamic = true;
    }

    const rawName = typeof spec?.name === "string" ? spec.name : jobId;
    const displayName = rawName.includes("${{") ? jobId : rawName;
    definitions.push({ jobId, displayName, axes, dynamic });
  }

  return definitions;
}

export function inferAxesFromExpandedJobName(
  name: string,
  definitions: MatrixDefinition[],
): AxisInference {
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
    baseJob,
    axes: Object.fromEntries(
      definition.axes.map((axis, index) => [axis, values[index] ?? ""]),
    ),
    source: "workflow-job-name",
  };
}
