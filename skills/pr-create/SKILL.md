---
name: pr-create
description: Pull Requestを作成する。未コミットの変更があればコミットし、リモートへプッシュしてPRを作成する。「PRを作成」「プルリクエストを作成」などの要求時に使用。
allowed-tools: Bash(git status *) Bash(git log *) Bash(git diff *) Bash(git push *) Bash(git switch *) Bash(git fetch *) Bash(gh pr create *) Bash(gh pr view *) Bash(gh repo view *) Read Glob
argument-hint: "[補足指示]"
---

# Pull Request 作成ワークフロー

## Requirements

`git`、認証済みの `gh` CLI、ネットワーク接続、ブランチの push と Pull Request 作成の権限を必要とする。

## Input

明示的なスキル呼び出しに続けて渡されたテキスト、または同じ依頼内の補足指示を入力として扱い、ブランチ、コミット、Pull Request のタイトルと本文へ反映する。補足指示がなければ、変更内容と会話履歴から判断する。

## Workflow

### Step 1: 未コミットの差分を確認

`git status --short` で変更ファイルを確認する。

- 未コミットの差分なし: Step 2へ進む
- 未コミットの差分あり: 同梱の `commit` スキルが利用可能ならその手順でブランチとコミットを作成する。スキル間連携に対応していない環境では、変更を確認し、必要ならトピックブランチを作成して、関連する変更だけをステージ・コミットする。その後 Step 2へ進む

### Step 2: ブランチと既存 PR の確認

- ベースブランチ（デフォルトブランチ）を取得する:
  ```bash
  gh repo view --json defaultBranchRef -q .defaultBranchRef.name
  git fetch origin <base>
  ```
- ベースブランチとの差分がない場合（`git log origin/<base>..HEAD` が空）: PR にする変更がない旨を報告して終了する
- 現在のブランチがデフォルトブランチの場合: デフォルトブランチからの PR は作成しない。変更内容から適切な名前（例: `feat/add-xxx`, `fix/resolve-yyy`, `docs/update-readme`）でトピックブランチを作成（`git switch -c <branch-name>`）してから Step 3 へ進む。この場合ローカルのデフォルトブランチにコミットが残り origin と分岐したままになるため、その旨をユーザーに報告する
- 現在のブランチに紐づく PR を確認する:
  ```bash
  gh pr view --json url,state
  ```
  - open な PR が既にある場合: 新規作成はせず、`git push` で既存 PR を更新し、その URL を報告して Step 6 へ進む（Step 3〜5 はスキップ）
  - PR がない（またはクローズ済みの）場合: Step 3 へ進む

### Step 3: リモートにプッシュしてブランチの変更内容を把握

リモートにプッシュする:

```bash
git push -u origin <branch-name>
```

ベースブランチからの全体像を把握する:

- コミット履歴: `git log --format='%h %s%n%b---' origin/<base>..HEAD`
- 差分の統計: `git diff --stat origin/<base>..HEAD`

`<base>` は Step 2 で取得したデフォルトブランチ（ローカルの base が古い可能性があるため `origin/<base>` を使う）。

### Step 4: PR タイトルとボディの作成

#### タイトル

- 70文字以内で変更の目的を簡潔に表す
- コミットが1つの場合はそのコミットメッセージの件名を流用してよい
- 複数コミットの場合は全体を包括する要約にする

#### ボディ

まず、リポジトリに PR テンプレートがあるか確認する:

- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/PULL_REQUEST_TEMPLATE/` ディレクトリ内のファイル

**テンプレートがある場合**: テンプレートの構造に従い、会話履歴とコミット履歴を振り返って各セクションを埋める。

**テンプレートがない場合**: 会話履歴とコミット履歴を振り返り、以下の構造で作成する:

- **概要**: この PR で何を実現するかを 1〜3 文で説明する
- **背景・動機**: なぜこの変更が必要になったか、解決する課題やユーザーの要求
- **アプローチ**: 採用した設計方針とその理由、却下した代替案、フィードバックによる方針変更の経緯
- **レビューポイント**: 特にレビュアーに確認してほしい箇所や判断（該当がなければ省略）

**注意事項**:
- 複数コミットの場合: コミットメッセージをそのまま貼り付けず、コミット群を俯瞰した要約とする
- 単一コミットの場合: コミットメッセージの本文を PR ボディとして流用してよい
- セクションの内容が薄い場合は無理に埋めず、該当セクションを省略する
- ボディの長さは変更の規模に見合わせる。重複する要約や boilerplate で膨らませない

issue / PR へのリンクを載せるときは以下に従う:

- 同一リポジトリの issue / PR は `#123` 形式かフル URL をそのまま使う。`redirect.github.com` 経由にすると `Fixes #123` などのクローズキーワードが認識されず、マージ時の自動クローズが働かない
- 作業リポジトリが `yami-beta/*` のときに限り、他リポジトリへのリンクは `https://redirect.github.com/{org}/{repo}/...` に書き換えて[バックリンク通知](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/autolinked-references-and-urls#avoiding-backlinks-to-linked-references)を避ける

### Step 5: Pull Request の作成

```bash
gh pr create --title "<title>" --body "<body>"
```

### Step 6: 結果の報告

作成（または更新）した Pull Request の URL を報告する。

### Step 7: CI チェックの監視

ユーザーが CI の監視も依頼している場合は、同梱の `pr-monitor` スキルが利用可能ならその手順を使う。スキル間連携に対応していない環境では、`gh pr checks <PR> --watch --interval 30` で対象 Pull Request のチェックが完了するまで待ち、最後に `gh pr checks <PR>` で結果を確認する。依頼されていない場合は、監視するか確認してから開始する。
