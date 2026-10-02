import { parse, parseDocument } from "yaml";
import { workflowMatrixDefinitions } from "./axes.js";
import { asRecord } from "./object.js";

export type WorkflowRewriteMode =
	| "axis-pruning"
	| "axis-pruning+exclude"
	| "exclude"
	| "explicit-include";

export type WorkflowRewriteJob = {
	jobId: string;
	beforeCells: number;
	afterCells: number;
	mode: WorkflowRewriteMode;
};

export type WorkflowRewriteResult = {
	changed: boolean;
	workflow: string;
	jobs: WorkflowRewriteJob[];
};

type RewritePlan = {
	mode: Exclude<WorkflowRewriteMode, "explicit-include">;
	matrix: Record<string, unknown>;
	cost: number;
	rank: number;
};

function stableValueKey(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) {
		return `[${value.map(stableValueKey).join(",")}]`;
	}
	if (value && typeof value === "object") {
		return `{${Object.entries(value as Record<string, unknown>)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, item]) => `${JSON.stringify(key)}:${stableValueKey(item)}`)
			.join(",")}}`;
	}
	return `${typeof value}:${String(value)}`;
}

function sameNames(actual: string[], expected: string[]): boolean {
	const left = [...actual].sort();
	const right = [...expected].sort();
	return (
		left.length === right.length &&
		left.every((name, index) => name === right[index])
	);
}

function matrixForJob(
	workflowText: string,
	jobId: string,
): Record<string, unknown> {
	const root = asRecord(parse(workflowText));
	const jobs = asRecord(root?.jobs);
	const job = asRecord(jobs?.[jobId]);
	const strategy = asRecord(job?.strategy);
	const matrix = asRecord(strategy?.matrix);
	if (!matrix) {
		throw new Error(`matrix for job ${jobId} could not be read safely`);
	}
	return structuredClone(matrix);
}

function renderMatrix(
	workflowText: string,
	jobId: string,
	matrix: Record<string, unknown>,
): string {
	const document = parseDocument(workflowText, { keepSourceTokens: true });
	if (document.errors.length) {
		throw new Error(
			`workflow YAML could not be parsed safely: ${document.errors[0]!.message}`,
		);
	}
	document.setIn(["jobs", jobId, "strategy", "matrix"], matrix);
	return document.toString({ lineWidth: 0 });
}

function staticAxisKeys(matrix: Record<string, unknown>): string[] {
	return Object.entries(matrix)
		.filter(
			([key, value]) =>
				key !== "include" && key !== "exclude" && Array.isArray(value),
		)
		.map(([key]) => key);
}

function selectedValueKeys(
	selected: Array<{ matrix: Record<string, unknown> }>,
	axis: string,
): Set<string> {
	return new Set(
		selected
			.filter((cell) => axis in cell.matrix)
			.map((cell) => stableValueKey(cell.matrix[axis])),
	);
}

function axisPrunedMatrix(
	matrix: Record<string, unknown>,
	selected: Array<{ matrix: Record<string, unknown> }>,
): Record<string, unknown> | null {
	const candidate = structuredClone(matrix);
	let changed = false;
	for (const axis of staticAxisKeys(matrix)) {
		const values = matrix[axis];
		if (!Array.isArray(values)) continue;
		const wanted = selectedValueKeys(selected, axis);
		if (!wanted.size) return null;
		const filtered = values.filter((value) =>
			wanted.has(stableValueKey(value)),
		);
		if (!filtered.length) return null;
		if (filtered.length !== values.length) changed = true;
		candidate[axis] = filtered;
	}
	return changed ? candidate : null;
}

function exclusionRule(
	cell: { matrix: Record<string, unknown> },
	axisKeys: string[],
): Record<string, unknown> | null {
	const rule: Record<string, unknown> = {};
	for (const axis of axisKeys) {
		if (!(axis in cell.matrix)) return null;
		rule[axis] = cell.matrix[axis];
	}
	return Object.keys(rule).length ? rule : null;
}

function cellFitsAxisValues(
	cell: { matrix: Record<string, unknown> },
	matrix: Record<string, unknown>,
): boolean {
	for (const axis of staticAxisKeys(matrix)) {
		const values = matrix[axis];
		if (!Array.isArray(values) || !(axis in cell.matrix)) return false;
		const wanted = stableValueKey(cell.matrix[axis]);
		if (!values.some((value) => stableValueKey(value) === wanted)) return false;
	}
	return true;
}

function withExclusions(
	matrix: Record<string, unknown>,
	omitted: Array<{ matrix: Record<string, unknown> }>,
): Record<string, unknown> | null {
	const axes = staticAxisKeys(matrix);
	if (!axes.length) return null;
	const relevant = omitted.filter((cell) => cellFitsAxisValues(cell, matrix));
	const rules = relevant.map((cell) => exclusionRule(cell, axes));
	if (rules.some((rule) => rule === null)) return null;

	const existing = Array.isArray(matrix.exclude)
		? matrix.exclude.filter(
				(item): item is Record<string, unknown> =>
					!!item && typeof item === "object" && !Array.isArray(item),
			)
		: [];
	const unique = new Map<string, Record<string, unknown>>();
	for (const rule of [...existing, ...(rules as Record<string, unknown>[])]) {
		unique.set(stableValueKey(rule), rule);
	}

	const candidate = structuredClone(matrix);
	candidate.exclude = [...unique.values()];
	return candidate;
}

function matrixCost(matrix: Record<string, unknown>): number {
	return JSON.stringify(matrix).length;
}

function candidateIsExact(
	workflowText: string,
	jobId: string,
	matrix: Record<string, unknown>,
	expectedNames: string[],
): { workflow: string; exact: boolean } {
	const workflow = renderMatrix(workflowText, jobId, matrix);
	const definition = workflowMatrixDefinitions(workflow).find(
		(item) => item.jobId === jobId,
	);
	return {
		workflow,
		exact:
			!!definition &&
			!definition.dynamic &&
			sameNames(
				definition.cells.map((cell) => cell.name),
				expectedNames,
			),
	};
}

function chooseSimplePlan(
	workflowText: string,
	jobId: string,
	definition: ReturnType<typeof workflowMatrixDefinitions>[number],
	selected: typeof definition.cells,
): { workflow: string; plan: RewritePlan } | null {
	const original = matrixForJob(workflowText, jobId);
	const selectedNames = selected.map((cell) => cell.name);
	const selectedSet = new Set(selectedNames);
	const omitted = definition.cells.filter(
		(cell) => !selectedSet.has(cell.name),
	);
	const plans: RewritePlan[] = [];

	const pruned = axisPrunedMatrix(original, selected);
	if (pruned) {
		plans.push({
			mode: "axis-pruning",
			matrix: pruned,
			cost: matrixCost(pruned),
			rank: 0,
		});
		const prunedWithExcludes = withExclusions(pruned, omitted);
		if (prunedWithExcludes) {
			plans.push({
				mode: "axis-pruning+exclude",
				matrix: prunedWithExcludes,
				cost: matrixCost(prunedWithExcludes),
				rank: 1,
			});
		}
	}

	const excluded = withExclusions(original, omitted);
	if (excluded) {
		plans.push({
			mode: "exclude",
			matrix: excluded,
			cost: matrixCost(excluded),
			rank: 2,
		});
	}

	const exact = plans
		.map((plan) => ({
			plan,
			...candidateIsExact(workflowText, jobId, plan.matrix, selectedNames),
		}))
		.filter((item) => item.exact)
		.sort((a, b) => a.plan.cost - b.plan.cost || a.plan.rank - b.plan.rank);
	return exact[0] ?? null;
}

function assertMutationSafe(
	workflowText: string,
	observedCells: Set<string>,
	selectedCells: Set<string>,
): ReturnType<typeof workflowMatrixDefinitions> {
	const definitions = workflowMatrixDefinitions(workflowText);

	if (!definitions.length) {
		throw new Error("workflow contains no static matrix definitions");
	}

	const dynamic = definitions.filter((definition) => definition.dynamic);
	if (dynamic.length) {
		throw new Error(
			`cannot rewrite dynamic matrix job(s): ${dynamic.map((item) => item.jobId).join(", ")}`,
		);
	}

	const currentNames = new Set(
		definitions.flatMap((definition) =>
			definition.cells.map((cell) => cell.name),
		),
	);

	const unseenCurrent = [...currentNames].filter(
		(name) => !observedCells.has(name),
	);
	if (unseenCurrent.length) {
		throw new Error(
			`cannot rewrite because ${unseenCurrent.length} current matrix cell(s) were not observed in the analyzed history`,
		);
	}

	const selectedOutsideCurrent = [...selectedCells].filter(
		(name) => !currentNames.has(name),
	);
	if (selectedOutsideCurrent.length) {
		throw new Error(
			`cannot rewrite because recommendation contains ${selectedOutsideCurrent.length} historical cell(s) not present in the current workflow`,
		);
	}

	return definitions;
}

export function rewriteWorkflowToSelectedCells(
	workflowText: string,
	observedCellNames: string[],
	selectedCellNames: string[],
): WorkflowRewriteResult {
	const observedCells = new Set(observedCellNames);
	const selectedCells = new Set(selectedCellNames);
	const definitions = assertMutationSafe(
		workflowText,
		observedCells,
		selectedCells,
	);

	const jobs: WorkflowRewriteJob[] = [];
	let rewritten = workflowText;

	for (const definition of definitions) {
		const selected = definition.cells.filter((cell) =>
			selectedCells.has(cell.name),
		);

		if (!selected.length) {
			throw new Error(
				`cannot remove every matrix cell from job ${definition.jobId}`,
			);
		}
		if (selected.length === definition.cells.length) continue;

		const simple = chooseSimplePlan(
			rewritten,
			definition.jobId,
			definition,
			selected,
		);
		let mode: WorkflowRewriteMode;
		if (simple) {
			rewritten = simple.workflow;
			mode = simple.plan.mode;
		} else {
			const include = selected.map((cell) => cell.matrix);
			rewritten = renderMatrix(rewritten, definition.jobId, { include });
			mode = "explicit-include";
		}

		jobs.push({
			jobId: definition.jobId,
			beforeCells: definition.cells.length,
			afterCells: selected.length,
			mode,
		});
	}

	if (!jobs.length) {
		return { changed: false, workflow: workflowText, jobs: [] };
	}

	// Final proof: every changed static matrix must render exactly the selected
	// cell names. Candidate planning is advisory; this proof is mandatory.
	const rewrittenDefinitions = workflowMatrixDefinitions(rewritten);
	for (const job of jobs) {
		const before = definitions.find((item) => item.jobId === job.jobId)!;
		const after = rewrittenDefinitions.find((item) => item.jobId === job.jobId);
		if (!after || after.dynamic) {
			throw new Error(
				`rewritten matrix for job ${job.jobId} could not be verified`,
			);
		}

		const expected = before.cells
			.filter((cell) => selectedCells.has(cell.name))
			.map((cell) => cell.name);
		const actual = after.cells.map((cell) => cell.name);
		if (!sameNames(actual, expected)) {
			throw new Error(
				`rewritten matrix for job ${job.jobId} did not round-trip to the selected cells`,
			);
		}
	}

	return { changed: true, workflow: rewritten, jobs };
}
