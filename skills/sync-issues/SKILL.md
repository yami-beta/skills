---
name: sync-issues
description: Reconcile managed GitHub issue states and close completed requirements. Use after a task closes or to reconcile the managed backlog.
---

# Reconcile Issue State

GitHub 上の事実から管理対象 Issue の `kind:*` と `workflow:*` を整合し、完了した親要件を閉じる。取得順序や処理のまとめ方は対象に応じて選び、以下の判定規則と更新条件を守る。

## Scope and prerequisites

- **Event**: closed になった source task が指定された場合、その native `blocking` にある open task と native parent requirement が対象。PR merge だけでは完了とせず、Issue が実際に closed であることを確認する。
- **Reconciliation**: source がない場合、`kind:*` / `workflow:*` を持つ全 open Issue と、その親・sub-issue が対象。親のない `kind:task` も含める。

対象 repository に全固定 label（`kind:requirement`、`kind:task`、`workflow:backlog`、`workflow:needs-input`、`workflow:ready`、`workflow:blocked`、`workflow:in-progress`、`workflow:review`、`automation:enabled`、`origin:agent`）が必要。欠落時は Issue を変更せず `setup-workflow` が必要なことを返す。呼び出し元が repository 単位で定期・イベント・手動実行を直列化する。排他を確認できない自動実行は更新せず、手動実行も他の実行と重ねない。

## 判定の正本

親子関係と依存は GitHub native metadata、作業状況は assignee と task を閉じる open PR を使う。label や本文の依存表現から事実を推測しない。必要な一覧は pagination の最後まで取得し、API の合計数と照合する。不完全な取得や API failure は `unknown` として、その Issue を変更せず実装候補にも返さない。

native parent があれば task、parent がなく sub-issue があれば requirement。階層で決まらない場合は単一の kind を使い、矛盾・分類不能は変更しない。親のない `kind:task` は不正な task として扱う。closed Issue の label は更新せず、完了判定には open/closed と close 理由を使う。

## Task の状態

必要な事実を確認できた open task に、上から最初に当てはまる状態を適用する。

| 事実 | workflow |
| --- | --- |
| 親・依存が不正、または open の依存がある | `blocked` |
| task を閉じる open PR がある | `review` |
| 担当者がいる | `in-progress` |
| 上記がなく、依存なしまたは全依存が closed | `ready` |

不正とは親の欠落、自己参照、循環、別 repository への依存など、確認できた矛盾を指す。取得失敗とは区別して根拠を報告する。作業中の task が blocked になった場合や、同じ task を閉じる open PR が複数ある場合も知らせる。

## Requirement の状態と完了

親の `## 設計` 節（正本がリンク先の設計書ならその内容）と全 sub-issue を照合する。

| 事実 | workflow / 操作 |
| --- | --- |
| task 分割中と確認できる | `in-progress` を保持 |
| 未決事項がある、または既存 sub-issue と「分割」の成果に欠落・余分・曖昧さがある | `needs-input` |
| 計画と対応する sub-issue があり、1件以上 open | `in-progress` |
| 未決事項がなく、計画の全成果に過不足なく対応する1件以上の sub-issue がすべて completed で closed | 親を completed として close |
| sub-issue がなく、課題と解決・分割が揃い、未決事項が「なし」 | `ready` |
| 設計が未完成 | 既存の `in-progress` / `needs-input` を保持、それ以外は `backlog` |

上から判定し、どの条件にも当てはまらなければ状態を保持して理由を報告する。not planned を含む場合や、分割途中の一部 task だけが完了した場合は親を閉じない。情報の取得失敗は計画の不一致と区別し、label も変更しない。

## Update contract

- 更新直前に判定の根拠を再確認し、更新後に結果と根拠の整合を確認する。特に親の close は最新の設計と全 sub-issue で完了条件を満たす場合だけ行う。
- open Issue の管理対象 label は kind/workflow 各1つに正規化し、一致していれば変更しない。無関係な label、`automation:enabled`、担当者、親子関係、依存は変更しない。追加の管理コメントは作らない。
- timeout や部分失敗後は実状態を確認してから復旧を判断する。結果不明の操作を繰り返さず、競合が続く、または安全な復旧を判断できない場合はその Issue の更新を止める。

## Completion

確認可能な対象を処理し、変更・close の結果と根拠、判断や復旧が必要な Issue を URL 付きで報告する。確認不能・競合と、確認できた不正・計画の不一致を区別する。一部が失敗しても独立して処理できる対象は継続し、呼び出し元には部分失敗を明示する。候補なしは正常終了とする。

Event では、更新後に `workflow:ready`、全依存が closed または依存なし、担当者・open PR なしと確認できた直接の後続 task を返す。呼び出し元は明示的な event invocation として `implement-task` へ渡せる。Reconciliation では対象の状態を報告し、scheduled dispatch の `automation:enabled` gate は維持する。このスキル自身は実装を開始しない。
