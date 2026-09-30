import { parse } from "yaml";
import { asRecord } from "./object.js";

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
		return Object.values(value as Record<string, unknown>).some(
			hasRuntimeExpression,
		);
	}
	return false;
}

export function inspectWorkflow(text: string): MatrixSummary[] {
	const doc = asRecord(parse(text));
	const jobs = asRecord(doc?.jobs) ?? {};
	const result: MatrixSummary[] = [];

	for (const [job, rawSpec] of Object.entries(jobs)) {
		const spec = asRecord(rawSpec);
		const strategy = asRecord(spec?.strategy);
		const matrix = strategy?.matrix;
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

		const matrixRecord = asRecord(matrix);
		if (!matrixRecord) continue;
		const axes: Record<string, number> = {};
		let dynamic =
			("include" in matrixRecord && !Array.isArray(matrixRecord.include)) ||
			("exclude" in matrixRecord && !Array.isArray(matrixRecord.exclude)) ||
			hasRuntimeExpression(matrixRecord.include) ||
			hasRuntimeExpression(matrixRecord.exclude);
		for (const [key, value] of Object.entries(matrixRecord)) {
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
			excludeRules: Array.isArray(matrixRecord.exclude)
				? matrixRecord.exclude.length
				: 0,
			includeEntries: Array.isArray(matrixRecord.include)
				? matrixRecord.include.length
				: 0,
			dynamic,
		});
	}
	return result;
}
