import { describe, expect, it } from "vitest";
import {
	exactWeightedSetCover,
	greedyWeightedSetCover,
	type SetCoverCandidate,
} from "../src/optimizer.js";

function candidate(
	id: string,
	cost: number,
	covers: number[],
): SetCoverCandidate {
	return {
		id,
		cost,
		covers: new Set(covers.map(String)),
	};
}

function bruteForceCost(
	candidates: SetCoverCandidate[],
	requirements: ReadonlySet<string>,
): number {
	let best = Number.POSITIVE_INFINITY;
	const combinations = 1 << candidates.length;
	for (let mask = 1; mask < combinations; mask++) {
		let cost = 0;
		const covered = new Set<string>();
		for (let index = 0; index < candidates.length; index++) {
			if (!(mask & (1 << index))) continue;
			const item = candidates[index]!;
			cost += item.cost;
			if (cost >= best) break;
			for (const token of item.covers) covered.add(token);
		}
		if ([...requirements].every((token) => covered.has(token))) {
			best = Math.min(best, cost);
		}
	}
	return best;
}

function seededRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
		return state / 0x1_0000_0000;
	};
}

describe("set-cover optimizers", () => {
	it("finds an exact solution that improves on greedy", () => {
		const candidates = [
			candidate("a", 1, [1, 2, 3]),
			candidate("b", 2.5, [4, 5]),
			candidate("c", 1.5, [3, 5]),
			candidate("d", 3, [1, 2, 4, 5]),
			candidate("e", 1, [0, 3, 5]),
		];
		const requirements = new Set(["0", "1", "2", "3", "4", "5"]);

		const greedy = greedyWeightedSetCover(candidates, requirements);
		const exact = exactWeightedSetCover(candidates, requirements, {
			initial: greedy,
			maxNodes: 10_000,
		});

		expect(greedy.cost).toBe(4.5);
		expect(greedy.selected).toEqual(["a", "b", "e"]);
		expect(exact.optimal).toBe(true);
		expect(exact.cost).toBe(4);
		expect(exact.selected).toEqual(["d", "e"]);
		expect(exact.searchNodes).toBeGreaterThan(0);
	});

	it("is deterministic across candidate input order", () => {
		const candidates = [
			candidate("a", 1, [0, 1]),
			candidate("b", 1, [0, 2]),
			candidate("c", 1, [1, 2]),
		];
		const requirements = new Set(["0", "1", "2"]);

		const first = exactWeightedSetCover(candidates, requirements);
		const second = exactWeightedSetCover(
			[...candidates].reverse(),
			requirements,
		);

		expect(first).toMatchObject({
			optimal: true,
			cost: 2,
			selected: ["a", "b"],
		});
		expect(second.selected).toEqual(first.selected);
		expect(second.cost).toBe(first.cost);
	});

	it("reports an aborted search when the node budget is exhausted", () => {
		const candidates = [
			candidate("a", 1, [0, 1]),
			candidate("b", 1, [0, 2]),
			candidate("c", 1, [1, 2]),
		];
		const requirements = new Set(["0", "1", "2"]);
		const greedy = greedyWeightedSetCover(candidates, requirements);

		const exact = exactWeightedSetCover(candidates, requirements, {
			initial: greedy,
			maxNodes: 1,
		});

		expect(exact.aborted).toBe(true);
		expect(exact.optimal).toBe(false);
		expect(exact.selected).toEqual(greedy.selected);
		expect(exact.cost).toBe(greedy.cost);
	});

	it("matches brute-force optimal cost across deterministic random cases", () => {
		const random = seededRandom(0x5eedc0de);

		for (let sample = 0; sample < 500; sample++) {
			const requirementCount = 2 + Math.floor(random() * 4);
			const candidateCount = requirementCount + Math.floor(random() * 4);
			const requirements = new Set(
				Array.from({ length: requirementCount }, (_, index) => String(index)),
			);
			const candidates: SetCoverCandidate[] = [];

			for (let index = 0; index < candidateCount; index++) {
				const covers = new Set<string>();
				for (const requirement of requirements) {
					if (random() < 0.5) covers.add(requirement);
				}
				if (!covers.size) {
					covers.add(String(Math.floor(random() * requirementCount)));
				}
				candidates.push({
					id: `c${String(index).padStart(2, "0")}`,
					cost: 1 + Math.floor(random() * 7),
					covers,
				});
			}

			// Guarantee feasibility while still leaving the random instance intact.
			for (const requirement of requirements) {
				if (!candidates.some((item) => item.covers.has(requirement))) {
					candidates[Math.floor(random() * candidates.length)]!.covers.add(
						requirement,
					);
				}
			}

			const expected = bruteForceCost(candidates, requirements);
			const exact = exactWeightedSetCover(candidates, requirements, {
				maxNodes: 1_000_000,
			});
			const reversed = exactWeightedSetCover(
				[...candidates].reverse(),
				requirements,
				{ maxNodes: 1_000_000 },
			);

			expect(exact.aborted, `sample ${sample}`).toBe(false);
			expect(exact.optimal, `sample ${sample}`).toBe(true);
			expect(exact.cost, `sample ${sample}`).toBe(expected);
			expect(reversed.cost, `sample ${sample}`).toBe(expected);
			expect(reversed.selected, `sample ${sample}`).toEqual(exact.selected);
		}
	});

	it("fails when a requirement has no covering candidate", () => {
		expect(() =>
			greedyWeightedSetCover([candidate("a", 1, [0])], new Set(["0", "1"])),
		).toThrow(/uncovered requirement/);
	});
});
