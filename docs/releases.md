# Releases

MatrixTrim publishes versioned GitHub Action releases from the repository's `main` branch.

## Version model

`package.json` is the source of truth for the release version. `package-lock.json` must contain the same root version.

A release creates two Git tags:

- exact tag such as `v0.20.0`
- floating major tag `v0`

Consumers should normally use the floating major tag:

```yaml
- uses: eburairu/matrixtrim@v0
```

For maximum reproducibility, pin an exact release tag or commit SHA instead.

## Release procedure

1. Merge the intended release commit to `main`.
2. Ensure `package.json` and `package-lock.json` contain the intended version.
3. Open **Actions → Release → Run workflow** on `main`.
4. The workflow reruns the full test suite and rebuilds the Action bundle.
5. The workflow verifies that `action-dist/index.cjs` is already committed and reproducible.
6. It creates the exact `vX.Y.Z` tag and a generated GitHub Release.
7. It moves the floating major tag, for example `v0`, to the same commit.

## Safety properties

- Releases can only run from `main`.
- Concurrent releases are serialized.
- The package and lockfile versions must match.
- Versions must use `X.Y.Z` numeric semver form.
- An existing exact tag is accepted only when it already points to the current release commit.
- An exact tag pointing elsewhere fails closed rather than being moved.
- The exact release tag is never force-updated.
- Only the floating major tag is intentionally force-updated.
- The full `npm run quality` gate must pass before any tag is created.
- The committed Action bundle must match a fresh build before any tag is created.
- Repository-level immutable releases prevent a published exact `vX.Y.Z` release and its tag from being changed afterward; the floating `v0` compatibility tag is intentionally not a release tag and may advance.

## Re-running a release

The workflow is intentionally idempotent for the same commit. If an earlier attempt created the exact tag or GitHub Release but failed before updating the floating tag, rerunning it from the same commit completes the missing step.

Do not bump the package version merely to retry infrastructure failure for an otherwise valid release.

## Why not publish directly from every push?

MatrixTrim keeps releases explicit. A successful `main` build proves the commit is healthy, while `workflow_dispatch` is the separate human-controlled promotion step that makes that commit consumable as a stable GitHub Action version.