# MatrixTrim

[![CI](https://github.com/eburairu/matrixtrim/actions/workflows/ci.yml/badge.svg)](https://github.com/eburairu/matrixtrim/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/eburairu/matrixtrim)](LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)
[![GitHub stars](https://img.shields.io/github/stars/eburairu/matrixtrim?style=flat)](https://github.com/eburairu/matrixtrim/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/eburairu/matrixtrim)](https://github.com/eburairu/matrixtrim/commits/main)

[English](README.md) | **简体中文** | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md)

**在保留真正有价值的失败信号的前提下，缩小 GitHub Actions matrix。**

MatrixTrim 关注的不是“任务越少越好”，而是一个更实际的问题：

> 哪些 matrix cell 确实发现过独有的问题？哪些只是在重复发现其他 cell 已经能发现的失败？

目标是结合 **历史失败覆盖、运行成本、matrix 结构和 holdout 回测**，给出更小、更有依据的 CI matrix 候选方案。

> **当前状态：v0.7 experimental。** recommendation 会同时考虑历史 failure evidence、已观测的 1-wise / pairwise / t-wise 配置覆盖、runtime cost 和 time-based holdout backtest，并可通过 GitHub Action 直接把结果反馈到 Pull Request。

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

从 v0.5 开始，MatrixTrim 会从**所有已完成的 run（包括成功 run）**中读取 job metadata；只有失败的 matrix job 才会进一步下载日志做 fingerprint 分析。

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

对于 dynamic matrix 或复杂的自定义 job name，不会强行猜测，而是标记为 unresolved。

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

使用 `--strength 3` 可以进一步保留已观测的 3-wise 组合。MatrixTrim 不会凭空制造原 matrix 中不存在的组合。当前优化器是 greedy weighted set cover。

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
      holdout: "25"
```

Action 一定会生成 **Step Summary**。在 Pull Request 中，如果 token 权限允许，还会创建或更新同一条 MatrixTrim 评论，不会每次都新增评论。对于 fork PR 等 read-only token 场景，只会跳过评论并给出 warning，分析本身仍然成功。

报告会显示当前/建议 cell 数、historical failure recall、combinatorial coverage、估算 compute 降幅、holdout recall、unseen-failure recall 以及建议保留的 cell。

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

详细案例：[docs/case-study-pytest.md](docs/case-study-pytest.md)

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
- [ ] 完整支持 `include` / `exclude`
- [ ] 显式 keep / compatibility constraint
- [x] GitHub Action + PR comment
- [ ] 在 matrix-heavy OSS 上做 benchmark
- [ ] runner-aware monetary cost model
- [ ] multi-event failure fingerprint
- [ ] 自动生成 recommendation PR
- [ ] 更强 / exact optimizer

## 设计原则

- **Evidence over intuition**
- **Deterministic core**
- **Explain every removal**
- **Backtest before trust**
- **Read-only by default**

## Contributing

欢迎提交 Issue 和 Pull Request。请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)。

## License

MIT
