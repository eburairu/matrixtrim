import { parseDocument } from "yaml";
import { workflowMatrixDefinitions } from "./axes.js";

export type WorkflowRewriteJob = {
	jobId: string;
	beforeCells: number;
	afterCells: number;
};

export type WorkflowRewriteResult = {
	changed: boolean;
	workflow: string;
	jobs: WorkflowRewriteJob[];
};

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

	const document = parseDocument(workflowText, {
		keepSourceTokens: true,
	});
	if (document.errors.length) {
		throw new Error(
			`workflow YAML could not be parsed safely: ${document.errors[0]!.message}`,
		);
	}

	const jobs: WorkflowRewriteJob[] = [];

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

		const include = selected.map((cell) => cell.matrix);
		document.setIn(["jobs", definition.jobId, "strategy", "matrix"], {
			include,
		});
		jobs.push({
			jobId: definition.jobId,
			beforeCells: definition.cells.length,
			afterCells: selected.length,
		});
	}

	if (!jobs.length) {
		return { changed: false, workflow: workflowText, jobs: [] };
	}

	const rewritten = document.toString({
		lineWidth: 0,
	});

	// Round-trip verification: every changed static matrix must render exactly
	// the selected cell names. If YAML serialization changes semantics, refuse.
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
			.map((cell) => cell.name)
			.sort();
		const actual = after.cells.map((cell) => cell.name).sort();

		if (
			expected.length !== actual.length ||
			expected.some((name, index) => name !== actual[index])
		) {
			throw new Error(
				`rewritten matrix for job ${job.jobId} did not round-trip to the selected cells`,
			);
		}
	}

	return {
		changed: true,
		workflow: rewritten,
		jobs,
	};
}
