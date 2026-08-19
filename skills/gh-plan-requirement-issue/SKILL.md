---
name: gh-plan-requirement-issue
description: Refine, investigate, and design an existing human-authored GitHub requirement issue, turning an informal or incomplete request into explicit goals, scope, requirements, acceptance criteria, and an implementation plan without losing the original text. Use when a rough requirement issue needs clarification, technical discovery, architecture decisions, validation strategy, or planning before task decomposition.
---

# Plan Requirement Issue

人間がカジュアルに作成した既存の要件 Issue を精緻化・調査し、実装可能な設計と計画を Issue 本文へ追記する。このスキルでは要件 Issue を新規作成しない。

## Workflow

1. 指定された対象 Issue の本文、コメント、リンク、repository 規約を読む。対象が指定されていなければ確認し、新規 Issue で代用しない。Issue の分類 metadata は要求しない。
2. Issue が自由形式または不完全であることを許容し、元の記述から利用者、課題、目的、in-scope、out-of-scope、機能・非機能要件、検証可能な受入条件を抽出して構造化する。記載がない項目を埋めるために意図を捏造しない。
3. codebase、tests、設定、関連 Issue/PR を調べ、現在の挙動、制約、用語、変更境界を把握する。調査結果で要件を具体化できる場合は根拠とともに反映し、根拠のないファイル名や API を捏造しない。
4. 事実、仮定、未決事項を分ける。
   - repository から解決できるものは調査する。
   - 可逆で影響の小さい選択は仮定として明記して進める。
   - 製品の意図、スコープ、公開 API、データ損失、セキュリティを左右する曖昧さは質問として残し、計画上の blocker として明記する。
5. 代替案が実質的にある場合は比較し、採用案と理由を記録する。
6. [assets/design-section.md](assets/design-section.md) に従い、精緻化した要件、設計、変更箇所、移行、テスト、rollout、リスク、タスク分割方針を作る。
7. `<!-- ai-design:start -->` と `<!-- ai-design:end -->` の区間を Issue 本文末尾へ追記する。区間が既にあればその区間だけ更新し、元の要望と人手の追記を保持する。
8. 重大な blocker がなければ、marker 区間が task 分割の入力として完結していることを確認する。blocker があれば未決事項に明記し、設計済みとして扱わない。
9. 更新した Issue URL、task 分割へ進めるか、精緻化した要件の要約、主要な設計判断、残った blocker を返す。

## Quality bar

- 元の Issue 本文を、精緻化した要件で置き換えない。解釈、仮定、追加した制約を追跡できるようにする。
- 各受入条件を、テストまたは検証手順へ対応付ける。
- 製品判断が必要な不明点を、技術的に可能という理由だけで確定しない。
- task を作れる粒度まで変更境界を具体化するが、コードを先に実装しない。
- 設計書を別ファイルとして repository に追加するよう明示されている場合は、そのファイルを正本にし、Issue には要約とリンクを追記する。
- API 更新が失敗した場合は本文を再取得し、他者の更新を取り込んで marker 区間だけ再適用する。
- Issue label を状態管理に使わない。設計済みかどうかは `ai-design` marker 区間の内容と blocker の有無から判断する。
