---
name: commit
description: 依頼された変更を確認し、適切なブランチとメッセージで git commit を作成する。コミット作成の依頼時に使用。
allowed-tools: Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git add *) Bash(git commit *) Bash(git branch *) Bash(git switch *) Bash(git symbolic-ref *) Bash(gh pr list *)
argument-hint: "[補足指示]"
---

# Gitコミットを作成

依頼された変更を適切な branch で commit し、作成結果を返す。`git` が必要。補足指示は対象・分割・メッセージに反映する。

## 対象とブランチ

staged / unstaged / untracked の変更を確認し、対象がなければ終了する。関連する変更だけをステージし、他の作業を混ぜたり捨てたりしない。`.env` やシークレットを含むファイルは commit しない。

branch は利用者の指定と repository 規約を優先する。指定がなければ現在の topic branch が今回の作業に適するか確認する。デフォルト branch 上では、規約や最近の履歴・PR から直接 commit 運用を確認できた場合だけそのまま使い、それ以外は topic branch を作る。PR の調査には利用可能なら認証済み `gh` を使い、判断できない場合も topic branch にする。

## メッセージ

変更の目的を簡潔に表し、repository の慣習がなければ Conventional Commits の `<type>[scope]: <description>` を使う。外部依存・lockfile の変更は `build`、CI 設定は `ci` とする。大きな変更は論理的な単位に分ける。

本文は、理解に必要な動機、判断と理由、代替案や方針変更の背景がある場合に添える。埋め草で膨らませない。

同じ repository の Issue/PR は `#123` または直接の URL で参照する。作業 repository が `yami-beta/*` の場合に限り、他 repository のリンクは `https://redirect.github.com/{org}/{repo}/...` にして backlink 通知を避ける。close キーワードの対象は redirect しない。

## Attribution と完了

利用者と実行環境の attribution 設定に従い、明示的に無効なら付けず、有効なら設定された表記を使う。名前・モデル・メールを推測せず、過去の別エージェントの署名を流用しない。自動付与との重複を避け、既存 contributor の表記を保持する。表記が不明なら不足を報告し、付与済みとは扱わない。

commit には適用される `Co-authored-by` trailer または設定された attribution を含め、Git の author / committer は変更しない。作成後は `git log -1 --format=%B` などで本文と attribution を確認し、件名と対象ファイルを簡潔に報告する。失敗時は原因と残った変更を返し、`--amend` や `--force` は明示的な許可がある場合だけ使う。
