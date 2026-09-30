# MatrixTrim

[![CI](https://github.com/eburairu/matrixtrim/actions/workflows/ci.yml/badge.svg)](https://github.com/eburairu/matrixtrim/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/eburairu/matrixtrim)](../../LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)
[![GitHub stars](https://img.shields.io/github/stars/eburairu/matrixtrim?style=flat)](https://github.com/eburairu/matrixtrim/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/eburairu/matrixtrim)](https://github.com/eburairu/matrixtrim/commits/main)

[English](../../README.md) | [简体中文](README.zh-CN.md) | **繁體中文** | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md)

**在保留真正有價值的 failure signal 前提下，縮小 GitHub Actions matrix。**

MatrixTrim 關心的不是單純把 job 數量砍到最低，而是：

> 哪些 matrix cell 真的抓到過其他 cell 抓不到的問題？哪些其實一直在重複發現相同的 failure？

目標是結合 **歷史 failure coverage、執行成本、matrix 結構與 holdout backtest**，提出更小、也更有依據的 CI matrix 候選方案。

> **目前狀態：v0.16 experimental。** MatrixTrim 已能結合 multi-event root-cause fingerprint、歷史 failure evidence、已觀測的 1-wise / pairwise / t-wise 組態 coverage、人為明確指定的 keep / compatibility constraint、exact branch-and-bound optimizer、runtime cost 與 runner-aware 金額估算、time-based holdout backtest、render 後 matrix job 名稱還原、GitHub Action、可重現的公開 OSS benchmark，以及明確 opt-in 的 draft 最佳化 PR 產生。

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

v0.16 在 v0.15 的deterministic GitHub expression求值基礎上，可透過明確的 `mode: capture` step 將執行時 `toJSON(matrix)` 保存到 Check Run annotation，並在後續分析中精確還原。capture為opt-in，未啟用的job不會增加annotation API call。沒有runtime evidence時仍維持 unresolved，dynamic matrix也不會自動rewrite。

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

使用 `--strength 3` 可進一步保留已觀測的 3-wise 組合。MatrixTrim 不會憑空要求原 matrix 中不存在的組合。

## exact optimizer

預設的 `--optimizer auto` 會先取得deterministic greedy解，再用process內的branch-and-bound證明目前coverage限制下runtime加權成本最低的cell集合。若搜尋超過預設 **250,000 nodes**，`auto` 會明確fallback到greedy；`--optimizer exact` 則會報錯，不會回傳尚未證明的結果；`--optimizer greedy` 會略過exact搜尋。

這裡的「exact」只表示**對目前weighted set-cover model最優**，並不代表被移除的environment未來絕對不會抓到新failure。完整說明請見 [Exact optimizer](../optimizer.md)。

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

## multi-event failure fingerprint

一個 failed matrix job 可能同時包含多個獨立的 failure signal。MatrixTrim 現在會把強 root cause 分別產生 fingerprint，因此同一個 job 裡的 `Error X` 與 `Error Y` 會成為兩個 event，而不是單一不透明的 `X+Y` 組合 fingerprint。typed error / exception、panic / fatal、segmentation fault 等強 root cause會優先使用；只有找不到強 root cause時才使用test runner的summary行，以避免明顯的重複計數。

相同normalized root cause重複出現時會dedup，每個job最多保留8個不同event。若無法辨識root-cause headline，則fallback到原本的single-fingerprint heuristic。完整說明請見 [Multi-event failure fingerprints](../fingerprints.md)。

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
      optimizer: auto
      holdout: "25"
```

Action 一定會產生 **Step Summary**。在 Pull Request 上，若 token 權限允許，會建立或更新同一則 MatrixTrim 留言，不會每次新增一則。fork PR 等 read-only token 情況只會略過留言並顯示 warning，分析本身仍會成功。

報告包含目前/建議 cell 數、historical failure recall、failure event 數 / multi-event job 數、combinatorial coverage、估算 compute 降幅、runner-aware rate-card / 估算費用、holdout recall、unseen-failure recall，以及建議保留的 cell。

### 產生 draft 最佳化 PR（opt-in）

PR 產生功能**預設關閉**。只有在希望 MatrixTrim 直接提出 workflow 修改時才明確啟用。

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

MatrixTrim 只會建立 **draft PR**，不會自動合併。它會把選中的 static cell 改寫成明確的 `matrix.include` 列，並在寫入前對 workflow 做 round-trip 驗證。只要存在 dynamic matrix、未解析 axis、workflow/job 名稱對應不完整、coverage 低於 100%，或已有 holdout 檢查未通過，就會拒絕產生 PR。由 `pull_request` / `pull_request_target` 觸發的 run 也會強制略過最佳化 PR 建立。

## 明確的 hard constraint

若某些環境即使從歷史資料看似重複，仍必須因相容性或支援政策保留，可以在 `.matrixtrim.yml` 中宣告。

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

`keep` 會固定一個完整相符的render後matrix cell；`require` 則保證至少保留一個符合條件的已觀測cell。同一套政策會套用到recommendation、backtest、GitHub Action與draft最佳化PR。若規則完全match不到任何cell，MatrixTrim會fail closed，而不是靜默忽略。

config會從repository的 **default branch** 讀取，因此不受信任的Pull Request不能藉由修改自己的config來削弱MatrixTrim安全政策。完整語意請見 [Explicit hard constraints](../constraints.md)。

## runner-aware cost model

MatrixTrim 不再把所有 CI minute 視為相同成本，而是依實際 runner label 與已觀測的 job 執行時間估算金額影響。

- 目前模型使用的 standard GitHub-hosted runner 基準費率：Linux 1-core x64 **$0.002/min**、Linux 2-core x64 **$0.006/min**、Linux 2-core arm64 **$0.005/min**、Windows x64/arm64 **$0.010/min**、standard macOS **$0.062/min**。
- 依 GitHub Actions 的計費方式，每個 job 會先向上取整到完整分鐘後再計價。
- 對 **public repository**，standard GitHub-hosted runner 免費，因此估算的 GitHub 實際費用顯示為 **$0**；rate-card 金額僅作為比較值。
- 對 **private/internal repository**，顯示的是尚未扣除 account/plan 內含 minutes 前的 standard runner overage 等價金額。
- self-hosted runner 的 GitHub Actions 費用以 $0 處理；larger runner 或無法辨識的 runner 不會硬猜價格，而會保留為 unpriced。
- 只有在觀測到的 run 時間窗達到 **7 天以上**時才顯示 30 天推估，避免用幾小時的歷史資料過度外推月成本。

價格依據：[GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) / [Actions runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing)

## 公開 OSS benchmark

為了避免只挑對 MatrixTrim 有利的案例，我們固定了 **12 個公開 OSS repository各20次有明確結論的 completed workflow run**，以 `--strength 2` 與 25% time holdout 進行評估。

- **12 個 repo 中有 10 個完整解析**：觀測cell的axis還原、workflow名稱render、active matrix family的實際job名稱比對都達到100%；另外2個為 partial，不列入 validated reduction。
- 已驗證且有非零縮減的案例：**pandas 34 → 32 cells (-7.2%)**、**Flask 12 → 10 (-13.6%)**、**Diesel 28 → 25 (-8.3%)**。
- 因為 runner 單價與每個 job 的整分鐘向上取整，compute 縮減率不會等於金額縮減率。依 standard runner rate-card：pandas **$25.148 → $24.671/run (-1.9%)**、Flask **$0.132 → $0.120/run (-9.1%)**、Diesel **$11.624 → $11.438/run (-1.6%)**。這三個 repo 都是 public，因此 standard runner 的估算 GitHub 實際費用仍為 **$0**。
- exact optimizer 在 benchmark **12/12 個 repo 中證明 optimality**，greedy fallback 為 **0 次**，最大搜尋量為 **102 nodes**。其中11個repo與greedy相同；Diesel的greedy runtime目標值改善了 **1.15%**，compute縮減率從約 **7.6% 提升到 8.3%**。pandas 與 Vite 在可用的 backtest 視窗中都維持 **100% holdout recall 與 100% unseen-failure recall**。Diesel 也維持 **100% holdout recall**；因為 holdout 中沒有新的 fingerprint，所以 unseen-failure recall 為 **n/a**。
- 固定 snapshot 的真實log也驗證event-level抽取：**pandas 59個 failed jobs → 151 events → 5個不同root-cause fingerprints**，**Vite 8 → 25 → 23**；而在正規化Rust volatile值與派生summary後，**Diesel 40 → 40 → 1**。
- 在10個完整解析的 repo 中，**有7個因安全限制而明確維持原matrix不變**。
- aiohttp 與 Tokio 仍是 partial。目前的 recommendation 會把 unresolved cell 當成安全限制逐一保留，因此此 snapshot 為 **aiohttp 29 → 29 / Tokio 51 → 51**，兩者都不列入 validated reduction。

所有run ID固定在 [benchmark/snapshot.json](../../benchmark/snapshot.json)，完整結果見 [benchmark/results.md](../../benchmark/results.md)。這些數字描述的是固定snapshot，不是對未來CI行為的保證。

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

完整案例：[docs/case-study-pytest.md](../case-study-pytest.md)

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
- [x] 已觀測 dynamic matrix 分析＋從已知 axis 順序 / job 名 template 安全還原 axis
- [x] deterministic GitHub 表達式函數＋bracket / object-filter 支援
- [x] 透過 Check Run annotation 提供opt-in deterministic runtime matrix evidence capture
- [x] 明確的 keep / compatibility constraint
- [x] GitHub Action + PR comment
- [x] matrix-heavy OSS可重現benchmark
- [x] runner-aware monetary cost model
- [x] multi-event failure fingerprint
- [x] opt-in draft recommendation PR 產生
- [x] 更強 / exact optimizer

## 設計原則

- **Evidence over intuition**
- **Deterministic core**
- **Explain every removal**
- **Backtest before trust**
- **Read-only by default**

## Contributing

歡迎 Issue 與 Pull Request。請參考 [CONTRIBUTING.md](../../CONTRIBUTING.md)。

## License

MIT
