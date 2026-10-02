# Multi-event failure fingerprints

MatrixTrim can extract multiple independent failure signals from one failed GitHub Actions matrix job.

Earlier versions treated the whole job log as one fingerprint:

```text
job
├─ Error X
└─ Error Y
      ↓
hash(Error X + Error Y)
```

That makes a job containing `Error X + Error Y` look unrelated to another job containing only `Error X`.

v0.12 analyzes the same log as independent events:

```text
job
├─ Error X → fingerprint X
└─ Error Y → fingerprint Y
```

The optimizer therefore reasons about the individual failure signals a matrix cell has demonstrated, rather than only the exact bundle of errors that happened to appear together in one job.

## Extraction policy

MatrixTrim normalizes timestamps, paths, volatile IDs, line/column numbers, runtimes, and other common log noise before fingerprinting.

Extraction is implemented as a deterministic registry with explicit precedence:

1. Python / pytest
2. Rust / Cargo
3. Node package managers and test-runner summaries
4. generic fallback

An ecosystem extractor is used only when its narrow matcher recognizes the log and it can produce a concrete root cause. Otherwise analysis continues to the next extractor, ending with the existing generic heuristic. Every extractor shares the same per-job bound of eight distinct events.

The Node adapter recognizes concise npm, pnpm, Yarn, and summary-only Node test-runner failures while filtering wrapper metadata such as npm's cwd, runtime version, exit-code, and complete-log-location lines. This keeps package-manager transport noise out of the fingerprint without hiding typed JavaScript errors, which still take precedence as strong root causes.

It then looks for root-cause headlines in two tiers.

### Strong root causes

Strong root causes are preferred when present:

- typed `*Error`, `*Exception`, and `*Failure` lines
- `error:`
- `fatal:`
- `panic:`
- Rust `panicked at`
- segmentation faults
- a meaningful root cause embedded after a test-runner summary separator, for example `FAILED test_x - ValueError: no types given`

For embedded summaries, MatrixTrim fingerprints the trailing root cause rather than the test name. This lets several failing test cases with the same underlying `ValueError` collapse to one event.

Each distinct normalized strong root cause becomes an independent event.

### Summary fallback

If no direct or embedded strong root cause is found, MatrixTrim falls back to the whole summary-style line, such as:

- pytest `FAILED ...`
- `ERROR ...`
- Python/pytest `E  ...` lines

Summary lines are not emitted in addition to strong events. This avoids counting both a typed exception and its later test-runner summary as separate signals.

## Deduplication and bounds

Repeated copies of the same normalized root cause inside one job are deduplicated.

Deterministic derivative summaries are also suppressed when a more specific root cause exists. For example, Rust/Cargo's `error: could not compile ... due to 1 previous error` is not treated as a second independent signal when the preceding compiler error is available. If that summary is the only recognizable cause, it is still retained.

MatrixTrim currently keeps at most the last **8 distinct root-cause events per job**, matching the previous bounded root-cause extraction behavior. This prevents pathological logs from producing an unbounded failure universe.

## Fallback behavior

If no recognizable root-cause headline exists, MatrixTrim keeps the legacy one-job fingerprint heuristic based on interesting log lines. A failed job therefore still contributes at least one signal when its log contains usable text.

## Evidence

Each event stores a small evidence window around its root-cause line. The fingerprint itself is generated from the normalized event signature, while evidence remains available for human inspection.

## Compatibility

The exported `fingerprintFailure(log)` function remains available and preserves the legacy one-job/one-fingerprint behavior.

Repository analysis uses the new `fingerprintFailures(log)` API and can emit multiple `FailureObservation` records for a single GitHub Actions job.

This means:

- `failedJobs` still counts failed matrix jobs.
- failure observations/events may be greater than `failedJobs`.
- `fingerprints` counts distinct normalized failure events across all analyzed jobs.

## Why this matters for optimization

MatrixTrim's set-cover universe contains failure fingerprints. With event-level fingerprinting, a cell is credited for every independent failure signal it has historically detected.

Example:

```text
Linux / Node 20   → F1, F2
Linux / Node 22   → F1
Windows / Node20  → F3
```

The optimizer can preserve `F1`, `F2`, and `F3` separately instead of treating `F1+F2` as one opaque compound failure.

## Fixed-snapshot examples

The pinned public-OSS benchmark provides concrete checks on the heuristic:

- **pandas:** 59 failed matrix jobs produced 151 events that clustered into 5 distinct root-cause fingerprints.
- **Vite:** 8 failed matrix jobs produced 25 events and 23 distinct fingerprints; sampled logs contained multiple concrete timeout/assertion failures in the same job.
- **Diesel:** 40 failed matrix jobs normalized to 40 events and 1 distinct fingerprint after stripping volatile Rust thread IDs/source locations and suppressing derivative `error: test run failed` summaries.
- **pytest:** 3 failed matrix jobs normalized to 3 events and 1 root-cause fingerprint in the pinned snapshot.

The extractor-registry change was also re-run against the pinned Node targets. Vite remained unchanged at 25 events, 23 fingerprints, and 6/6 selected cells. pnpm changed from 1 event / 1 fingerprint to 2 events / 2 fingerprints because one failed job contained two distinct bare test-runner summaries (`FAIL test/globalAdd.test.ts` and `FAIL test/globalUpdate.test.ts`) with no stronger root-cause headline; its recommendation remained 3/3 cells. This is an intentional summary-recall improvement rather than an additional matrix reduction.

The validated matrix reductions remain pandas 34 → 32, Flask 12 → 10, and Diesel 28 → 25. Event-level fingerprinting changes the evidence model without forcing additional removal.

See [benchmark/results.md](../benchmark/results.md) for the complete fixed snapshot.

## Known limitations

Log structure does not prove causal independence. A chained exception can contain multiple strong root-cause headlines that are causally related.

MatrixTrim currently favors precision over summary-level recall: once at least one strong root cause is found in a job, summary-only lines without an extractable cause are not added as extra events. In a mixed log, that can miss a second failure that appears only as a bare runner summary.

MatrixTrim deliberately uses deterministic, bounded extractors rather than an LLM or full language parser. The ecosystem adapters are narrow normalizers layered over the generic heuristic; they do not attempt causal program analysis. The public OSS benchmark records the number of **failure events** and **multi-event jobs** so over-splitting remains observable.

Future work may add additional narrow adapters only when fixed fixtures and benchmark evidence show a precision or recall improvement without collapsing materially different causes.
