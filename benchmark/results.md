# MatrixTrim OSS benchmark

Run snapshot captured: 2026-09-30T04:29:07.793Z

Settings: 20 pinned conclusive completed runs per repository, strength=2, holdout=25%.

Results are based on pinned workflow run IDs in benchmark/snapshot.json. Re-running without --refresh-snapshot uses the same run set.

Resolution status: **10/12 resolved**, **2 partial**, **0 unresolved**, **0 errors**.

Only rows marked resolved are treated as validated reduction results. Partial rows are diagnostic only, even when their apparent reduction is large.

Validated non-zero reductions in this snapshot:

- **pandas-dev/pandas**: 34 → 32 cells, 7.2% estimated compute reduction.
- **pallets/flask**: 12 → 10 cells, 13.6% estimated compute reduction.
- **diesel-rs/diesel**: 28 → 25 cells, 7.6% estimated compute reduction.

| Repository | Status | Observed cells | Selected | Axis resolved | Workflow render | Job match | Inactive families | Dynamic defs | Fingerprints | Historical recall | Holdout recall | Unseen recall | Combo coverage | Compute reduction |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| pytest-dev/pytest | resolved | 30 | 30 | 100% | 100% | 100% | 0 | 0 | 2 | 100.0% | n/a | n/a | 100.0% | 0.0% |
| numpy/numpy | resolved | 6 | 6 | 100% | 100% | 100% | 0 | 0 | 1 | 100.0% | n/a | n/a | 100.0% | 0.0% |
| pandas-dev/pandas | resolved | 34 | 32 | 100% | 100% | 100% | 0 | 0 | 3 | 100.0% | 100.0% | 100.0% | 100.0% | 7.2% |
| pydantic/pydantic | resolved | 101 | 101 | 100% | 100% | 100% | 72 | 0 | 23 | 100.0% | n/a | n/a | 100.0% | 0.0% |
| encode/httpx | resolved | 5 | 5 | 100% | 100% | 100% | 0 | 0 | 1 | 100.0% | n/a | n/a | 100.0% | 0.0% |
| pallets/flask | resolved | 12 | 10 | 100% | 100% | 100% | 0 | 0 | 4 | 100.0% | n/a | n/a | 100.0% | 13.6% |
| aio-libs/aiohttp | partial | 29 | 14 | 41% | 75% | 42% | 39 | 0 | 0 | n/a | n/a | n/a | 100.0% | 39.8% |
| tokio-rs/tokio | partial | 51 | 48 | 92% | 100% | 90% | 57 | 0 | 0 | n/a | n/a | n/a | 100.0% | n/a |
| serde-rs/serde | resolved | 6 | 6 | 100% | 100% | 100% | 0 | 0 | 0 | n/a | n/a | n/a | 100.0% | 0.0% |
| diesel-rs/diesel | resolved | 28 | 25 | 100% | 100% | 100% | 5 | 0 | 40 | 100.0% | 100.0% | 100.0% | 100.0% | 7.6% |
| pnpm/pnpm | resolved | 3 | 3 | 100% | 100% | 100% | 28 | 0 | 1 | 100.0% | n/a | n/a | 100.0% | 0.0% |
| vitejs/vite | resolved | 6 | 6 | 100% | 100% | 100% | 2 | 0 | 7 | 100.0% | 100.0% | 100.0% | 100.0% | 0.0% |

## Notes

- **pytest-dev/pytest**: backtest: backtest needs at least one analyzable failure in both the training and holdout windows
- **numpy/numpy**: backtest: backtest needs at least one analyzable failure in both the training and holdout windows
- **pydantic/pydantic**: backtest: backtest needs at least one analyzable failure in both the training and holdout windows
- **encode/httpx**: backtest: backtest needs at least one analyzable failure in both the training and holdout windows
- **pallets/flask**: backtest: backtest needs at least one analyzable failure in both the training and holdout windows
- **aio-libs/aiohttp**: 17 observed cell(s) have unresolved axes. backtest: backtest needs at least one analyzable failure in both the training and holdout windows
- **tokio-rs/tokio**: 4 observed cell(s) have unresolved axes. backtest: backtest needs at least one analyzable failure in both the training and holdout windows
- **serde-rs/serde**: backtest: backtest needs at least one analyzable failure in both the training and holdout windows
- **pnpm/pnpm**: backtest: backtest needs at least one analyzable failure in both the training and holdout windows
