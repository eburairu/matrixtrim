# MatrixTrim

[![CI](https://github.com/eburairu/matrixtrim/actions/workflows/ci.yml/badge.svg)](https://github.com/eburairu/matrixtrim/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/eburairu/matrixtrim)](../../LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)
[![GitHub stars](https://img.shields.io/github/stars/eburairu/matrixtrim?style=flat)](https://github.com/eburairu/matrixtrim/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/eburairu/matrixtrim)](https://github.com/eburairu/matrixtrim/commits/main)

[English](../../README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | **한국어** | [Español](README.es.md)

**실제로 필요한 failure signal은 남기고, GitHub Actions matrix는 더 작게.**

MatrixTrim은 단순히 job 수를 줄이는 도구가 아닙니다. 핵심 질문은 다음과 같습니다.

> 어떤 matrix cell이 정말로 고유한 failure를 잡아냈고, 어떤 cell은 다른 환경에서 이미 잡히는 failure를 반복해서 발견하고 있을까?

목표는 **과거 failure coverage, 실행 비용, matrix 구조, holdout backtest**를 바탕으로 더 작은 CI matrix 후보를 제안하는 것입니다.

> **현재 상태: v0.13 experimental.** multi-event root-cause fingerprint, 과거 failure evidence, 관측된 1-wise / pairwise / t-wise configuration coverage, 사람이 명시하는 keep / compatibility constraint, exact branch-and-bound optimizer, runtime cost와 runner-aware 금액 추정, time-based holdout backtest, 렌더링된 matrix job 이름 복원, GitHub Action, 재현 가능한 공개 OSS benchmark, 명시적 opt-in draft 최적화 PR 생성까지 지원합니다.

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

MatrixTrim은 **성공한 run을 포함한 모든 completed run에서 job metadata를 수집**합니다. 실제 log 분석은 실패한 matrix job에만 수행합니다.

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

static matrix에서는 직접적인 `matrix.*` 표현식, `format(...)`, `matrix.name || matrix.python` 같은 fallback 표현식, include-only matrix를 이용해 렌더링된 job 이름을 복원할 수 있습니다. dynamic matrix와 아직 지원하지 않는 GitHub 표현식은 억지로 추측하지 않고 unresolved로 남깁니다.

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

`--strength 3`을 사용하면 관측된 3-wise 조합까지 유지합니다. 실제 matrix에 없던 조합을 새로 만들어 요구하지 않습니다.

## exact optimizer

기본값인 `--optimizer auto`는 deterministic greedy 해를 먼저 구한 뒤, 프로세스 내부 branch-and-bound로 현재 coverage 요구사항을 만족하는 runtime 가중 비용 최소 cell 집합을 증명합니다. 기본 **250,000 nodes**를 넘으면 `auto`는 명시적으로 greedy로 fallback합니다. `--optimizer exact`는 증명되지 않은 결과를 반환하지 않고 실패하며, `--optimizer greedy`는 exact 탐색을 건너뜁니다.

여기서 “exact”는 **현재 weighted set-cover model에 대해 최적**이라는 뜻이지, 제거 후보 environment가 미래의 failure를 절대 잡지 못한다는 증명은 아닙니다. 자세한 내용은 [Exact optimizer](../optimizer.md)를 참고하세요.

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

## multi-event failure fingerprint

하나의 failed matrix job에 여러 독립적인 failure signal이 들어 있을 수 있습니다. MatrixTrim은 이제 강한 root cause를 각각 fingerprint하므로 같은 job의 `Error X`와 `Error Y`를 하나의 `X+Y` 복합 fingerprint가 아니라 두 개의 event로 다룹니다. typed error / exception, panic / fatal, segmentation fault 같은 강한 root cause를 우선하며, 그런 원인이 없을 때만 test runner summary를 사용해 명백한 중복 집계를 피합니다.

같은 normalized root cause가 반복되면 dedup하고 job당 최대 8개의 서로 다른 event만 유지합니다. root-cause headline을 찾지 못하면 기존 single-fingerprint heuristic으로 fallback합니다. 자세한 내용은 [Multi-event failure fingerprints](../fingerprints.md)를 참고하세요.

## GitHub Action으로 사용하기

clone이나 로컬 build 없이 바로 사용할 수 있습니다.

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

Action은 항상 **Step Summary**를 생성합니다. Pull Request에서는 권한이 허용될 경우 MatrixTrim 댓글 하나를 생성하거나 갱신합니다. fork PR처럼 token이 read-only이면 댓글 작성만 warning과 함께 건너뛰고 분석 자체는 성공합니다.

리포트에는 현재/추천 cell 수, historical failure recall, failure event 수 / multi-event job 수, combinatorial coverage, 예상 compute 절감률, runner-aware rate-card / 예상 청구액, holdout recall, unseen-failure recall, 추천 cell 목록이 포함됩니다.

### draft 최적화 PR 생성하기 (opt-in)

PR 생성은 **기본적으로 비활성화**되어 있습니다. MatrixTrim이 workflow 수정안까지 직접 만들게 할 때만 명시적으로 켭니다.

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

MatrixTrim은 **draft PR만** 만들며 자동 병합하지 않습니다. 선택된 static cell을 명시적인 `matrix.include` 행으로 변환하고, 쓰기 전에 workflow를 round-trip 검증합니다. dynamic matrix, unresolved axis, 불완전한 workflow/job 이름 매핑, 100% 미만의 coverage, 또는 사용 가능한 holdout 검증 실패가 하나라도 있으면 PR 생성을 거부합니다. `pull_request` / `pull_request_target` 이벤트에서 실행된 경우에도 최적화 PR 생성은 강제로 건너뜁니다.

## 명시적 hard constraint

과거 데이터만 보면 중복처럼 보여도 호환성이나 지원 정책 때문에 반드시 남겨야 하는 환경은 `.matrixtrim.yml`에 선언할 수 있습니다.

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

`keep`은 렌더링된 matrix cell 하나를 정확히 고정합니다. `require`는 조건에 맞는 관측된 cell을 최소 하나 유지합니다. 같은 정책이 recommendation, backtest, GitHub Action, draft 최적화 PR 생성에 모두 적용됩니다. 어떤 cell에도 매치되지 않는 규칙은 조용히 무시하지 않고 fail closed합니다.

config는 repository의 **default branch**에서 읽기 때문에 신뢰할 수 없는 Pull Request가 자기 config를 수정해 MatrixTrim의 안전 정책을 약화시킬 수 없습니다. 전체 의미는 [Explicit hard constraints](../constraints.md)를 참고하세요.

## runner-aware cost model

MatrixTrim은 모든 CI minute를 같은 비용으로 보지 않고, 실제 runner label과 관측된 job 실행 시간을 이용해 금액 영향을 추정합니다.

- 현재 모델에서 사용하는 standard GitHub-hosted runner 기준 단가는 Linux 1-core x64 **$0.002/min**, Linux 2-core x64 **$0.006/min**, Linux 2-core arm64 **$0.005/min**, Windows x64/arm64 **$0.010/min**, standard macOS **$0.062/min**입니다.
- GitHub Actions 과금 방식에 맞춰 각 job 실행 시간을 분 단위로 올림한 뒤 금액을 계산합니다.
- **public repository**에서는 standard GitHub-hosted runner가 무료이므로 예상 GitHub 실제 청구액은 **$0**으로 표시하고, rate-card 금액은 비교용 값으로 따로 보여 줍니다.
- **private/internal repository**에서는 account/plan에 포함된 무료 minutes를 차감하기 전의 standard runner overage 상당액을 표시합니다.
- self-hosted runner의 GitHub Actions 청구액은 $0으로 처리하며, larger runner나 식별할 수 없는 runner는 가격을 추측하지 않고 unpriced로 남깁니다.
- 30일 환산은 관측된 run 기간이 **7일 이상**일 때만 표시해, 몇 시간의 기록을 월 비용으로 과도하게 외삽하지 않습니다.

가격 근거: [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) / [Actions runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing)

## 공개 OSS benchmark

유리한 사례만 골라 검증하는 것을 피하기 위해 **12개 공개 OSS 저장소에서 결과가 확정된 completed workflow run을 각각 20개씩 고정**하고, `--strength 2`와 25% time holdout으로 평가했습니다.

- **12개 중 10개 저장소를 완전히 해석**했습니다. 관측된 axis 복원, workflow 이름 렌더링, active matrix family의 실제 job 이름 매칭이 모두 100%였으며, 나머지 2개는 partial이라 검증된 축소 결과에 포함하지 않았습니다.
- 검증된 비제로 축소 사례는 **pandas 34 → 32 cells (-7.2%)**, **Flask 12 → 10 (-13.6%)**, **Diesel 28 → 25 (-8.3%)**입니다.
- runner 단가와 job별 1분 단위 올림 때문에 compute 감소율과 금액 감소율은 같지 않습니다. standard runner rate-card 기준으로 pandas **$25.148 → $24.671/run (-1.9%)**, Flask **$0.132 → $0.120/run (-9.1%)**, Diesel **$11.624 → $11.438/run (-1.6%)**였습니다. 세 저장소 모두 public이므로 standard runner의 예상 GitHub 실제 청구액은 **$0**입니다.
- exact optimizer는 benchmark **12/12 저장소에서 optimality를 증명**했고 greedy fallback은 **0건**, 최대 탐색량은 **102 nodes**였습니다. 11개 저장소에서는 greedy와 같은 해였고, Diesel에서는 greedy runtime 목적값을 **1.15% 개선**해 compute 감소율이 약 **7.6% → 8.3%**로 올라갔습니다. pandas와 Vite는 사용 가능한 backtest 구간에서 **holdout recall 100%, unseen-failure recall 100%**를 유지했습니다. Diesel도 **holdout recall 100%**를 유지했지만 holdout에 새로운 fingerprint가 없어 unseen-failure recall은 **n/a**입니다.
- 고정 snapshot의 실제 로그에서도 event-level 추출이 동작했습니다. **pandas는 failed jobs 59개 → events 151개 → 서로 다른 root-cause fingerprints 5개**, **Vite는 8 → 25 → 23**, Rust의 volatile 값과 파생 summary를 정규화한 **Diesel은 40 → 40 → 1**로 수렴했습니다.
- 완전히 해석된 10개 저장소 중 **7개는 안전 제약 때문에 의도적으로 축소하지 않았습니다**.
- aiohttp와 Tokio는 여전히 partial입니다. 현재 recommendation은 unresolved cell을 안전 제약으로 개별 유지하므로 이 snapshot에서 **aiohttp 29 → 29 / Tokio 51 → 51**이며, 둘 다 validated reduction에 포함하지 않습니다.

정확한 run ID는 [benchmark/snapshot.json](../../benchmark/snapshot.json)에 고정되어 있고, 전체 결과는 [benchmark/results.md](../../benchmark/results.md)에서 확인할 수 있습니다. 이 수치는 고정snapshot에 대한 관측 결과이며 미래 CI 동작을 보장하지 않습니다.

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

전체 사례: [docs/case-study-pytest.md](../case-study-pytest.md)

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
- [x] static `include` / `exclude` 전개 및 렌더링된job 이름 복원
- [ ] dynamic matrix / 더 넓은GitHub 표현식 지원
- [x] 명시적 keep / compatibility constraint
- [x] GitHub Action + PR comment
- [x] matrix-heavy OSS 재현 가능benchmark
- [x] runner-aware monetary cost model
- [x] multi-event failure fingerprint
- [x] opt-in draft recommendation PR 생성
- [x] 더 강한 / exact optimizer

## 설계 원칙

- **Evidence over intuition**
- **Deterministic core**
- **Explain every removal**
- **Backtest before trust**
- **Read-only by default**

## Contributing

Issue와 Pull Request를 환영합니다. [CONTRIBUTING.md](../../CONTRIBUTING.md)를 참고하세요.

## License

MIT
