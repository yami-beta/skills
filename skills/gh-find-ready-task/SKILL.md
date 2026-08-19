---
name: gh-find-ready-task
description: Find, verify, and claim one actionable GitHub task sub-issue from a repository backlog without relying on labels. Use when a scheduled or polling automation must derive the next task from native sub-issue relationships, dependencies, assignments, claims, and pull requests rather than receiving a specific issue event.
---

# Find Ready Task

定期実行または polling 用に、実装可能な task を1件選び、競合しないよう確保する。指定 Issue を処理するイベント駆動ではこのスキルを使わず、直接 `gh-implement-ready-task` を使う。

## Workflow

1. 対象 repository を特定し、設計済みの要件 Issue に属する open な native sub-issue を取得する。親が明示された場合はその直下だけを、repository 全体の定期実行では `ai-task-index` を持つ要件 Issue の sub-issue を対象にする。
2. 各候補について本文の唯一の `- Depends on:` 行を解析する。次の候補を除外し、理由を報告する。
   - dependency が1件でも open、存在不明、または別 repository を参照する。
   - assignee がいる、未解除の claim marker がある、または別の実行主体が確保している。
   - task を close する open PR が既にある。
   - dependency 表現が欠落、複数、壊れている。
3. 残った候補を repository の priority 規約で並べる。規約がなければ milestone due date、親の `ai-task-index` の順序、Issue 番号の昇順で決める。推測した事業優先度で並べない。
4. 先頭候補を claim する。
   - automation actor へ assign できる構成なら assign する。
   - `<!-- ai-task-claim:<actor-or-run-id> -->` を含む短いコメントを1つ追加する。
5. Issue を再取得し、他の担当者、別 claim、または既存 PR が先に付いていないか確認する。競合した場合は自分の claim だけを戻し、次候補を試す。
6. 確保した Issue の番号、URL、dependency、選択理由を返す。候補がない場合は成功扱いで `no actionable task` を返す。

## Safety and idempotency

- 一度の実行で確保する task は1件だけにする。ただし呼び出し側が明示した上限があり、並列 worker ごとの一意な claim が保証される場合を除く。
- 同じ actor/run の marker が既にあれば同じ Issue を返し、新しい claim を作らない。
- claim marker と同じ actor/run の release marker が後にあれば、その claim は解除済みとして扱う。対応する release がない claim を勝手に失効または横取りしない。
- claim 後に実装へ進めなかった場合、コード変更がなく自分の claim だと確認できるときだけ自分を unassign し、`<!-- ai-task-release:<actor-or-run-id> -->` comment で claim を解除する。
- GitHub Actions などの呼び出し側でも repository 単位の concurrency 制御を設定する。
- Issue label を候補抽出、優先順位、排他制御に使わない。
