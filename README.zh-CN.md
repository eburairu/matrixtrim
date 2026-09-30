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

> **当前状态：v0.5 experimental。** 已支持静态 matrix 检查、Actions 历史读取、failure fingerprint、成功/失败运行时间统计、静态 axis 恢复、history-only recommendation 和按时间切分的 holdout backtest。

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

当前 recommendation 是 **history-only / experimental** 模式。

它会选择一组 cell，使其：

1. 覆盖所有已分析到的历史 failure fingerprint；
2. 每个 matrix job family 至少保留一个 cell；
3. 以 median runtime 作为成本，尽量降低估算的 CI 计算量。

当前使用 greedy weighted set cover。

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
- [x] history-only weighted set-cover recommendation
- [x] time-based holdout backtest
- [ ] 完整支持 `include` / `exclude`
- [ ] pairwise / t-wise coverage 约束
- [ ] 更强的优化器
- [ ] GitHub Action PR comment
- [ ] 自动生成 recommendation PR

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
