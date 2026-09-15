---
name: setup-workflow
description: Prepare or verify the fixed GitHub workflow labels. Use when adopting the issue workflow or repairing missing labels.
---

# Set Up GitHub Issue Workflow

認証済みの GitHub CLI または同等の API と label 管理権限を使い、対象 repository に固定 label を準備する。Issue への適用や既存 Issue の migration は扱わない。

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
| `origin:agent` | `BFDADC` | Created by an agent for later human triage |

## 更新条件と完了

全 label を取得し、表にある名前の欠落分だけを指定の色・説明で作る。既存の同名 label は再作成しない。色・説明の違いは利用を妨げない presentation drift として報告し、明示的な修復依頼がある場合だけ更新する。表にない label は変更・削除しない。

作成後は全固定 label の存在を再確認し、作成分・既存分・drift・未作成分を報告する。timeout 後は実状態を確認してから不足分を補い、部分成功を取り消さない。

他の workflow skill は label 欠落を暗黙に補わず、このスキルによる setup を必要とする。setup は Issue に `automation:enabled` や `origin:agent` を付ける許可を意味しない。
