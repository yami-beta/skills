---
name: pr-merge
description: Pull Requestをマージする。マージ前にCIチェックとレビュー状態を確認し、リポジトリのマージ設定と履歴の慣習に応じた方法でマージする。「PRをマージ」「プルリクエストをマージ」などの要求時に使用。
allowed-tools: Bash(gh pr merge *) Bash(gh pr view *) Bash(gh pr checks *) Bash(gh repo view *) Bash(git fetch *) Bash(git log *) Bash(git rev-parse *) Bash(git push origin --delete *)
argument-hint: "[pr-number-or-url]"
---

# Pull Request マージワークフロー

## Requirements

`git`、認証済みの `gh` CLI、ネットワーク接続、Pull Request のマージとブランチ削除の権限を必要とする。

## Input

ユーザーが指定した Pull Request の番号または URL を対象にする。未指定の場合は、現在のブランチに紐づく Pull Request を対象にする。次のコマンドで repository が許可するマージ方法を取得する。

```bash
gh repo view --json mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed
```

## Workflow

### Step 1: マージ前の状態確認

対象 PR の状態を確認する:

```bash
gh pr view <pr-number> --json title,url,state,mergeable,reviewDecision,headRefName
gh pr checks <pr-number>
```

- `state` が `OPEN` 以外（`MERGED` / `CLOSED`）の場合: マージ対象外としてその旨を報告して終了する
- `mergeable` が `CONFLICTING` の場合: コンフリクトの解消が必要な旨を報告して終了する
- チェックに pending がある場合: 待機を含むマージが依頼済みなら待機する。それ以外は CI の完了を待つかユーザーに確認する。「待つ」が選ばれたら同梱の `pr-monitor` スキルが利用可能ならその手順を使う。スキル間連携に対応していない環境では、`gh pr checks <pr-number> --watch --interval 30` で待機する。全チェック pass を確認してから Step 2 へ進む。「待たない」が選ばれたら現状を報告して終了する（pending のままのマージ続行はユーザーの明示的な指示があった場合のみ）
- チェックに失敗がある、または `reviewDecision` が `CHANGES_REQUESTED` の場合: マージせずその内容を報告して終了する。続行はユーザーの明示的な指示があった場合のみ
- すべて問題なければ Step 2 へ進む

### Step 2: マージ方法の決定

上記Contextの「許可されているマージ方法」と、デフォルトブランチの履歴から読み取れる運用を交差させて決める。

デフォルトブランチの履歴を確認する:

```bash
gh repo view --json defaultBranchRef -q .defaultBranchRef.name
git log -20 --format='%h %p %s' origin/<base>   # %p の親が2つ以上ある行がマージコミット、%s に PR 番号が付くか
```

`git log --merges -20` は件数上限がフィルタ後に効くため「直近20件のうちのマージ」にはならない。`%p` の親の数で判定する。

- マージコミットがある → Merge commit (`--merge`)
- 件名末尾に `(#123)` のような PR 番号がある → Squash merge (`--squash`)
- どちらも見られない（直線的な履歴） → Rebase merge (`--rebase`)
- 履歴が数件以下で判断材料が乏しい、または推定した方法が許可されていない場合は、許可されている中から Merge commit → Squash merge → Rebase merge の順で最初の方法を採る

推定した方法への承認がなければ、Step 3 でユーザーに提示して確認する。

### Step 3: Pull Requestをマージ

実行前に対象 PR（タイトル・URL）とマージ方法を明確にする。対象・方法・実行条件への承認が既に確認できれば再確認せず実行する。未承認の項目や承認後の条件変更がある場合は、その内容を提示して確認を得る。

マージ前に、作業ディレクトリが linked worktree かどうかを判定する:

```bash
git rev-parse --git-dir --git-common-dir
```

2つの出力が異なれば linked worktree、同じ（どちらも `.git` 等）なら main worktree である。

**main worktree の場合**、確認が取れたらマージを実行する:

```bash
gh pr merge <pr-number> <merge-method> --delete-branch
```

- `<merge-method>` には Step 2 で決定した方法（`--merge` / `--squash` / `--rebase`）を指定する
- pr-number が指定されていない場合は省略する（現在のブランチの PR が対象になる）
- `--delete-branch` によりローカル・リモートのトピックブランチが削除される（対象ブランチをチェックアウトしている場合はデフォルトブランチへの切り替えも行われる）

**linked worktree の場合**、`--delete-branch` は使わない（デフォルトブランチが main worktree 側でチェックアウト済みのため切り替えに失敗し、チェックアウト中のローカルブランチも削除できない）。確認が取れたら `--delete-branch` なしでマージし、リモートのトピックブランチのみ別途削除する:

```bash
gh pr merge <pr-number> <merge-method>
git push origin --delete <head-branch>
```

- `<head-branch>` には Step 1 で取得した `headRefName` を指定する
- リポジトリの自動削除設定などで既に削除済みの場合、`git push origin --delete` は失敗するが問題ない
- ローカルブランチとワークツリーはチェックアウト中のため削除できない。残ることを Step 5 で報告する

### Step 4: クリーンアップ

リモート追跡ブランチをクリーンアップする:

```bash
git fetch --prune
```

### Step 5: 結果の報告

マージした Pull Request のタイトルと URL、採用したマージ方法、ブランチ削除の結果を報告する。linked worktree でマージした場合は、リモートブランチのみ削除しローカルブランチとワークツリーが残っていることを明記する。
