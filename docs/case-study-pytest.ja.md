# ケーススタディ: pytest の30 matrix jobsが1つの障害だった

このドキュメントは、MatrixTrimのfailure fingerprint設計を実際のGitHub Actions failureで検証した記録です。

## 対象

- Repository: `pytest-dev/pytest`
- Workflow: `test.yml`
- Run: https://github.com/pytest-dev/pytest/actions/runs/36195406393
- Raw failed jobs: **31**
- Matrix jobs: **30**
- Downstream aggregate job: **1 (`check`)**

## 何が起きていたか

GitHub上では30個のmatrix variantがそれぞれfailureになっていました。

例:

```text
build (windows-py311)
build (windows-py314)
build (ubuntu-py312)
build (ubuntu-py315)
build (macos-py310)
build (macos-py314)
...
```

job名だけを見ると、OSやPython version固有の複数障害に見える可能性があります。

しかし各job logを確認すると、主要なroot causeは共通でした。

```text
ImportError: cannot import name '_resolve_args_directness'
from partially initialized module '_pytest.fixtures'
(most likely due to a circular import)
```

## なぜ単純なlog hashでは失敗するか

同じImportErrorでもjob logには環境固有のノイズが大量に含まれます。timestamp、tox environment名、dependency version一覧、duration、line number、OS固有pathなどが異なります。

初期実装ではこれらをfingerprint材料に含めすぎていたため、**同じ障害なのにmatrix cellごとに別fingerprint**になっていました。

## 改善

MatrixTrimではfingerprintを次のように変更しました。

1. timestamp / duration / UUID / line-columnを正規化
2. workspaceやOS固有の絶対パスを`<path>`へ正規化
3. dependency dumpやshell情報より、Exception / Error headlineを優先
4. traceback全体ではなくroot-cause候補をsignatureに採用
5. downstream aggregate jobをmatrix cell scoringから除外

その結果:

```text
30 matrix jobs
      ↓
30 separate-looking failures
      ↓ normalize
1 failure fingerprint
```

生成された代表signature:

```text
ImportError: cannot import name '_resolve_args_directness'
from partially initialized module '_pytest.fixtures'
(most likely due to a circular import) (<path>)
```

## 何が分かったか

このrunに限れば、30個のmatrix cellは、このfailureについて**30種類の独立した検出能力を提供していたわけではありません**。

```text
windows-py311 ─┐
windows-py314 ─┤
ubuntu-py312  ─┤
ubuntu-py315  ─┤
macos-py310   ─┤
...            ├── same fingerprint
30 cells ──────┘
```

これはmatrix縮約の強いシグナルになります。

ただし、ここから直ちに「29セル削除してよい」とは判断しません。別の履歴では特定OSや特定runtimeだけが固有障害を見つけている可能性があるためです。

## 現在の `recommend` が行うこと

MatrixTrimは多数のrunを横断して、各cellがどのfailure fingerprintを検出したかをcoverage graphとして扱います。

```text
cell A → failures {F1, F2, F4}
cell B → failures {F1}
cell C → failures {F2, F3}
cell D → failures {F3, F4}
```

ただし、現在のモデルはfailure coverageだけでセルを選びません。観測済みmatrix構造に対する1-wise / pairwise / t-wise coverage、matrix job familyごとの最低1セル、axis未解決セルの保守的な保持、repository側で明示した`keep` / `require`制約も同時に守ります。

目的関数には観測runtimeのmedianが使われます。`auto` modeでは、探索budget内で最適性を証明できる場合はexact branch-and-boundを使い、証明できない場合は保守的にfallbackします。ここでいうexactは、あくまで**現在の観測証拠モデルに対する最適解**であり、履歴に一度も現れていない将来障害を否定する証明ではありません。

このpytestの単一runだけを見ると、30セルは1つのfingerprintに対して同等に見えます。しかし、これは**安全性の証明ではなく、単一runの証拠が疎であることの実例**です。

現在のMatrixTrimはtime-based holdout backtestも使えます。古いrunだけでセルを選び、より新しいrunのfailureをその選択で検出できたかを測定します。公開benchmarkではこれをpairwise coverage（`--strength 2`）と組み合わせ、解決できない対象を無理に縮約せず`partial` / `unresolved`として残します。

したがって、このrunから得られる結論は「29 jobを消してよい」ではありません。

**GitHub UI上では30件のfailureに見えても、観測されたfailure signalの種類は1つだったため、raw failed-job countだけでは証拠の多様性を大きく見誤る可能性がある**、ということです。

## この実例が重要な理由

MatrixTrimの目的は「matrixを小さく見せること」ではありません。

**重複したCI計算と、本当に独自のfailure signalを持つCI計算を区別すること**です。

このpytest runは、その差が非常に分かりやすく現れた実例でした。
