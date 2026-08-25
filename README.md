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
| [`gh-setup-issue-workflow`](skills/gh-setup-issue-workflow/SKILL.md) | workflow が使う固定 label を repository に作成・検証する |
| [`gh-plan-requirement`](skills/gh-plan-requirement/SKILL.md) | 要件を精緻化し、調査・設計・実装計画を親 Issue に追記する |
| [`gh-split-requirement`](skills/gh-split-requirement/SKILL.md) | 計画を依存関係付きの task sub-issue に分割する |
| [`gh-find-ready-task`](skills/gh-find-ready-task/SKILL.md) | 定期実行向けに、着手可能な task を1件選択して確保する |
| [`gh-implement-ready-task`](skills/gh-implement-ready-task/SKILL.md) | 指定された task を実装して Pull Request を作る |
| [`gh-reconcile-issue-state`](skills/gh-reconcile-issue-state/SKILL.md) | prerequisite の完了後に後続 task を着手可能にし、全 task 完了時に要件 Issue を close する |

### Workflow metadata contract

GitHub native metadata を事実の正本とし、固定 label を検索、可視化、scheduled dispatch に使う。workflow を導入する repository では、最初に `gh-setup-issue-workflow` で必要 label を準備する。

| Label | 意味 |
| --- | --- |
| `kind:requirement` | 人間が作成した要件または複数 task をまとめる親 Issue |
| `kind:task` | 原則1つの Pull Request で完了する実装 sub-issue |
| `workflow:backlog` | 未整理または planning 開始前 |
| `workflow:needs-input` | 人間による判断・入力待ち |
| `workflow:ready` | 次の workflow を開始できる |
| `workflow:blocked` | open または確認不能な dependency がある |
| `workflow:in-progress` | planning、task 分割、実装のいずれかを実行中 |
| `workflow:review` | Pull Request 作成済みで CI または人間の review 待ち |
| `automation:enabled` | scheduled agent がこの Issue を処理してよいという opt-in gate |

open な workflow 管理対象 Issue は `kind:*` と `workflow:*` をそれぞれ1つだけ持つ。`automation:enabled` は workflow state とは独立して付け外しする。priority label は作らず、repository の規約、milestone due date、親 Issue 内の task 順、Issue 番号から dispatch 時に決める。

状態の事実が矛盾する場合は、次の優先順位で扱う。

1. Issue の open / closed を完了状態の正本にする。`workflow:done` は作らず、closed Issue の workflow label は判定に使わない。
2. requirement と task の階層は native sub-issue、task の prerequisite は native issue dependency を正本にする。
3. assignee、active claim、task を閉じる open Pull Request を実行中状態の根拠にする。
4. `workflow:*` は上記の事実を検索・表示しやすくした materialized state とし、reconciliation で欠落・重複・矛盾を修復する。

基本遷移は次のとおり。

```text
requirement: backlog -> in-progress -> needs-input | ready -> in-progress -> closed
task:        blocked | ready -> in-progress -> review -> closed
```

label の更新だけでは複数エージェント間の排他を保証できない。対応する release marker がない `<!-- ai-task-claim:<actor-or-run-id> -->` を active claim とし、claim 後に Issue を再取得して assignee、別 claim、open Pull Request を再確認する。

### Trigger patterns

定期実行では、最初に `gh-reconcile-issue-state` の全件整合モードを実行し、次に `gh-find-ready-task`、最後に `gh-implement-ready-task` を実行します。自動実装候補は `kind:task`、`workflow:ready`、`automation:enabled` をすべて持つ open Issue に限定します。

イベント駆動では、task 分割直後に dependency のない task を `gh-implement-ready-task` へ渡します。task Issue が close されたら `gh-reconcile-issue-state` の event mode で直接依存する後続 task を再評価し、返された actionable task を実装処理へ渡します。同じ実行で親要件の完了も判定し、全 sub-issue が完了していれば要件 Issue を close します。設計・分割の2スキルは、どちらのパターンでも手動または Issue イベントから個別に実行できます。

どちらの方式でも、呼び出し側で repository 単位の concurrency 制御を設定し、claim 後に task を再取得して二重着手を防ぎます。

## Validation

`gh skill publish --dry-run` で、全 skill を Agent Skills specification に対して検証します。

```sh
gh skill publish --dry-run
```

skill 名とディレクトリ名の一致、必須 frontmatter（`name` / `description`）、`allowed-tools` が文字列であること、install metadata（`metadata.github-*`）が混入していないことなどを検査します。`license` 未指定の warning は、リポジトリルートの `LICENSE` を正とするため許容します。
