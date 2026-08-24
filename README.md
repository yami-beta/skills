# Personal Agent Skills

個人利用する [Agent Skills](https://agentskills.io/) のコレクションです。各 skill は [Agent Skills specification](https://agentskills.io/specification) に従います。

## Installation

[GitHub CLI](https://cli.github.com/) の `gh skill`（preview）で導入します。

```sh
# Codex
gh skill install yami-beta/skills --all --agent codex --scope user

# Claude Code
gh skill install yami-beta/skills --all --agent claude-code --scope user
```

`--agent` には利用するエージェントの識別子を指定します。Cursor は `cursor`、Gemini CLI は `gemini-cli` に置き換えます。利用可能な値は `gh skill install --help` で確認できます。

更新は `gh skill update --all` で行います。リリースタグは作成していないため、既定ブランチの HEAD が常に取得されます。

エージェントごとのディレクトリへ配置されるのは複製であり、`gh skill update` で上書きされます。skill を変更するときはこのリポジトリを編集してください。

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

`allowed-tools` は Agent Skills specification に従う space-separated string とし、権限付与が実装されていないエージェントでも skill 本体が動作するよう、処理の前提にはしません。`argument-hint` は Claude Code と GitHub Copilot の入力 UI 向け拡張として文字列で記述し、Codex ではこの補助情報の動作を前提にしません。仕様外キーを拒否する厳格な配布経路には、そのままでは使用できない点に注意してください。

## Git/GitHub workflow

日々の commit と Pull Request 操作を担う skill です。`pr-create` は未コミットの変更があれば `commit` を呼び、PR 作成後に任意で `pr-monitor` を呼びます。`pr-merge` も CI が pending のとき `pr-monitor` を呼びます。

| Skill | 役割 |
| --- | --- |
| [`commit`](skills/commit/SKILL.md) | 変更を確認し、Conventional Commits 形式の commit を作成する |
| [`pr-create`](skills/pr-create/SKILL.md) | 未コミットの変更を commit し、push して Pull Request を作成する |
| [`pr-merge`](skills/pr-merge/SKILL.md) | CI とレビュー状態を確認し、リポジトリの慣習に応じた方法で merge する |
| [`pr-monitor`](skills/pr-monitor/SKILL.md) | CI チェックの完了を監視し、結果を報告する |

## Issue-driven development workflow

人間が作成した要件 Issue を起点に、以下のスキルを順に組み合わせると、要件の精緻化から実装 Pull Request までを GitHub Issue の依存関係付きで進行できます。

要件 Issue は自由形式で、背景や要望だけをカジュアルに記載して構いません。Agent は元の記述を保持し、コメントや codebase の調査結果を使って目的、スコープ、要件、受入条件、未決事項を明示してから設計へ進みます。

| Skill | 役割 |
| --- | --- |
| [`gh-plan-requirement`](skills/gh-plan-requirement/SKILL.md) | 要件を精緻化し、調査・設計・実装計画を親 Issue に追記する |
| [`gh-split-requirement`](skills/gh-split-requirement/SKILL.md) | 計画を依存関係付きの task sub-issue に分割する |
| [`gh-find-ready-task`](skills/gh-find-ready-task/SKILL.md) | 定期実行向けに、着手可能な task を1件選択して確保する |
| [`gh-implement-ready-task`](skills/gh-implement-ready-task/SKILL.md) | 指定された task を実装して Pull Request を作る |
| [`gh-update-task-readiness`](skills/gh-update-task-readiness/SKILL.md) | prerequisite の完了後に後続 task を着手可能にする |

### Label-free state model

このワークフローは Issue label を使わない。状態を別の metadata として重複保存せず、GitHub 上の正本から実行時に導出する。

| 状態 | 判定方法 |
| --- | --- |
| 要件 Issue | ワークフローへ指定された起点 Issue |
| 設計済み | 完成した `ai-design` marker 区間があり、task 分割を妨げる未決事項がない |
| task | 要件 Issue に属する open な native sub-issue |
| blocked | `Depends on` に open または確認不能な Issue がある |
| actionable | 全 dependency が closed で、active claim、assignee、open PR がない |
| in progress | active claim、assignee、または task を閉じる open PR がある |
| completed | task Issue が closed |

task 本文の `- Depends on: #123, #124` を依存関係の正本とする。対応する release marker がない claim marker を active claim とする。claim comment は並行実行の排他と監査にだけ使い、task の readiness は常に dependency の実状態から再計算する。

### Trigger patterns

定期実行では、最初に `gh-update-task-readiness` の全件整合モードを実行し、次に `gh-find-ready-task`、最後に `gh-implement-ready-task` を実行します。

イベント駆動では、task 分割直後に dependency のない task を `gh-implement-ready-task` へ渡します。task Issue が close されたら `gh-update-task-readiness` の event mode で直接依存する後続 task を再評価し、返された actionable task を実装処理へ渡します。設計・分割の2スキルは、どちらのパターンでも手動または Issue イベントから個別に実行できます。

どちらの方式でも、呼び出し側で repository 単位の concurrency 制御を設定し、claim 後に task を再取得して二重着手を防ぎます。

## Validation

`gh skill publish --dry-run` で、全 skill を Agent Skills specification に対して検証します。

```sh
gh skill publish --dry-run
```

skill 名とディレクトリ名の一致、必須 frontmatter（`name` / `description`）、`allowed-tools` が文字列であること、install metadata（`metadata.github-*`）が混入していないことなどを検査します。`license` 未指定の warning は、リポジトリルートの `LICENSE` を正とするため許容します。
