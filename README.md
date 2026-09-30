# MatrixTrim

[![CI](https://github.com/eburairu/matrixtrim/actions/workflows/ci.yml/badge.svg)](https://github.com/eburairu/matrixtrim/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/eburairu/matrixtrim)](LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)
[![GitHub stars](https://img.shields.io/github/stars/eburairu/matrixtrim?style=flat)](https://github.com/eburairu/matrixtrim/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/eburairu/matrixtrim)](https://github.com/eburairu/matrixtrim/commits/main)

**English** | [简体中文](docs/i18n/README.zh-CN.md) | [繁體中文](docs/i18n/README.zh-TW.md) | [日本語](docs/i18n/README.ja.md) | [한국어](docs/i18n/README.ko.md) | [Español](docs/i18n/README.es.md)

**Shrink GitHub Actions matrices without throwing away the failure signals that matter.**

MatrixTrim analyzes GitHub Actions matrix jobs and asks a practical question:

> Which matrix cells actually catch unique failures, and which ones keep rediscovering the same failures?

The goal is to recommend a smaller CI matrix using **historical failure coverage, runtime cost, matrix structure, and holdout backtesting**.

> **Status: v0.19 experimental.** MatrixTrim combines multi-event root-cause fingerprints, empirical failure evidence, observed 1-wise / pairwise / t-wise configuration coverage, explicit human keep / compatibility constraints, exact branch-and-bound optimization, runtime and runner-aware monetary cost, time-based holdout backtesting, static and observed dynamic matrix-name recovery, broader deterministic GitHub expression evaluation, opt-in runtime matrix evidence capture, versioned GitHub Action releases, reproducible public-OSS benchmarking, and opt-in draft optimization PR generation.

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

For static matrices, MatrixTrim can reconstruct common rendered job names using direct or bracketed `matrix.*` references, boolean/comparison operators, `format(...)`, `contains(...)`, `startsWith(...)`, `endsWith(...)`, `join(...)`, `toJSON(...)`, `fromJSON(...)`, `case(...)`, object filters, fallback expressions, and include-only matrices. For dynamic matrices, MatrixTrim keeps observed jobs in the analysis when they can be identified safely and only inverts deterministic name mappings. When runtime outputs are otherwise opaque, an explicit `mode: capture` step can preserve the exact `toJSON(matrix)` value in a versioned Check Run annotation for later analysis. Dynamic matrices remain ineligible for automatic workflow rewriting. See [docs/dynamic-matrices.md](docs/dynamic-matrices.md), [docs/expression-support.md](docs/expression-support.md), and [docs/runtime-evidence.md](docs/runtime-evidence.md).

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

Use `--strength 3` to preserve observed 3-wise combinations as well. MatrixTrim never invents combinations that were absent from the observed matrix.

## Exact optimizer

The default `--optimizer auto` starts from the deterministic greedy solution, then runs an in-process branch-and-bound search to prove the minimum runtime-weighted set for the modeled coverage requirements. If the default **250,000-node** budget is exceeded, `auto` explicitly falls back to greedy. `--optimizer exact` fails instead of returning an unproven solution, while `--optimizer greedy` skips exact search.

“Exact” means optimal for the **current weighted set-cover model**; it does not prove that removed environments can never catch a future failure. See [Exact optimizer](docs/optimizer.md).

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

## Multi-event failure fingerprints

A failed matrix job can contain more than one independent failure signal. MatrixTrim now fingerprints strong root causes separately, so a job containing `Error X` and `Error Y` contributes two events instead of one compound `X+Y` fingerprint. Typed errors/exceptions, panic/fatal lines and segmentation faults are preferred; test-runner summary lines are used only when no strong root cause is present, avoiding obvious double-counting.

Repeated copies of the same normalized root cause are deduplicated, and extraction stays bounded to at most 8 distinct events per job. If no root-cause headline is recognized, MatrixTrim falls back to the legacy single-fingerprint heuristic. See [Multi-event failure fingerprints](docs/fingerprints.md).

## Use as a GitHub Action

No clone or local build is required.

```yaml
permissions:
  actions: read
  contents: read
  pull-requests: write

steps:
  - uses: eburairu/matrixtrim@v0
    with:
      workflow: ci.yml
      limit: "100"
      strength: "2"
      optimizer: auto
      holdout: "25"
```

The Action always writes a **Step Summary**. On pull requests it also creates or updates a single MatrixTrim comment when permissions allow it. If a fork PR has a read-only token, comment creation is skipped with a warning while the analysis still succeeds.

Use the floating `@v0` tag for normal adoption. Exact `vX.Y.Z` tags or commit SHAs are available when stricter reproducibility is required. Releases are promoted explicitly from `main`; see [Release process](docs/releases.md).

MatrixTrim's own workflows pin external GitHub Actions to immutable commit SHAs rather than moving tags. Dependabot tracks both npm and GitHub Actions updates, CI rejects new unpinned external Actions, and the release/CI path is guarded by coverage, lint, dependency review, package-content checks, CodeQL, and repository security settings. See [Quality and reliability](docs/quality.md).

The report includes current vs suggested cells, historical failure recall, failure-event / multi-event job counts, combinatorial coverage, estimated compute reduction, runner-aware rate-card / charge estimates, holdout recall, unseen-failure recall, and the recommended cell set.

### Draft optimization PR (opt-in)

PR generation is **disabled by default**. To let MatrixTrim propose the workflow change itself:

```yaml
permissions:
  actions: read
  contents: write
  pull-requests: write

steps:
  - uses: eburairu/matrixtrim@v0
    with:
      workflow: ci.yml
      limit: "100"
      strength: "2"
      optimizer: auto
      holdout: "25"
      create-pr: "true"
```

MatrixTrim only creates a **draft PR**. It never auto-merges. The rewrite converts the selected static cells to explicit `matrix.include` rows and round-trip verifies the resulting workflow before writing it. PR creation is refused when dynamic matrices, unresolved axes, incomplete workflow/job-name mapping, sub-100% preserved coverage, or failing available holdout checks are present. Pull-request-triggered runs are also blocked from creating optimization PRs.

## Explicit hard constraints

For compatibility or support policies that must survive optimization, add a `.matrixtrim.yml` file:

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

`keep` pins an exact rendered matrix cell. `require` keeps at least one observed cell matching the selector. The same policy is applied to recommendation, backtesting, the GitHub Action, and draft optimization PR generation. A rule that matches nothing fails closed instead of being silently ignored.

The repository config is read from the **default branch**, so an untrusted pull request cannot weaken the MatrixTrim safety policy by editing its own config. See [Explicit hard constraints](docs/constraints.md) for the full semantics.

## Runner-aware cost model

MatrixTrim now estimates monetary impact from the runner labels and observed job durations instead of treating every CI minute as equal.

- Current standard GitHub-hosted rates used by the model: Linux 1-core x64 **$0.002/min**, Linux 2-core x64 **$0.006/min**, Linux 2-core arm64 **$0.005/min**, Windows x64/arm64 **$0.010/min**, and standard macOS **$0.062/min**.
- Each job is rounded up to a whole minute before pricing, matching GitHub Actions billing behavior.
- For **public repositories**, standard GitHub-hosted runners are free. MatrixTrim therefore reports an estimated GitHub charge of **$0** and shows the rate-card amount only as a comparison value.
- For **private/internal repositories**, the estimated charge is the standard-runner overage equivalent **before account/plan included minutes are subtracted**.
- Self-hosted runners are treated as $0 GitHub Actions charge; larger or unknown runner SKUs are left unpriced rather than guessed.
- A 30-day projection is shown only when the observed run window spans at least **7 days**, avoiding aggressive extrapolation from a few hours of CI history.

Pricing reference: [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) and [Actions runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing).

## Public OSS benchmark

To avoid validating MatrixTrim only on hand-picked examples, we pinned **20 conclusive completed workflow runs each from 12 public OSS repositories** and evaluated them with `--strength 2` and a 25% time holdout.

- **10/12 repositories were fully resolved** with 100% observed axis recovery, workflow-name rendering, and active-family job-name matching; 2 were partial and are not treated as validated reduction results.
- Validated non-zero reductions: **pandas 34 → 32 cells (-7.2%)**, **Flask 12 → 10 (-13.6%)**, **Diesel 28 → 25 (-8.3%)**.
- Monetary reduction is not identical to compute reduction because runner prices and per-job minute rounding matter: pandas **$25.148 → $24.671/run (-1.9%)**, Flask **$0.132 → $0.120/run (-9.1%)**, Diesel **$11.624 → $11.438/run (-1.6%)** on the standard-runner rate card. All three are public repositories, so estimated standard-runner GitHub charge remains **$0**.
- The exact optimizer proved optimality for **12/12 benchmark repositories**, used **0 greedy fallbacks**, and explored at most **102 search nodes**. It matched greedy on 11 repositories; on Diesel it improved the greedy runtime objective by **1.15%**, raising compute reduction from about **7.6% to 8.3%**. pandas and Vite kept **100% holdout recall and 100% unseen-failure recall** in the available backtest windows. Diesel kept **100% holdout recall**; its holdout contained no unseen fingerprint, so unseen-failure recall is **n/a**.
- Event-level extraction is exercised by real logs in the fixed snapshot: **pandas 59 failed jobs → 151 events → 5 distinct root-cause fingerprints**, **Vite 8 → 25 → 23**, while Rust volatility/derivative-summary normalization collapses **Diesel 40 → 40 → 1**.
- **7 of the 10 fully resolved repositories were intentionally left unchanged** because the safety constraints did not justify a reduction.
- aiohttp and Tokio remain partial. With unresolved cells retained as safety constraints, the current recommendation keeps **aiohttp 29 → 29** and **Tokio 53 → 53** in this snapshot; neither is counted as a validated reduction.

The exact run IDs are pinned in [benchmark/snapshot.json](benchmark/snapshot.json), and the complete results are in [benchmark/results.md](benchmark/results.md). These measurements describe that fixed snapshot; they are not universal promises about future CI behavior.

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
- [x] Static `include` / `exclude` expansion and rendered job-name recovery
- [x] Observed dynamic matrix analysis + safe axis recovery from known axis order / job-name templates
- [x] Broader deterministic GitHub expression functions + bracket/object-filter support
- [x] Opt-in deterministic runtime matrix evidence capture via Check Run annotations
- [x] Versioned GitHub Action releases + floating major tag
- [x] SHA-pinned workflow dependencies + Dependabot enforcement
- [x] Retry/timeout-aware GitHub API client + complete job pagination
- [x] Coverage/lint/type/package quality gates + aggregate protected CI check
- [x] CodeQL, dependency review, private vulnerability reporting, immutable releases
- [x] Brute-force oracle validation for the exact optimizer
- [x] Explicit keep / compatibility constraints
- [x] GitHub Action + PR comments
- [x] Reproducible benchmark across matrix-heavy OSS repositories
- [x] Runner-aware monetary cost model
- [x] Multi-event failure fingerprints
- [x] Opt-in draft recommendation PR generation
- [x] Stronger / exact optimizer

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
