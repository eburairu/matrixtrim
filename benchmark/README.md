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
