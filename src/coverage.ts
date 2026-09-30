import type { CellSummary } from "./analyze.js";

export type CoverageToken = {
	id: string;
	baseJob: string;
	axes: string[];
	values: string[];
};

function combinations<T>(items: T[], size: number): T[][] {
	if (size <= 0) return [[]];
	if (items.length < size) return [];
	if (size === 1) return items.map((item) => [item]);

	const result: T[][] = [];
	for (let index = 0; index <= items.length - size; index++) {
		const head = items[index]!;
		for (const tail of combinations(items.slice(index + 1), size - 1)) {
			result.push([head, ...tail]);
		}
	}
	return result;
}

function stablePairs(axes: Record<string, string>): Array<[string, string]> {
	return Object.entries(axes).sort(([a], [b]) => a.localeCompare(b));
}

export function tWiseCoverageForCell(
	cell: Pick<CellSummary, "baseJob" | "axes">,
	strength = 2,
): CoverageToken[] {
	if (!cell.axes || strength < 1) return [];
	const entries = stablePairs(cell.axes);
	return combinations(entries, strength).map((combo) => {
		const axes = combo.map(([axis]) => axis);
		const values = combo.map(([, value]) => value);
		const encoded = combo
			.map(
				([axis, value]) =>
					`${encodeURIComponent(axis)}=${encodeURIComponent(value)}`,
			)
			.join("&");
		return {
			id: `tw:${strength}:${encodeURIComponent(cell.baseJob)}:${encoded}`,
			baseJob: cell.baseJob,
			axes,
			values,
		};
	});
}

export function observedCombinatorialCoverage(
	cells: CellSummary[],
	maxStrength = 2,
): {
	tokens: CoverageToken[];
	byCell: Map<string, Set<string>>;
	unresolvedCells: string[];
	eligibleCells: number;
} {
	const tokensById = new Map<string, CoverageToken>();
	const byCell = new Map<string, Set<string>>();
	const unresolvedCells: string[] = [];
	let eligibleCells = 0;

	for (const cell of cells) {
		if (!cell.axes) {
			unresolvedCells.push(cell.cell);
			continue;
		}

		const tokens = [];
		const availableStrength = Math.min(
			maxStrength,
			Object.keys(cell.axes).length,
		);
		for (let strength = 1; strength <= availableStrength; strength++) {
			tokens.push(...tWiseCoverageForCell(cell, strength));
		}

		if (tokens.length) eligibleCells++;
		const ids = new Set(tokens.map((token) => token.id));
		byCell.set(cell.cell, ids);
		for (const token of tokens) tokensById.set(token.id, token);
	}

	return {
		tokens: [...tokensById.values()].sort((a, b) => a.id.localeCompare(b.id)),
		byCell,
		unresolvedCells,
		eligibleCells,
	};
}
