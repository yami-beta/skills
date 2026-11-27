// task-board の $.state の契約。管理セッションが update_board で渡す記録と、
// mod が自動取得した子の状況を持つ。

/** 子の実行先。`claude` だけが自動取得の対象。 */
export type Runner = 'claude' | 'codex'

/** 親要件。 */
export type BoardRequirement = {
  repository: string
  number: number
  title: string
  url: string
  state: string
}

/** task に紐づく Pull Request。 */
export type BoardPullRequest = {
  number: number
  url: string
  state: string
}

/** task を担当する子。`id` は Claude Code の session ID や Codex の task ID。 */
export type BoardChild = {
  runner: Runner
  id: string
  url?: string
}

export type BoardTask = {
  number: number
  title: string
  url: string
  state: string
  pr?: BoardPullRequest
  child?: BoardChild
}

/** update_board が受け取り、呼ぶたびに全体を置き換える記録。 */
export type Board = {
  requirement: BoardRequirement
  tasks: BoardTask[]
  /** 管理セッションが状態を確認した時刻（ISO 8601 など、管理セッションが渡した文字列）。 */
  checkedAt: string
}

/** 自動取得した子の状況。子の ID ごとに持つ。 */
export type ChildLive = {
  bucket?: string
  summary?: string
  reply?: string
  replyAt?: string
  fetchedAt?: number
  error?: string
}

/** 確認待ちの追加指示。 */
export type Pending = { task: number; childId: string; text: string } | null

declare module 'claude-code' {
  interface PluginState {
    'task-board': {
      board: Shaped<Board | null>
      live: Shaped<Record<string, ChildLive>>
      pending: Pending
      /** 行ごとの詳細の開閉。task 番号をキーにする。 */
      expanded: Record<string, boolean>
      notice: string
      refreshing: boolean
    }
  }
}
