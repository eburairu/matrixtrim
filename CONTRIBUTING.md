# Contributing

MatrixTrim is intentionally conservative because incorrect analysis can lead to unsafe CI reductions.

## Good first contributions

Small, testable contributions are preferred for a first pull request. Good examples include:

- workflow fixtures with unusual but real matrix syntax,
- failure-fingerprint fixtures from public CI logs,
- GitHub API pagination/retry edge cases,
- documentation examples for supported matrix/expression forms,
- and public benchmark targets that add ecosystem or workflow diversity.

Look for issues labeled [`good first issue`](https://github.com/eburairu/matrixtrim/labels/good%20first%20issue). Each one should include a narrow acceptance test so the change can be reviewed without redesigning MatrixTrim.

For benchmark contributions, start with [Add your repository to the benchmark](benchmark/README.md#add-your-repository-to-the-benchmark). Run the candidate in scratch files first; do not regenerate the canonical benchmark in your initial PR.

## Development

Use Node.js 20 or newer.

```bash
npm install
npm run quality
```

`npm run quality` runs strict TypeScript compilation, Biome checks, the test suite, dependency audit, full-source coverage thresholds, and npm package-content validation. Run `npm run format` to apply the repository formatter.

Changes to `src/action.ts` must be followed by `npm run build:action`; CI rejects a stale committed Action bundle.

## Pull-request scope

Keep the first PR focused. Add or update tests for behavioral changes and avoid mixing unrelated refactors into a fixture, documentation, or benchmark contribution.

MatrixTrim fails closed around unresolved matrix data. A contribution should not make an unsupported expression, runner, or matrix value look resolved merely to increase coverage.

Please open an issue before large architectural changes. Questions, design discussion, and usage results belong in [GitHub Discussions](https://github.com/eburairu/matrixtrim/discussions).
