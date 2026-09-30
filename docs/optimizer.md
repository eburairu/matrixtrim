# Exact optimizer

MatrixTrim v0.13 can prove the minimum-cost matrix selection for the coverage model it has built from the observed CI history.

The important scope is:

> **Exact means optimal for MatrixTrim's current weighted set-cover model. It does not mean future failures are proven impossible on removed configurations.**

The safety model still comes from:

- historical failure-event coverage,
- observed 1-wise / pairwise / t-wise configuration coverage,
- one anchor per matrix job family,
- unresolved-cell retention,
- explicit `keep` / compatibility constraints.

The optimizer chooses the minimum-cost set of observed cells that satisfies every one of those requirements.

## Objective

Each observed matrix cell has a weight:

```text
cell cost = median observed runtime
```

When a cell has no usable runtime, MatrixTrim uses the median runtime of the other observed cells as the optimization fallback. The fallback is used only for selection; user-facing compute estimates remain `n/a` when complete runtime evidence is unavailable.

The exact objective is:

```text
minimize Σ selected cell cost

subject to:
  every historical failure fingerprint is covered
  every requested observed combinatorial token is covered
  every matrix job family has an anchor
  every unresolved cell safety token is covered
  every explicit hard constraint is covered
```

This is a weighted set-cover problem.

## Branch-and-bound

MatrixTrim uses a deterministic in-process branch-and-bound solver rather than shipping an external ILP/MIP runtime.

The search starts with the deterministic greedy solution as an upper bound, then:

1. picks an uncovered requirement with the fewest candidate cells;
2. branches on cells that can cover that requirement;
3. explores higher coverage-per-cost candidates first;
4. uses an optimistic coverage/cost lower bound to prune branches that cannot beat the best known solution;
5. stops only when optimality is proven or the configured node budget is exhausted.

Ties are resolved deterministically by cost, selected-cell count, and cell name.

## Modes

### `auto` — default

```bash
matrixtrim recommend owner/repo --optimizer auto
```

MatrixTrim tries exact branch-and-bound first.

If optimality is proven:

```text
algorithm = exact-branch-and-bound
optimizerOptimal = true
```

If the search exceeds the node budget, MatrixTrim returns the deterministic greedy recommendation instead and emits an explicit fallback warning.

This keeps normal Action runs bounded.

### `exact`

```bash
matrixtrim recommend owner/repo \
  --optimizer exact \
  --exact-max-nodes 250000
```

Exact mode never silently returns an unproven result. If the node budget is exhausted before proof, the command fails.

Use this when an optimization result must carry an optimality proof for the current model.

### `greedy`

```bash
matrixtrim recommend owner/repo --optimizer greedy
```

This skips exact search and uses the previous deterministic greedy + redundancy-pruning behavior.

It is useful for debugging, comparisons, or unusually large search spaces.

## GitHub Action

```yaml
- uses: eburairu/matrixtrim@main
  with:
    workflow: ci.yml
    optimizer: auto
    exact-max-nodes: "250000"
```

Outputs include:

- `optimizer-algorithm`
- `optimizer-optimal`
- `optimizer-search-nodes`
- `optimizer-improvement-percent`
- `optimizer-fallback-reason`

The Step Summary shows the same information.

In `auto` mode, draft optimization PR generation is skipped if exact optimality was not proven. An explicitly requested `greedy` mode may still produce a draft PR because the user deliberately chose that optimizer.

## Backtesting

The same optimizer mode and node budget are applied to the training-window recommendation used by time-based holdout backtesting.

That prevents a mismatch such as:

```text
production recommendation = exact
holdout recommendation    = greedy
```

Backtest reports include the optimizer algorithm, optimality status, and search-node count.

## Fixed OSS benchmark

On the pinned 12-repository public OSS benchmark used for v0.13:

- **12/12** optimization problems were solved to proven optimality;
- **0** used the greedy fallback;
- the largest search explored **102 nodes**;
- exact matched greedy on 11 repositories;
- on **diesel-rs/diesel**, exact improved the greedy objective by about **1.15%**, increasing estimated compute reduction from about **7.6% to 8.3%** while preserving the same historical/combinatorial safety requirements.

Those numbers describe the pinned benchmark snapshot only. They do not imply every repository will solve within the default node budget.

## What the proof does not mean

An exact optimizer cannot repair missing evidence.

If the history never contains a future Windows-only failure, exact optimization cannot infer it from nothing. That is why MatrixTrim combines optimization with combinatorial safety, explicit compatibility constraints, holdout backtesting, and conservative handling of unresolved cells.

The proof is:

> Given this observed universe, these safety constraints, and these costs, no cheaper observed cell set satisfies all modeled requirements.

It is **not**:

> This is the smallest matrix that will catch every future bug.
