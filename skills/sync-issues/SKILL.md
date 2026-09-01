---
name: sync-issues
description: Recompute and repair GitHub issue kind and workflow labels from native relationships, assignments, claims, and closing pull requests, and close completed requirements. Use after a task closes or on a schedule to reconcile a managed issue backlog.
---

# Reconcile Issue State

GitHub native metadata と実行状況を正本として、open な管理対象 Issue の `kind:*` と `workflow:*` を再計算・修復する。全 native sub-issue が完了した requirement は条件を再確認して close する。

## Preconditions and scope

1. 対象 repository を特定し、workflow metadata contract の全固定 label が存在することを確認する。欠けていれば label を暗黙に作成せず、`setup-workflow` が必要な setup blocker として、Issue を変更せず停止する。
2. 管理対象の候補を native hierarchy、workflow marker、contract label から特定する。`ai-design` または `ai-task-index` marker を持つ親、native sub-issue を持つ親を requirement、その native sub-issue を task とする。加えて、contract の `kind:*` または `workflow:*` を1つ以上持つ open Issue も候補に含める。native metadata と marker から kind を導出できない候補は、単一の `kind:*` label を暫定分類に使う。`kind:requirement` だけを持ち矛盾する native facts がない Issue は requirement classification へ進め、native parent のない `kind:task` は Task classification の invalid 判定へ進める。`kind:*` が欠落・複数で kind を導出できない候補は `unknown` とする。label は候補抽出とこの暫定分類にだけ使い、最終的な kind/workflow は native metadata と marker を優先して再計算する。label が欠落・誤分類された Issue も修復対象から除外しない。
3. closed Issue は完了の正本とし、workflow label を再計算しない。closed task は requirement 完了判定の事実としてのみ読む。

## Select a mode

- **Event mode**: closed になった1件の source task が渡された場合に使う。source の native `blocking` relationship に含まれる open task と、source の native parent requirement だけを対象にする。PR merge イベントでは `Closes` により実際に closed になった Issue を source とし、PR が merge 済みでも Issue が open なら完了扱いにしない。
- **Reconciliation mode**: source task がない定期実行で使う。管理対象 requirement と、その open な native sub-issue を pagination の最後まで走査する。

どちらの mode でも同じ分類・更新規則を使う。event mode では source の `blocking` を直接依存 task の正本とし、本文や親の task index から dependent を推測しない。

## Task classification

各 open task について、native parent、native `blockedBy`、assignees、全 comments、task を閉じる open Pull Request とその top-level comments、現在の labels を取得する。collection は pagination の最後まで取得し、取得件数と API の合計数が一致することを確認する。

1. task が同じ repository の native sub-issue であることと、全 blocker の存在・状態を確認する。自己参照、循環、別 repository、参照不能など、事実として確認できた不正 metadata は `invalid` と分類する。
2. 対応する release marker が後にない `<!-- ai-task-claim:<actor-or-run-id> -->` を active implementation claim とする。claim を時間経過だけで失効させない。
3. review metadata を別の実行事実として読む。
   - open PR の番号に一致する最新の `<!-- ai-review-handoff:<pr-number>:<head-sha> -->` を valid handoff とする。marker の head が現在の head と違う場合は stale handoff として報告するが、同じ PR の session handoff 自体は有効とする。
   - review claim、release、state は PR 側の `<!-- ai-review-marker -->` を含む comment を正本として読む。Issue 側に残る過去の同種 marker は互換としてのみ読む。
   - 対応する release marker がない `<!-- ai-review-claim:<actor-or-run-id> -->` を active review claim とする。review claim は mutation cycle の排他であり、workflow label を `in-progress` に変える根拠にはしない。
   - `<!-- ai-review-state:<state-hash> -->` は同じ GitHub state への重複操作を抑止する記録であり、classification の正本にはしない。
4. 次の順で目標 workflow label を決める。
   - invalid metadata または1件以上の open blocker: `workflow:blocked`
   - blocker がなく、task を閉じる open Pull Request がある: `workflow:review`
   - blocker がなく、assignee または active implementation claim がある: `workflow:in-progress`
   - blocker がなく、上記の実行中事実もない: `workflow:ready`
5. blocker がある task に assignee、claim、open PR が存在する場合は `workflow:blocked` を維持し、作業中に dependency が追加・再openされた競合として警告する。
6. open PR があるのに同じ PR の valid handoff がない場合、workflow は `review` に修復するが review maintenance を actionable として返さず、handoff drift として警告する。stale handoff または active review claim がある場合も `review` を維持し、その状態と marker を結果へ含める。
7. dependency、comments、assignees、open PR、または review marker の取得が不完全なら `unknown` とする。既存 label を変更せず、actionable として返さない。部分的な API failure を blocker なし、handoff 済み、または review 完了と解釈しない。

既知の invalid task は `kind:task` と `workflow:blocked` に正規化し、invalid の根拠を結果へ含める。`unknown` task は安全な目標状態を確定できないため label 修復を行わない。

## Requirement classification and completion

各 open requirement について、本文の design/task-index marker と native sub-issue を取得する。sub-issue は pagination の最後まで取得し、取得件数と API の合計数が一致することを確認する。

- native sub-issue が1件以上あり、1件以上 open: `kind:requirement` と `workflow:in-progress`。
- native sub-issue がなく、完結した `ai-design` marker があり blocker がない: `kind:requirement` と `workflow:ready`。
- native sub-issue がなく、明示的な未解決 blocker がある: `kind:requirement` と `workflow:needs-input`。
- design marker と native sub-issue がなく、単一の `workflow:in-progress` が既にある場合は進行中の planning を推測で上書きしない。それ以外は `kind:requirement` と `workflow:backlog`。

native sub-issue が1件以上あり全件 closed の requirement は、次をすべて満たす場合だけ close 候補とする。

1. `ai-task-index` marker の task 一覧と実際の native sub-issue が完全に一致し、未作成 task や余分な sub-issue がない。
2. 全 sub-issue が completed として closed され、not planned など completed 以外の理由を含まない。
3. requirement、task index、全 sub-issue の取得が完全である。

条件を満たさない場合は close せず、確認可能な metadata mismatch なら `workflow:needs-input` に正規化し、API failure なら label も変更せず要確認として返す。close 直前に requirement と全 sub-issue を再取得し、条件を再確認する。根拠となる task 番号と closed reason を `<!-- ai-requirement-completion:<state-hash> -->` marker 付き comment に残してから requirement を completed として close し、同じ根拠の comment を重複させない。

## Label normalization

目標 kind/workflow を確定できた open Issue だけを更新する。

1. 更新直前に Issue と分類に使った全 metadata を再取得し、目標を再計算する。初回評価から事実が変わっていれば最新値を使う。
2. 現在の `kind:*` と `workflow:*` をすべて除去し、目標 kind と workflow を各1つ追加する。既存の無関係な label と `automation:enabled` は保持する。すでに完全一致している場合は変更しない。
3. 更新後に Issue、labels、分類事実を再取得する。kind/workflow が各1つでない、または事実が変化して目標が古くなった場合は、最新値で1回だけ再計算・再更新する。
4. 再試行後も競合、部分失敗、または矛盾が残る場合は変更を重ねず `concurrent update` として報告し、その Issue を actionable にしない。

workflow skill 内で欠けた contract label を作成せず、通常 label や `automation:enabled` を追加・削除しない。

## Results

- event mode では、修復後に `workflow:ready` で native blocker がすべて closed の直接依存 task の番号と URL を返す。呼び出し元は明示的な event invocation として `implement-task` へ渡せる。
- reconciliation mode では、ready、blocked、in-progress、review、invalid、unknown、concurrent-update の一覧、変更した labels、変更不要だった Issue を根拠付きで返す。review task には handoff の有効性、active review claim、最新 state marker の有無も含める。候補がない場合も成功扱いにする。
- close した requirement、metadata mismatch や not planned のため close しなかった requirement、API failure で確認不能だった requirement を区別して返す。

## Concurrency and failure rules

- label 更新と requirement close の直前・直後に native facts を再取得する。label は materialized state であり、readiness や完了の正本にしない。
- 部分的な API failure があれば、確認できない task を ready にせず、確認できない requirement を close しない。確認できた他の Issue の処理は継続する。
- timeout 後は Issue を再取得して更新結果を確認し、結果が不明なまま同じ label mutation、comment、close を繰り返さない。
- active implementation claim、assignee、open PR を見つけた task を ready implementation の actionable として返さない。active review claim は review maintenance の競合として報告する。`automation:enabled` は scheduled dispatch の opt-in gate であり、reconciliation の分類や修復では変更しない。
- scheduled caller でも repository 単位の concurrency 制御を設定する。skill 内の再取得と有限リトライは、複数実行を安全に並列化する保証ではない。
