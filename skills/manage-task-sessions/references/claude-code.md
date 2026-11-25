# Claude Code の CLI 操作例

認証済みの CLI と、対象 branch のクリーンな checkout を使う。必要なら別 worktree を用意し、対象の remote と branch がクラウドから取得できることを確認する。plugin 版のスキル名は `/software-factory:implement-task` と `/yami-beta-skills:pr-resume`。

新規起動には TTY が必要。コマンド実行ツールで対話端末を割り当て、依頼文を単一の引数として渡す。出力から子の session URL / ID を記録する。

```sh
claude --cloud "$prompt"
```

追加指示は記録した ID または URL 宛てに非対話で送れる。JSON の `ok` と宛先は送信受付の確認に使う。

```sh
claude -p "$message" --cloud "$session_id" --output-format json
```
