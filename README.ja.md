# MatrixTrim

[English](README.md) | **日本語**

**GitHub Actions の大きな matrix を、「過去に実際に見つけた障害」をなるべく失わずに縮約するためのOSSです。**

MatrixTrim が答えたいのは、次の問いです。

> この CI matrix の各セルは、本当に別々の障害を見つけているのか？ それとも複数セルがずっと同じ障害を重複して検出しているのか？

最終的には、過去の failure、組み合わせ網羅性（pairwise / t-wise）、実行時間、holdout backtest を使って、**必要十分な CI matrix 候補**を提示することを目標にしています。

> **Status: v0.3 experimental.** static matrix解析、GitHub Actions履歴取得、failure fingerprinting、unique failure集計、history-only recommendationまで動作します。

## なぜ必要か

例えば次のmatrixは、一見小さく見えても18セルあります。

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    node: [20, 22, 24]
    postgres: [14, 16]
```

CIが重くなると、人間は経験則で「Linuxだけ全バージョン」「Windows/macOSは最新版だけ」のように削り始めます。MatrixTrimはこれを、**そのセルが過去に何を見つけたか**という実績から判断できるようにします。

## セットアップ

Node.js 20+ が必要です。

```bash
npm install
npm run build
```

## ローカルworkflowのmatrixを確認

```bash
node dist/cli.js inspect .github/workflows
```

例:

```text
.github/workflows/ci.yml
  test: 9 base cells
    axes: os=3, node=3
    include=0, exclude=0
```

## GitHub Actions履歴を解析

Job logの取得には、Actions logを読めるGitHub tokenが必要です。GitHub CLIを使っている場合:

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js analyze owner/repo \
  --workflow ci.yml \
  --limit 100
```

特定runだけ確認することもできます。

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js analyze owner/repo --run 123456789
```

`--json` を付けると機械可読JSONを出力します。

## matrix縮約候補を出す

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js recommend owner/repo \
  --workflow ci.yml \
  --limit 100
```

現在の `recommend` は **history-only experimental mode** です。現時点では、次の制約で greedy weighted set cover を行います。

1. 解析できた過去のfailure fingerprintをすべて検出できるセルを残す
2. 各matrix job familyについて最低1セルは残す
3. 各セルのmedian runtimeをコストとして、より少ない計算量で上記を満たす集合を選ぶ

例:

```text
Mode:       history-only (experimental)
Historical failure recall: 18/18 (100.0%)
Matrix cells: 24 -> 9
Estimated compute: 1520.0s -> 611.0s
Estimated reduction: 59.8%
```

これは「9セルだけで将来も安全」という意味ではありません。**解析できた過去の18種類の障害は、この9セルでも全部検出できた**という意味です。pairwise/t-wise coverageやholdout backtestingは今後追加します。

## 実例: pytest

開発中に `pytest-dev/pytest` の実際のGitHub Actions failure runを解析しました。

- Run: https://github.com/pytest-dev/pytest/actions/runs/36195406393
- failed jobs: 31
- matrix jobs: 30
- downstream `check` job: 1

最初は30個すべて別failureに見えましたが、root causeを正規化すると、30セルすべてが実際には同じ障害でした。

```text
Windows / Python 3.11 ─┐
Ubuntu  / Python 3.12 ─┤
macOS   / Python 3.14 ─┤
...                     ├─ 1 failure fingerprint
30 matrix cells ────────┘

ImportError:
cannot import name '_resolve_args_directness'
from partially initialized module '_pytest.fixtures'
```

つまり、この障害1件を検出するという観点だけなら、**30セルは30個の異なるシグナルを提供していませんでした**。MatrixTrimはこのような重複を履歴から見つけます。

詳細: [pytest 実例ケーススタディ](docs/case-study-pytest.ja.md)

## Failure Fingerprint

MatrixTrimはjob logからtimestamp、workspace path、OSごとの絶対パス、line/column、UUID、durationなどの揺れる情報を除去し、Exception / Error / Assertion / panic / compiler error / failing testなどのroot-cause headlineを優先してfingerprintを作ります。

LLMは使用しません。coreはdeterministicです。

## 現在のロードマップ

- [x] static GitHub Actions matrix解析
- [x] CLI / JSON出力
- [x] Actions run履歴取得
- [x] failed job log取得
- [x] Failure signature正規化・クラスタリング
- [x] matrix cellごとのunique failure集計
- [x] runtime集計
- [x] history-only weighted set-cover recommendation
- [ ] `include` / `exclude` の完全展開
- [ ] historical job名からmatrix axis名を復元
- [ ] pairwise / t-wise coverage
- [ ] exact / improved optimizer
- [ ] holdout backtesting
- [ ] GitHub ActionとしてPRへコメント
- [ ] recommendation PR自動生成

## 設計原則

- **Deterministic core** — 最適化にLLMを必須にしない
- **Explain every removal** — 根拠なしにセルを削除しない
- **Backtest before trust** — 過去へのfitだけで安全と主張しない
- **Read-only by default** — 明示操作なしにworkflowを書き換えない
- **Evidence over intuition** — 経験則ではなく実際のfailure historyを見る

## Contributing

Issue / Pull Request歓迎です。[CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## License

MIT
