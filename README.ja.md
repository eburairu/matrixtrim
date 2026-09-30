# MatrixTrim

[![CI](https://github.com/eburairu/matrixtrim/actions/workflows/ci.yml/badge.svg)](https://github.com/eburairu/matrixtrim/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/eburairu/matrixtrim)](LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)
[![GitHub stars](https://img.shields.io/github/stars/eburairu/matrixtrim?style=flat)](https://github.com/eburairu/matrixtrim/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/eburairu/matrixtrim)](https://github.com/eburairu/matrixtrim/commits/main)

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | **日本語** | [한국어](README.ko.md) | [Español](README.es.md)

**GitHub Actions の巨大な matrix を、「本当に必要な failure signal」を残しながら小さくするためのOSSです。**

MatrixTrimが見たいのは、単純なjob数ではありません。

> そのmatrix cellは、他では見つからない障害を本当に検出しているのか？ それとも、別のcellと同じ障害を繰り返し見つけているだけなのか？

過去のfailure、実行コスト、matrix構造、holdout backtestを使って、より小さいCI matrix候補を作ることを目指しています。

> **Status: v0.5 experimental.** static matrix解析、Actions履歴取得、failure fingerprinting、success/failureを含むruntime履歴、static axis復元、history-only recommendation、time-based holdout backtestまで動作します。

## なぜ必要か

例えば次のmatrixは18 jobs/runです。

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    node: [20, 22, 24]
    postgres: [14, 16]
```

CIが重くなると、経験則でmatrixを削りがちです。MatrixTrimは代わりに、各cellの実績を見ます。

- 他のcellでは見つからなかったfailureを検出したか
- 同じfailureを重複して検出していないか
- 実行コストはどれくらいか
- 縮約後のcellで新しいfailureも拾えているか

## セットアップ

Node.js 20+ が必要です。

```bash
npm install
npm run build
```

## ローカルworkflowを確認

```bash
node dist/cli.js inspect .github/workflows
```

## GitHub Actions履歴を解析

Actions logを読むため、GitHub tokenが必要です。

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js analyze owner/repo \
  --workflow ci.yml \
  --limit 100
```

v0.5では、**failure runだけでなく、すべてのcompleted runからjob metadataを取得**します。failureになったmatrix jobだけlogまで深掘りします。

例えばMatrixTrim自身の直近5 runでは:

```text
Matrix cell history
  test (20): runs=5, success=5, failure=0, runtime=13.0s, node=20
  test (22): runs=5, success=5, failure=0, runtime=12.0s, node=22
  test (24): runs=5, success=5, failure=0, runtime=10.0s, node=24
```

このため、**一度も失敗していないcellが分析対象から消える**ことはありません。

static matrixならaxis名も可能な範囲で復元します。

```text
test (ubuntu-latest, 22)
↓
os=ubuntu-latest
node=22
```

dynamic matrixやcustom job nameは、無理に推測せず unresolved として扱います。

## matrix縮約候補を出す

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js recommend owner/repo \
  --workflow ci.yml \
  --limit 100
```

現在のrecommendationは **history-only / experimental** です。

次を満たすcell集合を探します。

1. 解析できた過去のfailure fingerprintをすべてカバー
2. matrix job familyごとに最低1cellを維持
3. median runtimeをコストとして推定computeを最小化

現在のoptimizerは greedy weighted set coverです。

## 新しいfailureでbacktestする

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js backtest owner/repo \
  --workflow ci.yml \
  --limit 100 \
  --holdout 25
```

古いrunだけでcellを選び、新しいholdout期間で次を測定します。

- holdout failure全体のrecall
- training時には存在しなかった**新しいfingerprint**のrecall
- どのfailureを取り逃したか

runtime costも**training期間だけ**から計算するため、holdout側の情報を先取りしません。

## 実例: pytest

実際の `pytest-dev/pytest` のfailure runで検証しました。

- failed jobs: 31
- matrix jobs: 30
- downstream aggregate job: 1

一見30種類のfailureに見えましたが、root causeを正規化すると30cellすべて同じfingerprintでした。

```text
windows-py311 ─┐
ubuntu-py312  ─┤
macos-py314   ─┤
...            ├─ 1 failure fingerprint
30 cells ──────┘

ImportError: cannot import name '_resolve_args_directness'
from partially initialized module '_pytest.fixtures'
```

これは**その障害について重複があった**という証拠であって、「29cell削除して安全」という意味ではありません。

詳細: [pytest 実例ケーススタディ](docs/case-study-pytest.ja.md)

## Failure Fingerprint

timestamp、絶対path、UUID、duration、line numberなどの揺れる情報を除去し、Exception / Assertion / panic / compiler error / failing testなどのroot-cause headlineを優先してfingerprint化します。

coreはdeterministicで、LLMは必須ではありません。

## ロードマップ

- [x] static GitHub Actions matrix解析
- [x] CLI / JSON出力
- [x] success runを含むcompleted-run履歴
- [x] failure signature正規化・クラスタリング
- [x] cellごとのsuccess/failure/runtime履歴
- [x] static matrix axis復元
- [x] history-only weighted set-cover recommendation
- [x] time-based holdout backtest
- [ ] `include` / `exclude` の完全展開
- [ ] pairwise / t-wise coverage constraint
- [ ] optimizer強化
- [ ] GitHub ActionとしてPRへコメント
- [ ] recommendation PR自動生成

## 設計原則

- **Evidence over intuition**
- **Deterministic core**
- **Explain every removal**
- **Backtest before trust**
- **Read-only by default**

## Contributing

Issue / Pull Request歓迎です。[CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## License

MIT
