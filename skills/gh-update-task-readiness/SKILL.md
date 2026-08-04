---
name: gh-update-task-readiness
description: Recompute GitHub task readiness after prerequisite issues close, unblock direct dependents, or reconcile the entire task backlog on a schedule. Use from an issue-closed or pull-request-merged event with one source issue, or from a scheduled job with no source issue to repair ready and blocked labels.
---

# Update Task Readiness

task 本文の dependency を再評価し、`workflow:blocked` と `workflow:ready` を整合させる。

## Select a mode

- **Event mode**: closed になった1件の source Issue が渡された場合に使う。source を `Depends on` に含む open task だけを候補にする。
- **Reconciliation mode**: source Issue がなく定期実行された場合に使う。open な `type:task` を全件走査する。

どちらも同じ評価規則を使う。PR merge イベントの場合は、PR の `Closes` keyword で実際に closed になった task Issue を source とする。PR が merge されても Issue が open なら完了扱いにしない。

## Workflow

1. 候補 task ごとに、本文中の唯一の `- Depends on:` 行を解析する。
2. 各 dependency の存在と open/closed 状態を GitHub から取得する。task 本文を正本とし、親 Issue の task index や `Blocks` 記述は判定に使わない。
3. 状態を決める。
   - `none` または全 dependency が closed: actionable。
   - 1件以上 open: blocked。
   - 欠落、複数行、参照不能、別 repository、自己参照、循環: invalid and blocked。
4. open task の workflow state を整合する。
   - actionable かつ claim、assignee、task を閉じる open PR がない: `workflow:ready`。
   - blocked または invalid: `workflow:blocked`。
   - `workflow:in-progress` または既存 PR がある task は、dependency が後から壊れた場合を除き state を巻き戻さず警告する。
   - state ラベルを付ける前に `workflow:ready`、`workflow:blocked`、`workflow:in-progress` の不要なものを外し、常に1つ以下にする。
5. state が変わった task にだけ、理由と dependency 状態をコメントする。`<!-- ai-readiness:<state>:<dependency-state-hash> -->` marker を付け、同じ評価のコメントを重複させない。
6. event mode では直接依存 task のみを更新する。更新で task が closed になるわけではないため、再帰的な伝播はしない。
7. 更新済み、変更なし、invalid、権限不足の Issue をそれぞれ返す。候補がない場合も成功扱いにする。

## Concurrency rules

- 更新直前に Issue と dependency を再取得する。
- 他者の claim や `in-progress` を見つけたら `ready` へ戻さない。
- 部分的な API failure があれば確認できない task を ready にせず、他の task の処理は継続する。
- repository 固有の同義ラベルがある場合はそれを使い、標準ラベルと二重管理しない。
