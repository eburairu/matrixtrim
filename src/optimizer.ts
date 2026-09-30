export type SetCoverCandidate = {
	id: string;
	cost: number;
	covers: ReadonlySet<string>;
};

export type SetCoverSolution = {
	selected: string[];
	cost: number;
};

export type ExactSetCoverResult = SetCoverSolution & {
	optimal: boolean;
	searchNodes: number;
	aborted: boolean;
};

const EPSILON = 1e-9;

function compareIds(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

function solutionBetter(
	candidate: SetCoverSolution,
	current: SetCoverSolution,
): boolean {
	if (candidate.cost < current.cost - EPSILON) return true;
	if (candidate.cost > current.cost + EPSILON) return false;
	if (candidate.selected.length < current.selected.length) return true;
	if (candidate.selected.length > current.selected.length) return false;

	const a = [...candidate.selected].sort(compareIds);
	const b = [...current.selected].sort(compareIds);
	for (let index = 0; index < a.length; index++) {
		const delta = compareIds(a[index]!, b[index]!);
		if (delta !== 0) return delta < 0;
	}
	return false;
}

function validate(
	candidates: SetCoverCandidate[],
	requirements: ReadonlySet<string>,
): void {
	const covered = new Set<string>();
	for (const candidate of candidates) {
		if (!Number.isFinite(candidate.cost) || candidate.cost <= 0) {
			throw new Error(
				`set-cover candidate ${candidate.id} has invalid cost ${candidate.cost}`,
			);
		}
		for (const token of candidate.covers) covered.add(token);
	}

	const missing = [...requirements].filter((token) => !covered.has(token));
	if (missing.length) {
		throw new Error(
			`set-cover universe contains ${missing.length} uncovered requirement(s)`,
		);
	}
}

function pruneRedundant(
	selected: SetCoverCandidate[],
	requirements: ReadonlySet<string>,
): SetCoverCandidate[] {
	const result = [...selected];
	let changed = true;

	while (changed) {
		changed = false;
		const removable = [...result].sort((a, b) => {
			const costDelta = b.cost - a.cost;
			if (Math.abs(costDelta) > EPSILON) return costDelta;
			return compareIds(a.id, b.id);
		});

		for (const candidate of removable) {
			const covered = new Set<string>();
			for (const item of result) {
				if (item.id === candidate.id) continue;
				for (const token of item.covers) covered.add(token);
			}
			if ([...requirements].every((token) => covered.has(token))) {
				const index = result.findIndex((item) => item.id === candidate.id);
				if (index >= 0) result.splice(index, 1);
				changed = true;
				break;
			}
		}
	}

	return result;
}

export function greedyWeightedSetCover(
	candidates: SetCoverCandidate[],
	requirements: ReadonlySet<string>,
): SetCoverSolution {
	validate(candidates, requirements);

	const uncovered = new Set(requirements);
	const remaining = new Map(
		candidates
			.slice()
			.sort((a, b) => compareIds(a.id, b.id))
			.map((candidate) => [candidate.id, candidate]),
	);
	const selected: SetCoverCandidate[] = [];

	while (uncovered.size) {
		let best: SetCoverCandidate | undefined;
		let bestNew: string[] = [];
		let bestScore = -1;

		for (const candidate of remaining.values()) {
			const newlyCovered = [...candidate.covers].filter((token) =>
				uncovered.has(token),
			);
			if (!newlyCovered.length) continue;

			const score = newlyCovered.length / candidate.cost;
			if (
				score > bestScore + EPSILON ||
				(Math.abs(score - bestScore) <= EPSILON &&
					newlyCovered.length > bestNew.length) ||
				(Math.abs(score - bestScore) <= EPSILON &&
					newlyCovered.length === bestNew.length &&
					best &&
					compareIds(candidate.id, best.id) < 0)
			) {
				best = candidate;
				bestNew = newlyCovered;
				bestScore = score;
			}
		}

		if (!best) {
			throw new Error("unable to satisfy set-cover requirements");
		}

		selected.push(best);
		remaining.delete(best.id);
		for (const token of bestNew) uncovered.delete(token);
	}

	const pruned = pruneRedundant(selected, requirements);
	return {
		selected: pruned.map((candidate) => candidate.id).sort(compareIds),
		cost: pruned.reduce((sum, candidate) => sum + candidate.cost, 0),
	};
}

export function exactWeightedSetCover(
	candidates: SetCoverCandidate[],
	requirements: ReadonlySet<string>,
	options: {
		maxNodes?: number;
		initial?: SetCoverSolution;
	} = {},
): ExactSetCoverResult {
	validate(candidates, requirements);

	const maxNodes = options.maxNodes ?? 250_000;
	if (!Number.isInteger(maxNodes) || maxNodes < 1) {
		throw new Error("maxNodes must be a positive integer");
	}

	const sortedCandidates = candidates
		.slice()
		.sort((a, b) => compareIds(a.id, b.id));
	const candidateById = new Map(
		sortedCandidates.map((candidate, index) => [candidate.id, index]),
	);
	const requirementCandidates = new Map<string, number[]>();
	for (const requirement of requirements) {
		requirementCandidates.set(
			requirement,
			sortedCandidates
				.map((candidate, index) =>
					candidate.covers.has(requirement) ? index : -1,
				)
				.filter((index) => index >= 0),
		);
	}

	const initial =
		options.initial ?? greedyWeightedSetCover(sortedCandidates, requirements);
	let best: SetCoverSolution = {
		selected: [...initial.selected].sort(compareIds),
		cost: initial.cost,
	};
	let searchNodes = 0;
	let aborted = false;

	function recurse(
		uncovered: Set<string>,
		selectedIndices: number[],
		selectedSet: Set<number>,
		cost: number,
	): void {
		if (aborted) return;
		searchNodes++;
		if (searchNodes > maxNodes) {
			aborted = true;
			return;
		}

		if (cost > best.cost + EPSILON) return;
		if (!uncovered.size) {
			const candidate: SetCoverSolution = {
				selected: selectedIndices
					.map((index) => sortedCandidates[index]!.id)
					.sort(compareIds),
				cost,
			};
			if (solutionBetter(candidate, best)) best = candidate;
			return;
		}

		let maxRatio = 0;
		for (let index = 0; index < sortedCandidates.length; index++) {
			if (selectedSet.has(index)) continue;
			const candidate = sortedCandidates[index]!;
			let gain = 0;
			for (const token of candidate.covers) {
				if (uncovered.has(token)) gain++;
			}
			if (!gain) continue;
			maxRatio = Math.max(maxRatio, gain / candidate.cost);
		}
		if (!maxRatio) return;

		const optimisticCost = cost + uncovered.size / maxRatio;
		if (optimisticCost > best.cost + EPSILON) return;

		let pivot: string | undefined;
		let pivotCandidates: number[] = [];
		for (const requirement of [...uncovered].sort(compareIds)) {
			const eligible = (requirementCandidates.get(requirement) ?? []).filter(
				(index) => !selectedSet.has(index),
			);
			if (!eligible.length) return;
			if (pivot === undefined || eligible.length < pivotCandidates.length) {
				pivot = requirement;
				pivotCandidates = eligible;
				if (eligible.length === 1) break;
			}
		}
		if (pivot === undefined) return;

		pivotCandidates.sort((a, b) => {
			const left = sortedCandidates[a]!;
			const right = sortedCandidates[b]!;

			let leftGain = 0;
			let rightGain = 0;
			for (const token of left.covers) {
				if (uncovered.has(token)) leftGain++;
			}
			for (const token of right.covers) {
				if (uncovered.has(token)) rightGain++;
			}

			const leftScore = leftGain / left.cost;
			const rightScore = rightGain / right.cost;
			if (Math.abs(leftScore - rightScore) > EPSILON) {
				return rightScore - leftScore;
			}
			if (leftGain !== rightGain) return rightGain - leftGain;
			if (Math.abs(left.cost - right.cost) > EPSILON) {
				return left.cost - right.cost;
			}
			return compareIds(left.id, right.id);
		});

		for (const index of pivotCandidates) {
			if (aborted) break;
			const candidate = sortedCandidates[index]!;
			const nextCost = cost + candidate.cost;
			if (nextCost > best.cost + EPSILON) continue;

			const nextUncovered = new Set(uncovered);
			for (const token of candidate.covers) nextUncovered.delete(token);

			const nextSelectedSet = new Set(selectedSet);
			nextSelectedSet.add(index);
			recurse(
				nextUncovered,
				[...selectedIndices, index],
				nextSelectedSet,
				nextCost,
			);
		}
	}

	recurse(new Set(requirements), [], new Set(), 0);

	// The caller may pass an initial solution containing IDs that were not in
	// this candidate set; reject that rather than silently returning nonsense.
	for (const id of best.selected) {
		if (!candidateById.has(id)) {
			throw new Error(
				`initial set-cover solution references unknown candidate: ${id}`,
			);
		}
	}

	return {
		...best,
		optimal: !aborted,
		searchNodes,
		aborted,
	};
}
