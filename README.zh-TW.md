# MatrixTrim

[![CI](https://github.com/eburairu/matrixtrim/actions/workflows/ci.yml/badge.svg)](https://github.com/eburairu/matrixtrim/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/eburairu/matrixtrim)](LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)
[![GitHub stars](https://img.shields.io/github/stars/eburairu/matrixtrim?style=flat)](https://github.com/eburairu/matrixtrim/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/eburairu/matrixtrim)](https://github.com/eburairu/matrixtrim/commits/main)

[English](README.md) | [简体中文](README.zh-CN.md) | **繁體中文** | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md)

**在保留真正有價值的 failure signal 前提下，縮小 GitHub Actions matrix。**

MatrixTrim 關心的不是單純把 job 數量砍到最低，而是：

> 哪些 matrix cell 真的抓到過其他 cell 抓不到的問題？哪些其實一直在重複發現相同的 failure？

目標是結合 **歷史 failure coverage、執行成本、matrix 結構與 holdout backtest**，提出更小、也更有依據的 CI matrix 候選方案。

> **目前狀態：v0.5 experimental。** 已支援 static matrix inspection、Actions 歷史讀取、failure fingerprinting、success/failure runtime history、static axis recovery、history-only recommendation，以及 time-based holdout backtest。

## 為什麼需要 MatrixTrim？

以下 matrix 每次執行就會產生 18 個 jobs：

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    node: [20, 22, 24]
    postgres: [14, 16]
```

CI 越跑越重時，團隊常會靠經驗刪組合。MatrixTrim 改用實際歷史資料來回答：

- 這個 cell 是否曾抓到其他 cell 沒抓到的 failure？
- 它是否大多只是在重複相同問題？
- 執行成本是多少？
- matrix 縮小後，在更新的 holdout 資料中還抓不抓得到 failure？

## 安裝

需要 Node.js 20+。

```bash
npm install
npm run build
```

## 查看本機 workflow

```bash
node dist/cli.js inspect .github/workflows
```

## 分析 GitHub Actions 歷史

讀取 Actions log 需要 GitHub token。

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js analyze owner/repo \
  --workflow ci.yml \
  --limit 100
```

從 v0.5 開始，MatrixTrim 會從**所有 completed run（包含成功 run）**取得 job metadata；只有失敗的 matrix job 才會進一步讀取 log 並建立 fingerprint。

例如：

```text
Matrix cell history
  test (20): runs=5, success=5, failure=0, runtime=13.0s, node=20
  test (22): runs=5, success=5, failure=0, runtime=12.0s, node=22
  test (24): runs=5, success=5, failure=0, runtime=10.0s, node=24
```

因此，一個從未失敗過的 cell 不會因為沒有 failure 就從分析 universe 中消失。

對 static matrix，MatrixTrim 也會盡可能還原 axis 名稱：

```text
test (ubuntu-latest, 22)
↓
os=ubuntu-latest
node=22
```

dynamic matrix 或複雜的 custom job name 則不硬猜，會保留為 unresolved。

## 建議更小的 matrix

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js recommend owner/repo \
  --workflow ci.yml \
  --limit 100
```

目前 recommendation 是 **history-only / experimental**。

它會選出一組 cell，使其：

1. 保留所有已分析歷史 failure fingerprint 的 coverage；
2. 每個 matrix job family 至少留下一個 cell；
3. 以 median runtime 作為成本，盡量降低估算的 CI compute。

目前使用 greedy weighted set cover。

## 用較新的 failure 做 backtest

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js backtest owner/repo \
  --workflow ci.yml \
  --limit 100 \
  --holdout 25
```

較舊的 run 用來挑選 cell，較新的 holdout run 則用來檢查：

- holdout failure 的整體 recall；
- **training 階段沒出現過的新 fingerprint** 的 recall；
- 被縮小後的 matrix 漏掉了哪些 failure。

runtime cost 只使用 training window 計算，避免把 holdout 的未來資訊洩漏進 selection。

## 真實案例：pytest

我們用一個真實的 `pytest-dev/pytest` GitHub Actions failure 做驗證：

- 31 個 failed jobs
- 其中 30 個是 matrix jobs
- 1 個 downstream aggregate job

表面上像 30 個不同 failure，但 root-cause normalization 後，30 個 cell 全部落在同一個 fingerprint：

```text
windows-py311 ─┐
ubuntu-py312  ─┤
macos-py314   ─┤
...            ├─ one failure fingerprint
30 cells ──────┘

ImportError: cannot import name '_resolve_args_directness'
from partially initialized module '_pytest.fixtures'
```

這代表**針對這個已觀察到的 failure**，30 個 cell 的訊號高度重複；不是在宣稱可以直接安全刪掉其中 29 個。

完整案例：[docs/case-study-pytest.md](docs/case-study-pytest.md)

## Failure Fingerprint

MatrixTrim 會移除 timestamp、絕對路徑、UUID、duration、line number 等易變資訊，再優先採用 Exception、Assertion、panic、compiler error、failing test 等更接近 root cause 的內容建立 fingerprint。

核心邏輯是 deterministic，不依賴 LLM。

## Roadmap

- [x] static GitHub Actions matrix inspection
- [x] CLI / JSON output
- [x] 包含成功 run 的 completed-run history
- [x] failure signature normalization / clustering
- [x] 每個 cell 的 success/failure/runtime history
- [x] static matrix axis recovery
- [x] history-only weighted set-cover recommendation
- [x] time-based holdout backtest
- [ ] 完整處理 `include` / `exclude`
- [ ] pairwise / t-wise coverage constraint
- [ ] 更強的 optimizer
- [ ] GitHub Action PR comment
- [ ] 自動產生 recommendation PR

## 設計原則

- **Evidence over intuition**
- **Deterministic core**
- **Explain every removal**
- **Backtest before trust**
- **Read-only by default**

## Contributing

歡迎 Issue 與 Pull Request。請參考 [CONTRIBUTING.md](CONTRIBUTING.md)。

## License

MIT
