---
name: pr-merge
description: CI・レビューと承認を確認して Pull Request をマージする。PR のマージ依頼時に使用。
allowed-tools: Bash(gh pr merge *) Bash(gh pr view *) Bash(gh pr checks *) Bash(gh repo view *) Bash(git fetch *) Bash(git log *) Bash(git rev-parse *) Bash(git push origin --delete *)
argument-hint: "[pr-number-or-url]"
---

# Pull Request をマージ

指定 PR の状態と承認を確認し、許可された方法でマージして結果を返す。未指定なら現在の branch の PR が対象。`git`、認証済み `gh`、ネットワーク、マージと対象 branch 削除の権限が必要。

## マージ条件

PR の状態、mergeability、CI、レビューを確認する。closed / merged は対象外、コンフリクトは解消が必要な状態として終了する。取得不能・判定待ちは成功と扱わない。

pending の CI は待機の依頼があれば待ち、なければ待つか確認する。利用可能なら `pr-monitor`、なければ `gh pr checks <PR> --watch --interval 30` を使う。失敗や `CHANGES_REQUESTED` があれば内容を報告して止める。pending・失敗・変更要求を残した続行には明示的な指示が必要で、repository の保護設定は迂回しない。

方法は repository が許可する `--merge` / `--squash` / `--rebase` の中から、利用者の指定と repository 規約に従って選ぶ。指定がなければ最新の base 履歴を参考に提案する。履歴だけで判断できなければ、許可される方法を提示して確認する。

対象 PR（タイトル・URL）・方法・実行条件への承認を確認し、同じ承認を取り直さない。条件変更や未承認の項目があれば提示して確認する。実行直前にも状態を確認し、承認時から変わった内容を無条件にマージしない。

## マージとクリーンアップ

`gh pr merge <PR> <method>` で実行し、PR が実際に merged になったことを確認する。timeout やマージ待ちの状態では、結果不明のまま再実行したり branch を削除したりしない。

main worktree では、安全に topic branch を削除できる場合に `--delete-branch` を利用できる。linked worktree ではこれを使わず、マージ確認後に対象リモートの topic branch だけを削除する。PR の head repository と branch を確認し、同名というだけで `origin` の branch を削除しない。利用中のローカル branch と worktree は保持する。

追跡情報は `git fetch --prune` で整理する。削除失敗は既に削除済みか、権限等の問題かを区別し、マージの成否と混同しない。

## 完了

PR のタイトルと URL、採用した方法、マージ結果、branch 削除の結果を報告する。残ったローカル branch / worktree や、未完了・確認不能な操作があれば明示する。
