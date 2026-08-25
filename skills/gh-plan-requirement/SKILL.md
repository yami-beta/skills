---
name: gh-plan-requirement
description: Refine, investigate, and design an existing human- or agent-authored GitHub requirement issue while maintaining its kind and planning workflow labels. Use when a rough requirement needs clarification, technical discovery, architecture decisions, validation strategy, or planning before task decomposition.
---

# Plan Requirement Issue

人間がカジュアルに作成した要件 Issue、または agent が作成した follow-up requirement を精緻化・調査し、実装可能な設計と計画を Issue 本文へ追記する。このスキルでは要件 Issue を新規作成しない。曖昧さはセッション内の対話で利用者に質問して解決するため、利用者と対話できる文脈で実行する。

## Workflow

1. 指定された対象 Issue の本文、コメント、リンク、repository 規約を読む。対象が指定されていなければ確認し、新規 Issue で代用しない。
2. repository に `kind:requirement`、`workflow:backlog`、`workflow:in-progress`、`workflow:needs-input`、`workflow:ready` が存在することを確認する。欠けていれば暗黙に作成せず、`gh-setup-issue-workflow` が必要な setup blocker として停止する。
3. 対象が open であることを確認する。`kind:*` がなければ `kind:requirement` を追加し、既に `kind:requirement` が1つだけなら保持する。`kind:task` または複数の `kind:*` があれば自動で再分類せず停止する。追加後に Issue を再取得し、単一の `kind:requirement` を確認できなければ workflow label や本文を変更しない。
4. planning 開始時に Issue を再取得し、既存の `workflow:*` だけを `workflow:in-progress` に置き換える。既存の無関係な label と `automation:enabled` は保持し、更新後に `kind:requirement` と単一の `workflow:in-progress` を確認できなければ本文を変更しない。
5. Issue が自由形式または不完全であることを許容し、元の記述から利用者、課題、目的、in-scope、out-of-scope、機能・非機能要件、検証可能な受入条件を抽出して構造化する。記載がない項目を埋めるために意図を捏造しない。
6. codebase、tests、設定、関連 Issue/PR を調べ、現在の挙動、制約、用語、変更境界を把握する。調査結果で要件を具体化できる場合は根拠とともに反映し、根拠のないファイル名や API を捏造しない。
7. 不明点を事実、仮定、判断に分ける。
   - repository や環境から解決できる事実は自力で調査し、利用者への質問にしない。
   - 可逆で影響の小さい選択は仮定として明記して進める。
   - 製品の意図、スコープ、公開 API、データ損失、セキュリティを左右する曖昧さは、利用者に委ねる判断として質問にする。
8. 判断を設計ツリー(ある判断が確定すると次の判断が現れる依存関係)として整理し、フロンティア(他の質問の回答に依存しない、いま質問できる判断)が空になるまでラウンドを繰り返す。
   - 1ラウンドでフロンティア全体をチャットに提示する。各質問は次の形式で、番号、タイトル、本文(選択肢を含めてよい)、推奨回答を必ず付ける。

     ```markdown
     **Q1 - <質問タイトル>**: <質問本文。選択肢があれば列挙>

     - 推奨: <推奨回答と理由>
     ```

   - 事実調査の完了を待ってラウンド全体を止めない。調査結果に依存する質問だけを待たせ、独立した質問は先に出す。
   - 回答を得るたびに設計ツリーを更新してフロンティアを再計算し、次のラウンドを提示する。
   - 利用者が明示的に保留した判断は blocker とし、残りの回答で進められる範囲だけ設計する。
   - 利用者の回答待ちまたは保留された blocker がある状態でターンを終える前に、現在の `workflow:*` だけを `workflow:needs-input` に置き換えて再取得する。label 更新に失敗しても質問は提示し、state drift として明示する。
   - 回答を受けて planning を再開するときは Step 4 と同じ規則で `workflow:in-progress` に戻す。
9. 代替案が実質的にある場合は比較し、採用案と理由を記録する。
10. [assets/design-section.md](assets/design-section.md) に従い、精緻化した要件、設計、変更箇所、移行、テスト、rollout、リスク、タスク分割方針を作る。ラウンドで解決した判断は採用理由とともに該当節へ反映し、保留された判断はラウンドと同じ質問形式で未決事項・blocker 節に記録する。
11. `<!-- ai-design:start -->` と `<!-- ai-design:end -->` の区間を Issue 本文末尾へ追記する。区間が既にあればその区間だけ更新し、元の要望と人手の追記を保持する。再実行時は、Issue コメントや本文に人手で追記された回答を blocker への回答として取り込み、フロンティアを再計算してから設計を更新する。解決した質問は未決事項・blocker 節から設計本文の該当節へ採用理由とともに移す。
12. 重大な blocker がなければ、marker 区間が task 分割の入力として完結していることを確認し、現在の `workflow:*` だけを `workflow:ready` に置き換える。blocker があれば設計済みとして扱わず、`workflow:needs-input` にする。どちらも Issue を更新直前・直後に再取得して kind/workflow label の単一性を確認する。
13. 更新した Issue URL、task 分割へ進めるか、精緻化した要件の要約、主要な設計判断、残った blocker、最終 workflow label を返す。本文更新後に label 更新を確認できなければ task 分割へ自動的に進めず、reconciliation が必要な state drift として報告する。

## Quality bar

- 元の Issue 本文を、精緻化した要件で置き換えない。解釈、仮定、追加した制約を追跡できるようにする。
- 各受入条件を、テストまたは検証手順へ対応付ける。
- 製品判断が必要な不明点を、技術的に可能という理由だけで確定しない。
- repository や環境から自力で調査できる事実を、利用者への質問にしない。
- 利用者への質問には必ず推奨回答を付ける。
- フロンティア(利用者へ質問できる判断)が空であることを設計完了の条件とする。空でなければ設計済みとして扱わない。
- task を作れる粒度まで変更境界を具体化するが、コードを先に実装しない。
- 設計書を別ファイルとして repository に追加するよう明示されている場合は、そのファイルを正本にし、Issue には要約とリンクを追記する。
- API 更新が失敗した場合は本文を再取得し、他者の更新を取り込んで marker 区間だけ再適用する。
- `ai-design` marker 区間と blocker の有無を設計完了の正本にし、workflow label はその状態を検索・表示するために更新する。label だけを根拠に設計済みと判断しない。
- kind/workflow label の更新前後に Issue を再取得し、観測した管理対象 label だけを変更する。API の部分的な失敗を成功と解釈せず、workflow skill 内で欠けた label を作成しない。
