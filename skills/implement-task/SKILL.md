---
name: implement-task
description: Implement a specified ready GitHub task through a verified pull request. Use for a task supplied by the user, an event, or pick-task; do not scan the backlog.
---

# Implement Ready Task

指定された task Issue を実装し、merge 時に task を close する Pull Request を作る。

## 着手条件

対象 repository と単一の task Issue が必要。未指定なら backlog を探索せず対象を要求する。Issue、親の設計、関連コメントと規約から実装範囲を把握する。

既存 branch と task を閉じる open PR を確認する。該当 PR があれば URL と状態を返して終了する。`workflow:review` なのに該当 PR を確認できなければ、不整合を報告し、新規実装しない。以下は新規実装・再開の条件とする。

- task は open な native sub-issue で、単一の `kind:task` と単一の workflow を持つ。新規着手は未担当の `workflow:ready` に限定する。`workflow:in-progress` は、自分だけが担当し、呼び出し元または利用者から同じ作業の継続と確認できる場合だけ再開する。
- native `blocked by` は全ページを取得して API の合計数と照合し、依存なしまたは全件 closed を確認する。取得不能、自己参照、循環、別 repository への依存を本文で代用しない。
- scheduled invocation は `automation:enabled` が必須。人間・明示的な event invocation にはこの gate を追加しない。

repository に `kind:task`、`workflow:ready`、`workflow:in-progress`、`workflow:review`、`automation:enabled` が必要。欠落時は更新せず `setup-workflow` が必要なことを返す。呼び出し元は repository 単位で定期・イベント・手動実行を直列化し、排他を確認できない自動実行は更新しない。

新規着手の場合は自分を assign し、workflow を `in-progress` にする。コード変更前に、自分だけが担当する単一の `workflow:in-progress`、有効な親・依存・opt-in 条件、既存 PR なしを再確認する。確認できなければ実装しない。

## Attribution

利用者と実行環境の設定に従い、commit と PR の attribution をそれぞれ確認する。明示的に無効なら付けず、有効なら設定された表記を使う。名前・メールを推測せず、別エージェントの署名を流用しない。自動付与と重複させず、既存 contributor と Git author / committer を保持する。

利用可能なら `commit` と `pr-create` を使う。なくても上記を守り、作成後の実際の本文で確認する。表記不明や欠落は報告し、PR の補完は他の本文を保持する。commit の amend は明示的な許可が必要。

## Implementation and completion

task 専用 branch または worktree で、Issue の成果と受入条件を満たす変更を実装する。ユーザーの既存変更を保持し、repository 規約に従う。実装順序や調査方法は task に応じて選び、範囲外の refactor は混ぜない。

変更と受入条件に応じて test の追加・更新、lint、typecheck、build、手動確認を選ぶ。repository の必須チェックは実施する。diff をレビューし、今回の変更による失敗は修正して関連チェックを再実行する。外部要因や利用者の判断が必要で進められない場合は blocker と未検証事項を報告する。

完了には、以下が必要となる。

- task の変更を commit・push し、適用される attribution を実際のコミット本文で確認する。既存の同名 branch を上書きしない。
- PR 本文に変更概要、必要な設計判断、検証結果、リスク・未検証事項、同じ repository の task を閉じる `Closes #<task-number>` を記載する。
- 作成した PR を再取得して attribution と close 対象を確認し、task を単一の `workflow:review` に整合する。Issue は merge 前に閉じず、担当者を保持する。

範囲外の独立した改善は根拠とともに保持し、PR と task の状態を確認した後、関連候補をまとめて最大3件まで `create-follow-up` へ渡す。候補なしなら呼び出さず、重複・作成失敗でも完成した PR を取り消さない。

PR 本文を引き継ぎ情報とし、追加の管理コメントは作らない。PR URL、変更概要、検証結果、follow-up、残った懸念を返して終了する。レビュー監視、CI の継続修正、merge は別途依頼された場合に扱う。

## Failure handling

- test failure や権限不足で完了できない場合、実施内容と blocker を Issue または呼び出し元へ明確に残す。途中変更を破壊的に捨てない。
- PR 作成結果が不明な timeout 後は、head branch と `Closes` 対象で検索してから再試行する。
- task が完了しなかった場合でも独立して再現できる follow-up 候補は終了時の報告で `create-follow-up` へ渡せるが、元 task の failure と blocker を先に報告する。
- task の要件を満たさない partial PR は、明示的な方針がない限り作らない。
- label 更新の直前に Issue を再取得する。既存の無関係な label と `automation:enabled` は保持し、目標 workflow label の存在と更新後の単一性を確認する。workflow skill が label を作成してはならない。
- コード変更前に担当設定や `workflow:in-progress` の確認に失敗したら実装しない。自分が追加した担当だけを安全に外せる場合は外し、`sync-issues` で状態を再計算する。
- コード変更後の中断では担当を保持し、変更場所と再開に必要な情報を呼び出し元へ返す。PR 作成後の label 更新失敗は `sync-issues` で修復し、PR を作り直さない。
