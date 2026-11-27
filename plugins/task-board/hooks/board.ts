// update_board の入力の検査と、表示・依頼文の組み立て。$ に触れない純粋な関数だけを置く。

import type { Board, BoardChild, BoardPullRequest, BoardTask, ChildLive, Runner } from '../types'

export const OPENED_TEXT = '管理ボードを開きました。'
export const QUICK_ASK = '現在の状態を一言で報告してください。何も変更しないでください。'
const REPLY_HEAD = 200

/** update_board の inputSchema。モデルはこの形で毎回全体を渡す。 */
export const UPDATE_BOARD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['requirement', 'tasks', 'checkedAt'],
  properties: {
    requirement: {
      type: 'object',
      description: '親要件の Issue',
      additionalProperties: false,
      required: ['repository', 'number', 'title', 'url', 'state'],
      properties: {
        repository: { type: 'string', description: 'owner/repo' },
        number: { type: 'integer' },
        title: { type: 'string' },
        url: { type: 'string' },
        state: { type: 'string', description: 'Issue の状態や workflow ラベル（例: open / workflow:in-progress）' },
      },
    },
    tasks: {
      type: 'array',
      description: '親要件の task をすべて並べる。毎回全体を渡し、前回の記録は置き換わる。',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['number', 'title', 'url', 'state'],
        properties: {
          number: { type: 'integer' },
          title: { type: 'string' },
          url: { type: 'string' },
          state: { type: 'string', description: 'Issue の状態や workflow ラベル' },
          pr: {
            type: 'object',
            description: 'task を閉じる Pull Request。なければ省く。',
            additionalProperties: false,
            required: ['number', 'url', 'state'],
            properties: {
              number: { type: 'integer' },
              url: { type: 'string' },
              state: { type: 'string', description: 'open / draft / merged / closed など' },
            },
          },
          child: {
            type: 'object',
            description: '担当の子。いなければ省く。',
            additionalProperties: false,
            required: ['runner', 'id'],
            properties: {
              runner: { type: 'string', enum: ['claude', 'codex'], description: '子の実行先' },
              id: { type: 'string', description: 'Claude Code は session_ ID、Codex は task ID' },
              url: { type: 'string' },
            },
          },
        },
      },
    },
    checkedAt: { type: 'string', description: '管理セッションが状態を確認した時刻（ISO 8601）' },
  },
} as const

export const UPDATE_BOARD_DESCRIPTION =
  '管理ボード（task-board mod のパネルと /task-board の一覧）に、親要件・task・PR・担当の子の記録を渡す。' +
  'ボードの作成時と、子の作成・PR の紐付け・状態の確認などで担当の記録が変わるたびに呼ぶ。' +
  '呼ぶたびに全体を置き換えるので、毎回すべての task を渡す。初回の呼び出しでパネルを開く。'

type Raw = Record<string, unknown>

function isObject(v: unknown): v is Raw {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(v: unknown, path: string): string {
  if (typeof v !== 'string') throw new Error(`${path} は文字列で渡してください`)
  return v
}

function num(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v)) throw new Error(`${path} は整数で渡してください`)
  return v
}

function obj(v: unknown, path: string): Raw {
  if (!isObject(v)) throw new Error(`${path} はオブジェクトで渡してください`)
  return v
}

function parsePr(v: unknown, path: string): BoardPullRequest | undefined {
  if (v === undefined || v === null) return undefined
  const o = obj(v, path)
  return { number: num(o.number, `${path}.number`), url: str(o.url, `${path}.url`), state: str(o.state, `${path}.state`) }
}

function parseChild(v: unknown, path: string): BoardChild | undefined {
  if (v === undefined || v === null) return undefined
  const o = obj(v, path)
  const runner = o.runner
  if (runner !== 'claude' && runner !== 'codex') throw new Error(`${path}.runner は claude か codex を渡してください`)
  const id = str(o.id, `${path}.id`).trim()
  if (!id) throw new Error(`${path}.id が空です`)
  const child: BoardChild = { runner: runner as Runner, id }
  if (o.url !== undefined && o.url !== null) child.url = str(o.url, `${path}.url`)
  return child
}

/** update_board の入力を検査して Board にする。形が違えば理由を添えて投げる。 */
export function parseBoard(input: Raw): Board {
  const r = obj(input.requirement, 'requirement')
  const tasksRaw = input.tasks
  if (!Array.isArray(tasksRaw)) throw new Error('tasks は配列で渡してください')
  const seen = new Set<number>()
  const tasks: BoardTask[] = tasksRaw.map((value, i) => {
    const path = `tasks[${i}]`
    const t = obj(value, path)
    const number = num(t.number, `${path}.number`)
    if (seen.has(number)) throw new Error(`task #${number} が重複しています`)
    seen.add(number)
    const task: BoardTask = {
      number,
      title: str(t.title, `${path}.title`),
      url: str(t.url, `${path}.url`),
      state: str(t.state, `${path}.state`),
    }
    const pr = parsePr(t.pr, `${path}.pr`)
    if (pr) task.pr = pr
    const child = parseChild(t.child, `${path}.child`)
    if (child) task.child = child
    return task
  })
  return {
    requirement: {
      repository: str(r.repository, 'requirement.repository'),
      number: num(r.number, 'requirement.number'),
      title: str(r.title, 'requirement.title'),
      url: str(r.url, 'requirement.url'),
      state: str(r.state, 'requirement.state'),
    },
    tasks,
    checkedAt: str(input.checkedAt, 'checkedAt'),
  }
}

/** $.store から読んだ値が Board の形かどうか。古い形や壊れた値は捨てる。 */
export function asBoard(v: unknown): Board | null {
  if (!isObject(v)) return null
  try {
    return parseBoard(v)
  } catch {
    return null
  }
}

export function bucketLabel(bucket?: string): string {
  const s = String(bucket ?? '')
    .replace('SESSION_STATUS_BUCKET_', '')
    .toLowerCase()
  const map: Record<string, string> = {
    working: '作業中',
    blocked: '対応待ち',
    review_ready: 'レビュー待ち',
    completed: '完了',
    failed: '失敗',
  }
  return map[s] ?? (s || '未取得')
}

/** 時刻を「11/27 08:30」の形にする。読めない値は「—」。 */
export function fmtTime(v?: number | string): string {
  if (v === undefined || v === '') return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return typeof v === 'string' ? v : '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function runnerLabel(runner: Runner): string {
  return runner === 'claude' ? 'Claude Code' : 'Codex'
}

export function prLabel(pr?: BoardPullRequest): string {
  return pr ? `PR #${pr.number} ${pr.state}` : 'PR なし'
}

export function oneLine(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? flat.slice(0, max) + '…' : flat
}

/** 管理会話に入れる依頼文。宛先の task 番号と子の ID を必ず含める。 */
export function instructionText(board: Board, task: BoardTask, child: BoardChild, text: string): string {
  const repo = board.requirement.repository
  return [
    `[管理ボード] ${repo}#${task.number} の担当（${runnerLabel(child.runner)} ${child.id}）に次の追加指示を転送してください。`,
    '担当の記録と GitHub で宛先を照合してから同じ子に送り、子の返信を確認して報告してください。',
    '',
    '指示:',
    text,
  ].join('\n')
}

/** /task-board の返答。モバイルアプリにはこの文字列がそのまま届く。 */
export function summaryText(board: Board | null, live: Record<string, ChildLive>): string {
  if (!board) {
    return [
      '**管理ボード**',
      '',
      '管理セッションがまだ記録していません。管理セッションが `mcp__task-board__update_board` を呼ぶと、task と担当の子が表示されます。',
    ].join('\n')
  }
  const r = board.requirement
  const lines = [
    `**管理ボード: ${r.repository}#${r.number} ${r.title}**（${r.state}）`,
    `管理セッションの確認: ${fmtTime(board.checkedAt)}`,
    '',
  ]
  if (board.tasks.length === 0) lines.push('- 記録された task はありません。')
  for (const t of board.tasks) {
    lines.push(`- #${t.number} ${t.title}`)
    lines.push(`  - ${t.state} · ${prLabel(t.pr)}`)
    const c = t.child
    if (!c) {
      lines.push('  - 担当: なし')
      continue
    }
    if (c.runner === 'codex') {
      lines.push(`  - 担当: Codex ${c.id}（自動取得しません。上の状態は管理セッションの記録です）`)
      continue
    }
    const L = live[c.id] ?? {}
    lines.push(`  - 担当: Claude Code ${c.id} · 状態 ${bucketLabel(L.bucket)}（最終取得 ${fmtTime(L.fetchedAt)}）`)
    if (L.error) lines.push(`  - ${L.error}`)
    if (L.reply) lines.push(`  - 最新の返信: ${oneLine(L.reply, REPLY_HEAD)}`)
  }
  lines.push(
    '',
    '自動取得した状態は参考情報です。追加指示は、この会話に「#<task 番号> の担当に〜と伝えて」のように書いてください。',
  )
  return lines.join('\n')
}

type McpContent = ReadonlyArray<{ type: string; text?: string }>

/** claude-code-remote の結果は JSON の前後に説明文が付くことがあるため、最初の { から最後の } までを読む。 */
export function parseJson(content: McpContent): Raw {
  const text = content
    .filter(c => c.type === 'text' && typeof c.text === 'string')
    .map(c => c.text as string)
    .join('\n')
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return {}
  try {
    const value: unknown = JSON.parse(text.slice(start, end + 1))
    if (!isObject(value)) return {}
    return isObject(value.ccr) ? value.ccr : value
  } catch {
    return {}
  }
}

export function errorText(content: McpContent): string {
  return content
    .filter(c => c.type === 'text' && typeof c.text === 'string')
    .map(c => c.text as string)
    .join(' ')
}

/** get_session の結果から状態と要約を読む。 */
export function readSession(s: Raw): { bucket?: string; summary?: string } {
  const meta = isObject(s.external_metadata) ? s.external_metadata : {}
  const pts = isObject(s.post_turn_summary) ? s.post_turn_summary : isObject(meta.post_turn_summary) ? meta.post_turn_summary : {}
  const summary = [pts.status_detail, pts.recent_action, s.task_summary].find(
    (v): v is string => typeof v === 'string' && v.trim() !== '',
  )
  return {
    bucket: typeof s.status_bucket === 'string' ? s.status_bucket : undefined,
    summary,
  }
}

/** list_events（kinds: result）の結果から、最新の返信を読む。 */
export function latestReply(ev: Raw): { text: string; at?: string } | null {
  const events = Array.isArray(ev.data) ? ev.data : []
  for (let i = events.length - 1; i >= 0; i--) {
    const e: unknown = events[i]
    if (!isObject(e)) continue
    const data = isObject(e.data) ? e.data : {}
    const outer = isObject(e.result) ? e.result : isObject(data.result) ? data.result : null
    if (!outer) continue
    const res = isObject(outer.internal_anthropic_catchall) ? outer.internal_anthropic_catchall : outer
    if (typeof res.result === 'string' && res.result.trim()) {
      return { text: res.result, at: typeof e.created_at === 'string' ? e.created_at : undefined }
    }
  }
  return null
}
