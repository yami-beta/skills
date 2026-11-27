import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

import type { Board, BoardTask, ChildLive, Pending } from '../types'
import type { Tone } from './board'
import {
  OPENED_TEXT,
  QUICK_ASK,
  UPDATE_BOARD_DESCRIPTION,
  UPDATE_BOARD_SCHEMA,
  asBoard,
  boardCounts,
  bucketLabel,
  bucketTone,
  cardLayout,
  doneText,
  errorText,
  fmtTime,
  instructionText,
  latestReply,
  oneLine,
  parseBoard,
  parseJson,
  prTone,
  readSession,
  rowTone,
  runnerLabel,
  stateLabel,
  stateTone,
  summaryText,
  toneColor,
} from './board'

const PANE = 'task-board'
const TITLE = '管理ボード'
const TOOL = 'update_board'
const SERVER = 'claude-code-remote'
const REFRESH_MS = 60_000
const STORE_KEY = 'board'
const REPLY_MAX = 600

// 値の形を変えたらタグを上げる。前の版が残した値は読まずに捨てる。
const board = atom({ plugin: 'task-board', key: 'board' } as const, null as Board | null, { shape: 'board-1' })
const live = atom({ plugin: 'task-board', key: 'live' } as const, {} as Record<string, ChildLive>, { shape: 'live-1' })
const pending = atom({ plugin: 'task-board', key: 'pending' } as const, null as Pending)
const expanded = atom({ plugin: 'task-board', key: 'expanded' } as const, {} as Record<string, boolean>)
const notice = atom({ plugin: 'task-board', key: 'notice' } as const, '')
const refreshing = atom({ plugin: 'task-board', key: 'refreshing' } as const, false)

// 取得中かどうかはモジュールの変数で持つ。hot reload で初期化されるので、取得の途中で reload しても止まったままにならない。
let inflight: Promise<void> | null = null

type Stored = { sessionId: string; board: Board }

async function openPane($: EngineInterface) {
  return $.ui.open({ id: PANE, title: TITLE })
}

// hot reload の後に、同じセッションで記録した board を $.store から戻す。別のセッションの記録は使わない。
async function restore($: EngineInterface): Promise<void> {
  if (await read($, board)) return
  const stored = await $.store.get(STORE_KEY)
  if (typeof stored !== 'object' || stored === null) return
  const { sessionId, board: value } = stored as Partial<Stored>
  if (sessionId !== (await $.session.id())) return
  const restored = asBoard(value)
  if (restored) await update($, board, () => restored)
}

function claudeChildren(b: Board | null): string[] {
  if (!b) return []
  const ids = b.tasks.flatMap(t => (t.child?.runner === 'claude' ? [t.child.id] : []))
  return [...new Set(ids)]
}

async function fetchChild($: EngineInterface, id: string): Promise<void> {
  try {
    const s = await $.mcp.call(SERVER, 'get_session', { session_id: id })
    if (s.isError) throw new Error(errorText(s.content) || 'get_session が失敗しました')
    const ev = await $.mcp.call(SERVER, 'list_events', { session_id: id, kinds: ['result'], limit: 100 })
    if (ev.isError) throw new Error(errorText(ev.content) || 'list_events が失敗しました')
    const { bucket, summary } = readSession(parseJson(s.content))
    const rep = latestReply(parseJson(ev.content))
    const now = await $.clock.now()
    await update($, live, all => {
      const prev = all[id] ?? {}
      const next: ChildLive = { ...prev, fetchedAt: now }
      delete next.error
      if (bucket !== undefined) next.bucket = bucket
      if (summary !== undefined) next.summary = summary
      if (rep) {
        next.reply = rep.text.length > REPLY_MAX ? rep.text.slice(0, REPLY_MAX) + '…' : rep.text
        if (rep.at !== undefined) next.replyAt = rep.at
      }
      return { ...all, [id]: next }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // 失敗した行は直前の表示を残し、理由だけを添える。
    await update($, live, all => ({
      ...all,
      [id]: { ...all[id], error: `取得できませんでした: ${message.slice(0, 200)}` },
    }))
  }
}

async function refreshAll($: EngineInterface): Promise<void> {
  const ids = claudeChildren(await read($, board))
  if (ids.length === 0) return
  await update($, refreshing, () => true)
  try {
    for (const id of ids) await fetchChild($, id)
  } finally {
    await update($, refreshing, () => false)
  }
}

/** 実行先が claude の子の状態と最新の返信を取り直す。取得中なら、その取得の終わりを待つ。 */
function refresh($: EngineInterface): Promise<void> {
  if (!inflight) {
    inflight = refreshAll($).finally(() => {
      inflight = null
    })
  }
  return inflight
}

function findTask(b: Board | null, task: number): BoardTask | undefined {
  return b?.tasks.find(t => t.number === task)
}

/** 管理会話に依頼を入れる。宛先は管理セッションで、mod から子へは直接送らない。 */
async function sendInstruction($: EngineInterface, p: NonNullable<Pending>): Promise<void> {
  const b = await read($, board)
  const t = findTask(b, p.task)
  await update($, pending, () => null)
  if (!b || !t?.child || t.child.id !== p.childId) {
    await update($, notice, () => `#${p.task} の担当が記録と変わったため、送りませんでした。もう一度入力してください。`)
    return
  }
  await update($, notice, () => `#${p.task} への指示を管理セッションに送りました。`)
  void $.prompt.submit({ text: instructionText(b, t, t.child, p.text) })
}

type RenderEvent = Parameters<EngineInterface['ui']['resolve']>[0]

const LABEL_WIDTH = 8
const SUMMARY_MAX = 80
const REPLY_MAX_SHOWN = 400

async function boardTree($: EngineInterface, e: RenderEvent, bodyColumns: number | undefined) {
  const { Box, Text, Button, Input, Link, Progress } = $.ui.resolve(e)
  const b = await read($, board)
  if (!b) {
    return (
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        <Box flexDirection="column" gap={1} borderStyle="round" paddingX={2} paddingY={1}>
          <Text bold>管理ボード</Text>
          <Text>管理セッションがまだ記録していません。</Text>
          <Text dimColor>管理セッションが mcp__task-board__update_board を呼ぶと、ここに task と担当の子が表示されます。</Text>
        </Box>
      </Box>
    )
  }
  const all = await read($, live)
  const wait = await read($, pending)
  const open = await read($, expanded)
  const note = await read($, notice)
  const busy = await read($, refreshing)
  const r = b.requirement
  const hasClaude = claudeChildren(b).length > 0
  const counts = boardCounts(b, all)
  const layout = cardLayout(bodyColumns)

  // 色付きの小さなラベル。背景を意味の色にし、文字は反転色にする。
  const chip = (key: string, label: string, tone: Tone) => (
    <Text key={key} backgroundColor={toneColor(tone)} color="inverseText">
      {` ${label} `}
    </Text>
  )
  // 短い見出しと値を揃えて並べる 1 行。
  const field = (key: string, label: string, value: RenderChildren) => (
    <Box key={key} flexDirection="row" gap={1}>
      <Box width={LABEL_WIDTH} flexShrink={0}>
        <Text dimColor>{label}</Text>
      </Box>
      <Box flexDirection="row" gap={1} flexWrap="wrap" flexShrink={1}>
        {value}
      </Box>
    </Box>
  )
  const tally = [
    { key: 'working', label: '作業中', n: counts.working, tone: 'info' as const },
    { key: 'waiting', label: '対応待ち', n: counts.waiting, tone: 'attention' as const },
    { key: 'review', label: 'レビュー待ち', n: counts.review, tone: 'good' as const },
    { key: 'failed', label: '失敗・取得できず', n: counts.failed, tone: 'problem' as const },
  ].filter(x => x.n > 0)

  return (
    <Box flexDirection="column" gap={1} paddingX={1} paddingY={1}>
      <Box key="summary" flexDirection="column" gap={1} borderStyle="round" paddingX={2} paddingY={1}>
        <Box flexDirection="column">
          <Link href={r.url} label={`${r.repository}#${r.number} ${r.title}`} />
          <Box flexDirection="row" gap={1} flexWrap="wrap">
            {chip('req-state', stateLabel(r.state), stateTone(r.state))}
            <Text dimColor>管理セッションの確認 {fmtTime(b.checkedAt)}</Text>
          </Box>
        </Box>
        <Box flexDirection="column">
          <Progress label="task の完了" value={counts.done} max={Math.max(counts.total, 1)} valueText={doneText(counts)} />
          {tally.length > 0 ? (
            <Box flexDirection="row" gap={1} flexWrap="wrap">
              {tally.map(x => chip(`tally-${x.key}`, `${x.label} ${x.n} 件`, x.tone))}
            </Box>
          ) : null}
        </Box>
        {hasClaude ? (
          <Box flexDirection="row" gap={2} flexWrap="wrap">
            <Button key="refresh" label="状況を更新" onPress={() => void refresh($)} />
            <Text dimColor>{busy ? '更新中…' : '1 分ごとに自動更新（参考情報）'}</Text>
          </Box>
        ) : null}
      </Box>
      {note ? <Text>{note}</Text> : null}
      {b.tasks.length === 0 ? <Text dimColor>記録された task はありません。</Text> : null}
      <Box
        key="cards"
        flexDirection={layout.columns === 2 ? 'row' : 'column'}
        flexWrap={layout.columns === 2 ? 'wrap' : 'nowrap'}
        columnGap={2}
        rowGap={1}
      >
        {b.tasks.map(t => {
          const c = t.child
          const L: ChildLive = c?.runner === 'claude' ? (all[c.id] ?? {}) : {}
          const isConfirming = !!c && wait?.task === t.number
          const isOpen = !!open[String(t.number)]
          const attention = rowTone(t, L)
          const toggle = () => void update($, expanded, prev => ({ ...prev, [String(t.number)]: !prev[String(t.number)] }))
          return (
            <Box
              key={`task-${t.number}`}
              flexDirection="column"
              gap={1}
              width={layout.width}
              borderStyle="round"
              borderColor={attention ? toneColor(attention) : undefined}
              paddingX={2}
              paddingY={1}
            >
              <Box flexDirection="column">
                <Link href={t.url} label={`#${t.number} ${t.title}`} />
                <Box flexDirection="row" gap={1} flexWrap="wrap">
                  {chip(`state-${t.number}`, stateLabel(t.state), stateTone(t.state))}
                  {c?.runner === 'claude' ? chip(`bucket-${t.number}`, bucketLabel(L.bucket), bucketTone(L.bucket)) : null}
                </Box>
              </Box>
              <Box flexDirection="column">
                {field(
                  `pr-${t.number}`,
                  'PR',
                  t.pr ? (
                    [chip(`pr-chip-${t.number}`, t.pr.state, prTone(t.pr.state)), <Link href={t.pr.url} label={`#${t.pr.number}`} />]
                  ) : (
                    <Text dimColor>なし</Text>
                  ),
                )}
                {field(
                  `child-${t.number}`,
                  '担当',
                  c ? (
                    [<Text>{`${runnerLabel(c.runner)} ${c.id}`}</Text>, c.url ? <Link href={c.url} label="開く" /> : null]
                  ) : (
                    <Text dimColor>なし</Text>
                  ),
                )}
                {c
                  ? field(
                      `fetched-${t.number}`,
                      '最終取得',
                      <Text dimColor={c.runner === 'codex'}>{c.runner === 'claude' ? fmtTime(L.fetchedAt) : '自動取得なし（Codex）'}</Text>,
                    )
                  : null}
                {c?.runner === 'claude' && L.summary
                  ? field(`summary-${t.number}`, '要約', <Text>{oneLine(L.summary, SUMMARY_MAX)}</Text>)
                  : null}
                {L.error ? <Text color={toneColor('problem')}>{L.error}</Text> : null}
              </Box>
              {c && !isConfirming ? (
                <Box flexDirection="row" gap={2} flexWrap="wrap">
                  <Button
                    key={`quick-${t.number}`}
                    label="状況を報告してもらう"
                    onPress={() => void sendInstruction($, { task: t.number, childId: c.id, text: QUICK_ASK })}
                  />
                  <Button key={`details-${t.number}`} label={isOpen ? '詳細を閉じる' : '詳細'} onPress={toggle} />
                </Box>
              ) : null}
              {c && isOpen && !isConfirming ? (
                <Box flexDirection="column" gap={1}>
                  {c.runner === 'claude' ? (
                    <Box flexDirection="column">
                      <Text dimColor>最新の返信{L.replyAt ? `（${fmtTime(L.replyAt)}）` : ''}</Text>
                      <Text>{L.reply ? oneLine(L.reply, REPLY_MAX_SHOWN) : 'まだありません。'}</Text>
                    </Box>
                  ) : null}
                  <Input
                    key={`draft-${t.number}`}
                    label="追加指示"
                    placeholder="Enter で宛先と指示文の確認へ"
                    submitLabel="確認"
                    rows={2}
                    onSubmit={text => {
                      const trimmed = text.trim()
                      if (!trimmed) return
                      void update($, notice, () => '')
                      void update($, pending, () => ({ task: t.number, childId: c.id, text: trimmed }))
                    }}
                  />
                </Box>
              ) : null}
              {c && isConfirming && wait ? (
                <Box flexDirection="column" gap={1}>
                  <Text>
                    宛先: #{t.number} の担当（{runnerLabel(c.runner)} {c.id}）。管理セッション経由で次の指示を送ります:
                  </Text>
                  <Text bold>{wait.text}</Text>
                  <Box flexDirection="row" gap={2} flexWrap="wrap">
                    <Button
                      key={`send-${t.number}`}
                      label="この内容で送る"
                      variant="primary"
                      onPress={() => void sendInstruction($, wait)}
                    />
                    <Button key={`cancel-${t.number}`} label="やめる" onPress={() => void update($, pending, () => null)} />
                  </Box>
                </Box>
              ) : null}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'task-board', description: '管理ボードを開き、task と担当の子の状況を一覧する' })
    await $.tool.register({
      name: TOOL,
      description: UPDATE_BOARD_DESCRIPTION,
      inputSchema: UPDATE_BOARD_SCHEMA,
      isDeferred: false,
    })
    await update($, refreshing, () => false)
    await restore($)
    void refresh($)
    $.clock.every(REFRESH_MS, () => {
      void refresh($)
    })
    return next(e)
  })

  on('tool.run', { tool: 'mcp__task-board__update_board' }, async ($, e) => {
    let value: Board
    try {
      value = parseBoard(e as unknown as Record<string, unknown>)
    } catch (err) {
      return { deny: `update_board の入力が不正です: ${err instanceof Error ? err.message : String(err)}` }
    }
    const before = await read($, board)
    await update($, board, () => value)
    const stored: Stored = { sessionId: await $.session.id(), board: value }
    await $.store.set(STORE_KEY, stored)
    // 担当がいなくなった子の自動取得の結果と、宛先が変わった確認待ちを捨てる。
    const ids = new Set(value.tasks.flatMap(t => (t.child ? [t.child.id] : [])))
    await update($, live, all => Object.fromEntries(Object.entries(all).filter(([id]) => ids.has(id))))
    await update($, pending, p => (p && findTask(value, p.task)?.child?.id === p.childId ? p : null))
    if (!before) void openPane($)
    void refresh($)
    const assigned = value.tasks.filter(t => t.child).length
    return { result: `管理ボードを更新しました（task ${value.tasks.length} 件、担当の子 ${assigned} 件）。` }
  }).catch(() => ({ deny: 'update_board の記録に失敗しました。もう一度呼んでください。' }))

  // 返答の文字列は常に状況の一覧にする。mod の描画先でないモバイルアプリにはこの文字列がそのまま届く。
  on('command.run', { command: 'task-board' }, async $ => {
    await openPane($)
    await refresh($)
    return { text: summaryText(await read($, board), await read($, live)) }
  })

  // mod の描画先（デスクトップ・ターミナルなど）ではパネルがあるので、一覧の代わりに一言だけ出す。
  on('ui.render', { component: 'CommandOutput', props: { command: 'task-board' } }, async ($, e, next) => {
    if (e.props.isErrored) return next(e)
    return next({ ...e, props: { ...e.props, text: OPENED_TEXT } })
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => boardTree($, e, e.props.bodyColumns))
}
