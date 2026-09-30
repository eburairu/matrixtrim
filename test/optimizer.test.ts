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

  it("fails when a requirement has no covering candidate", () => {
    expect(() =>
      greedyWeightedSetCover(
        [candidate("a", 1, [0])],
        new Set(["0", "1"]),
      )
    ).toThrow(/uncovered requirement/);
  });
});
