---
name: gh-update-task-readiness
description: Recompute GitHub task readiness without labels after prerequisite issues close, return actionable direct dependents, or reconcile the entire task backlog on a schedule. Use from an issue-closed or pull-request-merged event with one source issue, or from a scheduled job to derive actionable, blocked, in-progress, and invalid tasks.
---

# Update Task Readiness

task 本文の dependency と GitHub の実状態を再評価し、後続処理が使える readiness classification を返す。Issue を状態保存のために変更しない。

## Select a mode

- **Event mode**: closed になった1件の source Issue が渡された場合に使う。source を `Depends on` に含む open task だけを候補にする。
- **Reconciliation mode**: source Issue がなく定期実行された場合に使う。設計済みの要件 Issue に属する open な native sub-issue を全件走査する。

どちらも同じ評価規則を使う。PR merge イベントの場合は、PR の `Closes` keyword で実際に closed になった task Issue を source とする。PR が merge されても Issue が open なら完了扱いにしない。

## Workflow

1. 候補 task ごとに、本文中の唯一の `- Depends on:` 行を解析する。
2. 各 dependency の存在と open/closed 状態を GitHub から取得する。task 本文を正本とし、親 Issue の task index や `Blocks` 記述は判定に使わない。
3. dependency 状態を決める。
   - `none` または全 dependency が closed: dependency-ready。
   - 1件以上 open: blocked。
   - 欠落、複数行、参照不能、別 repository、自己参照、循環: invalid and blocked。
4. dependency-ready な task について、assignee、未解除 claim、task を閉じる open PR を確認する。
   - いずれもない: actionable。
   - 1つ以上ある: in-progress。
   - dependency が後から invalid または blocked になったのに作業中なら、状態を変更せず警告する。
5. event mode では直接依存 task のみを評価し、actionable task の番号と URL を呼び出し元へ返す。呼び出し元はそれぞれを `gh-implement-ready-task` へ渡せる。
6. reconciliation mode では actionable、blocked、in-progress、invalid の一覧と根拠を返す。候補がない場合も成功扱いにする。
7. 明示的に通知を依頼された場合だけ、`<!-- ai-readiness:<classification>:<dependency-state-hash> -->` marker 付き comment を追加する。同じ評価の comment を重複させず、comment を状態判定の正本にしない。

## Concurrency rules

- 更新直前に Issue と dependency を再取得する。
- 他者の assignee、claim、open PR を見つけたら actionable として返さない。
- 部分的な API failure があれば確認できない task を actionable にせず、他の task の処理は継続する。
- Issue label を候補抽出、readiness、進捗の判定に使わない。
