# MatrixTrim benchmark

This directory contains a reproducible public-OSS benchmark for MatrixTrim.

## Protocol

- 12 public repositories across Python, Rust, and Node.js ecosystems.
- 20 **conclusive completed** workflow runs per repository.
- Accepted run conclusions: `success`, `failure`, `timed_out`, and `neutral`.
- Matrix safety strength: `2` (1-wise + pairwise).
- Time holdout: 25%.
- Run IDs are pinned in `snapshot.json`; the benchmark does not silently move to newer runs unless the snapshot is refreshed.

## Reproduce

Use the pinned run set:

```bash
GH_TOKEN="$(gh auth token)" npm run benchmark -- \
  --limit 20 \
  --strength 2 \
  --holdout 25
```

Capture a new run set intentionally:

```bash
GH_TOKEN="$(gh auth token)" npm run benchmark -- \
  --limit 20 \
  --strength 2 \
  --holdout 25 \
  --refresh-snapshot
```

## Add your repository to the benchmark

MatrixTrim welcomes public repositories with real matrix-heavy GitHub Actions workflows. The contribution path is intentionally split into a **scratch run** and an **official snapshot update** so contributors do not have to rewrite the existing benchmark just to test one repository.

A useful candidate normally has:

- a public GitHub repository,
- a GitHub Actions workflow with an actual `strategy.matrix`,
- at least several observed matrix cells,
- enough completed history to make the result meaningful (20 conclusive runs is preferred),
- and a workflow that is still representative of how the project currently tests code.

A zero reduction is a valid contribution. Repositories where MatrixTrim stays conservative are as useful as repositories where it finds redundancy.

### 1. Run one repository in isolation

Create a temporary target file outside the tracked benchmark:

```bash
cat >/tmp/matrixtrim-targets.json <<'JSON'
[
  {
    "repository": "OWNER/REPOSITORY",
    "workflow": "ci.yml"
  }
]
JSON
```

Then capture and analyze a fresh 20-run snapshot without touching the official benchmark files:

```bash
GH_TOKEN="$(gh auth token)" npm run benchmark -- \
  --targets /tmp/matrixtrim-targets.json \
  --snapshot /tmp/matrixtrim-snapshot.json \
  --output /tmp/matrixtrim-results.json \
  --markdown /tmp/matrixtrim-results.md \
  --limit 20 \
  --strength 2 \
  --holdout 25 \
  --refresh-snapshot
```

Review `/tmp/matrixtrim-results.md`. Before proposing the target, check:

- the status is `resolved` or the reason for `partial` is interesting and reproducible,
- the observed matrix-cell count matches what you expect from GitHub,
- workflow-name matching and axis recovery are plausible,
- and any suggested reduction makes sense as **diagnostic evidence**, not as an automatic deletion claim.

### 2. Propose the target

Fork MatrixTrim, add only the repository/workflow entry to `benchmark/targets.json`, and open a pull request. In the PR body, paste the relevant row or short excerpt from your scratch result and explain why the workflow is useful benchmark coverage.

Do **not** replace `benchmark/snapshot.json` or the aggregate result files in a first-time target PR. The maintainer refreshes the canonical snapshot so every target is captured with one consistent protocol and token context.

If you are unsure whether a repository is a good fit, use the **Benchmark target** issue form first.

### 3. Maintainer validation

For accepted targets, the maintainer refreshes the canonical snapshot and checks the aggregate diff before merging:

```bash
GH_TOKEN="$(gh auth token)" npm run benchmark -- \
  --limit 20 \
  --strength 2 \
  --holdout 25 \
  --refresh-snapshot
```

The benchmark is evidence, not a leaderboard. Targets are not selected for high reduction percentages, and a repository is never removed merely because MatrixTrim recommends no change.

## Result classes

- **resolved** — observed axes are fully resolved; static workflow names are renderable; active matrix families match the actual GitHub job names.
- **partial** — at least one of those checks is incomplete. Apparent reductions are diagnostic only and are not counted as validated.
- **unresolved** — no usable matrix cells were recovered.
- **error** — the benchmark could not analyze the target.

A zero reduction is a valid result. It means the current evidence and safety constraints did not justify removing matrix cells.

## Pricing interpretation

- Runner pricing uses the standard GitHub-hosted rate card verified on 2026-09-30.
- Each job is rounded up to a whole minute before pricing.
- Every benchmark target is a public repository, so standard GitHub-hosted runners have an estimated GitHub charge of $0. Rate-card values are comparison-only.
- Larger/unknown runners are left unpriced rather than assigned a guessed rate.
- A 30-day run-frequency projection is emitted only when the pinned history spans at least 7 days.

## Files

- `targets.json` — benchmark repositories and workflows.
- `snapshot.json` — pinned workflow run IDs and source revisions.
- `results.json` — machine-readable output.
- `results.md` — human-readable summary.

The benchmark measures a fixed historical snapshot. It does **not** prove that a recommended matrix will detect every future failure.
