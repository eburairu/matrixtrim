# MatrixTrim

[![CI](https://github.com/eburairu/matrixtrim/actions/workflows/ci.yml/badge.svg)](https://github.com/eburairu/matrixtrim/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/eburairu/matrixtrim)](../../LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)
[![GitHub stars](https://img.shields.io/github/stars/eburairu/matrixtrim?style=flat)](https://github.com/eburairu/matrixtrim/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/eburairu/matrixtrim)](https://github.com/eburairu/matrixtrim/commits/main)

[English](../../README.md) | **简体中文** | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md)

**在保留真正有价值的失败信号的前提下，缩小 GitHub Actions matrix。**

MatrixTrim 关注的不是“任务越少越好”，而是一个更实际的问题：

> 哪些 matrix cell 确实发现过独有的问题？哪些只是在重复发现其他 cell 已经能发现的失败？

目标是结合 **历史失败覆盖、运行成本、matrix 结构和 holdout 回测**，给出更小、更有依据的 CI matrix 候选方案。

> **当前状态：v0.16 experimental。** MatrixTrim 已可结合 multi-event root-cause fingerprint、历史 failure evidence、已观测的 1-wise / pairwise / t-wise 配置覆盖、人工显式 keep / compatibility constraint、exact branch-and-bound optimizer、runtime cost 与 runner-aware 金额估算、time-based holdout backtest、渲染后 matrix job 名恢复、GitHub Action、可复现的公开 OSS benchmark，以及显式 opt-in 的 draft 优化 PR 生成。

## 为什么需要 MatrixTrim？

下面这个 matrix 每次运行就会产生 18 个 job：

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    node: [20, 22, 24]
    postgres: [14, 16]
```

CI 变慢之后，团队通常会凭经验删组合。MatrixTrim 更希望基于事实判断：

- 这个 cell 是否发现过其他 cell 没发现的问题？
- 它是不是长期只在重复相同 failure？
- 它的运行成本是多少？
- 缩小 matrix 后，在更新的 holdout 数据里还能不能抓到 failure？

## 安装

需要 Node.js 20+。

```bash
npm install
npm run build
```

## 查看本地 workflow

```bash
node dist/cli.js inspect .github/workflows
```

## 分析 GitHub Actions 历史

读取 Actions log 需要 GitHub token。

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js analyze owner/repo \
  --workflow ci.yml \
  --limit 100
```

MatrixTrim 会从**所有已完成的 run（包括成功 run）**中读取 job metadata；只有失败的 matrix job 才会进一步下载日志做 fingerprint 分析。

示例：

```text
Matrix cell history
  test (20): runs=5, success=5, failure=0, runtime=13.0s, node=20
  test (22): runs=5, success=5, failure=0, runtime=12.0s, node=22
  test (24): runs=5, success=5, failure=0, runtime=10.0s, node=24
```

因此，一个从未失败过的 cell 不会因为“没有 failure”而从分析范围中消失。

对于静态 matrix，MatrixTrim 也会尽量恢复 axis 名：

```text
test (ubuntu-latest, 22)
↓
os=ubuntu-latest
node=22
```

v0.16 在 v0.15 的确定性 GitHub 表达式求值基础上，允许通过显式 `mode: capture` step 将运行时 `toJSON(matrix)` 保存到 Check Run annotation，并在后续分析中精确恢复。capture 为 opt-in，未启用的 job 不会增加 annotation API 调用。没有 runtime evidence 时仍保持 unresolved，dynamic matrix 也不会自动 rewrite。

## 推荐更小的 matrix

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js recommend owner/repo \
  --workflow ci.yml \
  --limit 100
```

recommendation 仍然是 **experimental**。MatrixTrim 的核心价值不是自动删掉组合，而是衡量每个 configuration 实际提供了多少 failure-detection value。

默认使用 `--strength 2`，会同时保留：

1. 所有已分析的历史 failure fingerprint；
2. 每个已解析 axis 的所有已观测值（1-wise）；
3. 所有已观测的 axis-value pair（pairwise）；
4. 每个 matrix job family 至少一个 cell；
5. 在这些约束下尽量降低基于 median runtime 的估算 compute。

使用 `--strength 3` 可以进一步保留已观测的 3-wise 组合。MatrixTrim 不会凭空制造原 matrix 中不存在的组合。

## exact optimizer

默认的 `--optimizer auto` 会先得到确定性的greedy解，再用进程内branch-and-bound证明当前coverage约束下runtime加权成本最低的cell集合。如果搜索超过默认 **250,000 nodes**，`auto` 会明确回退到greedy；`--optimizer exact` 则直接报错而不会返回未经证明的结果；`--optimizer greedy` 会跳过exact搜索。

这里的“exact”只表示**对当前weighted set-cover模型最优**，并不证明被移除的environment未来绝不可能发现新failure。完整说明见 [Exact optimizer](../optimizer.md)。

## 用更新的 failure 做回测

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js backtest owner/repo \
  --workflow ci.yml \
  --limit 100 \
  --holdout 25
```

MatrixTrim 会使用较旧的 run 来选择 cell，再用较新的 holdout run 检查：

- holdout failure 的总体 recall；
- **训练阶段没有出现过的新 fingerprint** 的 recall；
- 被选中 matrix 漏掉了哪些 failure。

runtime cost 只使用 training window 计算，避免从 holdout 偷看未来信息。

## multi-event failure fingerprint

一个 failed matrix job 可能包含多个独立的 failure signal。MatrixTrim 现在会把强 root cause 分别生成 fingerprint，因此同一个 job 中的 `Error X` 与 `Error Y` 会成为两个 event，而不是一个不透明的 `X+Y` 组合 fingerprint。typed error / exception、panic / fatal、segmentation fault 等强 root cause 优先；只有找不到强 root cause 时才使用 test runner 的 summary 行，从而避免明显的重复计数。

同一 normalized root cause 的重复出现会被去重，每个 job 最多保留 8 个不同 event。如果无法识别 root-cause headline，则回退到原有 single-fingerprint heuristic。详情见 [Multi-event failure fingerprints](../fingerprints.md)。

## 作为 GitHub Action 使用

无需 clone，也无需本地 build。

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

Action 一定会生成 **Step Summary**。在 Pull Request 中，如果 token 权限允许，还会创建或更新同一条 MatrixTrim 评论，不会每次都新增评论。对于 fork PR 等 read-only token 场景，只会跳过评论并给出 warning，分析本身仍然成功。

报告会显示当前/建议 cell 数、historical failure recall、failure event 数 / multi-event job 数、combinatorial coverage、估算 compute 降幅、runner-aware rate-card / 预计费用、holdout recall、unseen-failure recall 以及建议保留的 cell。

### 生成 draft 优化 PR（opt-in）

PR 生成功能**默认关闭**。只有在希望 MatrixTrim 直接提出 workflow 修改时才显式开启。

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

MatrixTrim 只会创建 **draft PR**，绝不会自动合并。它会把选中的 static cell 改写成显式的 `matrix.include` 行，并在写入前对 workflow 做 round-trip 校验。只要存在 dynamic matrix、未解析 axis、workflow/job 名映射不完整、coverage 低于 100%，或已有 holdout 检查未通过，就会拒绝生成 PR。由 `pull_request` / `pull_request_target` 触发的 run 也会强制跳过优化 PR 创建。

## 显式 hard constraint

如果某些环境即使历史数据看起来冗余，也必须因为兼容性或支持策略继续保留，可以在 `.matrixtrim.yml` 中声明。

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

`keep` 会固定一个精确的渲染后 matrix cell；`require` 会确保至少保留一个符合条件的已观测 cell。同一套策略会用于 recommendation、backtest、GitHub Action 和 draft 优化 PR。规则如果一个 cell 都匹配不到，会直接 fail closed，而不是静默忽略。

配置从仓库的 **default branch** 读取，因此不受信任的 Pull Request 不能通过修改自身 config 来削弱 MatrixTrim 的安全策略。完整语义见 [Explicit hard constraints](../constraints.md)。

## runner-aware cost model

MatrixTrim 不再把所有 CI minute 当成相同成本，而是根据实际 runner label 和已观测的 job 执行时间估算金额影响。

- 当前模型使用的 standard GitHub-hosted runner 基准费率：Linux 1-core x64 **$0.002/min**、Linux 2-core x64 **$0.006/min**、Linux 2-core arm64 **$0.005/min**、Windows x64/arm64 **$0.010/min**、standard macOS **$0.062/min**。
- 按 GitHub Actions 的计费规则，每个 job 会先向上取整到整分钟再计算费用。
- 对 **public repository**，standard GitHub-hosted runner 免费，因此预计 GitHub 实际费用显示为 **$0**；rate-card 金额仅作为对比值。
- 对 **private/internal repository**，显示的是扣除账号/套餐自带 minutes 之前的 standard runner overage 等价值。
- self-hosted runner 的 GitHub Actions 费用按 $0 处理；larger runner 或无法识别的 runner 不会猜测价格，而是保留为 unpriced。
- 只有当已观测 run 的时间窗口达到 **7 天以上**时才给出 30 天预测，避免用几小时的历史数据过度外推月成本。

价格依据：[GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) / [Actions runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing)

## 公开 OSS benchmark

为了避免只挑对 MatrixTrim 有利的例子，我们固定了 **12 个公开 OSS 仓库中各 20 次有明确结论的 completed workflow run**，使用 `--strength 2` 和 25% time holdout 进行评估。

- **12 个仓库中有 10 个完全解析**：已观测 axis 恢复、workflow 名渲染、active matrix family 的实际 job 名匹配均达到 100%；另外 2 个为 partial，不计入已验证的缩减结果。
- 已验证且出现非零缩减的案例：**pandas 34 → 32 cells (-7.2%)**、**Flask 12 → 10 (-13.6%)**、**Diesel 28 → 25 (-8.3%)**。
- 由于 runner 单价和每个 job 的整分钟向上取整，compute 缩减率并不等于金额缩减率。按 standard runner rate-card 计算：pandas **$25.148 → $24.671/run (-1.9%)**、Flask **$0.132 → $0.120/run (-9.1%)**、Diesel **$11.624 → $11.438/run (-1.6%)**。这三个仓库都是 public，因此 standard runner 的预计 GitHub 实际费用仍为 **$0**。
- exact optimizer 在 benchmark **12/12 个仓库中证明了 optimality**，greedy fallback 为 **0 次**，最大搜索量为 **102 nodes**。其中 11 个仓库与 greedy 相同；Diesel 的 greedy runtime 目标值改善了 **1.15%**，compute 缩减率从约 **7.6% 提升到 8.3%**。pandas 和 Vite 在可用的 backtest 窗口中都保持了 **100% holdout recall 和 100% unseen-failure recall**。Diesel 也保持 **100% holdout recall**；由于 holdout 中没有新的 fingerprint，unseen-failure recall 为 **n/a**。
- 固定 snapshot 的真实日志也验证了 event-level 提取：**pandas 59 个 failed jobs → 151 events → 5 个不同 root-cause fingerprints**，**Vite 8 → 25 → 23**；而对 Rust volatile 值和派生 summary 进行归一化后，**Diesel 40 → 40 → 1**。
- 在 10 个完全解析的仓库中，**有 7 个被安全约束明确判断为“不应缩减”**。
- aiohttp 和 Tokio 仍属于 partial。当前 recommendation 会把 unresolved cell 作为安全约束逐个保留，因此在这个 snapshot 中为 **aiohttp 29 → 29 / Tokio 51 → 51**，两者都不计入 validated reduction。

所有 run ID 固定在 [benchmark/snapshot.json](../../benchmark/snapshot.json)，完整结果见 [benchmark/results.md](../../benchmark/results.md)。这些数字描述的是固定 snapshot，不代表对未来 CI 行为的保证。

## 真实案例：pytest

我们用一次真实的 `pytest-dev/pytest` GitHub Actions failure 做了验证：

- 31 个 failed jobs
- 其中 30 个是 matrix jobs
- 1 个是下游 aggregate job

表面上看像是 30 个不同 failure，但做 root-cause normalization 后，30 个 cell 实际上归并成同一个 fingerprint：

```text
windows-py311 ─┐
ubuntu-py312  ─┤
macos-py314   ─┤
...            ├─ one failure fingerprint
30 cells ──────┘

ImportError: cannot import name '_resolve_args_directness'
from partially initialized module '_pytest.fixtures'
```

这说明**对于这一个已观察到的 failure**，30 个 cell 存在明显冗余；并不代表可以直接安全删除其中 29 个。

详细案例：[docs/case-study-pytest.md](../case-study-pytest.md)

## Failure Fingerprint

MatrixTrim 会去除 timestamp、绝对路径、UUID、duration、line number 等易变化信息，再优先提取 Exception、Assertion、panic、compiler error、failing test 等更接近 root cause 的内容生成 fingerprint。

核心逻辑是 deterministic 的，不依赖 LLM。

## Roadmap

- [x] 静态 GitHub Actions matrix 检查
- [x] CLI / JSON 输出
- [x] 包含成功 run 的 completed-run 历史
- [x] failure signature normalization / clustering
- [x] 每个 cell 的 success/failure/runtime 历史
- [x] 静态 matrix axis 恢复
- [x] empirical failure-coverage recommendation
- [x] 已观测的 1-wise / pairwise / t-wise safety constraint
- [x] time-based holdout backtest
- [x] static `include` / `exclude` 展开与渲染后job名恢复
- [x] 已观测 dynamic matrix 分析 + 从已知 axis 顺序 / job 名模板安全恢复 axis
- [x] deterministic GitHub 表达式函数 + bracket / object-filter 支持
- [x] 通过 Check Run annotation 实现 opt-in 的 deterministic runtime matrix evidence capture
- [x] 显式 keep / compatibility constraint
- [x] GitHub Action + PR comment
- [x] 在 matrix-heavy OSS 上完成可复现 benchmark
- [x] runner-aware monetary cost model
- [x] multi-event failure fingerprint
- [x] opt-in draft recommendation PR 生成
- [x] 更强 / exact optimizer

## 设计原则

- **Evidence over intuition**
- **Deterministic core**
- **Explain every removal**
- **Backtest before trust**
- **Read-only by default**

## Contributing

欢迎提交 Issue 和 Pull Request。请参阅 [CONTRIBUTING.md](../../CONTRIBUTING.md)。

## License

MIT
