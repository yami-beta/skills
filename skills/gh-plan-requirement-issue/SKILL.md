---
name: gh-plan-requirement-issue
description: Investigate and design an existing GitHub requirement issue, create an implementation plan and design document, and append it to the issue body without losing the original requirements. Use when a requirement issue needs technical discovery, architecture decisions, risks, validation strategy, or a plan before task decomposition.
---

# Plan Requirement Issue

既存の要件 Issue を調査し、実装可能な設計と計画を Issue 本文へ追記する。

## Workflow

1. 対象 Issue の本文、コメント、リンク、repository 規約を読む。`type:requirement` でない場合も、内容が要件 Issue なら処理できる。
2. codebase、tests、設定、関連 Issue/PR を調べ、現在の構造と変更境界を把握する。根拠のないファイル名や API を捏造しない。
3. 未決事項を分類する。
   - repository から解決できるものは調査する。
   - 可逆で影響の小さい選択は仮定として明記して進める。
   - スコープ、公開 API、データ損失、セキュリティを左右するものは計画上の blocker として明記する。
4. 代替案が実質的にある場合は比較し、採用案と理由を記録する。
5. [assets/design-section.md](assets/design-section.md) に従い、設計、変更箇所、移行、テスト、rollout、リスク、タスク分割方針を作る。
6. `<!-- ai-design:start -->` と `<!-- ai-design:end -->` の区間を Issue 本文末尾へ追記する。区間が既にあればその区間だけ更新し、元の要件と人手の追記を保持する。
7. `workflow:planning` を外して `workflow:planned` を付ける。ただし重大な blocker が残る場合は planning のままにする。
8. 更新した Issue URL、主要な設計判断、残った blocker を返す。

## Quality bar

- 各受入条件を、テストまたは検証手順へ対応付ける。
- task を作れる粒度まで変更境界を具体化するが、コードを先に実装しない。
- 設計書を別ファイルとして repository に追加するよう明示されている場合は、そのファイルを正本にし、Issue には要約とリンクを追記する。
- API 更新が失敗した場合は本文を再取得し、他者の更新を取り込んで marker 区間だけ再適用する。
