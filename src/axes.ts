import { parse } from "yaml";
import {
	type MatrixValue,
	matchDynamicNameTemplate,
	matrixAxesInTemplate,
	renderName,
} from "./expression.js";
import { asRecord } from "./object.js";

export type ExpandedMatrixCell = {
	name: string;
	axes: Record<string, string>;
	matrix: Record<string, unknown>;
};

export type MatrixDefinition = {
	jobId: string;
	displayName: string;
	axes: string[];
	dynamic: boolean;
	expectedCells: number;
	renderedCells: number;
	cells: ExpandedMatrixCell[];
	nameTemplate?: string;
	captureEvidence: boolean;
};

export type AxisInference = {
	baseJob: string;
	axes: Record<string, string> | null;
	source: "workflow-rendered-name" | "workflow-job-name" | "unavailable";
};

export type AxisInferenceFailureReason =
	| "ambiguous-rendered-name"
	| "ambiguous-dynamic-name"
	| "job-name-not-matrix-shaped"
	| "matrix-definition-not-found"
	| "axis-names-unavailable"
	| "axis-value-count-mismatch"
	| "opaque-dynamic-job-name";

export type AxisInferenceDiagnostic = AxisInference & {
	reason?: AxisInferenceFailureReason;
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

export function axesFromMatrixEvidence(
	matrix: Record<string, unknown>,
): Record<string, string> {
	return Object.fromEntries(
		Object.entries(matrix)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([axis, value]) => [axis, stableStringify(value)]),
	);
}

function deepEqual(a: unknown, b: unknown): boolean {
	return stableStringify(a) === stableStringify(b);
}

function hasRuntimeExpression(value: unknown): boolean {
	if (typeof value === "string") return value.includes("${{");
	if (Array.isArray(value)) return value.some(hasRuntimeExpression);
	if (value && typeof value === "object") {
		return Object.values(value as Record<string, unknown>).some(
			hasRuntimeExpression,
		);
	}
	return false;
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

function expandStaticMatrix(matrix: Record<string, unknown>): {
	rows: Array<Record<string, MatrixValue>>;
	axes: string[];
	dynamic: boolean;
} {
	const axisEntries: Array<[string, MatrixValue[]]> = [];
	const axisNames: string[] = [];
	let dynamic =
		("include" in matrix && !Array.isArray(matrix.include)) ||
		("exclude" in matrix && !Array.isArray(matrix.exclude)) ||
		hasRuntimeExpression(matrix.include) ||
		hasRuntimeExpression(matrix.exclude);

	for (const [key, value] of Object.entries(matrix)) {
		if (key === "include" || key === "exclude") continue;
		axisNames.push(key);
		if (!Array.isArray(value) || hasRuntimeExpression(value)) {
			dynamic = true;
			continue;
		}
		axisEntries.push([key, value as MatrixValue[]]);
	}

	if (dynamic) {
		return { rows: [], axes: axisNames, dynamic: true };
	}

	const originalAxes = axisNames;
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
		: [
				...new Set(
					rows.flatMap((row) =>
						Object.entries(row)
							.filter(
								([, value]) =>
									value === null ||
									["string", "number", "boolean"].includes(typeof value),
							)
							.map(([key]) => key),
					),
				),
			];

	return {
		rows,
		axes: [...originalAxes, ...inferredIncludeAxes],
		dynamic: false,
	};
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
): string {
	const values = Object.values(row)
		.map((value) => stableStringify(value))
		.filter((value) => value !== "");
	return values.length ? `${label} (${values.join(", ")})` : label;
}

function hasCaptureEvidenceStep(spec: unknown): boolean {
	const record = asRecord(spec);
	if (!Array.isArray(record?.steps)) return false;
	return record.steps.some((rawStep) => {
		const step = asRecord(rawStep);
		const withConfig = asRecord(step?.with);
		return (
			String(withConfig?.mode ?? "")
				.trim()
				.toLowerCase() === "capture" &&
			typeof withConfig?.matrix === "string" &&
			withConfig.matrix.includes("matrix")
		);
	});
}

export function workflowMatrixDefinitions(text: string): MatrixDefinition[] {
	const doc = asRecord(parse(text));
	const jobs = asRecord(doc?.jobs) ?? {};
	const definitions: MatrixDefinition[] = [];

	for (const [jobId, rawSpec] of Object.entries(jobs)) {
		const spec = asRecord(rawSpec);
		const strategy = asRecord(spec?.strategy);
		const matrix = strategy?.matrix;
		if (!matrix) continue;

		const rawName = typeof spec?.name === "string" ? spec.name : jobId;
		const captureEvidence = hasCaptureEvidenceStep(spec);
		const nameTemplate =
			typeof spec?.name === "string" && spec.name.includes("${{")
				? spec.name
				: undefined;

		if (typeof matrix !== "object" || Array.isArray(matrix)) {
			if (typeof matrix !== "string" || !matrix.includes("${{")) continue;
			definitions.push({
				jobId,
				displayName: rawName.includes("${{") ? jobId : rawName,
				axes: nameTemplate ? matrixAxesInTemplate(nameTemplate) : [],
				dynamic: true,
				expectedCells: 0,
				renderedCells: 0,
				cells: [],
				nameTemplate,
				captureEvidence,
			});
			continue;
		}

		const matrixRecord = asRecord(matrix);
		if (!matrixRecord) continue;
		const expanded = expandStaticMatrix(matrixRecord);
		const cells: ExpandedMatrixCell[] = [];

		if (!expanded.dynamic) {
			for (const row of expanded.rows) {
				const name =
					typeof spec?.name === "string"
						? spec.name.includes("${{")
							? renderName(spec.name, row)
							: defaultExpandedName(spec.name, row)
						: defaultExpandedName(jobId, row);
				if (!name) continue;
				cells.push({
					name,
					axes: axesForRow(row, expanded.axes),
					matrix: { ...row },
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
			nameTemplate,
			captureEvidence,
		});
	}

	return definitions;
}

export function diagnoseAxesFromExpandedJobName(
	name: string,
	definitions: MatrixDefinition[],
): AxisInferenceDiagnostic {
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
	if (exactMatches.length > 1) {
		return {
			baseJob: name,
			axes: null,
			source: "unavailable",
			reason: "ambiguous-rendered-name",
		};
	}

	const dynamicMatches = definitions.flatMap((definition) => {
		if (!definition.dynamic || !definition.nameTemplate) return [];
		const axes = matchDynamicNameTemplate(definition.nameTemplate, name);
		return axes ? [{ definition, axes }] : [];
	});

	if (dynamicMatches.length === 1) {
		const match = dynamicMatches[0]!;
		return {
			baseJob: match.definition.jobId,
			axes: match.axes,
			source: "workflow-rendered-name",
		};
	}
	if (dynamicMatches.length > 1) {
		return {
			baseJob: name,
			axes: null,
			source: "unavailable",
			reason: "ambiguous-dynamic-name",
		};
	}

	const match = name.match(/^(.*?)\s+\((.*)\)$/);
	if (!match) {
		const direct = definitions.find(
			(candidate) => candidate.displayName === name || candidate.jobId === name,
		);
		return {
			baseJob: direct?.jobId ?? name,
			axes: null,
			source: "unavailable",
			reason: direct?.dynamic
				? "opaque-dynamic-job-name"
				: "job-name-not-matrix-shaped",
		};
	}

	const baseJob = match[1]!.trim();
	const inner = match[2]!.trim();
	const definition = definitions.find(
		(candidate) =>
			candidate.displayName === baseJob || candidate.jobId === baseJob,
	);
	if (!definition) {
		return {
			baseJob,
			axes: null,
			source: "unavailable",
			reason: "matrix-definition-not-found",
		};
	}
	if (!definition.axes.length) {
		return {
			baseJob: definition.jobId,
			axes: null,
			source: "unavailable",
			reason: "axis-names-unavailable",
		};
	}

	const values =
		definition.axes.length === 1
			? [inner]
			: inner.split(",").map((value) => value.trim());

	if (values.length !== definition.axes.length) {
		return {
			baseJob: definition.jobId,
			axes: null,
			source: "unavailable",
			reason: "axis-value-count-mismatch",
		};
	}

	return {
		baseJob: definition.jobId,
		axes: Object.fromEntries(
			definition.axes.map((axis, index) => [axis, values[index] ?? ""]),
		),
		source: "workflow-job-name",
	};
}

export function inferAxesFromExpandedJobName(
	name: string,
	definitions: MatrixDefinition[],
): AxisInference {
	const { reason: _reason, ...inference } = diagnoseAxesFromExpandedJobName(
		name,
		definitions,
	);
	return inference;
}
