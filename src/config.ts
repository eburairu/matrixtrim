import { parse } from "yaml";
import { GitHubHttpError, type GitHubClient } from "./github.js";

export type RequireConstraint = {
  baseJob?: string;
  axes: Record<string, string>;
};

export type MatrixTrimConstraints = {
  keep: string[];
  require: RequireConstraint[];
};

export type MatrixTrimConfig = {
  version: 1;
  constraints: MatrixTrimConstraints;
};

export const EMPTY_CONSTRAINTS: MatrixTrimConstraints = {
  keep: [],
  require: [],
};

function stringRecord(
  value: unknown,
  context: string,
): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context} must be a mapping`);
  }

  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!key.trim()) {
      throw new Error(`${context} contains an empty axis name`);
    }
    if (
      typeof raw !== "string" &&
      typeof raw !== "number" &&
      typeof raw !== "boolean"
    ) {
      throw new Error(
        `${context}.${key} must be a string, number, or boolean`,
      );
    }
    result[key] = String(raw);
  }
  if (!Object.keys(result).length) {
    throw new Error(`${context} must contain at least one axis`);
  }
  return result;
}

export function parseMatrixTrimConfig(text: string): MatrixTrimConfig {
  const raw = parse(text) as unknown;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("MatrixTrim config must be a YAML mapping");
  }

  const root = raw as Record<string, unknown>;
  const version = root.version ?? 1;
  if (version !== 1) {
    throw new Error(`unsupported MatrixTrim config version: ${String(version)}`);
  }

  const constraintsRaw = root.constraints ?? {};
  if (
    !constraintsRaw ||
    typeof constraintsRaw !== "object" ||
    Array.isArray(constraintsRaw)
  ) {
    throw new Error("constraints must be a mapping");
  }

  const constraintsObject = constraintsRaw as Record<string, unknown>;

  const keepRaw = constraintsObject.keep ?? [];
  if (!Array.isArray(keepRaw)) {
    throw new Error("constraints.keep must be a list of exact cell names");
  }
  const keep = keepRaw.map((item, index) => {
    if (typeof item !== "string" || !item.trim()) {
      throw new Error(
        `constraints.keep[${index}] must be a non-empty cell name`,
      );
    }
    return item.trim();
  });

  const requireRaw = constraintsObject.require ?? [];
  if (!Array.isArray(requireRaw)) {
    throw new Error("constraints.require must be a list of selectors");
  }
  const require = requireRaw.map((item, index): RequireConstraint => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`constraints.require[${index}] must be a mapping`);
    }
    const selector = item as Record<string, unknown>;
    const baseJobRaw = selector.baseJob;
    if (
      baseJobRaw !== undefined &&
      (typeof baseJobRaw !== "string" || !baseJobRaw.trim())
    ) {
      throw new Error(
        `constraints.require[${index}].baseJob must be a non-empty string`,
      );
    }

    return {
      ...(typeof baseJobRaw === "string"
        ? { baseJob: baseJobRaw.trim() }
        : {}),
      axes: stringRecord(
        selector.axes,
        `constraints.require[${index}].axes`,
      ),
    };
  });

  return {
    version: 1,
    constraints: {
      keep: [...new Set(keep)],
      require,
    },
  };
}

export async function loadRepositoryConfig(
  client: GitHubClient,
  path = ".matrixtrim.yml",
  required = false,
): Promise<MatrixTrimConfig | null> {
  try {
    return parseMatrixTrimConfig(await client.fileText(path));
  } catch (error) {
    if (
      !required &&
      error instanceof GitHubHttpError &&
      error.status === 404
    ) {
      return null;
    }
    throw error;
  }
}
