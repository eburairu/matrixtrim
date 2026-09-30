# GitHub expression support

MatrixTrim v0.15 expands the deterministic expression evaluator used to reconstruct rendered GitHub Actions matrix job names.

The evaluator is intentionally narrower than GitHub's runtime. MatrixTrim only evaluates expressions whose inputs are available from the workflow matrix row itself or from literals embedded in the workflow.

## Supported syntax

- grouping with `(...)`
- property dereference with `.`
- quoted index access such as `matrix['python-version']`
- logical `!`, `&&`, and `||`
- equality `==` / `!=` with GitHub-style case-insensitive string comparison and loose numeric coercion
- relational `<`, `<=`, `>`, `>=`
- string, boolean, null, decimal, exponential, and hexadecimal literals
- escaped single quotes inside single-quoted literals

## Supported functions

- `contains(search, item)`
- `startsWith(search, prefix)`
- `endsWith(search, suffix)`
- `format(template, ...)`
- `join(value, separator)`
- `toJSON(value)`
- `fromJSON(value)`
- `case(predicate, value, ..., default)`

Array object filters such as `matrix.target.variants.*.name` are supported when the underlying matrix value is available statically. Wildcard iteration over objects is left unresolved because GitHub explicitly does not guarantee object-property order, which would make rendered-name replay nondeterministic.
## Dynamic matrix inversion

For runtime-generated matrices, MatrixTrim does not execute arbitrary GitHub expressions backward. It only inverts name expressions when the mapping is deterministic.

Supported examples include:

```yaml
name: Test ${{ matrix.os }} / Node ${{ matrix.node }}
```

```yaml
name: ${{ format('Test {0} / {1}', matrix.os, matrix.python) }}
```

Quoted bracket references are equivalent to direct property references:

```yaml
name: Python ${{ matrix['python-version'] }}
```

A direct matrix value with a literal fallback is inverted only when the observed value is not the fallback:

```yaml
name: Runtime ${{ matrix.runtime || 'default' }}
```

`Runtime node22` safely implies `runtime=node22`. `Runtime default` is left unresolved because it could mean either a real value of `default` or a falsy runtime value that triggered the fallback.
## Deliberately unsupported runtime-dependent functions

`hashFiles()` is not evaluated from historical workflow YAML because its result depends on the checked-out repository contents and runner filesystem for that specific run.

Likewise, contexts such as `github.*`, `env.*`, `vars.*`, `secrets.*`, `steps.*`, and opaque `needs.*.outputs.*` values are not invented when their runtime value is unavailable.

GitHub job outputs are evaluated on the runner and are accessible to downstream jobs through the `needs` context, but the workflow-job REST response does not expose those output values as a historical field. MatrixTrim therefore avoids reconstructing them from logs unless a future evidence source can provide the exact value deterministically.

When an expression cannot be evaluated safely, the rendered name remains unresolved. The recommendation and rewrite safety checks continue to treat unresolved cells conservatively.