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

人間が作成した要件 Issue、または実装中に agent が提案した follow-up Issue を起点に、以下のスキルを順に組み合わせると、要件の精緻化から実装 Pull Request までを GitHub Issue の依存関係付きで進行できます。

要件 Issue は自由形式で、背景や要望だけをカジュアルに記載して構いません。Agent は元の記述を保持し、コメントや codebase の調査結果を使って目的、スコープ、要件、受入条件、未決事項を明示してから設計へ進みます。

| Skill | 役割 |
| --- | --- |
| [`gh-setup-issue-workflow`](skills/gh-setup-issue-workflow/SKILL.md) | workflow が使う固定 label を repository に作成・検証する |
| [`gh-plan-requirement`](skills/gh-plan-requirement/SKILL.md) | 要件を精緻化し、調査・設計・実装計画を親 Issue に追記する |
| [`gh-split-requirement`](skills/gh-split-requirement/SKILL.md) | 計画を依存関係付きの task sub-issue に分割する |
| [`gh-find-ready-task`](skills/gh-find-ready-task/SKILL.md) | 定期実行向けに、着手可能な task を1件選択して確保する |
| [`gh-implement-ready-task`](skills/gh-implement-ready-task/SKILL.md) | 指定された task を実装して Pull Request を作る |
| [`gh-maintain-review-task`](skills/gh-maintain-review-task/SKILL.md) | 指定された task PR の review・CI を最新状態から最大1 cycle 保守する |
| [`gh-create-follow-up-issue`](skills/gh-create-follow-up-issue/SKILL.md) | task 範囲外で見つけた改善を重複のない backlog Issue として提案する |
| [`gh-reconcile-issue-state`](skills/gh-reconcile-issue-state/SKILL.md) | native metadata から workflow label を整合し、後続 task の解放と要件 Issue の完了を判定する |

### Workflow metadata contract

GitHub native metadata を事実の正本とし、固定 label を検索、可視化、scheduled dispatch に使う。workflow を導入する repository では、最初に `gh-setup-issue-workflow` で必要 label を準備する。

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

label の更新だけでは複数エージェント間の排他を保証できない。対応する release marker がない `<!-- ai-task-claim:<actor-or-run-id> -->` を active implementation claim とし、claim 後に Issue を再取得して assignee、別 claim、open Pull Request を再確認する。

### Review maintenance and session handoff

`gh-implement-ready-task` は Pull Request と `workflow:review` を確認した後、PR 番号と最新 head SHA を `<!-- ai-review-handoff:<pr-number>:<head-sha> -->` marker に記録する。handoff を再取得して確認してから、自分の implementation claim を release し、自分で追加した assignee だけを外す。これにより、実装 session が終わっても Issue、PR、comments を使って review 状態を復元できる。

`gh-maintain-review-task` は1回の invocation ごとに GitHub の head、checks、reviews、comments、review threads、mergeability を再取得し、必要なら最大1回の mutation cycle を実行して終了する。skill 自身は待機や polling を行わないため、session や特定 agent の継続機能に依存しない。

継続監視は実行環境の maintenance driver に委ねる。Codex では native の「PR を監視して修正」、Claude Code では Auto-fix PR、または session を開いたまま使える場合の `/loop` を優先する。これらが利用できなければ scheduled または manual invocation で同じ once-mode contract を呼び出す。`/goal` は完了条件へ向かう長時間作業には使えるが、一定間隔の polling driver としては扱わない。

review 対応の mutation 直前だけ `<!-- ai-review-claim:<actor-or-run-id> -->` を取得し、完了または停止時に `<!-- ai-review-release:<actor-or-run-id> -->` を残す。driver の待機中は claim を保持しない。同じ head、checks、review、最新 comments、mergeability から作る `<!-- ai-review-state:<state-hash> -->` により、同一状態への rerun、comment、commit を繰り返さない。review claim は短命な排他であり、`workflow:review` を `workflow:in-progress` に変更する根拠にはしない。

同じPRに接続する driver は1つだけにする。native driver の custom instructions には未解決 review thread の取得も含め、自動 merge は明示的に許可しない限り無効にする。CI が green でも必須 review が pending なら監視を継続し、必要な approval を満たして未解決 feedback と conflict がない、merged/closed、曖昧な feedback、権限不足、claim conflict のいずれかで停止またはpauseする。将来の常駐 orchestrator も同じ once-mode contract を worker として呼び出せる。

### Agent-created follow-up work

実装または review 中に現在の task 範囲外の改善を見つけた場合、現在の変更へ混ぜず、Pull Request の作成と確認後に `gh-create-follow-up-issue` で standalone requirement を提案します。作業中は候補と根拠を保持し、最後に関連する候補をまとめて重複を検索するため、発見のたびに Issue を作成しません。

作成する Issue は `kind:requirement`、`workflow:backlog`、`origin:agent` を持ち、source Issue/PR、確認できた根拠、期待成果、現在の task との境界、受入条件を記録します。native parent、dependency、assignee、claim、`automation:enabled` は設定しません。人間が triage し、採用する場合に `gh-plan-requirement` から通常の planning workflow を開始します。

follow-up の作成失敗や重複は、完成した source Pull Request を取り消す理由にしません。security finding や秘密情報は公開 Issue にせず、人間へ安全な報告経路が必要なことを返します。定期的な codebase 探索による Issue 生成はこの workflow に含めず、初期運用では実装・review 中に得た具体的な発見だけを対象にします。

### Trigger patterns

定期実行では、最初に `gh-reconcile-issue-state` の全件整合モードを実行し、次に `gh-find-ready-task`、`gh-implement-ready-task` の順で実行します。PR 作成後の継続保守を許可していて実行環境に maintenance driver があれば、同じ task/PR に driver を1つだけ接続します。自動実装候補は `kind:task`、`workflow:ready`、`automation:enabled` をすべて持つ open Issue に限定します。

イベント駆動では、task 分割直後に dependency のない task を `gh-implement-ready-task` へ渡します。task Issue が close されたら `gh-reconcile-issue-state` の event mode で直接依存する後続 task を再評価し、返された actionable task を実装処理へ渡します。同じ実行で親要件の完了も判定し、全 sub-issue が完了していれば要件 Issue を close します。設計・分割の2スキルは、どちらのパターンでも手動または Issue イベントから個別に実行できます。

どちらの方式でも、呼び出し側で repository 単位の concurrency 制御を設定し、claim 後に task を再取得して二重着手を防ぎます。

### Scheduled execution

定期実行は常駐 daemon を前提にせず、Codex、Claude Code など利用するエージェントのスケジュール機能から、repository ごとに次の1回分の処理を起動します。

1. `gh-reconcile-issue-state` を全件整合モードで実行する。
2. 整合に成功した場合だけ `gh-find-ready-task` で task を1件選択して claim する。
3. task を claim できた場合だけ、その Issue を指定して `gh-implement-ready-task` を実行する。
4. Pull Request と review handoff が確認でき、継続保守を許可していて実行環境に maintenance driver がある場合だけ、同じ Issue/PR に driver を1つ接続する。driver がなければ handoff で終了する。

1回の実行で扱う task は最大1件とし、repository 単位で実行が重ならないよう scheduler の concurrency を設定します。各段階が失敗した場合、metadata を確定できない場合、または claim の競合を検出した場合は、そこで停止します。後続段階を推測で続行したり、label だけを根拠に実装を開始したりしません。

Codex と Claude Code ではスケジュールを登録する UI や設定方法だけが異なります。どのエージェントでも、前節の Installation に従って同じ skill を導入し、次のような共通 prompt を使用できます。実際の schedule 作成は利用するエージェント側で行います。

```text
In repository <owner/repo>:
1. Use $gh-reconcile-issue-state in full reconciliation mode.
2. Only if it succeeds, use $gh-find-ready-task.
3. If exactly one task is claimed, use $gh-implement-ready-task for that issue.
4. If it opens and hands off a pull request and the environment supports a PR maintenance driver, attach exactly one driver that invokes $gh-maintain-review-task once per wake-up. Otherwise return the handoff.
Stop on unknown metadata, a setup blocker, a failed stage, or a claim conflict.
Process at most one task in this run.
```

### Migration from body dependency declarations

旧運用の task 本文に `- Depends on: #123, #456` のような行がある repository は、次の順序で native issue dependencies へ移行します。移行中は対象 Issue から `automation:enabled` を外し、scheduled execution を停止しておきます。

1. `gh-setup-issue-workflow` で固定 label を作成・検証する。
2. open な管理対象 task を列挙し、本文の依存宣言と想定する親 requirement を記録する。
3. 参照先 Issue が同じ repository に存在すること、自己参照や循環がないこと、親子関係が一意であることを確認する。不明な参照は推測で補わない。
4. native sub-issue の parent と native `blocked by` relationship を設定する。本文の依存宣言はまだ削除しない。
5. Issue を再取得し、`parent` と pagination を含む `blockedBy` の集合が手順2の記録と完全に一致することを確認する。
6. 完全一致した task だけ、本文から旧依存宣言と不要になった空の見出しを削除する。
7. 本文と native metadata をもう一度取得してから `gh-reconcile-issue-state` を実行し、`workflow:ready` または `workflow:blocked` が native metadata と一致することを確認する。

native relationship の設定、再取得、または照合に失敗した task では、本文の旧依存宣言を削除せず、`automation:enabled` も付けません。その task の自動実装は停止し、確認できた事実と失敗箇所を報告します。途中まで native relationship が設定された場合も自動化は停止したままにし、再取得した実状態と移行前の記録を比較してから同じ手順を再開します。

### Rollout and rollback

移行後は一度に全面開放せず、次の順で自動化を有効にします。

1. 全管理対象 Issue の native metadata と workflow label を reconciliation で検証する。
2. native prerequisite をすべて満たした少数の ready task にだけ `automation:enabled` を付ける。
3. 共通 prompt を手動で1回実行し、reconciliation、claim、Pull Request、Issue close 後の後続 task 解放を確認する。
4. 問題がなければ、対象 requirement または task 群を段階的に増やす。

緊急停止するときは schedule を無効化し、未着手の対象 Issue から `automation:enabled` を外します。native sub-issue と issue dependency は手動運用にも必要な事実なので削除しません。進行中の claim や Pull Request は自動的に取り消さず、担当者が完了させるか、claim 所有者が release marker を残して明示的に解放します。修正後は reconciliation と少数 task での手動実行から再開します。rollback は自動実装の停止を意味し、検証済み native metadata を旧本文形式へ戻す操作ではありません。

## Validation

`gh skill publish --dry-run` で、全 skill を Agent Skills specification に対して検証します。

```sh
rg -n 'label[-]free|without (using|relying on) label[s]' README.md skills
rg -n 'Depends[ ]on' skills
rg -n 'Depends[ ]on' README.md
gh skill publish --dry-run
```

最初の2つの検索は旧 workflow 方針が残っていないことを確認し、結果が0件になることを期待します。3つ目の検索結果はこの移行手順内の例示だけであることを確認します。

skill 名とディレクトリ名の一致、必須 frontmatter（`name` / `description`）、`allowed-tools` が文字列であること、install metadata（`metadata.github-*`）が混入していないことなどを検査します。`license` 未指定の warning は、リポジトリルートの `LICENSE` を正とするため許容します。
