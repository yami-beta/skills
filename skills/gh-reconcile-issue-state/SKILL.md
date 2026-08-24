---
name: gh-reconcile-issue-state
description: Reconcile GitHub issue state without labels after prerequisite issues close, return actionable direct dependents, close requirement issues whose sub-issues are all complete, or reconcile the entire task backlog on a schedule. Use from an issue-closed or pull-request-merged event with one source issue, or from a scheduled job to derive actionable, blocked, in-progress, and invalid tasks and completed requirements.
---

# Reconcile Issue State

task 本文の dependency と GitHub の実状態を再評価し、後続処理が使える readiness classification を返す。あわせて、全 sub-issue が完了した要件 Issue を close する。Issue を状態保存のために変更しない。要件 Issue の close は導出状態の保存ではなく実体のあるライフサイクル遷移であり、この原則の対象外。

## Select a mode

- **Event mode**: closed になった1件の source Issue が渡された場合に使う。source を `Depends on` に含む open task と、source の親要件だけを対象にする。
- **Reconciliation mode**: source Issue がなく定期実行された場合に使う。設計済みの要件 Issue に属する open な native sub-issue と、走査対象の全要件を対象にする。

どちらも同じ評価規則を使う。PR merge イベントの場合は、PR の `Closes` keyword で実際に closed になった task Issue を source とする。PR が merge されても Issue が open なら完了扱いにしない。

## Task readiness workflow

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

## Requirement completion workflow

対象要件（event mode は source task の親要件、reconciliation mode は走査した全要件）ごとに完了を判定する。

1. 次を全て満たす場合に限り close 候補とする。
   - native sub-issue が1件以上存在し、全件が closed である。
   - `ai-task-index` marker の task 一覧と実際の sub-issue が一致し、未作成 task がない。
   - completed 以外の理由（not planned など）で closed になった sub-issue がない。
2. not planned の sub-issue を含む要件は自動 close せず、要確認として結果に含める。
3. close 直前に要件 Issue と全 sub-issue を再取得し、条件を再確認する。要件がすでに closed なら何もしない。
4. close は completed として行い、根拠（全 sub-issue の番号と closed 状態の一覧）を comment で残す。
5. close した要件と要確認の要件を結果に含めて返す。

## Concurrency rules

- 更新直前に Issue と dependency を再取得する。
- 他者の assignee、claim、open PR を見つけたら actionable として返さない。
- 部分的な API failure があれば確認できない task を actionable にせず、確認できない要件を close せず、他の対象の処理は継続する。
- Issue label を候補抽出、readiness、進捗、完了の判定に使わない。
