# MatrixTrim

**Shrink GitHub Actions matrices without throwing away the failure signals that matter.**

MatrixTrim analyzes GitHub Actions matrix jobs and asks a practical question:

> Which matrix cells have actually detected unique failures, and which keep detecting the same failures as other cells?

The long-term goal is to recommend the smallest useful CI matrix using historical failures, combinatorial coverage, runtime cost, and holdout backtesting.

> **Status: v0.2.** Static matrix inspection, Actions history ingestion, failure fingerprinting, and per-cell unique-failure analysis work today.

## Why

A small-looking matrix grows quickly:

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    node: [20, 22, 24]
    postgres: [14, 16]
```

That is 18 base cells per run. Teams often trim these by intuition. MatrixTrim builds evidence from what the cells have actually caught.

## Install for development

```bash
npm install
npm run build
```

Node.js 20+ is required.

## Inspect a local workflow

```bash
node dist/cli.js inspect .github/workflows
```

Example:

```text
.github/workflows/ci.yml
  test: 9 base cells
    axes: os=3, node=3
    include=0, exclude=0
```

## Analyze GitHub Actions history

Job-log analysis needs a GitHub token with permission to read Actions logs.

```bash
export GH_TOKEN=...
node dist/cli.js analyze owner/repo --workflow ci.yml --limit 100
```

If you already use the GitHub CLI:

```bash
GH_TOKEN="$(gh auth token)" node dist/cli.js analyze owner/repo --workflow ci.yml --limit 100
```

Analyze one known run:

```bash
node dist/cli.js analyze owner/repo --run 123456789
```

Add `--json` to either command for machine-readable output.

## What v0.2 does

For failed matrix jobs, MatrixTrim:

1. Reads completed GitHub Actions runs and expanded jobs.
2. Downloads failed job logs.
3. Removes timestamps, paths, durations, IDs, and other volatile data.
4. Prioritizes root-cause lines such as exceptions, assertions, panics, and compiler errors.
5. Clusters equivalent failures into deterministic fingerprints.
6. Counts distinct and **unique** failure fingerprints per matrix cell.
7. Ignores downstream non-matrix failures when a matrix job family is detectable.

Example shape:

```text
Shared failure clusters
  8ffd16a81b4c2965: cells=30, observations=30
    ImportError: cannot import name '_resolve_args_directness' ... (<path>)

Failure detection by job variant
  build (windows-py311): distinct=1, unique=0, observations=1
  build (ubuntu-py312):  distinct=1, unique=0, observations=1
```

A cluster shared by 30 cells is evidence of redundancy for that historical failure. It is **not** proof that 29 cells are safe to remove.

## Real-world validation

During development, MatrixTrim was tested against a failed `pytest-dev/pytest` Actions run with 31 failed jobs. Thirty matrix variants failed from the same circular-import `ImportError`; the current fingerprinting logic groups those 30 variants into one failure cluster while excluding the downstream aggregate `check` job from matrix-cell scoring.

## Target model

The recommendation engine will combine:

1. **Matrix structure** — OS, runtime, database, and feature axes
2. **Run history** — GitHub Actions jobs and outcomes
3. **Failure fingerprints** — normalized root causes
4. **Coverage constraints** — pairwise / t-wise and required axis values
5. **Cost** — runtime and queue time
6. **Backtesting** — train on older runs, validate on newer failures

The optimization can then be expressed as a constrained weighted set-cover problem: minimize matrix cost while retaining historical failure detection and required combinatorial coverage.

## Roadmap

- [x] Parse static GitHub Actions matrices
- [x] CLI + JSON output
- [x] GitHub Actions run-history ingestion
- [x] Failure signature normalization and clustering
- [x] Unique failure detection per expanded matrix job
- [ ] Correct local `include` / `exclude` expansion
- [ ] Recover named matrix axes from historical jobs
- [ ] Pairwise / t-wise coverage model
- [ ] Runtime-cost ingestion
- [ ] Weighted set-cover optimizer
- [ ] Holdout backtesting
- [ ] `matrixtrim/action` PR comment integration
- [ ] Recommendation PR generation

## Principles

- **Deterministic core.** No LLM is required for optimization.
- **Explain every removal.** A cell should never disappear without evidence.
- **Backtest recommendations.** Historical fit alone is not enough.
- **Read-only by default.** Mutation should require an explicit command.
- **Vendor-light.** Start with GitHub Actions, keep the optimization model reusable.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
