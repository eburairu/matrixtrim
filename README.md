# MatrixTrim

[![CI](https://github.com/eburairu/matrixtrim/actions/workflows/ci.yml/badge.svg)](https://github.com/eburairu/matrixtrim/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/eburairu/matrixtrim)](LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)
[![GitHub stars](https://img.shields.io/github/stars/eburairu/matrixtrim?style=flat)](https://github.com/eburairu/matrixtrim/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/eburairu/matrixtrim)](https://github.com/eburairu/matrixtrim/commits/main)

**English** | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md)

**Shrink GitHub Actions matrices without throwing away the failure signals that matter.**

MatrixTrim analyzes GitHub Actions matrix jobs and asks a practical question:

> Which matrix cells actually catch unique failures, and which ones keep rediscovering the same failures?

The goal is to recommend a smaller CI matrix using **historical failure coverage, runtime cost, matrix structure, and holdout backtesting**.

> **Status: v0.6 experimental.** MatrixTrim now combines empirical failure evidence with observed 1-wise / pairwise / t-wise configuration coverage, runtime cost, and time-based holdout backtesting.

## Why MatrixTrim?

A matrix like this already creates 18 jobs per run:

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    node: [20, 22, 24]
    postgres: [14, 16]
```

Teams often trim these matrices by intuition. MatrixTrim instead asks what each cell has **actually contributed**:

- Did this cell ever catch a failure no other cell caught?
- Does it mostly duplicate failures found elsewhere?
- How expensive is it?
- Does a smaller selection still catch newer failures in a holdout window?

## Install

Node.js 20+ is required.

```bash
npm install
npm run build
```

## Inspect a local workflow

```bash
node dist/cli.js inspect .github/workflows
```

## Analyze GitHub Actions history

Actions log analysis requires a GitHub token.

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js analyze owner/repo \
  --workflow ci.yml \
  --limit 100
```

MatrixTrim now fetches **job metadata from every completed run, including successful runs**. Failed matrix jobs get deeper log analysis.

Example output:

```text
Matrix cell history
  test (20): runs=5, success=5, failure=0, runtime=13.0s, node=20
  test (22): runs=5, success=5, failure=0, runtime=12.0s, node=22
  test (24): runs=5, success=5, failure=0, runtime=10.0s, node=24
```

That means a cell is no longer dropped from the analysis universe simply because it never failed.

For static matrices, MatrixTrim also tries to recover axis names such as:

```text
test (ubuntu-latest, 22)
↓
os=ubuntu-latest
node=22
```

Dynamic matrices and custom job names are left unresolved rather than guessed.

## Recommend a smaller matrix

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js recommend owner/repo \
  --workflow ci.yml \
  --limit 100
```

The recommendation layer is still **experimental**. Its primary job is to measure configuration value; automatic deletion is not implied.

By default (`--strength 2`), selection preserves:

1. every analyzed historical failure fingerprint,
2. every observed value of each resolved matrix axis (1-wise coverage),
3. every observed pair of axis values (pairwise coverage),
4. at least one cell per matrix job family, and
5. lower estimated compute where the constraints allow it.

Use `--strength 3` to preserve observed 3-wise combinations as well. MatrixTrim never invents combinations that were absent from the observed matrix. The optimizer currently uses greedy weighted set cover.

## Backtest against newer failures

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js backtest owner/repo \
  --workflow ci.yml \
  --limit 100 \
  --holdout 25
```

The older runs are used for selection, then the newer holdout runs are used to measure:

- overall holdout failure recall,
- recall for **new fingerprints not seen during training**,
- which failures the selected matrix missed.

Runtime costs are computed from the **training window only**, avoiding leakage from the holdout period.

## Real-world example: pytest

MatrixTrim was validated against a real failed `pytest-dev/pytest` Actions run:

- 31 failed jobs
- 30 matrix jobs
- 1 downstream aggregate job

Those 30 matrix jobs looked independent, but after root-cause normalization they collapsed to a single failure fingerprint:

```text
windows-py311 ─┐
ubuntu-py312  ─┤
macos-py314   ─┤
...            ├─ one failure fingerprint
30 cells ──────┘

ImportError: cannot import name '_resolve_args_directness'
from partially initialized module '_pytest.fixtures'
```

That is evidence of redundancy for **that observed failure**, not proof that 29 cells are safe to remove.

Full case study: [docs/case-study-pytest.md](docs/case-study-pytest.md)

## Failure fingerprinting

MatrixTrim removes volatile log data such as timestamps, paths, UUIDs, durations, and line numbers, then prioritizes root-cause headlines including exceptions, assertions, panics, compiler errors, and failing tests.

The core is deterministic. No LLM is required.

## Roadmap

- [x] Static GitHub Actions matrix inspection
- [x] CLI + JSON output
- [x] Completed-run job history, including successful runs
- [x] Failure signature normalization and clustering
- [x] Per-cell success/failure/runtime history
- [x] Static matrix axis recovery
- [x] Empirical failure-coverage recommendation
- [x] Observed 1-wise / pairwise / t-wise safety constraints
- [x] Time-based holdout backtesting
- [ ] Full `include` / `exclude` expansion
- [ ] Explicit keep / compatibility constraints
- [ ] GitHub Action + PR comments
- [ ] Benchmark across matrix-heavy OSS repositories
- [ ] Runner-aware monetary cost model
- [ ] Multi-event failure fingerprints
- [ ] Recommendation PR generation
- [ ] Stronger / exact optimizer

## Principles

- **Evidence over intuition**
- **Deterministic core**
- **Explain every removal**
- **Backtest before trust**
- **Read-only by default**

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
