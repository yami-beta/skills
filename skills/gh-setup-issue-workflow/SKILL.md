---
name: gh-setup-issue-workflow
description: Set up or verify the fixed GitHub labels required by this issue-driven development workflow. Use before adopting the workflow in a repository, after workflow labels were deleted, or when another workflow skill reports missing labels.
---

# Set Up GitHub Issue Workflow

対象 repository に workflow metadata contract の固定 label を準備する。この skill は label schema だけを管理し、Issue への label 適用や既存 Issue の migration は行わない。

## Label contract

| Name | Color | Description |
| --- | --- | --- |
| `kind:requirement` | `5319E7` | Requirement or parent issue managed by the issue workflow |
| `kind:task` | `1D76DB` | Implementation task managed by the issue workflow |
| `workflow:backlog` | `D0D7DE` | Waiting for planning or triage |
| `workflow:needs-input` | `FBCA04` | Waiting for human input or a decision |
| `workflow:ready` | `0E8A16` | Ready for the next workflow step |
| `workflow:blocked` | `D73A4A` | Blocked by an open or unverifiable dependency |
| `workflow:in-progress` | `1D76DB` | Planning, splitting, or implementation is in progress |
| `workflow:review` | `A371F7` | Pull request is waiting for CI or human review |
| `automation:enabled` | `006B75` | Scheduled agents may process this issue |

## Workflow

1. 対象 repository を特定し、認証済みの GitHub CLI または同等の GitHub API access と label 管理権限があることを確認する。
2. repository の全 label を名前、色、説明付きで取得する。
3. contract の各 label を評価する。
   - 同名 label が存在する場合は再作成せず、色または説明の差異を drift として記録する。名前が一致すれば workflow の利用を妨げない presentation drift として扱い、明示的な修復依頼なしに更新しない。
   - label が存在しない場合は表の名前、色、説明で作成する。
4. 作成後に全 contract label を再取得し、欠落がないことを確認する。
5. 作成した label、既存だった label、presentation drift、権限または API error のため作成できなかった label を返す。

## Safety and idempotency

- contract にない既存 label を変更または削除しない。
- contract label の名前を入力から生成せず、表の固定値だけを使う。
- 同名 label がある状態で作成を再試行せず、API timeout 後は label 一覧を再取得して結果を確認する。
- 部分的に作成した後で失敗した場合は成功分を削除しない。再実行で残りだけを作成できる状態として報告する。
- workflow skills は必要 label が欠けている場合に typo や類似名の label を暗黙作成せず、この setup skill の実行を要求する。
- この skill の実行は Issue に `automation:enabled` を付ける許可を意味しない。
