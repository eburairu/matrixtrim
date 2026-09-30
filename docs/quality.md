# Quality and reliability

MatrixTrim treats analysis correctness as a release requirement, not only a test-suite concern.

## Local quality gate

`npm run quality` is the same gate used by CI and releases. It requires:

- TypeScript strict mode plus `noUncheckedIndexedAccess`, `noUnusedLocals`, and `noUnusedParameters`
- Biome formatting, import organization, and lint checks
- the complete Vitest suite
- full-source V8 coverage thresholds: 60% statements, 50% branches, 70% functions, 60% lines
- `npm audit --audit-level=moderate`
- npm package-content validation

The coverage floor deliberately includes every `src/**/*.ts` file, including entry points that are harder to unit-test. It is a regression floor, not a claim that the current coverage level is sufficient forever.

## Correctness checks

The exact set-cover optimizer is checked against a brute-force oracle across 500 deterministic randomized feasible instances in addition to hand-written cases.

The GitHub API client has dedicated tests for retryable 5xx responses, `Retry-After`, bounded rate-limit waits, request timeouts, non-retryable errors, pagination beyond 300 workflow jobs, and fail-closed incomplete pagination.

CLI behavior is exercised end-to-end through the TypeScript entry point.

## CI gate

All required CI signals feed one `ci-gate` job. Repository branch protection requires that single stable check rather than coupling protection rules to a changing matrix of individual jobs.

The gate includes Node 20/22/24 tests, runtime matrix capture smoke tests, Action smoke tests, the full quality gate, and dependency review on pull requests.
## Supply-chain controls

- External Actions used by MatrixTrim's own workflows are pinned to immutable commit SHAs.
- Dependabot tracks npm and GitHub Actions updates.
- Dependabot vulnerability alerts and automated security updates are enabled.
- Secret scanning and push protection are enabled.
- CodeQL default setup is enabled.
- Pull-request dependency review fails for newly introduced moderate-or-higher vulnerabilities.
- Private vulnerability reporting is enabled.
- Immutable Releases protect future exact `vX.Y.Z` releases after publication; the floating `v0` compatibility tag may still advance.

## Distribution checks

The npm package build cleans `dist/` before compilation. `package.json#files` limits publishable content to the compiled CLI plus README and license, and `npm run pack:check` rejects unexpected files or stale `dist/src` output.

npm publication metadata includes repository, issue tracker, homepage, public access, and provenance configuration. Publishing remains a separate promotion decision from GitHub Action releases.
