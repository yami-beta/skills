# Personal Agent Skills

個人利用する [Agent Skills](https://agentskills.io/) のコレクションです。各 skill は [Agent Skills specification](https://agentskills.io/specification) に従います。

## Installation

Claude Code では plugin として、Codex など他のエージェントでは `gh skill` で導入します。同じ skill を両方の経路で導入すると重複して表示されるため、エージェントごとにどちらか一方を使います。

### Claude Code plugin

このリポジトリは Claude Code の plugin marketplace（`yami-beta`）を兼ねており、skill を用途別の plugin として配布します。必要な plugin だけを導入します。

| Plugin | Skill |
| --- | --- |
| `git-workflow` | `commit`, `pr-create`, `pr-resume`, `pr-merge`, `pr-monitor`, `cloud-handoff` |
| `issue-workflow` | `setup-workflow`, `plan-requirement`, `pick-task`, `implement-task`, `create-follow-up`, `sync-issues` |

`issue-workflow` は `commit` と `pr-create` を使うため `git-workflow` に依存しており、導入すると `git-workflow` も導入されます。リポジトリ固有の運用に依存するため、`--scope project` で対象リポジトリに導入します。

```sh
claude plugin marketplace add yami-beta/skills
claude plugin install git-workflow@yami-beta

# issue-driven workflow を project scope へ（対象リポジトリ内で実行）
claude plugin install issue-workflow@yami-beta --scope project
```

plugin の skill は `/git-workflow:commit` のように plugin 名で修飾して呼び出します。この README の `$pr-resume` のような例は、plugin では `/git-workflow:pr-resume` に読み替えます。

plugin に `version` を持たせていないため、commit SHA で更新を判定します。自作 marketplace は auto-update が既定で無効なので、`claude plugin marketplace update yami-beta` の後に `claude plugin update <plugin>@yami-beta` で更新するか、`/plugin` の Marketplaces タブで auto-update を有効にします。

#### Cloud sessions

クラウドセッションは手元に登録した marketplace や導入した plugin を読み込まず、リポジトリの `.claude/settings.json` で宣言した marketplace も追加しません。また、このリポジトリは private のため、セッションに追加していないリポジトリとしては GitHub から取得できません。そこで、セッションに yami-beta/skills を追加し、clone された作業ツリーを local directory の marketplace として登録します。

1. claude.ai/code の環境設定にある setup script で marketplace を登録し、その環境で使う plugin を導入します。

   ```sh
   #!/bin/bash
   claude plugin marketplace add /home/user/skills || true
   claude plugin install git-workflow@yami-beta || true
   ```

2. その環境でセッションを開始するとき、作業対象のリポジトリに加えて yami-beta/skills を追加します。

setup script は Claude Code の起動前に実行され、その時点でセッションに追加したリポジトリは `/home/user/<repo>` に clone されています。local directory の marketplace の plugin はコピーされずにその場所から読み込まれるため、セッションで選んだ yami-beta/skills のブランチの内容がそのまま使われます。yami-beta/skills を追加しないセッションでは plugin は読み込まれません。

setup script の結果は環境単位でキャッシュされ、その環境のすべてのセッションで使われます。使う plugin はプロジェクトごとに環境を分けて選びます。1つの環境で複数のプロジェクトを使い分けたい場合は、setup script では marketplace の登録だけを行い、作業対象のリポジトリの `.claude/settings.json` で使う plugin を有効にしてコミットします。

```json
{
  "enabledPlugins": {
    "git-workflow@yami-beta": true
  }
}
```

複数のリポジトリを追加したセッションでも、各リポジトリの `.claude/settings.json` の `enabledPlugins` は読み込まれ、marketplace 内の plugin は導入しなくても有効になります。他の人と共有するリポジトリにコミットすると、marketplace を登録していない人の環境では plugin が見つからないエラーが表示されます。

### gh skill

[GitHub CLI](https://cli.github.com/) の `gh skill`（preview）で導入します。skill によって適した scope が異なります。

- **project scope**（`--scope` の既定値）: GitHub の issue や label を前提とする issue-driven development workflow の skill（`setup-workflow`, `plan-requirement`, `pick-task`, `implement-task`, `create-follow-up`, `sync-issues`）。リポジトリ固有の運用に依存するため、対象リポジトリの中で導入します。
- **user scope**: リポジトリ固有の前提を持たない `commit`, `pr-create`, `pr-resume`, `pr-merge`, `pr-monitor`, `cloud-handoff`。

```sh
# issue-driven workflow の skill を project scope へ（対象リポジトリ内で実行）
gh skill install yami-beta/skills setup-workflow plan-requirement pick-task \
  implement-task create-follow-up sync-issues --agent claude-code

# 汎用 skill を user scope へ
gh skill install yami-beta/skills commit pr-create pr-resume pr-merge pr-monitor cloud-handoff \
  --agent claude-code --scope user
```

`--agent` には利用するエージェントの識別子を指定します。Codex は `codex`、Cursor は `cursor`、Gemini CLI は `gemini-cli` に置き換えます。利用可能な値は `gh skill install --help` で確認できます。

同名の skill が両 scope に存在する場合、Claude Code は user scope を優先します。project scope の版を使わせたい skill は user scope へ導入しないでください。

#### Updating

更新は `gh skill update --all` で行います。リリースタグは作成していないため、既定ブランチの HEAD が常に取得されます。scope ごとに導入した skill は、その scope の位置（project scope なら対象リポジトリ内）で更新します。

エージェントごとのディレクトリへ配置されるのは複製であり、`gh skill update` で上書きされます。skill を変更するときはこのリポジトリを編集してください。frontmatter の `metadata.github-*` は install 時に注入されるものであり、このリポジトリ側の `SKILL.md` には持たせません。

`gh skill update` は skill の改名・削除を追随しません。旧パスを指す installed copy を残したまま "All skills are up to date." と報告します。改名・削除したときは `--force` 付きの install で導入し直し、旧ディレクトリを手動で削除してください（`gh skill` に uninstall subcommand はありません）。

このリポジトリ自身の中で `gh skill update --all` や `gh skill list` を実行すると、`skills/*` が project scope の published skill として列挙され、`<name> has no GitHub metadata` という warning が出ます。正本に `metadata.github-*` を持たせない運用どおりの状態であり、installed copy の更新漏れとは別です。

## Repository structure

```text
.claude-plugin/
└── marketplace.json      # Claude Code plugin marketplace と各 plugin の skill 構成
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

skill は単体で完結させ、利用者側の `CLAUDE.md` や `AGENTS.md` など外部の設定に依存する記述を置きません。skill の動作に必要な前提は `SKILL.md` と標準リソースの中に書きます。

## Git/GitHub workflow

日々の commit と Pull Request 操作を担う skill です。`pr-create` は未コミットの変更があれば `commit` を呼び、PR 作成後に任意で `pr-monitor` を呼びます。`pr-merge` も CI が pending のとき `pr-monitor` を呼びます。

| Skill | 役割 |
| --- | --- |
| [`commit`](skills/commit/SKILL.md) | 変更を確認し、Conventional Commits 形式の commit を作成する |
| [`pr-create`](skills/pr-create/SKILL.md) | 未コミットの変更を commit し、push して Pull Request を作成する |
| [`pr-resume`](skills/pr-resume/SKILL.md) | 自動実装などが作成した既存 PR を引き継ぎ、残作業の実装・修正・検証を行う |
| [`pr-merge`](skills/pr-merge/SKILL.md) | CI とレビュー状態を確認し、リポジトリの慣習に応じた方法で merge する |
| [`pr-monitor`](skills/pr-monitor/SKILL.md) | CI チェックの完了を監視し、結果を報告する |

## Session handoff

[`cloud-handoff`](skills/cloud-handoff/SKILL.md) は、ローカルで進めている作業のコード・判断・残作業・検証結果を、Claude Code や Codex のクラウドセッションへ引き継ぎます。利用可能な正式機能で受け渡し、直接起動できない環境では引き継ぎ文と手動操作を返します。

利用例: `$cloud-handoff この作業をクラウドに引き継いで、残りの実装とテスト、PR 作成まで進めてください`。実行せず準備だけ行う場合は、その旨を指定します。

## Issue-driven development workflow

既存の要件 Issue、または実装中に agent が提案した follow-up Issue を起点に、以下のスキルを順に組み合わせると、要件の整理から実装 Pull Request までを GitHub Issue の依存関係付きで進行できます。

要件 Issue は自由形式で、初期段階では背景や要望だけの記述でも構いません。Agent は元の記述を保持し、コメントや codebase の調査結果を使って、利用者視点の課題と解決、実装に必要な合意と判断、task への分割を親 Issue に追記します。受入条件と検証方法は分割後の task Issue が持ちます。

| Skill | 役割 |
| --- | --- |
| [`setup-workflow`](skills/setup-workflow/SKILL.md) | workflow が使う固定 label を repository に作成・検証する |
| [`plan-requirement`](skills/plan-requirement/SKILL.md) | 要件を整理して調査・設計・実装計画を親 Issue に追記し、承認後に依存関係付きの task sub-issue へ分割する |
| [`pick-task`](skills/pick-task/SKILL.md) | 定期実行向けに、着手可能な task を1件選択して確保する |
| [`implement-task`](skills/implement-task/SKILL.md) | 指定された task を実装して Pull Request を作る |
| [`create-follow-up`](skills/create-follow-up/SKILL.md) | task 範囲外で見つけた改善を重複のない backlog Issue として提案する |
| [`sync-issues`](skills/sync-issues/SKILL.md) | native metadata から workflow label を整合し、後続 task の解放と要件 Issue の完了を判定する |

### Skill design

開発 workflow の skill はモデルを問わず使えるよう、成果物・完了条件・判断の境界を定義します。調査や実装の順序、質問の数・書式は task に応じてエージェントが選びます。対象は Issue 駆動の setup・選択・設計・実装・follow-up・状態整合を担う6スキルです。

設計には別セッションへ引き継ぐべき挙動・制約・判断を残し、task の受入条件には新たな成果と維持すべき性質を含められます。検証は変更に応じて選び、repository の必須チェックを守ります。GitHub の依存確認、排他、重複防止、automation の opt-in は引き続き必要です。

### Workflow metadata contract

GitHub native metadata を事実の正本とし、固定 label を検索、可視化、scheduled dispatch に使う。workflow を導入する repository では、最初に `setup-workflow` で必要 label を準備する。

| Label | 意味 |
| --- | --- |
| `kind:requirement` | 人間または agent が作成した要件、または複数 task をまとめる親 Issue |
| `kind:task` | 原則1つの Pull Request で完了する実装 sub-issue |
| `workflow:backlog` | 未整理または planning 開始前 |
| `workflow:needs-input` | 人間による判断・入力待ち |
| `workflow:ready` | 次の workflow を開始できる |
| `workflow:blocked` | open または確認不能な dependency がある |
| `workflow:in-progress` | planning、task 分割、実装のいずれかを実行中 |
| `workflow:review` | Pull Request 作成済みで CI または人間の review 待ち |
| `automation:enabled` | scheduled agent がこの Issue を処理してよいという opt-in gate |
| `origin:agent` | agent が発見し、人間の triage 待ちとして作成した follow-up Issue |

open な workflow 管理対象 Issue は `kind:*` と `workflow:*` をそれぞれ1つだけ持つ。`automation:enabled` は workflow state とは独立して付け外しする。priority label は作らず、repository の規約、milestone due date、Issue 番号から dispatch 時に決める。

状態の事実が矛盾する場合は、次の優先順位で扱う。

1. Issue の open / closed を完了状態の正本にする。`workflow:done` は作らず、closed Issue の workflow label は判定に使わない。
2. requirement と task の階層は native sub-issue、task の prerequisite は native issue dependency を正本にする。
3. assignee、task を閉じる open Pull Request を実行中状態の根拠にする。
4. `workflow:*` は上記の事実を検索・表示しやすくした materialized state とし、reconciliation で欠落・重複・矛盾を修復する。

基本遷移は次のとおり。

```text
requirement: backlog -> in-progress -> needs-input | ready -> in-progress -> closed
task:        blocked | ready -> in-progress -> review -> closed
```

担当者と label は GitHub の画面で作業状況を確認するために使います。同時実行は呼び出し元で防ぎ、同じ repository の定期実行・イベント・手動実行を直列にします。自動実行は共通の排他枠を使い、これを保証できない環境では手動で1件ずつ実行します。同じ GitHub アカウントを使う別 session も同時に動かしません。`sync-issues` → `pick-task` → `implement-task` は1回の連続した実行として扱い、途中で別の実行を割り込ませません。

担当設定に失敗したら実装を始めません。中断時は担当を保持し、担当者が再開するか、変更内容を確認して明示的に担当を解除します。同じアカウントが担当しているという理由だけで、別 session の作業を引き継ぎません。

### Pull Request 作成後

`implement-task` は task を閉じる PR を作り、変更概要・検証結果を PR 本文に記録して終了します。`workflow:review` は PR 作成済みの表示です。担当者は PR 対応中も保持します。

レビュー、CI 失敗への修正、マージは人間が確認し、必要に応じてエージェントへ依頼します。既存 PR の実装作業を引き継ぐ場合は `pr-resume` を使います。例えば `$pr-resume <PR URL> レビュー指摘と CI 失敗を修正して PR を更新してください` と依頼します。PR の継続監視や自動修正は開始しません。マージで task が閉じた後、`sync-issues` が後続 task の着手可否を更新します。親要件は設計の「分割」と全 sub-issue の対応を確認し、作成漏れがなく全件 completed の場合だけ閉じます。

設計は通常の `## 設計` 見出しで記録します。子タスク一覧と依存関係は GitHub の sub-issue・dependency に任せ、本文へ別の索引を作りません。follow-up の重複は問題箇所、期待する成果、関連 Issue/PR から確認します。

### Agent-created follow-up work

実装または review 中に現在の task 範囲外の改善を見つけた場合、現在の変更へ混ぜず、Pull Request の作成と確認後に `create-follow-up` で standalone requirement を提案します。作業中は候補と根拠を保持し、最後に関連する候補をまとめて重複を検索するため、発見のたびに Issue を作成しません。

作成する Issue は `kind:requirement`、`workflow:backlog`、`origin:agent` を持ち、source Issue/PR、確認できた根拠、期待成果、現在の task との境界、受入条件を記録します。native parent、dependency、assignee、`automation:enabled` は設定しません。人間が triage し、採用する場合に `plan-requirement` から通常の planning workflow を開始します。

follow-up の作成失敗や重複は、完成した source Pull Request を取り消す理由にしません。security finding や秘密情報は公開 Issue にせず、人間へ安全な報告経路が必要なことを返します。定期的な codebase 探索による Issue 生成はこの workflow に含めず、初期運用では実装・review 中に得た具体的な発見だけを対象にします。

### Trigger patterns

定期実行では `sync-issues` → `pick-task` → `implement-task` の順に実行し、最大1件の task を扱います。候補は `kind:task`、`workflow:ready`、`automation:enabled` を持つ open Issue に限定します。

イベント駆動では、承認済みの task 分割後に依存のない task を `implement-task` に渡します。task が閉じたら `sync-issues` の event mode で後続 task と親要件を再評価します。どちらも repository の共通の排他枠で直列実行します。

### Scheduled execution

利用するエージェントのスケジュール機能から、repository ごとに次の1回分の処理を起動します。既存実行をキャンセルして新しい実行で置き換えず、先の実行が終了するまで待つか、その回をスキップします。

```text
In repository <owner/repo>, run the following under one repository-wide concurrency slot:
1. Use $sync-issues in full reconciliation mode.
2. Only if it succeeds, use $pick-task.
3. If exactly one task is assigned for this run, use $implement-task for that issue.
4. Return the pull request URL and verification results, then stop.
Do not start review monitoring, automatic PR fixes, or merging.
Stop on unknown metadata, a setup blocker, a failed stage, or a conflicting execution.
Process at most one task in this run.
```

PR の作成結果が不明なら既存 PR を再検索し、重複作成しません。metadata が確認不能なときは後続段階へ進みません。

### Migration from body dependency declarations

旧運用の task 本文に `- Depends on: #123, #456` のような行がある repository は、次の順序で native issue dependencies へ移行します。移行中は対象 Issue から `automation:enabled` を外し、scheduled execution を停止しておきます。

1. `setup-workflow` で固定 label を作成・検証する。
2. open な管理対象 task を列挙し、本文の依存宣言と想定する親 requirement を記録する。
3. 参照先 Issue が同じ repository に存在すること、自己参照や循環がないこと、親子関係が一意であることを確認する。不明な参照は推測で補わない。
4. native sub-issue の parent と native `blocked by` relationship を設定する。本文の依存宣言はまだ削除しない。
5. Issue を再取得し、`parent` と pagination を含む `blockedBy` の集合が手順2の記録と完全に一致することを確認する。
6. 完全一致した task だけ、本文から旧依存宣言と不要になった空の見出しを削除する。
7. 本文と native metadata をもう一度取得してから `sync-issues` を実行し、`workflow:ready` または `workflow:blocked` が native metadata と一致することを確認する。

native relationship の設定、再取得、または照合に失敗した task では、本文の旧依存宣言を削除せず、`automation:enabled` も付けません。その task の自動実装は停止し、確認できた事実と失敗箇所を報告します。途中まで native relationship が設定された場合も自動化は停止したままにし、再取得した実状態と移行前の記録を比較してから同じ手順を再開します。

### Rollout and rollback

移行後は一度に全面開放せず、次の順で自動化を有効にします。

1. 全管理対象 Issue の native metadata と workflow label を reconciliation で検証する。
2. native prerequisite をすべて満たした少数の ready task にだけ `automation:enabled` を付ける。
3. 共通 prompt を手動で1回実行し、reconciliation、担当設定、Pull Request、Issue close 後の後続 task 解放を確認する。
4. 問題がなければ、対象 requirement または task 群を段階的に増やす。

緊急停止するときは schedule を無効化し、未着手の対象 Issue から `automation:enabled` を外します。親子関係と依存関係は保持します。進行中の作業や PR は取り消さず、担当者が完了させるか、途中変更を確認して明示的に担当を解除します。再開時は `sync-issues` と少数 task での手動実行から確認します。

## Validation

`gh skill publish --dry-run` で全 skill を Agent Skills specification に対して、`claude plugin validate .` で marketplace の定義を検証します。skill を追加・改名・削除したときは、`.claude-plugin/marketplace.json` の各 plugin の `skills` も更新します。

```sh
rg -n 'label[-]free|without (using|relying on) label[s]' README.md skills
rg -n 'Depends[ ]on' skills
rg -n 'Depends[ ]on' README.md
gh skill publish --dry-run
claude plugin validate .
```

最初の2つの検索は旧 workflow 方針が残っていないことを確認し、結果が0件になることを期待します。3つ目の検索結果はこの移行手順内の例示だけであることを確認します。

skill 名とディレクトリ名の一致、必須 frontmatter（`name` / `description`）、`allowed-tools` が文字列であること、install metadata（`metadata.github-*`）が混入していないことなどを検査します。`license` 未指定の warning は、リポジトリルートの `LICENSE` を正とするため許容します。

## Contributing

このリポジトリへの変更は topic branch から Pull Request を作成し、merge commit で `main` へ統合します。`main` への直接 commit は行いません。
