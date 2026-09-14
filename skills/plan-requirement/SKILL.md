---
name: plan-requirement
description: Clarify an existing GitHub requirement and record its design, then split an approved plan into task sub-issues. Use for requirement planning or resuming task decomposition.
---

# Plan Requirement Issue

指定された既存の要件 Issue について理解を揃え、実装へ引き継げる設計と、承認された task 分割を残す。調査・質問の順序や深さは要件の規模と不確実性に応じて選ぶ。要件 Issue の新規作成や実装は行わない。

## Input and prerequisites

対象 repository と open な要件 Issue が必要。未指定なら対象を確認する。`kind:*` がなければ `kind:requirement` を付け、既に単一の `kind:requirement` なら保持する。他の kind や複数の kind は勝手に再分類しない。

必要な固定 label は `kind:requirement`、`kind:task`、`workflow:backlog`、`workflow:in-progress`、`workflow:needs-input`、`workflow:ready`、`workflow:blocked`。欠落時は Issue を変更せず `setup-workflow` が必要なことを返す。workflow 更新は呼び出し元が repository 単位で直列化し、手動実行も他の実行と重ねない。排他を確認できない自動実行は更新しない。

## 理解を揃える

Issue と関連するコード・tests・規約を調べ、現在の挙動と期待する成果を把握する。既存の glossary や設計判断を尊重し、利用者の説明とコードに矛盾があれば明らかにする。

事実は自力で調べ、可逆で影響の小さい選択は仮定として示して進める。製品の意図、スコープ、公開 API、データ損失、セキュリティを左右する判断は利用者に確認する。対話できなければ、その判断を未決事項として残す。

質問は判断の依存関係を踏まえ、回答によって次に確認すべきことを見直す。未回答の判断を仮定して先の質問を進めず、独立した調査や相談は継続する。質問には可能な範囲で推奨案と理由を添える。質問の数や書式は対話に合わせる。

## 合意を残す

[assets/design-section.md](assets/design-section.md) を使い、親 Issue の `## 設計` 節へ課題と解決、実装に必要な合意、分割案、未決事項を記録する。別セッションの実装者が、期待する挙動と制約を復元できることを基準にする。数値条件、例外時の挙動、互換性なども、重要な合意なら省かない。

設計判断は内容と理由を簡潔に残す。独立した ADR にするほどの判断かどうかで、仕様に必要な情報を選別しない。確定した事実と仮定を区別し、不要な節や調査・会話の経緯は省く。根拠となるリンクや file path は有用な場合に添える。未決事項だけは常に残し、なければ「なし」とする。

元の要望と人手の追記を保持し、既存の設計節は該当箇所を更新する。更新対象が曖昧なら上書きしない。別ファイルの設計書を利用者が指定した場合はそれを正本にし、Issue に要約とリンクを残す。

## 承認された案をタスクにする

課題と解決・分割が揃い、実装を左右する未決事項が解決したら、設計と分割案を提示して承認を得る。各 task の成果と技術的な依存をレビューできる形にする。同じ案への承認が確認できれば再確認せず続行し、承認が不明なら現在の案への承認を求める。設計確認までの依頼ならそこで終了する。

原則1 task = 1 PR とし、単独でデモまたは検証できる成果で分ける。ファイル数や層で機械的に区切らず、移行も途中状態を検証できる単位にする。依存は着手に技術的な前提がある場合だけ設定し、承認された成果や依存を変更する場合は再承認を得る。

[assets/task-issue.md](assets/task-issue.md) に沿って、挙動、関連する親の決定、受入条件、検証方法を書く。受入条件は新たな成果と維持すべき性質の両方を含められ、第三者が検証できることを基準にする。詳細な受入条件は task に置き、親の合意を漏れなく反映する。

既存の全 sub-issue と「分割」の成果を照合し、再実行では未作成分だけを補う。対応が曖昧なら重複作成しない。task は同じ repository の native sub-issue とし、依存には native `blocked by` を使う。本文を依存関係の代用にせず、別の task 番号索引も作らない。

## State and update contract

| 親の状態 | workflow |
| --- | --- |
| 調査・設計中、または承認済みの task 分割中 | `in-progress` |
| 利用者の回答待ち・保留された判断がある | `needs-input` |
| 設計が分割可能で、task 作成前 | `ready` |
| 計画の全成果を task 化できた | `in-progress` |

- 設計と既存 task を確認して必要な段階から再開する。label は設計完了や承認の証拠にしない。
- 作成した task は単一の `kind:task` を持ち、依存がないか全件 closed なら `workflow:ready`、open または確認不能な依存があれば `workflow:blocked` とする。自己参照・循環・別 repository への依存は作成前に排除する。
- 更新前に最新状態、更新後に結果を確認し、open な管理対象 Issue の kind/workflow を各1つに保つ。無関係な label と `automation:enabled` は保持し、親からの opt-in 自動継承や label の暗黙作成はしない。必要な状態更新を確認できなければ task 作成へ進まない。
- 親子関係と依存は pagination を含む全件を取得し、API の合計数と照合する。親の不一致や計画外の依存は勝手に直さず報告する。自分が作った task の計画済み依存の欠落だけは補完できる。
- API failure や timeout 後は実状態を調べ、結果不明の作成・更新を繰り返さない。部分作成した task は削除せず、metadata が未確認の task を後続依存や実装へ渡さない。

## Completion

設計確認だけなら親 Issue URL、設計の要点、未決事項、状態を返す。task 化までなら、計画の全成果と task が過不足なく対応し、親子関係・依存・label が検証できたことを確認して、task URL と依存、着手可能な task を返す。失敗や state drift があれば、完了した範囲と再開に必要な情報を区別して報告する。
