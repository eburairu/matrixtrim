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

> **Status: v0.9 experimental.** 過去のfailure evidence、観測済み1-wise / pairwise / t-wise構成coverage、runtime costとrunner-awareな金額推定、time-based holdout backtest、render済みmatrix job名の復元、GitHub Action、再現可能な公開OSS benchmarkまで利用できます。

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

MatrixTrimは、**failure runだけでなく、すべてのcompleted runからjob metadataを取得**します。failureになったmatrix jobだけlogまで深掘りします。

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

static matrixでは、直接の `matrix.*` 参照、`format(...)`、`matrix.name || matrix.python` のようなfallback式、include-only matrixからrender済みjob名を復元できます。dynamic matrixや未対応のGitHub式は、無理に推測せず unresolved として扱います。

## matrix縮約候補を出す

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js recommend owner/repo \
  --workflow ci.yml \
  --limit 100
```

recommendationはまだ **experimental** です。中心は「自動で削除すること」ではなく、各configurationのfailure-detection valueを測ることです。

既定の `--strength 2` では、次をすべて維持した上で縮約候補を探します。

1. 解析できた過去のfailure fingerprint
2. 解決できた各axisの全観測値（1-wise）
3. 観測されたaxis値の全ペア（pairwise）
4. matrix job familyごと最低1cell
5. 上記を満たす範囲で、median runtimeベースの推定computeを削減

`--strength 3` にすると、観測済みの3-wise組み合わせまで維持します。実際のmatrixに存在しなかった組み合わせを勝手に要求することはありません。optimizerは現在 greedy weighted set coverです。

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

## GitHub Actionとして使う

cloneやlocal buildは不要です。

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

Actionは必ず **Step Summary** を生成します。Pull Request上では、権限があればMatrixTrimコメントを1件だけ作成・更新します。fork PRなどでtokenがread-onlyの場合、コメント作成だけwarning付きでskipし、分析自体は成功させます。

レポートには、現在cell数と推奨cell数、historical failure recall、combinatorial coverage、推定compute削減率、runner-awareなrate-card / 推定請求額、holdout recall、unseen-failure recall、推奨cell一覧を表示します。

## runner-aware cost model

MatrixTrimはCI minuteをすべて同じ価値として扱わず、実際のrunner labelと観測したjob実行時間から金額影響を推定します。

- v0.9で使用するstandard GitHub-hosted runnerの基準単価は、Linux 1-core x64 **$0.002/min**、Linux 2-core x64 **$0.006/min**、Linux 2-core arm64 **$0.005/min**、Windows x64/arm64 **$0.010/min**、standard macOS **$0.062/min** です。
- GitHub Actionsの課金仕様に合わせ、各jobの実行時間を1分単位へ切り上げてから金額化します。
- **public repository**ではstandard GitHub-hosted runnerは無料です。そのため推定GitHub請求額は**$0**とし、rate-cardは比較用の金額として別表示します。
- **private/internal repository**では、account/planに含まれる無料minuteを差し引く前のstandard runner overage相当額として表示します。
- self-hosted runnerのGitHub Actions請求は$0として扱い、larger runnerや判定できないrunnerは無理に単価を推測せずunpricedにします。
- 30日換算は、観測したrunの期間が**7日以上**ある場合だけ表示します。数時間分の履歴から月額を過剰に外挿しません。

料金根拠: [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) / [Actions runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing)

## 公開OSS benchmark

都合の良い実例だけで評価しないため、**公開OSS 12 repositoryについてconclusiveなcompleted workflow runを各20件固定**し、`--strength 2`、time holdout 25%で評価しました。

- **12 repo中10 repoは、観測cellのaxis復元・workflow名render・active matrix familyの実job名照合をすべて100%解決**できました。残り2 repoはpartialで、検証済み削減結果には含めていません。
- 検証済みで削減が出たのは **pandas 34 → 32 cell (-7.2%)**、**Flask 12 → 10 (-13.6%)**、**Diesel 28 → 25 (-7.6%)** です。
- runner単価とjob単位の1分丸めがあるため、compute削減率と金額削減率は一致しません。standard runnerのrate-cardでは、pandas **$25.148 → $24.671/run (-1.9%)**、Flask **$0.132 → $0.120/run (-9.1%)**、Diesel **$11.624 → $11.450/run (-1.5%)** でした。3 repoともpublicなのでstandard runnerの推定GitHub請求額は**$0**のままです。
- pandasとDieselは、利用可能なbacktest期間で **holdout recall 100% / unseen-failure recall 100%** を維持しました。
- 完全解決できた10 repoのうち**7 repoは安全制約上「削らない」判定**でした。
- aiohttpとTokioはpartialのままです。unresolved cellを安全制約として個別保持するv0.9では、このsnapshotで **aiohttp 29 → 29 / Tokio 51 → 51** となり、どちらも検証済み削減には数えていません。

対象run IDは [benchmark/snapshot.json](benchmark/snapshot.json) に固定し、全結果は [benchmark/results.md](benchmark/results.md) に保存しています。この数値は固定snapshotに対する観測結果であり、将来のCI挙動を保証するものではありません。

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
- [x] empirical failure coverage recommendation
- [x] 観測済み1-wise / pairwise / t-wise safety constraint
- [x] time-based holdout backtest
- [x] static `include` / `exclude` 展開＋render済みjob名復元
- [ ] dynamic matrix / GitHub式の対応拡大
- [ ] 明示的なkeep / compatibility constraint
- [x] GitHub Action化＋PRコメント
- [x] matrix-heavy OSSでの再現可能benchmark
- [x] runner単価を含むmonetary cost model
- [ ] 1 job内のmulti-event failure fingerprint
- [ ] recommendation PR自動生成
- [ ] exact / stronger optimizer

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
