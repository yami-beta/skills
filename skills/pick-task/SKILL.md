---
name: pick-task
description: Find, verify, and assign one automation-enabled GitHub task whose workflow label is ready and whose native dependencies are closed. Use for scheduled or polling dispatch; do not use when a specific task was supplied by an event or user.
---

# Find Ready Task

定期実行または polling 用に、実装可能な task を1件選び、競合しないよう確保する。label は候補検索と状態表示に使い、readiness の事実は GitHub native metadata で再検証する。指定 Issue を処理するイベント駆動ではこのスキルを使わず、直接 `implement-task` を使う。

## Workflow

1. 呼び出し元で repository の workflow 更新を直列実行する。定期実行・イベント・手動実行で同じ排他枠を使う。同じ GitHub アカウントでも別 session は同時実行しない。直列化を確認できない自動実行では選択・更新しない。手動実行も他の実行を停止してから行う。
2. `kind:task`、`workflow:ready`、`workflow:in-progress`、`automation:enabled` が存在することを確認する。欠けていれば `setup-workflow` が必要なことを返す。
3. `kind:task`、`workflow:ready`、`automation:enabled` を持つ open Issue を検索する。親が指定されていればその sub-issue に絞る。
4. 候補の親、全 dependency、assignee、task を閉じる open PR、label を再取得する。親が不正、dependency が open または確認不能、担当者あり、既存 PR あり、必須 label が欠落・複数、または dependency に自己参照・循環・別 repository への参照があれば除外する。dependency は全ページを取得し、本文を代用しない。
5. repository の優先順位規約に従う。規約がなければ milestone due date、Issue 番号の昇順で選ぶ。
6. 1件だけ実行者に assign し、`workflow:ready` を `workflow:in-progress` にする。assign できなければ dispatch しない。無関係な label と `automation:enabled` は保持する。
7. 更新後に親、全 dependency、既存 PR がないこと、`automation:enabled` と単一の `kind:task` を再確認し、自分だけが担当する単一の `workflow:in-progress` であることを確認して Issue URL と選択理由を返す。失敗時は dispatch しない。コード変更前で自分が追加した担当だけを安全に外せる場合は外し、`sync-issues` で状態を再計算する。

候補がなければ `no actionable task` として正常終了する。再開する対象が呼び出し元から明示されている場合は、その Issue の担当と実行状況を確認して再利用し、新しい task を選ばない。同じアカウントの担当というだけで別 session の作業を再開しない。中断した task は自動的に担当解除せず、担当者が再開または明示的に解放する。
