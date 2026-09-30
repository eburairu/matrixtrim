# Contributing

MatrixTrim is intentionally conservative because incorrect analysis can lead to unsafe CI reductions.

## Good first contributions

- Workflow fixtures with unusual matrix syntax
- GitHub Actions history samples with known platform/version-specific failures
- Failure fingerprinting test cases
- GitHub API pagination/retry edge cases
- Suggestions for backtesting metrics

## Development

Use Node.js 20 or newer.

```bash
npm install
npm run quality
```

`npm run quality` runs strict TypeScript compilation, Biome checks, the test suite, dependency audit, full-source coverage thresholds, and npm package-content validation. Run `npm run format` to apply the repository formatter.

Changes to `src/action.ts` must be followed by `npm run build:action`; CI rejects a stale committed Action bundle.

Please open an issue before large architectural changes.
