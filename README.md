# MatrixTrim

**Shrink GitHub Actions matrices without throwing away the failure signals that matter.**

MatrixTrim is an open-source CLI for analyzing GitHub Actions matrix jobs. The long-term goal is to use historical workflow runs, normalized failure signatures, combinatorial coverage, and holdout backtesting to recommend the smallest useful CI matrix.

> **Status:** v0.1 bootstrap. Static matrix inspection works today. History-aware optimization is the next milestone.

## Why

A matrix like this is useful, but grows quickly:

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    node: [20, 22, 24]
    postgres: [14, 16]
```

That is 18 base cells per run. Teams often trim these by intuition. MatrixTrim aims to answer a harder question:

> Which cells have actually contributed unique failure detection, and which are redundant?

## Current CLI

```bash
npm install
npm run build
node dist/cli.js .github/workflows
```

JSON output is available with `--json`.

## Target model

MatrixTrim will combine:

1. **Matrix structure** — OS, runtime, database, feature axes
2. **Run history** — GitHub Actions jobs and outcomes
3. **Failure fingerprints** — normalized failing tests, stack traces, exit codes
4. **Coverage constraints** — pairwise / t-wise and required axis values
5. **Cost** — runtime and queue time
6. **Backtesting** — train on older runs, validate recommendations on newer failures

The optimization can then be expressed as a constrained weighted set-cover problem: minimize matrix cost while retaining historical failure-detection and required combinatorial coverage.

## Planned commands

```bash
matrixtrim inspect .github/workflows
matrixtrim analyze owner/repo
matrixtrim backtest owner/repo
matrixtrim recommend owner/repo
```

A future report should look roughly like:

```text
Current matrix:      18 cells
Recommended matrix:   8 cells

Historical failures retained: 73 / 73
Holdout failures detected:    19 / 20
Pairwise coverage:            100%
Median compute:               126m -> 61m
```

MatrixTrim will report evidence, not claim that an unseen future failure is impossible.

## Roadmap

- [x] Parse static GitHub Actions matrices
- [x] CLI + JSON output
- [ ] Correct `include` / `exclude` expansion
- [ ] GitHub Actions run-history ingestion
- [ ] Failure signature normalization and clustering
- [ ] Pairwise / t-wise coverage model
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
