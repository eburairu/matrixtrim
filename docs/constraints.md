# Explicit hard constraints

MatrixTrim can preserve human-defined compatibility requirements in addition to historical failure evidence and observed combinatorial coverage.

By default, MatrixTrim looks for `.matrixtrim.yml` in the repository's default branch. The same constraints are applied to:

- `recommend`
- `backtest`
- the GitHub Action
- draft optimization PR generation

Reading the policy from the default branch is intentional: a pull request cannot weaken the repository's MatrixTrim safety policy by editing its own copy of the config.

## Example

```yaml
version: 1

constraints:
  keep:
    - "test (windows-latest, 20)"

  require:
    - axes:
        os: windows-latest

    - baseJob: test
      axes:
        node: "20"
        postgres: "14"
```

## `keep`

`keep` contains exact rendered matrix-cell names as reported by MatrixTrim.

```yaml
constraints:
  keep:
    - "test (windows-latest, 20)"
```

A kept cell is a hard requirement. It cannot be removed by cost optimization, failure deduplication, combinatorial pruning, or greedy post-processing.

Use `keep` when a specific environment must always remain in CI for policy, support, contractual, or operational reasons.

If a named cell is not present in the analyzed matrix, MatrixTrim fails closed instead of silently ignoring the rule.

## `require`

`require` keeps **at least one observed cell** matching an axis selector.

```yaml
constraints:
  require:
    - axes:
        os: windows-latest
```

This says: keep at least one observed Windows configuration.

Selectors may also target a specific matrix job family:

```yaml
constraints:
  require:
    - baseJob: test
      axes:
        node: "20"
        postgres: "14"
```

This says: within the `test` matrix, keep at least one observed cell with Node 20 and PostgreSQL 14.

All axis comparisons are exact after YAML scalar values are normalized to strings.

If a `require` selector matches no observed matrix cells, MatrixTrim fails closed.

## Interaction with combinatorial coverage

Explicit constraints are independent of `strength`.

For example, pairwise coverage may already retain a particular two-axis combination. Adding it to `require` can still be useful because it turns that combination into an explicit repository policy that remains enforced even if the global coverage strength changes later.

A three-axis requirement can also express a compatibility sentinel that would not necessarily be preserved by pairwise coverage.

## Optimization semantics

MatrixTrim adds hard-constraint requirements to the same weighted set-cover universe used for historical failures and observed combinatorial coverage:

```text
historical failure coverage
+ observed combinatorial coverage
+ per-job-family anchors
+ unresolved-cell safety
+ explicit keep / require constraints
↓
weighted set cover
↓
redundancy pruning
```

A `keep` rule creates a requirement that only that exact cell can satisfy.

A `require` rule creates a requirement that any matching observed cell can satisfy, allowing MatrixTrim to choose the lower-cost compatible cell when several candidates exist.

## CLI

The default config is loaded automatically:

```bash
GH_TOKEN="$(gh auth token)" \
  matrixtrim recommend owner/repo --workflow ci.yml --limit 100
```

Use another repository-relative config path with:

```bash
matrixtrim recommend owner/repo --config .github/matrixtrim.yml
matrixtrim backtest owner/repo --config .github/matrixtrim.yml
```

If an explicitly requested config path does not exist, the CLI returns an error. A missing default `.matrixtrim.yml` is treated as no explicit constraints.

## GitHub Action

```yaml
- uses: eburairu/matrixtrim@main
  with:
    workflow: ci.yml
    config: .matrixtrim.yml
    strength: "2"
```

The Action report exposes:

- `constraint-requirements`
- `constraint-coverage`

A missing default `.matrixtrim.yml` means no explicit constraints. If the Action is configured with a different `config:` path and that file does not exist, MatrixTrim fails closed.

Draft optimization PR generation is allowed only when every explicit hard constraint is satisfied.

## Current scope

Version 1 intentionally keeps the policy model small:

- exact-cell `keep`
- at-least-one matching-cell `require`
- optional `baseJob`
- exact axis matching

MatrixTrim does not currently implement cardinality rules such as "keep at least two Windows cells." It also does not need a `forbid` rule for optimization: MatrixTrim only selects from matrix cells that already exist in the observed workflow; it does not invent new configuration combinations.
