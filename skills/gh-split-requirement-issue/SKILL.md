---
name: gh-split-requirement-issue
description: Split a planned GitHub requirement issue into implementation task sub-issues, record a dependency DAG, and assign initial ready or blocked workflow labels. Use when a design is ready to decompose into independently reviewable tasks or when creating GitHub sub-issues with explicit prerequisites.
---

# Split Requirement Issue

設計済みの要件 Issue を、依存関係を持つ実装 task Issue に分割する。

## Workflow

1. 親 Issue の要件と `ai-design` 区間を読む。設計が task 化できないほど曖昧なら、作成せず不足点を返す。
2. task を「1つの明確な成果、独立した検証、原則1つの PR」で完了できる単位にする。層ごとの作業より、可能なら end-to-end の価値単位を優先する。
3. task 間の有向非巡回グラフを作る。各 dependency は、その task を開始できない技術的理由がある場合だけ追加する。単なる希望順序は依存関係にしない。
4. 同じ親を示す既存 task/sub-issue を検索し、タイトルと成果が一致するものを再利用する。再実行で重複を作らない。
5. dependency のない task から topological order で Issue を作る。[assets/task-issue.md](assets/task-issue.md) を使い、次の機械可読行を必ず1行だけ置く。
   - dependency なし: `- Depends on: none`
   - dependency あり: `- Depends on: #123, #124`
6. 各 task を GitHub の native sub-issue として親 Issue に関連付ける。現在の GitHub connector に操作がなければ、利用可能な GitHub API または `gh` を使う。repository 設定または権限のため関連付けられない場合は、平坦な Issue で代用せず、作成済み Issue と blocker を報告して停止する。
7. dependency なしには `type:task` と `workflow:ready`、ありには `type:task` と `workflow:blocked` を付ける。workflow state ラベルは1つだけにする。
8. 親 Issue の `ai-task-index` marker 区間を、task と dependency の一覧で追記または更新する。元の要件・設計を保持する。
9. 作成・再利用した task の URL、状態、dependency graph、作成できなかった項目を返す。

## Dependency contract

- task 本文の `Depends on` 行を依存関係の正本にする。`Blocks` や親の一覧は参照用であり、矛盾時は正本から再生成する。
- 同じ repository の Issue 番号だけを記載する。外部 repository 依存は通常のリンクと blocker 説明を併記し、自動で ready にしない。
- 存在しない、open/closed を確認できない、または循環する dependency を持つ task は `workflow:blocked` のままにして問題を報告する。
