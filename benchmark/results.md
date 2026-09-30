# MatrixTrim OSS benchmark

Run snapshot captured: 2026-09-30T04:29:07.793Z

Settings: 20 pinned conclusive completed runs per repository, strength=2, holdout=25%.

Results are based on pinned workflow run IDs in benchmark/snapshot.json. Re-running without --refresh-snapshot uses the same run set.

Resolution status: **10/12 resolved**, **2 partial**, **0 unresolved**, **0 errors**.

Only rows marked resolved are treated as validated reduction results. Partial rows are diagnostic only, even when their apparent reduction is large.

All benchmark targets are public OSS repositories. For standard GitHub-hosted runners, estimated GitHub charge is therefore $0; rate-card values are comparison-only and show the monetary value of equivalent private-repository overage usage.

Validated non-zero reductions in this snapshot:

- **pandas-dev/pandas**: 34 → 32 cells, 7.2% estimated compute reduction; standard-runner rate-card $25.148 → $24.671 per run; estimated GitHub charge $0.000 → $0.000 per run.
- **pallets/flask**: 12 → 10 cells, 13.6% estimated compute reduction; standard-runner rate-card $0.132 → $0.120 per run; estimated GitHub charge $0.000 → $0.000 per run.
- **diesel-rs/diesel**: 28 → 25 cells, 7.6% estimated compute reduction; standard-runner rate-card $11.624 → $11.450 per run; estimated GitHub charge $0.000 → $0.000 per run.

| Repository | Status | Cells | Selected | Axis resolved | Workflow render | Job match | Fingerprints | Historical recall | Holdout recall | Unseen recall | Compute reduction | Pricing coverage | Rate-card/run | Est. charge/run |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| pytest-dev/pytest | resolved | 30 | 30 | 100% | 100% | 100% | 2 | 100.0% | n/a | n/a | 0.0% | 100.0% | $2.059 → $2.059 | $0.000 → $0.000 |
| numpy/numpy | resolved | 6 | 6 | 100% | 100% | 100% | 1 | 100.0% | n/a | n/a | 0.0% | 100.0% | $0.234 → $0.234 | $0.000 → $0.000 |
| pandas-dev/pandas | resolved | 34 | 32 | 100% | 100% | 100% | 3 | 100.0% | 100.0% | 100.0% | 7.2% | 100.0% | $25.148 → $24.671 | $0.000 → $0.000 |
| pydantic/pydantic | resolved | 101 | 101 | 100% | 100% | 100% | 23 | 100.0% | n/a | n/a | 0.0% | 100.0% | $10.464 → $10.464 | $0.000 → $0.000 |
| encode/httpx | resolved | 5 | 5 | 100% | 100% | 100% | 1 | 100.0% | n/a | n/a | 0.0% | 100.0% | $0.048 → $0.048 | $0.000 → $0.000 |
| pallets/flask | resolved | 12 | 10 | 100% | 100% | 100% | 4 | 100.0% | n/a | n/a | 13.6% | 100.0% | $0.132 → $0.120 | $0.000 → $0.000 |
| aio-libs/aiohttp | partial | 29 | 29 | 41% | 75% | 42% | 0 | n/a | n/a | n/a | 0.0% | 100.0% | $2.221 → $2.221 | $0.000 → $0.000 |
| tokio-rs/tokio | partial | 51 | 51 | 92% | 100% | 90% | 0 | n/a | n/a | n/a | n/a | 98.0% | n/a | n/a |
| serde-rs/serde | resolved | 6 | 6 | 100% | 100% | 100% | 0 | n/a | n/a | n/a | 0.0% | 100.0% | $0.064 → $0.064 | $0.000 → $0.000 |
| diesel-rs/diesel | resolved | 28 | 25 | 100% | 100% | 100% | 40 | 100.0% | 100.0% | 100.0% | 7.6% | 100.0% | $11.624 → $11.450 | $0.000 → $0.000 |
| pnpm/pnpm | resolved | 3 | 3 | 100% | 100% | 100% | 1 | 100.0% | n/a | n/a | 0.0% | 0.0% | n/a | n/a |
| vitejs/vite | resolved | 6 | 6 | 100% | 100% | 100% | 7 | 100.0% | 100.0% | 100.0% | 0.0% | 100.0% | $0.596 → $0.596 | $0.000 → $0.000 |

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
