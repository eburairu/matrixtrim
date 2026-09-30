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

> **目前狀態：v0.8 experimental。** MatrixTrim 已能結合歷史 failure evidence、已觀測的 1-wise / pairwise / t-wise 組態 coverage、runtime cost、time-based holdout backtest、render 後 matrix job 名稱還原、GitHub Action，以及可重現的公開 OSS benchmark。

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

MatrixTrim 會從**所有 completed run（包含成功 run）**取得 job metadata；只有失敗的 matrix job 才會進一步讀取 log 並建立 fingerprint。

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

對 static matrix，MatrixTrim 可從直接的 `matrix.*` 表達式、`format(...)`、像 `matrix.name || matrix.python` 的 fallback 表達式，以及 include-only matrix 還原 render 後的 job 名稱。dynamic matrix 與尚未支援的 GitHub 表達式則維持 unresolved，不會硬猜。

## 建議更小的 matrix

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js recommend owner/repo \
  --workflow ci.yml \
  --limit 100
```

recommendation 仍然是 **experimental**。MatrixTrim 的核心不是自動刪除組合，而是衡量每個 configuration 實際提供多少 failure-detection value。

預設的 `--strength 2` 會同時保留：

1. 所有已分析的歷史 failure fingerprint；
2. 每個已解析 axis 的所有已觀測值（1-wise）；
3. 所有已觀測的 axis-value pair（pairwise）；
4. 每個 matrix job family 至少一個 cell；
5. 在上述限制下，盡量降低以 median runtime 估算的 compute。

使用 `--strength 3` 可進一步保留已觀測的 3-wise 組合。MatrixTrim 不會憑空要求原 matrix 中不存在的組合。目前 optimizer 使用 greedy weighted set cover。

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

## 作為 GitHub Action 使用

不需要 clone，也不需要在本機 build。

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

Action 一定會產生 **Step Summary**。在 Pull Request 上，若 token 權限允許，會建立或更新同一則 MatrixTrim 留言，不會每次新增一則。fork PR 等 read-only token 情況只會略過留言並顯示 warning，分析本身仍會成功。

報告包含目前/建議 cell 數、historical failure recall、combinatorial coverage、估算 compute 降幅、holdout recall、unseen-failure recall，以及建議保留的 cell。

## 公開 OSS benchmark

為了避免只挑對 MatrixTrim 有利的案例，我們固定了 **12 個公開 OSS repository各20次有明確結論的 completed workflow run**，以 `--strength 2` 與 25% time holdout 進行評估。

- **12 個 repo 中有 10 個完整解析**：觀測cell的axis還原、workflow名稱render、active matrix family的實際job名稱比對都達到100%；另外2個為 partial，不列入 validated reduction。
- 已驗證且有非零縮減的案例：**pandas 34 → 32 cells (-7.2%)**、**Flask 12 → 10 (-13.6%)**、**Diesel 28 → 25 (-7.6%)**。
- pandas 與 Diesel 在可用的 backtest 視窗中都維持 **100% holdout recall 與 100% unseen-failure recall**。
- 在10個完整解析的 repo 中，**有7個因安全限制而明確維持原matrix不變**。
- aiohttp 表面上可由29 → 14，但axis還原率只有41%、workflow名稱render coverage為75%、active family job名稱match率為42%，因此僅作為diagnostic，不視為validated結果。

所有run ID固定在 [benchmark/snapshot.json](benchmark/snapshot.json)，完整結果見 [benchmark/results.md](benchmark/results.md)。這些數字描述的是固定snapshot，不是對未來CI行為的保證。

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
- [x] empirical failure-coverage recommendation
- [x] 已觀測的 1-wise / pairwise / t-wise safety constraint
- [x] time-based holdout backtest
- [x] static `include` / `exclude` 展開與render後job名稱還原
- [ ] dynamic matrix / 更廣泛的GitHub表達式支援
- [ ] 明確的 keep / compatibility constraint
- [x] GitHub Action + PR comment
- [x] matrix-heavy OSS可重現benchmark
- [ ] runner-aware monetary cost model
- [ ] multi-event failure fingerprint
- [ ] 自動產生 recommendation PR
- [ ] 更強 / exact optimizer

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
