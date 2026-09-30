# Runtime matrix evidence

MatrixTrim v0.16 can preserve exact matrix values for GitHub Actions matrices whose runtime outputs cannot be reconstructed later from the REST API.

GitHub exposes job outputs to downstream jobs through the `needs` context while a workflow is running, but historical workflow-job REST responses do not include those output values. MatrixTrim therefore uses an explicit, opt-in capture step inside the matrix job instead of guessing values from logs.

## Capture a dynamic matrix cell

Add MatrixTrim to the matrix job and pass the current matrix as JSON:

```yaml
jobs:
  test:
    needs: prepare
    strategy:
      matrix: ${{ fromJSON(needs.prepare.outputs.matrix) }}
    steps:
      - uses: actions/checkout@v7
      - uses: eburairu/matrixtrim@v0
        with:
          mode: capture
          matrix: ${{ toJSON(matrix) }}
```

`mode: capture` does not run repository analysis and does not require a GitHub token. It emits one GitHub notice annotation containing a versioned, base64url-encoded JSON payload for the current matrix cell.
## Later analysis

When a later `analyze`, `recommend`, or GitHub Action analysis encounters an unresolved dynamic job, MatrixTrim first checks whether that historical workflow revision explicitly contained a capture step. Only then does it query that job's Check Run annotations.

If exactly one consistent MatrixTrim evidence payload is found, MatrixTrim restores every top-level runtime matrix key and records the axis source as `capture-evidence`. No annotation API calls are made for repositories or jobs that did not opt in.

For otherwise identical job names, MatrixTrim appends a canonical axis suffix to its internal cell identity, for example:

```text
opaque runtime cell [flavor=fast, runtime=node20]
opaque runtime cell [flavor=safe, runtime=node22]
```

This prevents two runtime configurations with the same custom GitHub job name from collapsing into one historical cell.

## Permissions

The analysis job needs:

```yaml
permissions:
  actions: read
  checks: read
  contents: read
```

If annotation access is unavailable, MatrixTrim fails soft: the affected cells remain unresolved and the report includes runtime-evidence coverage/errors.
## Security and limits

The evidence payload is **encoded, not encrypted**. Anyone who can read the repository's Check Run annotations can decode it. Do not capture matrix values that contain secrets, credentials, tokens, or other sensitive data.

MatrixTrim limits the serialized evidence payload to 24 KiB before encoding. Large matrices should store identifiers in the matrix and resolve bulky configuration elsewhere.

Capture is deliberately opt-in. MatrixTrim does not scrape arbitrary logs for values that merely look like job outputs, because log-derived reconstruction can be ambiguous and can expose unrelated data.

## Safety behavior

- Conflicting evidence annotations are rejected.
- Malformed evidence is ignored.
- Evidence is only accepted when its captured GitHub job ID matches the dynamic matrix definition being analyzed.
- Missing evidence never causes MatrixTrim to invent an axis value.
- Dynamic matrices remain ineligible for automatic workflow rewriting even when runtime evidence is available.