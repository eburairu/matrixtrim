# MatrixTrim

**English** | [日本語](README.ja.md)

**Shrink GitHub Actions matrices without throwing away the failure signals that matter.**

MatrixTrim analyzes GitHub Actions matrix jobs and asks a practical question:

> Which matrix cells have actually detected unique failures, and which keep detecting the same failures as other cells?

The long-term goal is to recommend the smallest useful CI matrix using historical failures, combinatorial coverage, runtime cost, and holdout backtesting.

> **Status: v0.3 experimental.** Static matrix inspection, Actions history ingestion, failure fingerprinting, unique-failure analysis, runtime aggregation, and history-only recommendations work today.

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

Node.js 20+ is required.

```bash
npm install
npm run build
```

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
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js analyze owner/repo \
  --workflow ci.yml \
  --limit 100
```

Analyze one known run:

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js analyze owner/repo --run 123456789
```

Add `--json` for machine-readable output.

## Recommend a smaller matrix

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js recommend owner/repo \
  --workflow ci.yml \
  --limit 100
```

`recommend` currently runs in **history-only experimental mode**. It:

1. keeps coverage of every analyzed historical failure fingerprint,
2. retains at least one cell per detected matrix job family, and
3. uses median observed runtime as cost in a greedy weighted set-cover selection.

Example shape:

```text
Mode:       history-only (experimental)
Historical failure recall: 18/18 (100.0%)
Matrix cells: 24 -> 9
Estimated compute: 1520.0s -> 611.0s
Estimated reduction: 59.8%
```

This means the selected cells preserve all **observed** failure fingerprints. It does **not** mean unseen future failures are guaranteed to be detected. Pairwise/t-wise constraints and holdout backtesting are planned.

## What failure analysis does

For failed matrix jobs, MatrixTrim:

1. reads completed GitHub Actions runs and expanded jobs,
2. downloads failed job logs,
3. removes timestamps, paths, durations, IDs, and other volatile data,
4. prioritizes root-cause lines such as exceptions, assertions, panics, and compiler errors,
5. clusters equivalent failures into deterministic fingerprints,
6. counts distinct and **unique** failure fingerprints per matrix cell, and
7. ignores downstream non-matrix failures when a matrix job family is detectable.

## Real-world validation: pytest

MatrixTrim was tested against a real `pytest-dev/pytest` failed Actions run:

- Run: https://github.com/pytest-dev/pytest/actions/runs/36195406393
- 31 raw failed jobs
- 30 matrix variants
- 1 downstream aggregate `check` job

Those 30 matrix jobs looked independent, but root-cause normalization showed that all 30 were failing from the same circular-import `ImportError`:

```text
windows-py311 ─┐
ubuntu-py312  ─┤
macos-py314   ─┤
...            ├─ one failure fingerprint
30 cells ──────┘

ImportError: cannot import name '_resolve_args_directness'
from partially initialized module '_pytest.fixtures'
```

This is evidence of historical redundancy for that failure—not evidence that 29 cells are universally safe to remove.

Read the full case study: [docs/case-study-pytest.md](docs/case-study-pytest.md)

## Recommendation model

The current optimizer treats matrix selection as a coverage problem:

```text
cell A -> {F1, F2, F4}
cell B -> {F1}
cell C -> {F2, F3}
cell D -> {F3, F4}
```

It uses median runtime as cost and applies greedy weighted set cover while retaining one cell for each detected matrix job family.

Future versions will add pairwise/t-wise constraints, stronger optimization, and holdout backtesting.

## Roadmap

- [x] Parse static GitHub Actions matrices
- [x] CLI + JSON output
- [x] GitHub Actions run-history ingestion
- [x] Failure signature normalization and clustering
- [x] Unique failure detection per expanded matrix job
- [x] Runtime aggregation
- [x] History-only weighted set-cover recommendation
- [ ] Correct local `include` / `exclude` expansion
- [ ] Recover named matrix axes from historical jobs
- [ ] Pairwise / t-wise coverage model
- [ ] Exact / improved optimizer
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
