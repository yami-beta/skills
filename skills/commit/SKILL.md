---
name: commit
description: gitコミットを作成する。変更の確認、コミットメッセージの作成、コミット実行までを一貫して行う。「コミットを作成」「変更をコミット」「git commit」などの要求時に使用。
allowed-tools: Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git add *) Bash(git commit *) Bash(git branch *) Bash(git switch *) Bash(git symbolic-ref *) Bash(gh pr list *)
argument-hint: "[補足指示]"
---

# Gitコミットを作成

## Requirements

`git` を使用する。GitHub の Pull Request 運用を判定する場合は、認証済みの `gh` CLI も使用する。`gh` を利用できず判断材料が足りない場合は、トピックブランチを作成する。

## Input

明示的なスキル呼び出しに続けて渡されたテキスト、または同じ依頼内の補足指示を入力として扱い、コミット対象、分割方針、コミットメッセージへ反映する。補足指示がなければ、変更内容から判断する。

## Attribution

- 作成前に、利用者の指示と実行環境で適用される attribution 設定・規約を確認する。明示的に無効化されている場合は付けない。
- 有効な場合は設定された表記を使う。エージェント名、モデル名、メールアドレスを推測せず、過去の別エージェントの署名を流用しない。必要な表記を確認できない場合は不足を報告し、付与済みとは扱わない。
- 実行環境が自動付与する場合も含め、同じ attribution を重複させない。既存の他の contributor の表記を保持する。

コミットには適用される `Co-authored-by` trailer または設定された attribution を含める。Git の author / committer を attribution の代用として変更しない。

## Workflow

### Step 1: 変更の確認

次のコマンドで現在の状態を確認する。

```bash
git branch --show-current
git log --oneline -20
git status
git diff
git diff --staged
```

変更（staged / unstaged / untracked）が一切ない場合は、コミット対象がない旨を報告してワークフローを終了する。

### Step 2: ブランチを作成

- 現在のブランチがデフォルトブランチと異なる場合
    - トピックブランチ上なので **Step 3** へ進む
- 現在のブランチがデフォルトブランチの場合
   - リポジトリのワークフローを判定する。判定材料を取得する:
     ```bash
     git log -20 --format='%h %p %s'                          # %p の親が2つ以上ある行がマージコミット
     gh pr list --state merged --limit 1 --json number,mergedAt
     git log -20 --format=%cI | tail -1
     ```
     `git log --merges -20` は件数上限がフィルタ後に効くため「直近20件のうちのマージ」にはならない。`%p` の親の数で判定する
   - 以下のいずれかに該当すればトピックブランチ運用なので **Step 2.1** へ進む
       - マージコミットがある（merge commit 運用）
       - 件名末尾に `(#123)` のような PR 番号がある（squash merge 運用の痕跡）
       - 最新のマージ済み PR の `mergedAt` が直近20コミットの最古の日時より新しい（rebase merge 運用。履歴が直線になるためマージコミットも件名にも痕跡が残らない）。古ければ過去に PR を使っていただけなので該当しない
   - いずれにも該当しない場合は直接コミットスタイルなので **Step 3** へ進む
   - 判断材料が乏しい場合（コミット履歴が数件以下の新規リポジトリなど）は安全側に倒し **Step 2.1** へ進む

#### Step 2.1: トピックブランチの作成

デフォルトブランチへの直接コミットは避け、トピックブランチを作成する。

1. Step 1で確認した変更内容から適切なブランチ名を生成
   - 例: `feat/add-xxx`, `fix/resolve-yyy`, `docs/update-readme`
2. ブランチを作成してチェックアウト
   ```bash
   git switch -c <branch-name>
   ```
3. **Step 3** へ進む

### Step 3: コミットメッセージの作成

変更内容を分析し、適切なコミットメッセージを作成する。

基本フォーマット:
```
<type>[scope]: <description>

[optional body]
```

#### type の選び方

Conventional Commits に従い、変更の性質で type を選ぶ。リポジトリに確立した慣習があればそれを優先しつつ、以下を基準にする:

- `feat`: 新機能
- `fix`: バグ修正
- `build`: ビルドシステムや**外部依存**の変更（依存の追加/更新/削除、lockfile、パッケージマネージャ設定など）
- `ci`: CI 設定・ワークフローの変更
- `docs`: ドキュメントのみ
- `refactor`: 挙動を変えないコード整理
- `test`: テストの追加・修正
- `style`: フォーマット等（挙動・意味に影響しない）
- `perf`: パフォーマンス改善
- `chore`: 上記のいずれにも当てはまらない雑多な変更

#### 本文（body）に含める内容

会話履歴を振り返り、以下のうち該当する情報があるものだけを本文に記載する（該当がなければ件名のみとし、埋め草で膨らませない）:

- **変更の動機・背景**: なぜこの変更が必要になったか
- **設計判断とその理由**: 技術的な選択とその根拠
- **却下した代替案**: 検討したが採用しなかったアプローチとその理由
- **ユーザーからのフィードバックによる方針変更**: 当初の方針から変更があった場合、その経緯

issue / PR へのリンクを載せるときは以下に従う:

- 同一リポジトリの issue / PR は `#123` 形式かフル URL をそのまま使う。`redirect.github.com` 経由にすると `Fixes #123` などのクローズキーワードが認識されず、マージ時の自動クローズが働かない
- 作業リポジトリが `yami-beta/*` のときに限り、他リポジトリへのリンクは `https://redirect.github.com/{org}/{repo}/...` に書き換えて[バックリンク通知](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/autolinked-references-and-urls#avoiding-backlinks-to-linked-references)を避ける

### Step 4: 変更のステージングとコミット

```bash
git add <files>
git commit -m "<message>"
```

作成後は `git log -1 --format=%B` で実際のコミット本文を読み、期待する attribution が重複なく含まれることを確認する。欠落があれば報告する。修正のための `--amend` や履歴の書き換えは、利用者が明示的に許可した場合だけ行う。

### Step 5: 結果の報告

作成したコミットの件名と対象ファイルを1〜2行で報告する。

## 注意事項

- `.env` やシークレットを含むファイルはコミットしない
- 大きな変更は論理的な単位で分割してコミットする
- `--amend` や `--force` は明示的に指示された場合のみ使用する
