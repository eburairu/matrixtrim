# MatrixTrim

[![CI](https://github.com/eburairu/matrixtrim/actions/workflows/ci.yml/badge.svg)](https://github.com/eburairu/matrixtrim/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/eburairu/matrixtrim)](../../LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)
[![GitHub stars](https://img.shields.io/github/stars/eburairu/matrixtrim?style=flat)](https://github.com/eburairu/matrixtrim/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/eburairu/matrixtrim)](https://github.com/eburairu/matrixtrim/commits/main)

[English](../../README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | **Español**

**Reduce tus matrices de GitHub Actions sin perder las señales de fallo que realmente importan.**

MatrixTrim no intenta simplemente ejecutar menos jobs. La pregunta útil es otra:

> ¿Qué celdas de la matrix detectan fallos que nadie más detecta y cuáles solo repiten los mismos fallos que ya aparecen en otros entornos?

El objetivo es proponer una CI matrix más pequeña basándose en **cobertura histórica de fallos, coste de ejecución, estructura de la matrix y backtesting con holdout temporal**.

> **Estado actual: v0.20 experimental.** MatrixTrim combina multi-event root-cause fingerprints, evidencia histórica de fallos, cobertura observada 1-wise / pairwise / t-wise, restricciones keep / compatibility definidas explícitamente por humanos, exact branch-and-bound optimizer, coste de runtime y estimación monetaria según runner, backtesting temporal, reconstrucción de nombres de jobs de matrix ya renderizados, GitHub Action, benchmark reproducible sobre OSS público y generación opt-in de draft PRs de optimización.

## ¿Por qué MatrixTrim?

Esta matrix ya genera 18 jobs por ejecución:

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    node: [20, 22, 24]
    postgres: [14, 16]
```

Cuando CI empieza a ser caro, es habitual eliminar combinaciones a ojo. MatrixTrim intenta tomar esa decisión con evidencia:

- ¿Esta celda ha detectado alguna vez un fallo único?
- ¿Suele repetir fallos que otras celdas ya encuentran?
- ¿Cuánto cuesta ejecutarla?
- ¿Una selección más pequeña sigue detectando fallos posteriores?

## Instalación

Se necesita Node.js 20+.

```bash
npm install
npm run build
```

## Inspeccionar un workflow local

```bash
node dist/cli.js inspect .github/workflows
```

## Analizar el historial de GitHub Actions

Para leer los logs de Actions se necesita un token de GitHub.

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js analyze owner/repo \
  --workflow ci.yml \
  --limit 100
```

MatrixTrim obtiene metadata de jobs de **todas las ejecuciones completadas, incluidas las exitosas**. Solo descarga logs detallados de los matrix jobs que fallaron.

Ejemplo:

```text
Matrix cell history
  test (20): runs=5, success=5, failure=0, runtime=13.0s, node=20
  test (22): runs=5, success=5, failure=0, runtime=12.0s, node=22
  test (24): runs=5, success=5, failure=0, runtime=10.0s, node=24
```

Así, una celda que nunca haya fallado no desaparece del universo analizado.

En matrices estáticas, MatrixTrim también intenta recuperar los nombres de los axes:

```text
test (ubuntu-latest, 22)
↓
os=ubuntu-latest
node=22
```

En v0.16, además de la evaluación determinista de expresiones de v0.15, un step explícito `mode: capture` puede guardar `toJSON(matrix)` en una anotación de Check Run y permitir su recuperación exacta en análisis posteriores. La captura es opt-in y no añade llamadas a annotations en jobs que no la usan. Sin evidencia runtime, los valores siguen unresolved y las matrices dinámicas nunca se reescriben automáticamente.

## Recomendar una matrix más pequeña

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js recommend owner/repo \
  --workflow ci.yml \
  --limit 100
```

La recomendación sigue siendo **experimental**. El objetivo principal no es borrar combinaciones automáticamente, sino medir el failure-detection value real de cada configuración.

Con el valor predeterminado `--strength 2`, MatrixTrim conserva:

1. todos los failure fingerprints históricos analizados;
2. todos los valores observados de cada axis resuelto (1-wise);
3. todos los pares observados de valores entre axes (pairwise);
4. al menos una celda por cada matrix job family;
5. el menor compute estimado posible dentro de esas restricciones, usando median runtime como coste.

Con `--strength 3` también conserva las combinaciones 3-wise observadas. MatrixTrim no inventa combinaciones que no existían en la matrix observada.

## Exact optimizer

El valor predeterminado `--optimizer auto` obtiene primero una solución greedy determinista y después ejecuta un branch-and-bound dentro del propio proceso para demostrar el conjunto de cells de menor coste ponderado por runtime que satisface las restricciones de coverage actuales. Si supera el presupuesto predeterminado de **250.000 nodes**, `auto` vuelve explícitamente a greedy. `--optimizer exact` falla en lugar de devolver una solución sin prueba, mientras que `--optimizer greedy` omite la búsqueda exacta.

“Exact” significa óptimo para el **weighted set-cover model actual**; no demuestra que un environment eliminado nunca pueda detectar un fallo futuro. Consulta [Exact optimizer](../optimizer.md).

## Backtest con fallos más recientes

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js backtest owner/repo \
  --workflow ci.yml \
  --limit 100 \
  --holdout 25
```

Las ejecuciones más antiguas se usan para elegir las celdas. Después, las ejecuciones más recientes del holdout miden:

- recall total de fallos en el holdout;
- recall de **fingerprints nuevos que no existían en training**;
- qué fallos se perdieron con la matrix reducida.

El coste de runtime se calcula solo con la ventana de training, evitando leakage desde el holdout.

## Multi-event failure fingerprints

Un failed matrix job puede contener varias señales de fallo independientes. MatrixTrim ahora crea fingerprints separados para root causes fuertes, de modo que `Error X` y `Error Y` dentro del mismo job producen dos events en vez de un fingerprint compuesto `X+Y`. Se priorizan typed errors/exceptions, panic/fatal y segmentation faults; las líneas summary del test runner solo se usan cuando no existe un root cause fuerte, evitando duplicados evidentes.

Las repeticiones del mismo normalized root cause se deduplican y cada job queda limitado a un máximo de 8 events distintos. Si no se reconoce ningún root-cause headline, MatrixTrim vuelve al heuristic single-fingerprint anterior. Consulta [Multi-event failure fingerprints](../fingerprints.md) para más detalles.

## Usarlo como GitHub Action

No hace falta clonar el repositorio ni compilar MatrixTrim localmente.

```yaml
permissions:
  actions: read
  contents: read
  pull-requests: write

steps:
  - uses: eburairu/matrixtrim@v0
    with:
      workflow: ci.yml
      limit: "100"
      strength: "2"
      optimizer: auto
      holdout: "25"
```

La Action siempre genera un **Step Summary**. En Pull Requests también crea o actualiza un único comentario de MatrixTrim si el token tiene permisos. En PRs desde forks con token de solo lectura, el comentario se omite con un warning y el análisis continúa correctamente.

El informe muestra celdas actuales y sugeridas, historical failure recall, número de failure events / multi-event jobs, combinatorial coverage, reducción estimada de compute, rate-card / cargo estimado según runner, holdout recall, unseen-failure recall y la lista de celdas recomendadas.

### Crear un draft PR de optimización (opt-in)

La creación de PR está **desactivada por defecto**. Solo se habilita explícitamente cuando se quiere que MatrixTrim proponga también el cambio del workflow.

```yaml
permissions:
  actions: read
  contents: write
  pull-requests: write

steps:
  - uses: eburairu/matrixtrim@v0
    with:
      workflow: ci.yml
      limit: "100"
      strength: "2"
      optimizer: auto
      holdout: "25"
      create-pr: "true"
```

MatrixTrim solo crea un **draft PR** y nunca hace auto-merge. Convierte las celdas static seleccionadas en filas explícitas de `matrix.include` y valida el workflow con un round-trip antes de escribirlo. Si hay matrices dinámicas, axes sin resolver, correspondencia incompleta entre workflow y nombres de jobs, coverage inferior al 100% o algún holdout disponible falla, la creación del PR se rechaza. Las ejecuciones disparadas por `pull_request` o `pull_request_target` también omiten de forma forzada la creación del PR de optimización.

## Hard constraints explícitas

Si un entorno debe conservarse por compatibilidad o política de soporte aunque el historial lo haga parecer redundante, puede declararse en `.matrixtrim.yml`.

```yaml
version: 1
constraints:
  keep:
    - "test (windows-latest, 20)"
  require:
    - axes:
        os: windows-latest
    - baseJob: test
      axes:
        node: "20"
        postgres: "14"
```

`keep` fija una cell renderizada exacta. `require` garantiza que permanezca al menos una cell observada que cumpla el selector. La misma política se aplica a recommendation, backtest, GitHub Action y generación del draft PR. Si una regla no coincide con ninguna cell, MatrixTrim falla de forma cerrada en lugar de ignorarla silenciosamente.

La configuración se lee desde la **default branch** del repositorio, por lo que un Pull Request no confiable no puede debilitar la política de seguridad de MatrixTrim modificando su propia copia del config. Consulta [Explicit hard constraints](../constraints.md) para la semántica completa.

## Modelo de coste según runner

MatrixTrim ya no trata todos los minutos de CI como si costaran lo mismo: estima el impacto monetario a partir de los labels reales del runner y de la duración observada de cada job.

- Tarifas base de standard GitHub-hosted runners usadas por el modelo actual: Linux 1-core x64 **$0.002/min**, Linux 2-core x64 **$0.006/min**, Linux 2-core arm64 **$0.005/min**, Windows x64/arm64 **$0.010/min** y standard macOS **$0.062/min**.
- Cada job se redondea hacia arriba al minuto completo antes de calcular el coste, igual que en la facturación de GitHub Actions.
- En un **public repository**, los standard GitHub-hosted runners son gratuitos. Por eso MatrixTrim muestra un cargo GitHub estimado de **$0** y usa el rate-card solo como valor comparativo.
- En un **private/internal repository**, el cargo estimado representa el equivalente de overage del standard runner **antes de descontar los minutos incluidos en el plan**.
- Los self-hosted runners se consideran $0 de cargo GitHub Actions; los larger runners o runners desconocidos quedan como unpriced en vez de inventar una tarifa.
- La proyección a 30 días solo se muestra cuando la ventana observada cubre al menos **7 días**, para no extrapolar agresivamente unas pocas horas de historial.

Referencias de precios: [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) / [Actions runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing)

## Benchmark con OSS público

Para evitar validar MatrixTrim solo con ejemplos favorables, fijamos **20 ejecuciones completadas con resultado concluyente en cada uno de 12 repositorios OSS públicos** y las evaluamos con `--strength 2` y un holdout temporal del 25%.

- **10 de 12 repositorios quedaron completamente resueltos**: recuperación de axes observados, renderizado de nombres de workflow y correspondencia de nombres de jobs en matrix families activas alcanzaron el 100%; los otros 2 son partial y no cuentan como reducciones validadas.
- Reducciones no nulas validadas: **pandas 34 → 32 celdas (-7.2%)**, **Flask 12 → 10 (-13.6%)** y **Diesel 28 → 25 (-8.3%)**.
- La reducción de compute no coincide necesariamente con la reducción monetaria por las tarifas distintas de cada runner y el redondeo de cada job al minuto completo. En el rate-card de standard runners: pandas **$25.148 → $24.671/run (-1.9%)**, Flask **$0.132 → $0.120/run (-9.1%)** y Diesel **$11.624 → $11.438/run (-1.6%)**. Los tres repositorios son públicos, así que el cargo GitHub estimado para standard runners sigue siendo **$0**.
- El exact optimizer demostró optimality en **12/12 repositorios del benchmark**, con **0 fallbacks a greedy** y un máximo de **102 nodes** explorados. Coincidió con greedy en 11 repositorios; en Diesel mejoró el objetivo de runtime de greedy en **1.15%**, elevando la reducción de compute de aproximadamente **7.6% a 8.3%**. pandas y Vite mantuvieron **100% de holdout recall y 100% de unseen-failure recall** en las ventanas de backtest disponibles. Diesel mantuvo **100% de holdout recall**; como no hubo fingerprints nuevos en el holdout, unseen-failure recall es **n/a**.
- La extracción por events también aparece en logs reales del snapshot fijo: **pandas 59 failed jobs → 151 events → 5 root-cause fingerprints distintos**, **Vite 8 → 25 → 23**, mientras que la normalización de valores volátiles de Rust y summaries derivados hace que **Diesel converja 40 → 40 → 1**.
- **7 de los 10 repositorios completamente resueltos se dejaron sin cambios deliberadamente** porque las restricciones de seguridad no justificaban una reducción.
- aiohttp y Tokio siguen siendo partial. En la recommendation actual los cells unresolved se conservan individualmente como restricción de seguridad, por lo que este snapshot queda en **aiohttp 29 → 29 / Tokio 51 → 51**; ninguno cuenta como reducción validada.

Los run IDs exactos están fijados en [benchmark/snapshot.json](../../benchmark/snapshot.json) y los resultados completos en [benchmark/results.md](../../benchmark/results.md). Estas cifras describen ese snapshot fijo; no son una promesa sobre el comportamiento futuro del CI.

## Caso real: pytest

MatrixTrim se validó con una ejecución fallida real de `pytest-dev/pytest`:

- 31 jobs fallidos
- 30 matrix jobs
- 1 job agregado downstream

A primera vista parecían 30 fallos independientes. Después de normalizar la causa raíz, las 30 celdas terminaron en el mismo fingerprint:

```text
windows-py311 ─┐
ubuntu-py312  ─┤
macos-py314   ─┤
...            ├─ one failure fingerprint
30 cells ──────┘

ImportError: cannot import name '_resolve_args_directness'
from partially initialized module '_pytest.fixtures'
```

Eso demuestra redundancia **para ese fallo observado**. No significa que eliminar 29 celdas sea automáticamente seguro.

Caso completo: [docs/case-study-pytest.md](../case-study-pytest.md)

## Failure Fingerprint

MatrixTrim elimina datos volátiles como timestamps, rutas absolutas, UUIDs, duraciones y números de línea. Después prioriza señales cercanas a la causa raíz: Exception, Assertion, panic, compiler error o failing test.

El núcleo es determinista y no depende de un LLM.

## Roadmap

- [x] Inspección de matrices estáticas de GitHub Actions
- [x] CLI / salida JSON
- [x] Historial de completed runs, incluidos los exitosos
- [x] Normalización y clustering de failure signatures
- [x] Historial success/failure/runtime por celda
- [x] Recuperación de axes de matrices estáticas
- [x] Recomendación basada en empirical failure coverage
- [x] Restricciones de seguridad 1-wise / pairwise / t-wise observadas
- [x] Backtest temporal
- [x] Expansión estática de `include` / `exclude` y reconstrucción del nombre renderizado del job
- [x] Análisis de matrices dinámicas observadas + recuperación segura de ejes desde orden conocido / nombres de job
- [x] Funciones de expresiones GitHub deterministas + soporte de brackets / object filters
- [x] Captura opt-in de evidencia runtime determinista mediante anotaciones de Check Run
- [x] Releases versionadas de GitHub Action + floating major tag
- [x] SHA-pinned workflow dependencies + Dependabot enforcement
- [x] Retry/timeout-aware GitHub API client + complete job pagination
- [x] Coverage/lint/type/package quality gates + aggregate protected CI check
- [x] CodeQL, dependency review, private vulnerability reporting, immutable releases
- [x] Brute-force oracle validation for the exact optimizer
- [x] Restricciones explícitas keep / compatibility
- [x] GitHub Action + comentarios en PR
- [x] Benchmark reproducible en repos OSS con matrices grandes
- [x] Modelo de coste monetario según runner
- [x] Multi-event failure fingerprinting
- [x] Generación opt-in de draft recommendation PR
- [x] Optimizador más potente / exacto

## Principios de diseño

- **Evidence over intuition**
- **Deterministic core**
- **Explain every removal**
- **Backtest before trust**
- **Read-only by default**

## Contributing

Se agradecen Issues y Pull Requests. Consulta [CONTRIBUTING.md](../../CONTRIBUTING.md).

## License

MIT
