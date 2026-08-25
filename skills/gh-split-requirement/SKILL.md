---
name: gh-split-requirement
description: Split a planned GitHub requirement into labeled implementation task sub-issues with native blocked-by relationships. Use when a completed design is ready to decompose into independently reviewable tasks with explicit prerequisites.
---

# Split Requirement Issue

設計済みの要件 Issue を、依存関係を持つ実装 task Issue に分割する。

## Workflow

1. repository に `kind:requirement`、`kind:task`、`workflow:ready`、`workflow:blocked`、`workflow:in-progress` が存在することを確認する。欠けていれば暗黙に作成せず、`gh-setup-issue-workflow` が必要な setup blocker として停止する。
2. 親 Issue と `ai-design` 区間を読み、open な native Issue、単一の `kind:requirement`、単一の `workflow:ready` または再実行中の `workflow:in-progress` であることを確認する。設計 marker が不完全、blocker が残る、kind/workflow label が不正なら task を作らない。
3. 分割開始時に親を再取得し、現在の `workflow:*` だけを `workflow:in-progress` に置き換える。既存の無関係な label と `automation:enabled` は保持し、更新後に単一性を確認できなければ task を作らない。
4. task を「1つの明確な成果、独立した検証、原則1つの PR」で完了できる単位にする。層ごとの作業より、可能なら end-to-end の価値単位を優先する。
5. task 間の有向非巡回グラフを作る。各 dependency は、その task を開始できない技術的理由がある場合だけ追加する。単なる希望順序は依存関係にしない。循環、自己参照、別 repository dependency があれば Issue 作成前に停止する。
6. 親の native sub-issue と `ai-task-index` を取得し、タイトルと成果が一致する既存 task を再利用する。番号やタイトルだけで曖昧に一致させず、再実行で重複を作らない。
7. dependency のない task から topological order で [assets/task-issue.md](assets/task-issue.md) を使って Issue を作る。task 本文には dependency の正本を置かず、作成時に native parent、native `blocked by`、`kind:task`、導出した workflow label を同時に設定する。
   - native blocker がないか、すべて closed: `workflow:ready`
   - native blocker が1件以上 open または確認不能: `workflow:blocked`
   - `automation:enabled` は明示的な opt-in のため、親から task へ自動継承しない。
8. 作成または再利用した task ごとに Issue を再取得し、parent、`blockedBy` の全件、`kind:*`、`workflow:*` を検証する。pagination を最後まで取得し、取得件数と API の合計数が一致することも確認する。
   - parent が違う場合は平坦な Issue で代用せず停止する。
   - planned dependency が欠け、かつ自分が作成した task だと確認できる場合だけ native relationship の追加を試みる。計画にない blocker は勝手に削除せず、設計との不一致として停止する。
   - kind/workflow label は既存の無関係な label を保持し、観測した管理対象 label だけを目標値へ正規化して再取得する。
   - metadata を確認できない task を後続 task の dependency に使わず、作成済み Issue と失敗箇所を報告して後続作成を停止する。
9. 全 task の native metadata を確認できた後だけ、親 Issue の `ai-task-index` marker 区間を task と dependency の一覧で追記または更新する。dependency 一覧は人間向けの索引であり、native `blocked by` を正本とする。元の要件・設計を保持する。
10. 親 Issue を再取得し、単一の `kind:requirement` と `workflow:in-progress`、全 task の native sub-issue 関係、task index の一致を確認する。確認できない場合は actionable task を後続処理へ渡さない。
11. 作成・再利用した task の URL、workflow label、native dependency graph、作成できなかった項目を返す。event-driven の呼び出し元には `workflow:ready` かつ native blocker が closed の actionable task を明示的に返す。

## Dependency contract

- task の識別には native sub-issue、dependency には native `blocked by` relationship を正本として使う。本文、`Blocks`、親の task index は判定用の fallback にしない。
- 存在しない、open/closed を確認できない、循環する、または取得が不完全な dependency を持つ task は `workflow:blocked` とし、問題を報告する。
- label は native metadata から導出した materialized state とする。task 作成・修復の直前と直後に再取得し、workflow skill 内で欠けた contract label を作成しない。
- API timeout 後は同じ親の native sub-issue を検索し、作成結果が不明なまま同じ task を再作成しない。部分的に作成した task を自動削除せず、再実行で安全に補完できる状態として報告する。
