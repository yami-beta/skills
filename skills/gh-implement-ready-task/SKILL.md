---
name: gh-implement-ready-task
description: Implement one specified GitHub task after validating its workflow labels and native dependencies, open a pull request, and capture eligible out-of-scope follow-ups for human triage. Use after task creation, dependency completion, or gh-find-ready-task; do not use this skill to scan the backlog.
---

# Implement Ready Task

指定された task Issue を実装し、merge 時に task を close する Pull Request を作る。

## Preconditions

1. 対象 repository と単一の task Issue を特定する。Issue が指定されていなければ backlog を探索せず、呼び出し元に対象を要求する。
2. Issue 本文、親要件、設計、コメント、repository 規約を読む。
3. repository に `kind:task`、`workflow:ready`、`workflow:in-progress`、`workflow:review`、`automation:enabled` が存在することを確認する。欠けていれば暗黙に作成せず、`gh-setup-issue-workflow` が必要な setup blocker として停止する。
4. task が open な native sub-issue で、`kind:task` とちょうど1つの `workflow:*` を持つことを確認する。未着手なら `workflow:ready`、呼び出し元が既に確保済みなら `workflow:in-progress` でなければ実装しない。scheduled invocation では `automation:enabled` も必須とし、人間または明示的な event invocation ではこの gate を勝手に追加・要求しない。
5. native `blocked by` relationship を pagination の最後まで取得し、取得件数と API が返す合計数が一致したうえで、blocker がないか全 blocker が closed であることを GitHub 上で再確認する。open、参照不能、循環、自己参照、別 repository、または取得結果が不完全な dependency があれば実装せず、blocked または invalid の理由を返す。本文の dependency 表現へ fallback しない。
6. 同じ task を close する open PR、既存 branch、他者の assignee または未解除 claim を検索する。既存 PR があれば重複実装しない。PR と task の関係を確認し、現在の `workflow:*` だけを `workflow:review` に置き換えてから、その URL を返す。label 更新に失敗した場合も PR を正本として state drift を報告する。
7. 自分の active claim がなければ、可能なら自分を assign し、claim marker を付ける。続いて現在の labels を再取得し、既存の `workflow:*` だけを `workflow:in-progress` に置き換える。他者の assignee または未解除 claim があれば停止する。
8. claim と label 更新後に task を再取得し、native dependency、`kind:task`、単一の `workflow:in-progress`、自分以外の assignee、別 claim、open PR を再確認する。scheduled invocation では `automation:enabled` も再確認する。競合または確認不能な状態があればコードを変更しない。

## Implementation

1. 現在の worktree と未保存変更を確認し、ユーザーの変更を保持する。repository 規約に従う task 専用 branch または worktree を使う。
2. Issue の成果と受入条件に必要な最小変更を実装する。スコープ外の refactor を混ぜない。
3. repository の既存 test pattern に沿って test を追加または更新する。関連する test、lint、typecheck、build を実行し、結果を記録する。
4. diff を自己レビューし、受入条件、互換性、エラー処理、セキュリティ、migration を確認する。現在の task 範囲外にある独立した改善を見つけた場合は変更へ混ぜず、根拠とともに follow-up 候補として保持する。
5. task を表す commit を作り、branch を push する。失敗時に同名 branch が存在するなら内容と所有者を確認し、上書きしない。
6. Pull Request を作る。本文には次を含める。
   - 変更概要と設計判断
   - 検証結果
   - リスクまたは未検証事項
   - 同じ repository の task を merge 時に閉じる `Closes #<task-number>`
7. PR が作成されたことと task を閉じる関係を再取得して確認してから、現在の `workflow:*` だけを `workflow:review` に置き換える。Issue は merge 前に close しない。
8. PR と単一の `workflow:review` を確認した後、保持した follow-up 候補があれば関連する候補をまとめ、最大3件まで `gh-create-follow-up-issue` へ渡す。候補がなければ呼び出さない。follow-up の重複、setup blocker、作成失敗は現在の PR を取り消す理由にせず、結果とともに報告する。
9. Issue を再取得して単一の `workflow:review` と open PR を確認し、PR URL、変更概要、test 結果、作成または再利用した follow-up、残った懸念を返す。

## Failure handling

- test failure や権限不足で完了できない場合、実施内容と blocker を Issue または呼び出し元へ明確に残す。途中変更を破壊的に捨てない。
- PR 作成結果が不明な timeout 後は、head branch と `Closes` 対象で検索してから再試行する。
- task が完了しなかった場合でも独立して再現できる follow-up 候補は最終 handoff で `gh-create-follow-up-issue` へ渡せるが、元 task の failure と blocker を先に報告する。
- task の要件を満たさない partial PR は、明示的な方針がない限り作らない。
- label 更新の直前に Issue を再取得する。既存の無関係な label と `automation:enabled` は保持し、目標 workflow label の存在と更新後の単一性を確認する。workflow skill が label を作成してはならない。
- コード変更前に `workflow:in-progress` への更新または確認が失敗した場合は実装しない。自分が作った claim だけを安全に解除できる場合は unassign し、release marker を残す。
- コード変更、push、または PR が存在する段階では claim と assignee を維持し、失敗箇所を報告する。PR 作成後に `workflow:review` への更新が失敗しても PR を閉じたり作り直したりせず、PR を正本として reconciliation が必要な state drift を報告する。
- label は進捗の materialized state であり、native dependency、assignee、claim、open PR の確認を省略する理由にしない。GitHub API の部分的な失敗を ready と解釈しない。
