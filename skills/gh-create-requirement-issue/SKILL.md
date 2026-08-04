---
name: gh-create-requirement-issue
description: Create a structured GitHub requirement issue from a feature request, problem statement, or rough requirements. Use when asked to capture requirements in an issue, start issue-driven development, or create the parent issue that will later receive design notes and task sub-issues.
---

# Create Requirement Issue

要件を、設計とタスク分割の起点になる GitHub Issue として作成する。

## Workflow

1. 対象 repository を、ユーザー指定、現在の remote、または会話コンテキストから特定する。特定できない場合だけ確認する。
2. repository の Issue template、CONTRIBUTING、既存ラベル、類似 Issue を調べる。repository 固有の規約を優先する。
3. 類似する open Issue が同じ要件を扱っていないか確認する。重複の可能性が高ければ新規作成せず候補を示す。
4. 入力から観測できる事実と仮定を分け、[assets/requirement-issue.md](assets/requirement-issue.md) に沿って本文を作る。解決策を要件として固定しない。
5. 受入条件を検証可能な表現にする。重要な情報が不足していても、安全に仮定できる範囲は `仮定`、設計を左右するものは `未決事項` に記録する。
6. Issue を作成し、既存なら `type:requirement` と `workflow:planning` を付ける。ラベルが存在せず作成権限がある場合は作る。repository 固有ラベルが同じ意味を持つ場合はそちらを使う。
7. 作成した Issue の番号、URL、残った未決事項を返す。

## Rules

- ユーザーが Issue 作成を依頼している場合、本文の再承認を必須にしない。
- API または CLI の失敗後は、同じタイトルや識別可能な本文を検索してから再試行し、重複作成を防ぐ。
- 実装タスク、設計詳細、依存関係はこの段階で推測して sub-issue 化しない。
- 認証情報、非公開の内部情報、不要な個人情報を本文に含めない。
