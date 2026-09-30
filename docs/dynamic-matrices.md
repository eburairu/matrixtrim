# Dynamic matrix analysis

MatrixTrim v0.14 added safe analysis support for GitHub Actions matrices that are not fully static in workflow YAML. v0.16 adds explicit runtime evidence capture for cases where the exact matrix value cannot be reconstructed later.

The key rule is unchanged: **do not invent runtime matrix values**. MatrixTrim only uses values it can recover from the workflow shape or from job names that GitHub actually rendered.

## Support levels

| Matrix form | Cell history | Axis recovery | Automatic rewrite |
| --- | --- | --- | --- |
| Fully static matrix | yes | full, when names render | eligible after safety checks |
| Partially dynamic object | yes | known axis order can be recovered from default names | no |
| Whole dynamic matrix + direct `matrix.*` custom name | yes | supported | no |
| Whole dynamic matrix + supported `format(...)` name | yes | supported | no |
| Opaque whole dynamic matrix | yes when capture is enabled | exact top-level runtime keys from capture evidence; otherwise unresolved | no |

## Partially dynamic matrices

MatrixTrim retains axis names from the YAML object even when one or more axis values come from expressions:

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest]
    node: ${{ fromJSON(needs.prepare.outputs.nodes) }}
```

If GitHub renders a default job name such as `test (windows-latest, 24)`, MatrixTrim can map those observed values back to `os` and `node` without evaluating `needs.prepare.outputs.nodes`.
## Whole dynamic matrices

A common pattern delegates the whole matrix to an earlier job:

```yaml
strategy:
  matrix: ${{ fromJSON(needs.prepare.outputs.matrix) }}
```

MatrixTrim does not try to execute the producer job or reconstruct the output JSON. Instead, it can recover axes when the job name exposes them directly:

```yaml
name: Test ${{ matrix.os }} / Node ${{ matrix.node }}
```

For an observed job named `Test windows-latest / Node 22`, MatrixTrim records:

```text
os=windows-latest
node=22
```

`format(...)` is also supported when its dynamic arguments are direct `matrix.*` references:

```yaml
name: ${{ format('Test {0} / {1}', matrix.os, matrix.python) }}
```

Reusable-workflow child suffixes such as ` / child job` remain compatible with this matching.

## Runtime evidence capture

When a dynamic matrix remains opaque, add a `mode: capture` MatrixTrim step to the matrix job and pass `toJSON(matrix)`. The exact runtime matrix object is stored as a versioned Check Run notice annotation and can be replayed by later analysis. See [runtime-evidence.md](runtime-evidence.md) for setup, permissions, security, and limits.

## Safety behavior

When MatrixTrim cannot recover an axis value safely, it leaves `axes` unresolved. The recommendation layer then retains that observed cell individually as a safety constraint instead of pretending it has combinatorial coverage.

Dynamic matrix definitions are still reported as dynamic because they cannot be statically enumerated. That distinction matters for three reasons:

1. static expected-cell coverage cannot be claimed for runtime-generated combinations;
2. opaque dynamic axes may reduce combinatorial coverage evidence;
3. MatrixTrim refuses draft optimization PR generation for dynamic matrices.

Automatic rewriting remains intentionally static-only. The draft-PR path requires a fully resolved static matrix, complete workflow/job-name mapping, preserved historical and combinatorial coverage, and successful available holdout checks.

## What MatrixTrim still does not do

MatrixTrim does **not** currently:

- execute producer jobs later to recreate historical `needs.*.outputs.*` values;
- evaluate arbitrary GitHub expression contexts such as repository variables, secrets, or runtime-only event data when their value was not captured;
- scrape arbitrary logs to guess opaque runtime values;
- rewrite a dynamic matrix into a smaller workflow definition.

Without explicit capture evidence, those cases remain unresolved rather than guessed.