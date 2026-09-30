# MatrixTrim

[![CI](https://github.com/eburairu/matrixtrim/actions/workflows/ci.yml/badge.svg)](https://github.com/eburairu/matrixtrim/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/eburairu/matrixtrim)](LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)
[![GitHub stars](https://img.shields.io/github/stars/eburairu/matrixtrim?style=flat)](https://github.com/eburairu/matrixtrim/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/eburairu/matrixtrim)](https://github.com/eburairu/matrixtrim/commits/main)

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | **Español**

**Reduce tus matrices de GitHub Actions sin perder las señales de fallo que realmente importan.**

MatrixTrim no intenta simplemente ejecutar menos jobs. La pregunta útil es otra:

> ¿Qué celdas de la matrix detectan fallos que nadie más detecta y cuáles solo repiten los mismos fallos que ya aparecen en otros entornos?

El objetivo es proponer una CI matrix más pequeña basándose en **cobertura histórica de fallos, coste de ejecución, estructura de la matrix y backtesting con holdout temporal**.

> **Estado actual: v0.8 experimental.** MatrixTrim combina evidencia histórica de fallos, cobertura observada 1-wise / pairwise / t-wise, coste de runtime, backtesting temporal, reconstrucción de nombres de jobs de matrix ya renderizados, GitHub Action y un benchmark reproducible sobre OSS público.

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

En matrices estáticas, MatrixTrim puede reconstruir nombres renderizados a partir de expresiones directas `matrix.*`, `format(...)`, fallbacks como `matrix.name || matrix.python` y matrices definidas solo con `include`. Las matrices dinámicas y las expresiones de GitHub aún no soportadas quedan como unresolved en vez de inventar una interpretación.

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

Con `--strength 3` también conserva las combinaciones 3-wise observadas. MatrixTrim no inventa combinaciones que no existían en la matrix observada. El optimizador actual usa greedy weighted set cover.

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

## Usarlo como GitHub Action

No hace falta clonar el repositorio ni compilar MatrixTrim localmente.

```yaml
permissions:
  actions: read
  contents: read
  pull-requests: write

steps:
  - uses: eburairu/matrixtrim@main
    with:
      workflow: ci.yml
      limit: "100"
      strength: "2"
      holdout: "25"
```

La Action siempre genera un **Step Summary**. En Pull Requests también crea o actualiza un único comentario de MatrixTrim si el token tiene permisos. En PRs desde forks con token de solo lectura, el comentario se omite con un warning y el análisis continúa correctamente.

El informe muestra celdas actuales y sugeridas, historical failure recall, combinatorial coverage, reducción estimada de compute, holdout recall, unseen-failure recall y la lista de celdas recomendadas.

## Benchmark con OSS público

Para evitar validar MatrixTrim solo con ejemplos favorables, fijamos **20 ejecuciones completadas con resultado concluyente en cada uno de 12 repositorios OSS públicos** y las evaluamos con `--strength 2` y un holdout temporal del 25%.

- **10 de 12 repositorios quedaron completamente resueltos**: recuperación de axes observados, renderizado de nombres de workflow y correspondencia de nombres de jobs en matrix families activas alcanzaron el 100%; los otros 2 son partial y no cuentan como reducciones validadas.
- Reducciones no nulas validadas: **pandas 34 → 32 celdas (-7.2%)**, **Flask 12 → 10 (-13.6%)** y **Diesel 28 → 25 (-7.6%)**.
- pandas y Diesel mantuvieron **100% de holdout recall y 100% de unseen-failure recall** en las ventanas de backtest disponibles.
- **7 de los 10 repositorios completamente resueltos se dejaron sin cambios deliberadamente** porque las restricciones de seguridad no justificaban una reducción.
- aiohttp muestra aparentemente 29 → 14, pero solo el 41% de las celdas observadas tiene axes resueltos, con 75% de cobertura de renderizado y 42% de correspondencia de nombres en families activas; por eso sigue siendo un resultado diagnóstico, no validado.

Los run IDs exactos están fijados en [benchmark/snapshot.json](benchmark/snapshot.json) y los resultados completos en [benchmark/results.md](benchmark/results.md). Estas cifras describen ese snapshot fijo; no son una promesa sobre el comportamiento futuro del CI.

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

Caso completo: [docs/case-study-pytest.md](docs/case-study-pytest.md)

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
- [ ] Matrices dinámicas / soporte más amplio de expresiones de GitHub
- [ ] Restricciones explícitas keep / compatibility
- [x] GitHub Action + comentarios en PR
- [x] Benchmark reproducible en repos OSS con matrices grandes
- [ ] Modelo de coste monetario según runner
- [ ] Multi-event failure fingerprinting
- [ ] Generación automática de recommendation PR
- [ ] Optimizador más potente / exacto

## Principios de diseño

- **Evidence over intuition**
- **Deterministic core**
- **Explain every removal**
- **Backtest before trust**
- **Read-only by default**

## Contributing

Se agradecen Issues y Pull Requests. Consulta [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
