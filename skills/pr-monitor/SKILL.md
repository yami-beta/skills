---
name: pr-monitor
description: PR の CI チェックを完了まで監視し、最終結果を報告する。PR の CI 完了を待ちたいとき、マージ前に CI を確認したいとき、失敗チェックを早く知りたいときに使用する。
allowed-tools: Bash(gh pr checks *) Bash(gh pr view *)
argument-hint: "[pr-number-or-url]"
---

# PR チェック監視

## 概要

`gh pr checks --watch` で GitHub Actions と external checks（Codecov 等）をまとめて監視し、全チェック確定後に結果を報告する。エージェントや実行環境に固有のツール名には依存しない。

## Requirements

認証済みの `gh` CLI、ネットワーク接続、コマンドの終了を待つか background work の完了後に再開できる実行環境を必要とする。

## Input

ユーザーが指定した Pull Request の番号または URL を対象にする。未指定の場合は、現在のブランチに紐づく Pull Request を対象にする。

## Workflow

### Step 1: 対象 PR と現在の状況を確認する

```bash
gh pr view <PR> --json number,title,url,state
gh pr checks <PR>
```

`<PR>` は対象 PR 番号または URL。現在のブランチに紐づく PR を使う場合は省略する。PR が open でなければ監視せず、その状態を報告する。すべてのチェックが確定済みなら Step 3 へ進む。

### Step 2: チェックを監視する

```bash
gh pr checks <PR> --watch --interval 30
```

- 実行環境に background job、monitor、thread wakeup などの長時間コマンド向け機能があれば利用する。機能名や呼び出し方は、その環境の指示に従う。
- そのような機能がなければ foreground で待機する。実行時間の上限がある場合は、許容範囲内で待ち、上限到達時点の状態を報告する。
- 最初の失敗で監視を終えるようユーザーが求めた場合は `--fail-fast` を追加する。
- API レート制限を避けるため、ポーリング間隔は30秒以上にする。

### Step 3: 最終状態を報告する

監視コマンドの終了後に `gh pr checks <PR>` を再実行し、各チェックの最終状態を取得する。全件 pass、失敗あり、または未完了のいずれかを明示する。失敗があればチェック名とログ URL を示す。

## Failure handling

- `gh` が PR を見つけられない場合は、現在のブランチに PR があるか確認し、なければ PR 番号または URL をユーザーに求める。
- 認証、権限、通信、実行時間上限により監視を継続できない場合は、最後に確認できた状態と再開方法を報告する。
- 監視を再開するときは、まず `gh pr checks <PR>` で現在の状態を再取得し、既に完了していれば新しい監視を開始しない。
