---
name: pr-monitor
description: PR の CI チェックを完了まで監視して結果を報告する。CI の待機・監視を依頼された場合に使用。
allowed-tools: Bash(gh pr checks *) Bash(gh pr view *)
argument-hint: "[pr-number-or-url]"
---

# PR チェック監視

指定 PR の GitHub Actions と external checks が確定するまで監視し、結果を報告する。認証済み `gh`、ネットワーク、待機または background work から再開できる環境が必要。未指定なら現在の branch の PR を使い、見つからなければ対象を確認する。

## 監視条件

開始・再開時に PR の状態と現在の checks を取得する。open でなければその状態を報告し、checks が確定済みなら待機しない。

未完了なら `gh pr checks <PR> --watch --interval 30` で待機する。実行環境の長時間処理機能があれば利用し、なければ許容時間内で foreground 実行する。特定エージェントの機能名は前提にしない。ポーリング間隔は30秒以上とし、最初の失敗で終了する依頼には `--fail-fast` を使う。

## 完了と中断

終了後に checks を再取得し、成功・失敗・未完了を区別して報告する。skipped やチェック未登録を全件 pass と解釈しない。失敗はチェック名とログ URL を添える。

認証・権限・通信・時間上限で続行できない場合は、最後に確認した状態と再開方法を返す。再開時も現在の状態から判断し、監視を理由に PR の修正やマージは開始しない。
