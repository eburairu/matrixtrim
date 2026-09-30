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

> **Estado actual: v0.6 experimental.** Las recomendaciones ya combinan evidencia histórica de fallos, cobertura observada 1-wise / pairwise / t-wise, coste de runtime y backtesting temporal.

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

Desde v0.5, MatrixTrim obtiene metadata de jobs de **todas las ejecuciones completadas, incluidas las exitosas**. Solo descarga logs detallados de los matrix jobs que fallaron.

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

Las matrices dinámicas o los nombres de job demasiado personalizados se dejan como unresolved en vez de inventar una interpretación.

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
- [ ] Soporte completo de `include` / `exclude`
- [ ] Restricciones explícitas keep / compatibility
- [ ] GitHub Action + comentarios en PR
- [ ] Benchmark en repos OSS con matrices grandes
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
