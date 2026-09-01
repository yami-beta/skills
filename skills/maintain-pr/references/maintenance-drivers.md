# Maintenance drivers

`maintain-pr` は1回分の判断と mutation だけを担当する。継続監視は実行環境が提供する driver に委ね、GitHub の状態が変わるたび、または定期的な wake-up ごとに同じ task/PR を指定して skill を呼び出す。

## Selection order

利用可能な driver を次の順で1つだけ選ぶ。

1. 実行環境の native PR maintenance。PR と task の紐付け、wake-up、停止を製品側へ委ねられる場合に優先する。
2. session-scoped recurring invocation。native maintenance がないか、必要な signal を扱えない場合に使う。
3. scheduled または manual invocation。session を開いたままにできない場合の fallback とする。

同じPRに複数の driver を同時に接続しない。driver の切り替え時は先の driver を停止またはpauseしてから新しいものを開始する。read-only の待機中は review claim を保持せず、各 invocation の mutation 直前だけ skill が claim を取得する。

## Product adapters

### Codex

利用可能なら PR の「監視して修正」機能を使う。CI failure と merge conflict に加えて、top-level comment、inline comment、unresolved review thread も毎回再取得し、task scope 内の actionable feedback を処理するよう custom instructions に明記する。CI が green でも review decision が `REVIEW_REQUIRED` の間は監視を継続し、green だけを理由にpauseしないことも明記する。auto-merge は明示的に許可されていない限り無効にする。

`/goal` は完了条件へ向けて継続的に進める作業のための機能であり、一定間隔の polling timer として扱わない。PR maintenance の待機 driver には native PR maintenance を使い、`/goal` を使う場合も「現在処理可能な問題を解消する」という bounded objective に限定する。

### Claude Code

利用可能なら Auto-fix PR を優先する。代替として session を開いたままにできる場合は `/loop` から同じ task/PR に対する `maintain-pr` を呼び出す。固定間隔は repository の CI 時間と利用上限に合わせ、たとえば10分を初期値とする。

Auto-fix PR と `/loop` を同じPRで同時に使わない。`/loop` の各 invocation は前回の会話状態だけで判断せず、GitHub を再取得し、処理可能な変更がなければ mutation せず終了する。

### Other agents

製品名ではなく、次の capability を満たす driver を利用できる。

- 同じ repository、task Issue、Pull Request を各 invocation に渡せる
- GitHub の head、checks、reviews、comments、review threads、mergeability を再取得できる
- merged、closed、required approval の完了、human input、permission failure で停止またはpauseできる
- 同じPRに対する重複 driver を避けられる

## Driver instructions

driver には最低限、次の契約を渡す。

```text
Maintain task issue <issue> and pull request <pr>.
On each wake-up, use $maintain-pr exactly once.
Re-fetch GitHub checks, review comments and unresolved review threads, and mergeability.
Address only actionable in-scope review feedback, failures caused by this PR, and merge conflicts.
Do not merge or enable auto-merge.
Do not mutate pending, unchanged, ambiguous, or already-processed state.
Keep monitoring while required human review is pending, even when CI is green.
Pause or stop when the PR is merged/closed, or when checks and required approvals are complete
with no conflicts or actionable feedback, or when human input or additional permission is required.
```

製品の native driver が skill invocation を直接指定できない場合も、上記の once-mode contract と停止条件を custom instructions へ移す。driver が取得した snapshot は wake-up hint とし、mutation の根拠には使わない。各 invocation で skill が authoritative state を再取得する。
