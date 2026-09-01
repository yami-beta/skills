---
name: create-follow-up
description: Create deduplicated GitHub backlog requirement issues for durable findings that are outside the current task. Use after implementation or review reaches a handoff, or when a user explicitly asks to capture a follow-up; do not implement or schedule the new issue.
---

# Create Follow-up Issue

実装、review、調査中に見つかった現在の task 範囲外の改善を、後で人間が triage できる standalone requirement Issue として記録する。発見を理由に現在の変更範囲を広げず、新しい Issue を自動実装しない。

## Invocation timing

- 明示的な invocation では、利用者が示した発見をその場で評価する。
- `implement-task` などから呼ばれる場合は、作業中には候補と根拠だけを保持し、現在の Pull Request と close 対象 Issue を確認した後に1回だけ呼ぶ。実装途中で候補ごとに Issue を作らない。
- 現在の task が失敗した場合でも、独立して再現できる発見は最終 handoff 時に記録できる。ただし元 task の失敗報告を follow-up で代用しない。
- 組み込み invocation では1回の task 実行につき最大3件とし、同じ成果に属する発見は1件にまとめる。利用者が明示した件数はこの上限より優先する。

## Candidate qualification

次をすべて満たす発見だけを候補にする。

1. 現在の Issue の成果・受入条件に含まれず、現在の PR に混ぜると scope が広がる。
2. 問題、影響、再現条件、code location、test、計測値など、少なくとも1つの確認可能な根拠がある。
3. 独立した期待成果と、完了を判断できる受入条件を記述できる。
4. 一時的な観察、実装中に解消した問題、根拠のない好み、単なる将来アイデアではない。

secret、個人情報、未公開情報、または悪用可能な security finding を公開 Issue に記載しない。その場合は Issue を作らず、公開できない理由と安全な報告先が必要なことを利用者または呼び出し元へ返す。

## Preconditions and duplicate search

1. 対象 repository、存在する source Issue/Pull Request、発見内容と根拠を特定する。明示的な調査に source Issue/PR がなければ `none` とし、存在しない参照を捏造しない。
2. repository に `kind:requirement`、`workflow:backlog`、`origin:agent` が存在することを確認する。欠けていれば類似 label を作らず、`setup-workflow` が必要な setup blocker として Issue を作成せず停止する。
3. `<owner/repo>|<component-or-location>|<normalized-outcome>` から安定した fingerprint を作り、`<!-- ai-follow-up:<fingerprint> -->` marker にする。同じ発見を言い換えただけで fingerprint を変えない。
4. repository の open/closed Issue と Pull Request を、marker、主要な error/symbol/path、期待成果、source Issue/PR への参照で検索する。検索結果と source の関連リンクは pagination の最後まで確認する。
5. 同じ marker または実質的に同じ成果を持つ Issue/PR があれば新規作成せず、その URL と open/closed 状態を返す。closed item を勝手に reopen せず、not planned の判断を別 Issue で迂回しない。重複か判断できなければ候補 URL を返し、人間の判断なしに作成しない。

## Issue creation

1. [assets/follow-up-issue.md](assets/follow-up-issue.md) を使い、簡潔な命令形または成果ベースの title と本文を作る。確認できた事実と推論を分け、不明点を断定しない。
2. source Issue と source Pull Request が存在する場合は、本文から同じ repository の `#<number>` で参照する。agent 名が分かる場合は本文に記録するが、agent ごとの label は作らない。
3. standalone Issue として、`kind:requirement`、`workflow:backlog`、`origin:agent` の3 label を付けて作成する。native parent、native dependency、assignee、milestone、claim、`automation:enabled` は設定しない。
4. 作成後に Issue を再取得し、title、marker、3 label、open state、parent/assignee がないことを確認する。`kind:*` または `workflow:*` が複数、marker が欠落、または `automation:enabled` が同時に付与された場合は concurrent update として報告し、新しい Issue の実装へ進まない。
5. 作成した Issue の番号、URL、要約、source、重複検索の根拠、triage 待ちであることを返す。呼び出し元は follow-up 作成失敗を理由に完成済みの source PR を閉じたり作り直したりしない。

## Safety and idempotency

- API timeout 後は marker、title、source 参照で Issue を再検索し、作成結果が不明なまま再試行しない。
- follow-up を source requirement の sub-issue や blocker にせず、現在の task、PR、requirement の完了を妨げない。
- `workflow:ready`、`workflow:in-progress`、`automation:enabled` を付けず、人間の triage 前に planning、task 分割、実装へ渡さない。
- 通常 label と既存 Issue/PR を変更しない。新しい Issue の作成以外の tracker mutation は、利用者が明示した場合だけ行う。
- 該当する候補がなければ成功扱いで `no follow-up needed` を返す。
