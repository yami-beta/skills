---
name: pr-create
description: 変更を commit・push して Pull Request を作成または更新する。PR 作成の依頼時に使用。
allowed-tools: Bash(git status *) Bash(git log *) Bash(git diff *) Bash(git push *) Bash(git switch *) Bash(git fetch *) Bash(gh pr create *) Bash(gh pr view *) Bash(gh repo view *) Read Glob
argument-hint: "[補足指示]"
---

# Pull Request を作成

依頼された変更を commit・push し、レビューできる PR を作成または更新する。`git`、認証済み `gh`、ネットワーク、push と PR 作成の権限が必要。利用者の対象・base・draft 指定を反映する。

## 対象と作成条件

未コミットの関連変更があれば、利用可能な `commit` スキルを使う。使えない環境でも差分を確認し、repository 規約に従う topic branch で関連変更だけを commit する。他の作業やシークレットは含めず、履歴の書き換えは明示的な許可がある場合だけ行う。

base は指定がなければ repository のデフォルト branch とし、最新のリモート状態との比較で対象変更を確認する。変更がなければ終了する。デフォルト branch から PR は作らず topic branch を用意し、ローカルのデフォルト branch に commit が残る場合は報告する。

同じ head の open PR があれば重複作成せず更新する。ない場合は対象 branch を push して PR を作る。API failure を「PR なし」と解釈せず、timeout 後は head と base で結果を確認してから再試行する。

## レビューに必要な内容

タイトルは変更の目的を簡潔に表す。本文は repository の PR テンプレートがあれば従い、なければ変更概要、必要な背景・判断、検証結果、残った懸念を変更規模に応じてまとめる。薄い節や重複する説明は省く。既存 PR の更新でも最終的な差分と説明が一致するようにする。

同じ repository の Issue/PR は `#123` または直接の URL で参照する。作業 repository が `yami-beta/*` の場合に限り、他 repository のリンクは `https://redirect.github.com/{org}/{repo}/...` にして backlink 通知を避ける。close キーワードの対象は redirect しない。

## Attribution と完了

利用者と実行環境の attribution 設定に従い、明示的に無効なら付けず、有効なら設定された表記を使う。名前・モデル・メールを推測せず、過去の別エージェントの署名を流用しない。自動付与との重複を避け、既存 contributor の表記を保持する。表記が不明なら不足を報告し、付与済みとは扱わない。

commit の trailer と PR 本文の生成元表記は別に確認する。作成・更新後は `gh pr view --json url,body` などで結果を取得し、期待する attribution の欠落は他の本文を保持して補う。無効化設定を理由に既存表記を削除しない。

対象 branch・base・draft 状態と本文を確認して PR URL を返す。CI 監視も依頼済みなら利用可能な `pr-monitor` を使い、なければ `gh pr checks <PR> --watch --interval 30` で待機して最終状態を再取得する。未依頼なら PR の結果を報告して終了する。
