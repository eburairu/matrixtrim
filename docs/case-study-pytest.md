# Case study: 30 pytest matrix jobs, one root failure

This document records a real-world validation of MatrixTrim's failure fingerprinting.

## Target

- Repository: `pytest-dev/pytest`
- Workflow: `test.yml`
- Run: https://github.com/pytest-dev/pytest/actions/runs/36195406393
- Raw failed jobs: **31**
- Matrix jobs: **30**
- Downstream aggregate job: **1 (`check`)**

## What happened

Thirty expanded matrix jobs failed across Windows, Ubuntu, macOS, and multiple Python environments. At first glance they looked like many independent failures.

After inspecting the job logs, the dominant root cause was the same:

```text
ImportError: cannot import name '_resolve_args_directness'
from partially initialized module '_pytest.fixtures'
(most likely due to a circular import)
```

## Why naive hashing fails

The logs differed in timestamps, absolute paths, tox environment names, dependency dumps, durations, and line numbers. A whole-log or broad error-line hash therefore split one root failure into many fingerprints.

MatrixTrim now normalizes volatile values and prioritizes exception/error headlines over surrounding environment noise.

```text
30 matrix jobs
      ↓
30 separate-looking failures
      ↓ normalize root cause
1 failure fingerprint
```

The downstream `check` job is excluded from matrix-cell scoring when an expanded matrix family can be identified.

## What this means

For this failure, those 30 cells did not provide 30 independent failure signals. That is useful evidence of historical redundancy.

It does **not** mean that 29 cells are automatically safe to remove. Other runs may contain OS- or runtime-specific failures.

That is why the recommendation layer looks across many runs and solves a coverage problem rather than reacting to a single failure.

## Recommendation model

History-only mode builds a mapping such as:

```text
cell A -> {F1, F2, F4}
cell B -> {F1}
cell C -> {F2, F3}
cell D -> {F3, F4}
```

It then uses median runtime as cost and greedily selects a set that covers every observed failure fingerprint while retaining at least one cell per matrix job family.

If history-only recommendation is run on this single failure run alone, it can reduce 30 cells to 1 while retaining 100% recall of the one observed fingerprint. Estimated compute for the 30 failed matrix jobs was 1159 seconds versus 20 seconds for the selected cell, a 98.3% reduction.

That result is intentionally treated as **sparse evidence, not safety proof**. MatrixTrim v0.4 adds time-based holdout backtesting: select cells using older failures, then measure whether those cells actually detect newer failures. Pairwise/t-wise constraints are still planned before recommendations should be treated as strong removal guidance.
