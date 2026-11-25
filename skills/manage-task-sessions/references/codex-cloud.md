# Codex Cloud の操作例

## 管理ツールと CLI

- **作成**。その場の `create_thread` が `codexCloud` を受け付ける場合は、`list_cloud_environments` から対象 repository の実行可能な `environmentConfigId` を選ぶ。CLI が対象環境を認識する場合は `codex cloud exec --env "$env_id" --branch "$branch" "$prompt"` でも新規作成できる。環境 ID は各手段が返した値を使う。作成結果の正式なチャット ID または URL、環境名、返された `hostId` を記録する。
- **追加指示**。`send_message_to_thread` で同じ子を指定できれば、Web で作成した子にも送れる。`codex cloud exec` は毎回新しいタスクを作る。
- **返信確認**。`wait_threads` で今回のターンの返信を確認できる。本文の到達を調べるときは `read_thread` でツール出力も取得する。実際の検証では、追加指示の全文が子の履歴に委任メッセージとして届いていても、子が求められた回答を返さないことがあった。

## Web 画面

[ChatGPT](https://chatgpt.com/) で新しいチャットの「実行場所」→「クラウド」から公開済み環境を選ぶ。表示された環境名を確認して初回の依頼を送る。作成中の一時 URL が正式なチャット URL に切り替わったら記録する。

追加指示は記録済みの URL を開き、「フォローアップの変更を求める」欄から送る。返信確認だけなら同じ会話の該当する回答を読む。ログインが必要な場合は操作を利用者に渡す。
