# MatrixTrim

[![CI](https://github.com/eburairu/matrixtrim/actions/workflows/ci.yml/badge.svg)](https://github.com/eburairu/matrixtrim/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/eburairu/matrixtrim)](LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)
[![GitHub stars](https://img.shields.io/github/stars/eburairu/matrixtrim?style=flat)](https://github.com/eburairu/matrixtrim/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/eburairu/matrixtrim)](https://github.com/eburairu/matrixtrim/commits/main)

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | **한국어** | [Español](README.es.md)

**실제로 필요한 failure signal은 남기고, GitHub Actions matrix는 더 작게.**

MatrixTrim은 단순히 job 수를 줄이는 도구가 아닙니다. 핵심 질문은 다음과 같습니다.

> 어떤 matrix cell이 정말로 고유한 failure를 잡아냈고, 어떤 cell은 다른 환경에서 이미 잡히는 failure를 반복해서 발견하고 있을까?

목표는 **과거 failure coverage, 실행 비용, matrix 구조, holdout backtest**를 바탕으로 더 작은 CI matrix 후보를 제안하는 것입니다.

> **현재 상태: v0.6 experimental.** 과거 failure evidence에 관측된 1-wise / pairwise / t-wise configuration coverage, runtime cost, time-based holdout backtest를 함께 적용해 recommendation을 만들 수 있습니다.

## 왜 MatrixTrim인가?

다음 matrix는 실행할 때마다 18개의 job을 만듭니다.

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    node: [20, 22, 24]
    postgres: [14, 16]
```

CI가 느려지면 보통 경험적으로 조합을 줄입니다. MatrixTrim은 대신 실제 기록을 봅니다.

- 이 cell만 잡아낸 failure가 있었는가?
- 다른 cell과 같은 failure를 계속 중복해서 잡고 있는가?
- 실행 비용은 얼마나 되는가?
- matrix를 줄인 뒤에도 더 최신의 failure를 잡을 수 있는가?

## 설치

Node.js 20+가 필요합니다.

```bash
npm install
npm run build
```

## 로컬 workflow 확인

```bash
node dist/cli.js inspect .github/workflows
```

## GitHub Actions 이력 분석

Actions log를 읽을 수 있는 GitHub token이 필요합니다.

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js analyze owner/repo \
  --workflow ci.yml \
  --limit 100
```

v0.5부터는 **성공한 run을 포함한 모든 completed run에서 job metadata를 수집**합니다. 실제 log 분석은 실패한 matrix job에만 수행합니다.

예:

```text
Matrix cell history
  test (20): runs=5, success=5, failure=0, runtime=13.0s, node=20
  test (22): runs=5, success=5, failure=0, runtime=12.0s, node=22
  test (24): runs=5, success=5, failure=0, runtime=10.0s, node=24
```

따라서 한 번도 실패하지 않은 cell도 분석 대상에서 빠지지 않습니다.

static matrix라면 axis 이름도 가능한 범위에서 복원합니다.

```text
test (ubuntu-latest, 22)
↓
os=ubuntu-latest
node=22
```

dynamic matrix나 복잡한 custom job name은 억지로 추측하지 않고 unresolved로 남깁니다.

## 더 작은 matrix 추천

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js recommend owner/repo \
  --workflow ci.yml \
  --limit 100
```

recommendation은 아직 **experimental**입니다. 핵심은 조합을 자동 삭제하는 것이 아니라 각 configuration이 실제로 제공하는 failure-detection value를 측정하는 것입니다.

기본값인 `--strength 2`에서는 다음을 모두 유지합니다.

1. 분석된 모든 과거 failure fingerprint
2. 해석 가능한 각 axis의 모든 관측값(1-wise)
3. 관측된 모든 axis-value pair(pairwise)
4. 각 matrix job family에서 최소 1개 cell
5. 위 조건을 지키는 범위에서 median runtime 기준 추정 compute 최소화

`--strength 3`을 사용하면 관측된 3-wise 조합까지 유지합니다. 실제 matrix에 없던 조합을 새로 만들어 요구하지 않습니다. 현재 optimizer는 greedy weighted set cover입니다.

## 최신 failure로 backtest

```bash
GH_TOKEN="$(gh auth token)" \
  node dist/cli.js backtest owner/repo \
  --workflow ci.yml \
  --limit 100 \
  --holdout 25
```

오래된 run으로 cell을 선택하고, 더 최신의 holdout run에서 다음을 측정합니다.

- 전체 holdout failure recall
- training 때 없었던 **새 fingerprint**의 recall
- 선택된 matrix가 놓친 failure

runtime cost도 **training window만 사용**해 계산하므로 holdout 정보를 미리 보지 않습니다.

## 실제 사례: pytest

실제 `pytest-dev/pytest` GitHub Actions failure run으로 검증했습니다.

- failed jobs: 31
- matrix jobs: 30
- downstream aggregate job: 1

겉으로는 30개의 서로 다른 failure처럼 보였지만, root-cause normalization 후에는 30개 cell이 모두 하나의 fingerprint로 묶였습니다.

```text
windows-py311 ─┐
ubuntu-py312  ─┤
macos-py314   ─┤
...            ├─ one failure fingerprint
30 cells ──────┘

ImportError: cannot import name '_resolve_args_directness'
from partially initialized module '_pytest.fixtures'
```

이는 **그 관측된 failure에 대해서는 중복 신호가 많았다**는 뜻이지, 29개 cell을 바로 삭제해도 안전하다는 뜻은 아닙니다.

전체 사례: [docs/case-study-pytest.md](docs/case-study-pytest.md)

## Failure Fingerprint

timestamp, 절대 경로, UUID, duration, line number처럼 흔들리는 정보를 제거하고, Exception / Assertion / panic / compiler error / failing test 같은 root-cause headline을 우선해 fingerprint를 만듭니다.

핵심 로직은 deterministic하며 LLM에 의존하지 않습니다.

## Roadmap

- [x] static GitHub Actions matrix 분석
- [x] CLI / JSON 출력
- [x] success run을 포함한 completed-run history
- [x] failure signature normalization / clustering
- [x] cell별 success/failure/runtime history
- [x] static matrix axis 복원
- [x] empirical failure-coverage recommendation
- [x] 관측된 1-wise / pairwise / t-wise safety constraint
- [x] time-based holdout backtest
- [ ] `include` / `exclude` 완전 지원
- [ ] 명시적 keep / compatibility constraint
- [ ] GitHub Action + PR comment
- [ ] matrix-heavy OSS benchmark
- [ ] runner-aware monetary cost model
- [ ] multi-event failure fingerprint
- [ ] recommendation PR 자동 생성
- [ ] 더 강한 / exact optimizer

## 설계 원칙

- **Evidence over intuition**
- **Deterministic core**
- **Explain every removal**
- **Backtest before trust**
- **Read-only by default**

## Contributing

Issue와 Pull Request를 환영합니다. [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.

## License

MIT
