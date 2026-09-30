# MatrixTrim

[![CI](https://github.com/eburairu/matrixtrim/actions/workflows/ci.yml/badge.svg)](https://github.com/eburairu/matrixtrim/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/eburairu/matrixtrim)](../../LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)
[![GitHub stars](https://img.shields.io/github/stars/eburairu/matrixtrim?style=flat)](https://github.com/eburairu/matrixtrim/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/eburairu/matrixtrim)](https://github.com/eburairu/matrixtrim/commits/main)

[English](../../README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | **日本語** | [한국어](README.ko.md) | [Español](README.es.md)

**GitHub Actions の巨大な matrix を、「本当に必要な failure signal」を残しながら小さくするためのOSSです。**

MatrixTrimが見たいのは、単純なjob数ではありません。

> そのmatrix cellは、他では見つからない障害を本当に検出しているのか？ それとも、別のcellと同じ障害を繰り返し見つけているだけなのか？

過去のfailure、実行コスト、matrix構造、holdout backtestを使って、より小さいCI matrix候補を作ることを目指しています。

> **Status: v0.15 experimental.** multi-event root-cause fingerprint、過去のfailure evidence、観測済み1-wise / pairwise / t-wise構成coverage、人間が明示するkeep / compatibility constraint、exact branch-and-bound optimizer、runtime costとrunner-awareな金額推定、time-based holdout backtest、render済みmatrix job名の復元、GitHub Action、再現可能な公開OSS benchmark、明示opt-inのdraft最適化PR生成まで利用できます。

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

v0.15では、direct / bracket形式の `matrix.*` 参照に加えて、比較・論理演算子、`format`、`contains`、`startsWith`、`endsWith`、`join`、`toJSON`、`fromJSON`、`case`、object filterまでdeterministicに評価します。dynamic matrixも観測済みjobを安全に識別できる場合は分析対象に含めますが、runtimeでしか得られない値は推測せず unresolved のまま保持し、自動rewriteも行いません。

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

`--strength 3` にすると、観測済みの3-wise組み合わせまで維持します。実際のmatrixに存在しなかった組み合わせを勝手に要求することはありません。

## exact optimizer

デフォルトの `--optimizer auto` はdeterministicなgreedy解を上限として使い、その後in-processのbranch-and-boundで、現在のcoverage要件を満たすruntime重み付き最小集合を証明します。既定の **250,000 node** を超えた場合、`auto` は明示的にgreedyへfallbackします。`--optimizer exact` は未証明解を返さずerrorにし、`--optimizer greedy` はexact探索を行いません。

ここでの「exact」は**現在のweighted set-cover modelに対して最適**という意味で、削除候補のenvironmentが将来のfailureを絶対に検出しないことを証明するものではありません。詳細は [Exact optimizer](../optimizer.md) を参照してください。

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

## multi-event failure fingerprint

1つのfailed matrix jobに独立したfailure signalが複数含まれる場合、MatrixTrimはそれぞれを別eventとして扱います。`Error X` と `Error Y` が同じjobに出ても `X+Y` という複合fingerprintにはせず、XとYを個別にcoverage対象へ入れます。typed error / exception、panic / fatal、segmentation faultなどの強いroot causeを優先し、それらが無い場合だけtest runnerのsummary行を使うため、明らかな二重計上を避けます。

同じroot causeの繰り返しはdedupし、1 jobあたり最大8個までに制限します。root-cause headlineを抽出できないlogでは従来のsingle-fingerprint heuristicへfallbackします。詳細は [Multi-event failure fingerprints](../fingerprints.md) を参照してください。

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
      optimizer: auto
      holdout: "25"
```

Actionは必ず **Step Summary** を生成します。Pull Request上では、権限があればMatrixTrimコメントを1件だけ作成・更新します。fork PRなどでtokenがread-onlyの場合、コメント作成だけwarning付きでskipし、分析自体は成功させます。

レポートには、現在cell数と推奨cell数、historical failure recall、failure event数 / multi-event job数、combinatorial coverage、推定compute削減率、runner-awareなrate-card / 推定請求額、holdout recall、unseen-failure recall、推奨cell一覧を表示します。

### draft最適化PRを作る（opt-in）

PR生成は**デフォルト無効**です。MatrixTrim自身にworkflow変更案まで作らせる場合だけ明示的に有効化します。

```yaml
permissions:
  actions: read
  contents: write
  pull-requests: write

steps:
  - uses: eburairu/matrixtrim@main
    with:
      workflow: ci.yml
      limit: "100"
      strength: "2"
      optimizer: auto
      holdout: "25"
      create-pr: "true"
```

生成するのは**draft PRだけ**で、auto-mergeはしません。選択したstatic cellを明示的な `matrix.include` へ変換し、書き込み前にworkflowをround-trip検証します。dynamic matrix、unresolved axis、不完全なworkflow/job名対応、coverage 100%未満、利用可能なholdout checkの失敗がある場合はPR生成を拒否します。pull_request / pull_request_target起動時も最適化PR生成は強制skipします。

## 明示的なhard constraint

履歴上は不要に見えても、互換性・サポート方針として必ず残したい環境は `.matrixtrim.yml` に書けます。

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

`keep` はrender済みmatrix cellを完全一致で固定します。`require` は条件に一致する観測済みcellを最低1つ残します。同じ条件をrecommendation、backtest、GitHub Action、draft最適化PR生成のすべてに適用します。条件が1件もmatchしない場合は黙って無視せずfail closedします。

configはrepositoryの**default branch**から読むため、信頼できないPull Requestが自分自身のconfigを書き換えて安全条件を弱めることもできません。詳細は [Explicit hard constraints](../constraints.md) を参照してください。

## runner-aware cost model

MatrixTrimはCI minuteをすべて同じ価値として扱わず、実際のrunner labelと観測したjob実行時間から金額影響を推定します。

- 現在のモデルで使用するstandard GitHub-hosted runnerの基準単価は、Linux 1-core x64 **$0.002/min**、Linux 2-core x64 **$0.006/min**、Linux 2-core arm64 **$0.005/min**、Windows x64/arm64 **$0.010/min**、standard macOS **$0.062/min** です。
- GitHub Actionsの課金仕様に合わせ、各jobの実行時間を1分単位へ切り上げてから金額化します。
- **public repository**ではstandard GitHub-hosted runnerは無料です。そのため推定GitHub請求額は**$0**とし、rate-cardは比較用の金額として別表示します。
- **private/internal repository**では、account/planに含まれる無料minuteを差し引く前のstandard runner overage相当額として表示します。
- self-hosted runnerのGitHub Actions請求は$0として扱い、larger runnerや判定できないrunnerは無理に単価を推測せずunpricedにします。
- 30日換算は、観測したrunの期間が**7日以上**ある場合だけ表示します。数時間分の履歴から月額を過剰に外挿しません。

料金根拠: [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) / [Actions runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing)

## 公開OSS benchmark

都合の良い実例だけで評価しないため、**公開OSS 12 repositoryについてconclusiveなcompleted workflow runを各20件固定**し、`--strength 2`、time holdout 25%で評価しました。

- **12 repo中10 repoは、観測cellのaxis復元・workflow名render・active matrix familyの実job名照合をすべて100%解決**できました。残り2 repoはpartialで、検証済み削減結果には含めていません。
- 検証済みで削減が出たのは **pandas 34 → 32 cell (-7.2%)**、**Flask 12 → 10 (-13.6%)**、**Diesel 28 → 25 (-8.3%)** です。
- runner単価とjob単位の1分丸めがあるため、compute削減率と金額削減率は一致しません。standard runnerのrate-cardでは、pandas **$25.148 → $24.671/run (-1.9%)**、Flask **$0.132 → $0.120/run (-9.1%)**、Diesel **$11.624 → $11.438/run (-1.6%)** でした。3 repoともpublicなのでstandard runnerの推定GitHub請求額は**$0**のままです。
- exact optimizerはbenchmark **12/12 repoでoptimalityを証明**し、greedy fallbackは **0件**、最大探索量は **102 nodes** でした。11 repoではgreedyと同値で、Dieselではgreedyのruntime目的値を **1.15%改善**し、compute削減率が約 **7.6% → 8.3%** になりました。pandasとViteは、利用可能なbacktest期間で **holdout recall 100% / unseen-failure recall 100%** を維持しました。Dieselも **holdout recall 100%** ですが、holdoutに未観測fingerprintが無かったためunseen-failure recallは **n/a** です。
- 固定snapshotの実ログでもevent-level抽出が動いており、**pandasは59 failed jobs → 151 events → 5 distinct root-cause fingerprints**、**Viteは8 → 25 → 23**、一方でRustのvolatile値と派生summaryを正規化した **Dieselは40 → 40 → 1** に収束しました。
- 完全解決できた10 repoのうち**7 repoは安全制約上「削らない」判定**でした。
- aiohttpとTokioはpartialのままです。unresolved cellを安全制約として個別保持する現在のrecommendationでは、このsnapshotで **aiohttp 29 → 29 / Tokio 51 → 51** となり、どちらも検証済み削減には数えていません。

対象run IDは [benchmark/snapshot.json](../../benchmark/snapshot.json) に固定し、全結果は [benchmark/results.md](../../benchmark/results.md) に保存しています。この数値は固定snapshotに対する観測結果であり、将来のCI挙動を保証するものではありません。

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

詳細: [pytest 実例ケーススタディ](../case-study-pytest.ja.md)

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
- [x] 観測済みdynamic matrix分析＋既知axis順序 / job名templateからの安全なaxis復元
- [x] deterministicなGitHub式関数＋bracket / object-filter対応
- [ ] opaque runtime outputのdeterministic evidence source
- [x] 明示的なkeep / compatibility constraint
- [x] GitHub Action化＋PRコメント
- [x] matrix-heavy OSSでの再現可能benchmark
- [x] runner単価を含むmonetary cost model
- [x] 1 job内のmulti-event failure fingerprint
- [x] opt-in draft recommendation PR生成
- [x] exact / stronger optimizer

## 設計原則

- **Evidence over intuition**
- **Deterministic core**
- **Explain every removal**
- **Backtest before trust**
- **Read-only by default**

## Contributing

Issue / Pull Request歓迎です。[CONTRIBUTING.md](../../CONTRIBUTING.md) を参照してください。

## License

MIT
