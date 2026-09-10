---
name: sync-issues
description: Recompute and repair GitHub issue kind and workflow labels from native relationships, assignments and closing pull requests, and close completed requirements. Use after a task closes or on a schedule to reconcile a managed issue backlog.
---

# Reconcile Issue State

GitHub native metadata と実行状況を正本として、open な管理対象 Issue の `kind:*` と `workflow:*` を再計算・修復する。全 native sub-issue が完了した requirement は条件を再確認して close する。

## Preconditions and scope

1. 対象 repository を特定し、workflow metadata contract の全固定 label が存在することを確認する。欠けていれば label を暗黙に作成せず、`setup-workflow` が必要な setup blocker として、Issue を変更せず停止する。
2. 管理対象は `kind:*` / `workflow:*` label を持つ open Issue と、その親・sub-issue から探す。native parent があれば task、parent がなく sub-issue があれば requirement とする。階層から判定できない場合は単一の `kind:*` を使う。矛盾や分類不能は `unknown` として変更しない。native parent のない `kind:task` は invalid とする。
3. closed Issue は完了の正本とし、workflow label を再計算しない。closed task は requirement 完了判定の事実としてのみ読む。

## Select a mode

- **Event mode**: closed になった1件の source task が渡された場合に使う。source の native `blocking` relationship に含まれる open task と、source の native parent requirement だけを対象にする。PR merge イベントでは `Closes` により実際に closed になった Issue を source とし、PR が merge 済みでも Issue が open なら完了扱いにしない。
- **Reconciliation mode**: source task がない定期実行で使う。候補の全 open Issue（親のない `kind:task` も含む）と、管理対象 requirement の sub-issue を pagination の最後まで走査する。

どちらの mode でも同じ分類・更新規則を使う。event mode では source の `blocking` を直接依存 task の正本とし、本文 から dependent を推測しない。

## Task classification

各 open task の parent、全 dependency、assignee、task を閉じる open PR、label を取得する。全ページを取得して API の合計数と一致することを確認し、不完全なら `unknown` として label を変更せず実装候補にも返さない。

次の順で状態を決める。

| 確認した事実 | workflow |
| --- | --- |
| 親や依存が不正、または open の dependency がある | `blocked` |
| task を閉じる open PR がある | `review` |
| 担当者がいる | `in-progress` |
| 上記がなく、全 dependency が closed | `ready` |

不正とは親の欠落、自己参照、循環、別 repository への依存など、確認できた矛盾を指す。これらは `invalid` として根拠も返す。API failure と混同しない。作業中に dependency が追加・再open された場合は `blocked` として警告する。複数の open PR が同じ task を閉じる場合は `review` を表示するが、重複を報告する。

## Requirement classification and completion

親の本文と全 sub-issue を取得し、取得件数が API の合計数と一致することを確認する。設計は通常の `## 設計` 節で読む。設計書へのリンクが正本ならその内容も確認する。

- 明示的な未決事項がある場合、または sub-issue が1件以上あり「分割」の各成果との対応に欠落・余分・曖昧さがある場合は `workflow:needs-input`。task 分割中であると確認できる場合は `workflow:in-progress` を保持する。
- sub-issue があり、計画との対応が確認でき、1件以上 open なら `workflow:in-progress`。
- sub-issue がなく、課題と解決・分割が揃い、未決事項が「なし」なら `workflow:ready`。
- 設計が未完成なら既存の `workflow:in-progress` または `workflow:needs-input` を保持し、それ以外は `workflow:backlog`。

親を自動 close できるのは、未決事項がなく、設計の「分割」の全成果が sub-issue と対応し、全 sub-issue が1件以上あり、すべて completed として closed された場合だけとする。not planned を含む場合や分割の途中で一部 task だけが完了した場合は close しない。番号の索引や追加の管理コメントは不要とする。

close 直前に本文と全 sub-issue を再取得して同じ条件を確認し、親を completed として close する。対応関係を確認できなければ `workflow:needs-input` にして理由を返す。API failure なら label も変更しない。取得先の内容が曖昧な場合は推測で完了扱いにしない。

## Label normalization

目標 kind/workflow を確定できた open Issue だけを更新する。

1. 更新直前に Issue と分類に使った全 metadata を再取得し、目標を再計算する。初回評価から事実が変わっていれば最新値を使う。
2. 現在の `kind:*` と `workflow:*` をすべて除去し、目標 kind と workflow を各1つ追加する。既存の無関係な label と `automation:enabled` は保持する。すでに完全一致している場合は変更しない。
3. 更新後に Issue、labels、分類事実を再取得する。kind/workflow が各1つでない、または事実が変化して目標が古くなった場合は、最新値で1回だけ再計算・再更新する。
4. 再試行後も競合、部分失敗、または矛盾が残る場合は変更を重ねず `concurrent update` として報告し、その Issue を actionable にしない。

workflow skill 内で欠けた contract label を作成せず、通常 label や `automation:enabled` を追加・削除しない。

## Results

- event mode では、修復後に `workflow:ready` で native blocker がすべて closed の直接依存 task の番号と URL を返す。呼び出し元は明示的な event invocation として `implement-task` へ渡せる。
- reconciliation mode では、ready、blocked、in-progress、review、invalid、unknown、concurrent-update の一覧と、変更した label を根拠付きで返す。review task には PR URL を含める。候補がなくても正常終了する。
- close した requirement、metadata mismatch や not planned のため close しなかった requirement、API failure で確認不能だった requirement を区別して返す。

## Concurrency and failure rules

- label 更新と requirement close の直前・直後に native facts を再取得する。label は materialized state であり、readiness や完了の正本にしない。
- 部分的な API failure があれば、確認できない task を ready にせず、確認できない requirement を close しない。確認できた他の Issue の処理は継続する。
- timeout 後は Issue を再取得して更新結果を確認し、結果が不明なまま同じ label mutation、comment、close を繰り返さない。
- 担当者または open PR がある task は実装候補に返さない。`automation:enabled` は自動実行への opt-in とし、この skill では変更しない。
- 呼び出し元で repository の workflow 更新を直列化する。定期実行・イベント・手動実行で同じ排他枠を使い、直列化を確認できない自動実行は変更しない。手動実行も他の実行を停止してから行う。
