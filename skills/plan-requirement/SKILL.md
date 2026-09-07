---
name: plan-requirement
description: Analyze and organize an existing GitHub requirement issue into an implementation-ready design, then split the approved design into labeled task sub-issues with native blocked-by relationships. Use when a requirement needs investigation, clarification, architecture decisions, or planning, or when an approved design is ready for task decomposition.
---

# Plan Requirement Issue

既存の要件 Issue を整理・調査し、実装可能な設計と計画を Issue 本文へ追記した上で、承認された設計を依存関係を持つ実装 task Issue に分割する。このスキルでは要件 Issue を新規作成しない。曖昧さはセッション内の対話で利用者に質問して解決するため、利用者と対話できる文脈で実行する。

## Workflow

### 状態確認とフェーズ判定

1. 指定された対象 Issue の本文、コメント、リンク、repository 規約を読む。対象が指定されていなければ確認し、新規 Issue で代用しない。
2. repository に `kind:requirement`、`kind:task`、`workflow:backlog`、`workflow:in-progress`、`workflow:needs-input`、`workflow:ready`、`workflow:blocked` が存在することを確認する。欠けていれば暗黙に作成せず、`setup-workflow` が必要な setup blocker として停止する。
3. 対象が open であることを確認する。`kind:*` がなければ `kind:requirement` を追加し、既に `kind:requirement` が1つだけなら保持する。`kind:task` または複数の `kind:*` があれば自動で再分類せず停止する。追加後に Issue を再取得し、単一の `kind:requirement` を確認できなければ workflow label や本文を変更しない。
4. 既存状態からフェーズを判定する。`ai-design` marker 区間が task 分割の入力として完結し(課題と解決、分割があり、未決事項が「なし」)、blocker が残っておらず、`workflow:ready`(または task 分割の再実行中を示す `workflow:in-progress` と既存の native sub-issue / `ai-task-index`)であれば、Split フェーズ(Step 15)から再開する。それ以外は Planning フェーズから始める。label だけを根拠に設計済みと判断せず、marker 区間と blocker の有無を正本にする。

### Planning フェーズ

5. planning 開始時に Issue を再取得し、既存の `workflow:*` だけを `workflow:in-progress` に置き換える。既存の無関係な label と `automation:enabled` は保持し、更新後に `kind:requirement` と単一の `workflow:in-progress` を確認できなければ本文を変更しない。
6. Issue が自由形式または不完全であることを許容し、元の記述から利用者、課題、目的、in-scope、out-of-scope、機能・非機能要件を読み取って設計の前提にする。Issue 本文へ書くのは利用者視点の「課題と解決」と、元の記述に対して確定・追加した点(スコープ外、外れると設計が変わる前提)だけとし、元の要望に書かれている内容を再記述しない。記載がない項目を埋めるために意図を捏造しない。
7. codebase、tests、設定、関連 Issue/PR を調べ、現在の挙動、制約、用語、変更範囲を把握する。repository に glossary や ADR があればその語彙と決定に従う。調査結果は独立した節にせず、決定事項の理由として該当箇所に添える。根拠のないファイル名や API を捏造しない。
8. 不明点を事実、仮定、判断に分ける。
   - repository や環境から解決できる事実は自力で調査し、利用者への質問にしない。
   - 可逆で影響の小さい選択は仮定として明記して進める。
   - 製品の意図、スコープ、公開 API、データ損失、セキュリティを左右する曖昧さは、利用者に委ねる判断として質問にする。
9. 判断を設計ツリー(ある判断が確定すると次の判断が現れる依存関係)として整理し、フロンティア(他の質問の回答に依存しない、いま質問できる判断)が空になるまでラウンドを繰り返す。
   - 1ラウンドでフロンティア全体をチャットに提示する。各質問は次の形式で、番号、タイトル、本文(選択肢を含めてよい)、推奨回答を必ず付ける。

     ```markdown
     **Q1 - <質問タイトル>**: <質問本文。選択肢があれば列挙>

     - 推奨: <推奨回答と理由>
     ```

   - 事実調査の完了を待ってラウンド全体を止めない。調査結果に依存する質問だけを待たせ、独立した質問は先に出す。
   - 回答を得るたびに設計ツリーを更新してフロンティアを再計算し、次のラウンドを提示する。
   - 利用者が明示的に保留した判断は blocker とし、残りの回答で進められる範囲だけ設計する。
   - 利用者の回答待ちまたは保留された blocker がある状態でターンを終える前に、現在の `workflow:*` だけを `workflow:needs-input` に置き換えて再取得する。label 更新に失敗しても質問は提示し、state drift として明示する。
   - 回答を受けて planning を再開するときは Step 5 と同じ規則で `workflow:in-progress` に戻す。
10. 代替案が実質的にある場合は比較し、採用案と理由を確定する。テストをどの境界(seam)で書くかも、既存の手段で自明でなければここで決める。
11. [assets/design-section.md](assets/design-section.md) に従い、課題と解決、決定事項、前提、スコープ外、分割、未決事項を書く。決定事項に載せるのは「後から変えるコストが大きい」「文脈なしでは意外」「実質的な代替案があった」の3条件をすべて満たす判断だけで、各1〜3文にする。3条件を満たす判断が1つもないのは正常で、その場合は節を省く。ゲートを通らない選択は書かず、task 側と実装に委ねる。受入条件と検証方法は task Issue に置き、親には書かない。該当しない節は「なし」「変更なし」と埋めずに省く(未決事項は例外で、なければ「なし」と明記する)。ラウンドで解決した判断はゲートを通るものだけ決定事項へ反映し(質問番号は残さない)、保留された判断はラウンドと同じ質問形式で未決事項に記録する。文体は Writing 節に従う。
12. `<!-- ai-design:start -->` と `<!-- ai-design:end -->` の区間を Issue 本文末尾へ追記する。区間が既にあればその区間だけ更新し、元の要望と人手の追記を保持する。再実行時は、Issue コメントや本文に人手で追記された回答を blocker への回答として取り込み、フロンティアを再計算してから設計を更新する。解決した質問は未決事項から消し、ゲートを通るものだけ決定事項へ理由とともに移す。設計の変更は該当箇所の書き換えで反映し、無効になった記述を残したり追記節を重ねたりしない。
13. 重大な blocker がなければ、marker 区間が task 分割の入力として完結していることを確認し、現在の `workflow:*` だけを `workflow:ready` に置き換える。blocker があれば設計済みとして扱わず `workflow:needs-input` にし、Split フェーズへ進まない。どちらも Issue を更新直前・直後に再取得して kind/workflow label の単一性を確認する。
14. 更新した Issue URL、決定事項、「分割」に基づく task 分割案(各 task について、完了したらできること、依存)を番号付きで利用者に提示し、粒度は適切か、依存は技術的に本物か、統合・分割すべき task はないかを確認して承認を得る。Issue 本文をチャットに再掲しない。利用者が設計の確認までで止める場合は、更新した Issue URL、残った blocker、最終 workflow label を報告して終了する(`workflow:ready` のまま終えれば、本スキルの再実行で Split フェーズから再開できる)。本文更新後に label 更新を確認できなければ task 分割へ自動的に進めず、reconciliation が必要な state drift として報告する。

### Split フェーズ

15. 親 Issue と `ai-design` 区間を再取得し、open な native Issue、単一の `kind:requirement`、単一の `workflow:ready` または再実行中の `workflow:in-progress` であることを確認する。設計 marker が不完全、blocker が残る、kind/workflow label が不正、または Step 14 の承認を得ていないなら task を作らない。
16. 分割開始時に親を再取得し、現在の `workflow:*` だけを `workflow:in-progress` に置き換える。既存の無関係な label と `automation:enabled` は保持し、更新後に単一性を確認できなければ task を作らない。
17. `ai-design` 区間の「分割」を起点にし、task を「完了したら何ができるようになるか」を単独でデモまたは検証できる縦の単位にする。層ごとに切らず、原則1 task = 1 PR にする。1回の機械的変更が広範囲に波及する場合だけ、新形式の追加 → 呼び出し側の段階的移行 → 旧形式の削除の順に分ける。方針から乖離する場合は理由を記録し、利用者に提示した分割案から黙って変更しない。task 本文は挙動と受入条件で書き、file path や行番号は原則書かない(要件が置き場所を名指ししている場合と、決定事項が配置そのものである場合は例外)。理由や設計の再説明は書かず、従う親の決定事項を番号で参照する。各受入条件は、着手時点では満たされておらず、その task の変更だけで満たせ、要望の言い換えでないことを確認する。
18. task 間の有向非巡回グラフを作る。各 dependency は、その task を開始できない技術的理由がある場合だけ追加する。単なる希望順序は依存関係にしない。循環、自己参照、別 repository dependency があれば Issue 作成前に停止する。
19. 親の native sub-issue と `ai-task-index` を取得し、タイトルと成果が一致する既存 task を再利用する。番号やタイトルだけで曖昧に一致させず、再実行で重複を作らない。
20. dependency のない task から topological order で [assets/task-issue.md](assets/task-issue.md) を使って Issue を作る。task 本文には dependency の正本を置かず、作成時に native parent、native `blocked by`、`kind:task`、導出した workflow label を同時に設定する。
    - native blocker がないか、すべて closed: `workflow:ready`
    - native blocker が1件以上 open または確認不能: `workflow:blocked`
    - `automation:enabled` は明示的な opt-in のため、親から task へ自動継承しない。
21. 作成または再利用した task ごとに Issue を再取得し、parent、`blockedBy` の全件、`kind:*`、`workflow:*` を検証する。pagination を最後まで取得し、取得件数と API の合計数が一致することも確認する。
    - parent が違う場合は平坦な Issue で代用せず停止する。
    - planned dependency が欠け、かつ自分が作成した task だと確認できる場合だけ native relationship の追加を試みる。計画にない blocker は勝手に削除せず、設計との不一致として停止する。
    - kind/workflow label は既存の無関係な label を保持し、観測した管理対象 label だけを目標値へ正規化して再取得する。
    - metadata を確認できない task を後続 task の dependency に使わず、作成済み Issue と失敗箇所を報告して後続作成を停止する。
22. 全 task の native metadata を確認できた後だけ、親 Issue の `ai-task-index` marker 区間を task の一覧(番号、タイトル、blocked by の番号のみ。1 task = 1行)で追記または更新する。成果や変更内容は task Issue にあるので index に繰り返さない。dependency 一覧は人間向けの索引であり、native `blocked by` を正本とする。元の要件・設計を保持する。
23. 親 Issue を再取得し、単一の `kind:requirement` と `workflow:in-progress`、全 task の native sub-issue 関係、task index の一致を確認する。確認できない場合は actionable task を後続処理へ渡さない。
24. 更新した Issue URL、決定事項、作成・再利用した task の URL と workflow label、native dependency graph、作成できなかった項目、残った blocker、最終 workflow label を返す。`workflow:ready` かつ native blocker がすべて closed の actionable task を明示する。

## Writing

`ai-design` 区間と task Issue の本文は、レビューして承認する人間に向けて書く。数週間後に経緯を知らずに読む人が、設計区間だけで「何が課題で、何ができるようになり、なぜその形にしたか」を掴めることを基準にする。設計区間は決定の記録であり、決める場所でも実装手順書でもない。書かれていることは、利用者が実際に決めたか調査で確認したことだけにする。節を埋めるために発明した内容は欠陥とみなす。

- 課題と解決を利用者視点で先に書く。読者が最初に知りたいのは何が変わるかであり、要件の整理や調査の経緯ではない。
- 決定事項は3条件ゲート(後から変えるコストが大きい、文脈なしでは意外、実質的な代替案があった)を通るものだけ、各1〜3文で書く。価値は「その決定をした」と「なぜ」を残すことにあり、節を埋めることにはない。
- file path、行番号、コード断片を書かない。すぐ古くなり、読者を実装の細部に引きずり込む。例外は、状態機械や型の形のように決定を散文より正確に表す抜粋だけで、その場合も決定に関わる部分だけに切り詰める。
- 1つの事実は1か所にだけ書く。同じ内容を課題・決定事項・分割・task に繰り返さない。
- 1文1論点にする。決定、理由、却下した代替案は別々の文にし、括弧の入れ子や「〜のため〜であり〜(〜)」の連結を避ける。
- 過程の痕跡を残さない。質問番号(Q1 など)、「利用者の指示により」「確定判断」「再実行で」といった planning の経緯は書かず、決定の内容と理由だけを書く。人手で回答された判断も同じ形で書く。
- 用語は元の Issue、codebase、glossary のものを使う。workflow の内部語彙(正本、native、marker、blocker、claim、materialized など)を本文に出さない。
- 成果物の中身を書かない。作成するドキュメント・設定・コードの本文は task の実装で書き、設計では「何を含めるか」を1行で示す。
- 更新は上書きで行う。設計を後から変えたときは該当箇所を書き換え、無効になった記述や「上の記述は無効」形式の追記節、NOTE callout の修正を残さない。経緯が必要なら「変更履歴」節に日付と1行で記録する。
- 調査で得た事実は独立した節にせず、決定の理由として1〜2文で添える。参照した一次ソースはリンクだけを残す。
- task は「完了したらできること」を挙動で書き、fresh session が親を読み直さなくても着手できる文章にする。「この task が終わったら何をデモできるか」に答えられない task は層で切れている。

## Quality bar

- 元の Issue 本文を、整理した要件で置き換えない。解釈、仮定、追加した制約を追跡できるようにする。
- 受入条件は task Issue を正本にし、各受入条件を検証方法へ対応付ける。親 Issue には受入条件を書かない。
- 同じ内容を親 Issue、task Issue、`ai-task-index` に重複して書かない。親は課題・決定・分割、task は挙動と受入条件、index は番号と依存の対応だけを持つ。
- 該当しない節・項目は省き、「なし」「変更なし」で埋めない(未決事項の「なし」は例外)。元の要望に書かれている内容を設計区間で再記述しない。
- 製品判断が必要な不明点を、技術的に可能という理由だけで確定しない。
- repository や環境から自力で調査できる事実を、利用者への質問にしない。
- 利用者への質問には必ず推奨回答を付ける。
- フロンティア(利用者へ質問できる判断)が空であることを設計完了の条件とする。空でなければ設計済みとして扱わない。
- 単独で検証できる task に切れるまで設計を具体化するが、コードを先に実装しない。
- 設計完了(`workflow:ready`)と task Issue の作成の間に利用者の承認を挟み、承認なしに task を作成しない。
- 設計書を別ファイルとして repository に追加するよう明示されている場合は、そのファイルを正本にし、Issue には要約とリンクを追記する。
- API 更新が失敗した場合は本文を再取得し、他者の更新を取り込んで marker 区間だけ再適用する。
- `ai-design` marker 区間と blocker の有無を設計完了の正本にし、workflow label はその状態を検索・表示するために更新する。label だけを根拠に設計済みと判断しない。
- kind/workflow label の更新前後に Issue を再取得し、観測した管理対象 label だけを変更する。API の部分的な失敗を成功と解釈せず、workflow skill 内で欠けた label を作成しない。

## Dependency contract

- task の識別には native sub-issue、dependency には native `blocked by` relationship を正本として使う。本文、`Blocks`、親の task index は判定用の fallback にしない。
- 存在しない、open/closed を確認できない、循環する、または取得が不完全な dependency を持つ task は `workflow:blocked` とし、問題を報告する。
- label は native metadata から導出した materialized state とする。task 作成・修復の直前と直後に再取得し、workflow skill 内で欠けた contract label を作成しない。
- API timeout 後は同じ親の native sub-issue を検索し、作成結果が不明なまま同じ task を再作成しない。部分的に作成した task を自動削除せず、再実行で安全に補完できる状態として報告する。
