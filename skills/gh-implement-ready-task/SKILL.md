---
name: gh-implement-ready-task
description: Implement one specified GitHub task issue that is ready, verify the change, push a focused branch, and open a pull request that closes the task on merge. Use after a ready-label event or after gh-find-ready-task has selected and claimed a task; do not use this skill to scan the backlog.
---

# Implement Ready Task

指定された task Issue を実装し、merge 時に task を close する Pull Request を作る。

## Preconditions

1. 対象 repository と単一の task Issue を特定する。Issue が指定されていなければ backlog を探索せず、呼び出し元に対象を要求する。
2. Issue 本文、親要件、設計、コメント、repository 規約を読む。
3. `Depends on` の全 Issue が closed であることを GitHub 上で再確認する。ラベルだけを信用しない。不正な dependency または open dependency があれば実装せず `workflow:blocked` に整合させる。
4. 同じ task を close する open PR、既存 branch、他者の claim を検索する。既存 PR があれば重複実装せず、その URL を返す。
5. `workflow:ready` なら自分の claim marker を付けて `workflow:in-progress` に遷移する。他者が確保済みなら停止する。

## Implementation

1. 現在の worktree と未保存変更を確認し、ユーザーの変更を保持する。repository 規約に従う task 専用 branch または worktree を使う。
2. Issue の成果と受入条件に必要な最小変更を実装する。スコープ外の refactor を混ぜない。
3. repository の既存 test pattern に沿って test を追加または更新する。関連する test、lint、typecheck、build を実行し、結果を記録する。
4. diff を自己レビューし、受入条件、互換性、エラー処理、セキュリティ、migration を確認する。
5. task を表す commit を作り、branch を push する。失敗時に同名 branch が存在するなら内容と所有者を確認し、上書きしない。
6. Pull Request を作る。本文には次を含める。
   - 変更概要と設計判断
   - 検証結果
   - リスクまたは未検証事項
   - 同じ repository の task を merge 時に閉じる `Closes #<task-number>`
7. Issue に PR をリンクし、`workflow:in-progress` のままにする。PR 作成時点では Issue を close しない。
8. PR URL、変更概要、test 結果、残った懸念を返す。

## Failure handling

- test failure や権限不足で完了できない場合、実施内容と blocker を Issue または呼び出し元へ明確に残す。途中変更を破壊的に捨てない。
- PR 作成結果が不明な timeout 後は、head branch と `Closes` 対象で検索してから再試行する。
- task の要件を満たさない partial PR は、明示的な方針がない限り作らない。
