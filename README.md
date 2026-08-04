# Personal Agent Skills

個人利用する [Agent Skills](https://agentskills.io/) のコレクションです。各 skill は [Agent Skills specification](https://agentskills.io/specification) に従います。

## Repository structure

```text
skills/
└── <skill-name>/
    ├── SKILL.md          # 必須: YAML frontmatter と指示
    ├── scripts/          # 任意: 実行可能な処理
    ├── references/       # 任意: 必要時に読む資料
    ├── assets/           # 任意: テンプレートなどの静的リソース
    └── agents/           # 任意: Codex/OpenAI 向け UI metadata
```

`SKILL.md` の `name` は親ディレクトリ名と一致させ、64文字以内の lowercase kebab-case にします。`description` には skill の機能と発火条件の両方を記載します。`agents/` は Agent Skills specification が許容する追加ディレクトリであり、skill の移植性に必要な情報は `SKILL.md` と標準リソース内に保持します。

## Issue-driven development workflow

人間が作成した要件 Issue を起点に、以下のスキルを順に組み合わせると、要件の精緻化から実装 Pull Request までを GitHub Issue の依存関係付きで進行できます。

要件 Issue は自由形式で、背景や要望だけをカジュアルに記載して構いません。Agent は元の記述を保持し、コメントや codebase の調査結果を使って目的、スコープ、要件、受入条件、未決事項を明示してから設計へ進みます。

| Skill | 役割 |
| --- | --- |
| [`gh-plan-requirement-issue`](skills/gh-plan-requirement-issue/SKILL.md) | 要件を精緻化し、調査・設計・実装計画を親 Issue に追記する |
| [`gh-split-requirement-issue`](skills/gh-split-requirement-issue/SKILL.md) | 計画を依存関係付きの task sub-issue に分割する |
| [`gh-find-ready-task`](skills/gh-find-ready-task/SKILL.md) | 定期実行向けに、着手可能な task を1件選択して確保する |
| [`gh-implement-ready-task`](skills/gh-implement-ready-task/SKILL.md) | 指定された task を実装して Pull Request を作る |
| [`gh-update-task-readiness`](skills/gh-update-task-readiness/SKILL.md) | prerequisite の完了後に後続 task を着手可能にする |

### Trigger patterns

定期実行では、最初に `gh-update-task-readiness` の全件整合モードを実行し、次に `gh-find-ready-task`、最後に `gh-implement-ready-task` を実行します。

イベント駆動では、task Issue に `workflow:ready` が付いたイベントから `gh-implement-ready-task` を実行し、task Issue が close されたイベントから `gh-update-task-readiness` の単一 Issue モードを実行します。設計・分割の2スキルは、どちらのパターンでも手動または Issue イベントから個別に実行できます。

どちらの方式でも、task は GitHub の native sub-issue として親要件へ関連付け、Issue 本文の `- Depends on: #123, #124` を依存関係の正本として使います。

## Validation

公式の [`skills-ref`](https://github.com/agentskills/agentskills/tree/main/skills-ref) をインストールした環境で、各 skill を検証します。

```sh
for skill in skills/*; do
  skills-ref validate "$skill"
done
```
