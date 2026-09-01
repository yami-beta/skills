---
name: pick-task
description: Find, verify, and claim one automation-enabled GitHub task whose workflow label is ready and whose native dependencies are closed. Use for scheduled or polling dispatch; do not use when a specific task was supplied by an event or user.
---

# Find Ready Task

定期実行または polling 用に、実装可能な task を1件選び、競合しないよう確保する。label は候補検索と状態表示に使い、readiness の事実は GitHub native metadata で再検証する。指定 Issue を処理するイベント駆動ではこのスキルを使わず、直接 `implement-task` を使う。

## Workflow

1. 対象 repository を特定し、`kind:task`、`workflow:ready`、`workflow:in-progress`、`automation:enabled` の固定 label が存在することを確認する。欠けていれば候補を探さず、`setup-workflow` が必要な setup blocker として返す。類似名の label を作らない。
   - 呼び出し側が同じ actor/run で以前に確保した Issue を保持している場合は通常の候補検索より先に再取得する。自分の active claim、単一の `workflow:in-progress`、closed な native blocker、競合なしを確認できれば同じ Issue を返し、新しい task を確保しない。
2. 3つの label をすべて持つ open Issue を検索する。親が明示された場合は、その native sub-issue だけに絞る。
3. 各候補を再取得し、labels、native parent、native `blocked by`、assignees、comments、task を閉じる Pull Request を確認する。次の候補を除外し、理由を報告する。
   - `kind:*` または `workflow:*` が欠落・複数・矛盾している、3つの必須 label のいずれかがなくなった、または native task parent を確認できない。
   - native blocker が1件でも open、参照不能、または取得結果が不完全である。pagination を最後まで取得し、取得件数と API が返す合計数が一致することを確認する。本文の dependency 表現へ fallback しない。
   - assignee がいる、未解除の claim marker がある、または別の実行主体が確保している。
   - task を close する open Pull Request が既にある。
4. 残った候補を repository の priority 規約で並べる。規約がなければ milestone due date、親の `ai-task-index` の順序、Issue 番号の昇順で決める。priority label や推測した事業優先度で並べない。
5. 先頭候補を claim する。
   - automation actor へ assign できる構成なら assign する。
   - `<!-- ai-task-claim:<actor-or-run-id> -->` を含む短いコメントを1つ追加する。
6. claim 後、Issue を再取得してまだ `workflow:ready` であり、native blocker がすべて closed で、他の担当者、別 claim、または既存 PR がないことを確認する。続いて `workflow:ready` だけを `workflow:in-progress` に置き換える。
7. Issue をもう一度取得し、`kind:task`、`workflow:in-progress`、`automation:enabled`、native blocker、自分以外の assignee、別 claim、open PR を再検証する。競合した場合は自分の claim だけを解除し、その候補を返さず次候補を試す。
8. 確保した Issue の番号、URL、native dependency、選択理由を返す。候補がない場合は成功扱いで `no actionable task` を返す。

## Safety and idempotency

- 一度の実行で確保する task は1件だけにする。ただし呼び出し側が明示した上限があり、並列 worker ごとの一意な claim が保証される場合を除く。
- 同じ actor/run の marker が既にあれば同じ Issue を返し、新しい claim を作らない。
- claim marker と同じ actor/run の release marker が後にあれば、その claim は解除済みとして扱う。対応する release がない claim を勝手に失効または横取りしない。
- workflow label を更新する直前に現在の labels を取得する。既存の無関係な label と `automation:enabled` は保持し、現在の `workflow:*` だけを除去して目標 label を1つ追加し、更新後に再取得して確認する。
- `workflow:in-progress` が存在しない、label 更新に失敗した、または更新後の単一性を確認できない場合は task を dispatch しない。コード変更がなく自分の claim だと確認できるときだけ自分を unassign し、`<!-- ai-task-release:<actor-or-run-id> -->` comment で claim を解除する。
- GitHub Actions などの呼び出し側でも repository 単位の concurrency 制御を設定する。
- label だけで readiness や排他を判断しない。native dependency、assignee、claim、open Pull Request を更新前後に確認し、GitHub API の部分的な失敗を ready と解釈しない。
