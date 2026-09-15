---
name: pick-task
description: Select and claim one ready, automation-enabled GitHub task. Use for scheduled or polling dispatch, not when a specific task is already supplied.
---

# Find Ready Task

定期実行・polling 用に実装可能な task を最大1件確保し、呼び出し元へ返す。指定 task の実装には `implement-task` を使う。

## 選択条件

対象は `kind:task`、`workflow:ready`、`automation:enabled` を持つ open Issue。親が指定されていればその sub-issue に絞る。repository にこれらと `workflow:in-progress` がなければ、更新せず `setup-workflow` が必要なことを返す。

着手可能なのは、有効な native parent があり、依存がないか全件 closed、担当者・task を閉じる open PR がない task だけ。kind/workflow は各1つを必要とする。依存は全ページを確認し、本文で代用しない。取得不能、不正な親、自己参照、循環、別 repository への依存がある候補は除外する。

候補一覧を全ページ取得し、取得完了を確認してから選ぶ。取得が不完全なら確保しない。優先順位は repository 規約に従い、なければ milestone due date、Issue 番号の昇順とする。

## 確保と完了

呼び出し元が repository 単位で定期・イベント・手動実行を直列化する。同じアカウントの別 session も重ねず、排他を確認できない自動実行は選択・更新しない。

選んだ1件を実行者に assign し、workflow を `in-progress` にする。無関係な label と opt-in は保持する。更新後に依存・親・PR・label を再確認し、自分だけが担当する単一の `workflow:in-progress` と着手条件を確認できた場合だけ、Issue URL と選択理由を返す。

候補なしは `no actionable task` として正常終了する。確保失敗や結果不明なら dispatch せず実状態を確認する。コード変更前なら安全に外せる自分の追加担当だけを外し、`sync-issues` で状態を再計算する。

再開対象が明示された場合は同じ作業であることを確認して再利用する。同じアカウントというだけで引き継がず、中断 task は自動解放しない。
