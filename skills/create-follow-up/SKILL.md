---
name: create-follow-up
description: Record concrete out-of-scope findings as deduplicated GitHub backlog issues. Use at task completion or on an explicit follow-up request; do not implement them.
---

# Create Follow-up Issue

現在の task 範囲外の具体的な発見を、重複のない standalone requirement として記録し、人間の triage に渡す。

## 対象とタイミング

明示的な依頼ではその場で評価する。実装から呼ばれる場合は候補と根拠を保持し、PR と close 対象を確認した後にまとめて扱う。組み込み呼び出しは最大3件とし、同じ成果はまとめる。明示的な件数指定を優先する。元 task が失敗した場合も独立して再現できる発見は終了時に扱えるが、失敗報告を先に行う。

候補には、確認可能な根拠、独立した期待成果、検証できる受入条件が必要。一時的な観察、解消済みの問題、好み、将来アイデアだけでは作成しない。secret、個人情報、未公開情報、悪用可能な security finding は公開 Issue にせず、安全な報告先が必要なことを返す。

## 作成条件

対象 repository と source Issue/PR を特定する。source がない明示的な調査は `none` とし、参照を捏造しない。`kind:requirement`、`workflow:backlog`、`origin:agent` が欠けていれば作成せず `setup-workflow` が必要なことを返す。呼び出し元で repository の実行を直列化し、手動でも競合を避け、排他を確認できない自動実行では作成しない。

問題箇所・期待成果・source を手掛かりに open/closed Issue と PR を検索し、検索結果と関連リンクを全ページ確認する。同じ成果があれば既存 URL と状態を返す。重複か不明なら人間の判断を求め、closed の勝手な reopen や not planned の別 Issue による迂回はしない。

[assets/follow-up-issue.md](assets/follow-up-issue.md) で事実と推論を分けて記録する。source は同じ repository なら `#<number>`、別 repository なら URL で参照する。agent 名は分かる場合だけ記録する。作成する open Issue は上記3 label のみを持ち、parent、dependency、assignee、milestone、`automation:enabled` は設定しない。

## 完了と復旧

作成結果を再取得し、本文・label・関係が条件どおりであることを確認して、URL、要約、source、重複検索の根拠と triage 待ちであることを返す。候補なしは `no follow-up needed` として正常終了する。

timeout 後は実状態を検索し、結果不明の作成を繰り返さない。新規作成以外の tracker 更新は明示的な依頼がある場合だけ行う。follow-up の失敗で元 PR を取り消さず、元の要件の sub-issue や blocker にもしない。人間の triage 前に planning・実装・自動実行へ渡さない。
