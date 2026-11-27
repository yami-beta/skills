import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import type { On } from 'claude-code'

const SESSION = 'session_manager'
const CHILD = 'session_child42'

const PANE = {
  plugin: 'task-board',
  component: 'Pane',
  requestId: 'task-board',
  props: {
    title: '管理ボード',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const

const BOARD = {
  requirement: {
    repository: 'yami-beta/skills',
    number: 47,
    title: '管理ボードを mod のパネルにする',
    url: 'https://github.com/yami-beta/skills/issues/47',
    state: 'workflow:in-progress',
  },
  tasks: [
    {
      number: 48,
      title: 'mod 本体を作る',
      url: 'https://github.com/yami-beta/skills/issues/48',
      state: 'workflow:review',
      pr: { number: 50, url: 'https://github.com/yami-beta/skills/pull/50', state: 'open' },
      child: { runner: 'claude', id: CHILD, url: 'https://claude.ai/code/session_child42' },
    },
    {
      number: 49,
      title: '手順書を書き換える',
      url: 'https://github.com/yami-beta/skills/issues/49',
      state: 'workflow:in-progress',
      child: { runner: 'codex', id: 'task_codex49' },
    },
    {
      number: 51,
      title: '担当のいない完了済みの task',
      url: 'https://github.com/yami-beta/skills/issues/51',
      state: 'closed',
    },
  ],
  checkedAt: '2026-11-27T09:00:00Z',
}

type Calls = { opened: number; submitted: string[]; mcp: string[]; fail: boolean; bucket: string; clock: MockClock }

function text(value: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(value) }], isError: false }
}

// 管理セッションの代わりに engine の各呼び出しへ答える。
function engine(on: On, store: Record<string, unknown> = {}): Calls {
  mock.store(on, store)
  const clock = mock.clock(on, { now: Date.UTC(2026, 10, 27, 9, 5) })
  const calls: Calls = { opened: 0, submitted: [], mcp: [], fail: false, bucket: 'SESSION_STATUS_BUCKET_REVIEW_READY', clock }
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__task-board__${e.name}` } }))
  on('session.id', () => ({ value: SESSION }))
  on('ui.open', () => {
    calls.opened++
    return { value: { isPlaced: true } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => {
    calls.submitted.push(e.text)
    return { text: e.text }
  })
  on('mcp.call', (_, e) => {
    calls.mcp.push(`${e.server}/${e.tool}/${String(e.args.session_id)}`)
    if (calls.fail) {
      return { value: { content: [{ type: 'text', text: 'session not found' }], isError: true } }
    }
    if (e.tool === 'get_session') {
      // claude-code-remote の実際の応答と同じく ccr で包み、要約は task_summary に入る。
      return {
        value: text({
          ccr: { id: CHILD, status_bucket: calls.bucket, task_summary: 'PR #50 を作成した' },
        }),
      }
    }
    return {
      value: text({
        ccr: {
          data: [
            { created_at: '2026-11-27T08:50:00Z', result: { internal_anthropic_catchall: { result: '古い返信' } } },
            {
              created_at: '2026-11-27T09:01:00Z',
              result: { internal_anthropic_catchall: { result: 'PR #50 を作成しました。検証はすべて通っています。' } },
            },
          ],
          has_more: true,
        },
      }),
    }
  })
  return calls
}

async function start($: Engine) {
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
}

async function runCommand($: Engine) {
  return $.command.run({
    command: 'task-board',
    args: '',
    origin: { kind: 'user' } as never,
    presentation: { isFullscreen: false } as never,
  })
}

test('記録がないうちは、まだ記録していないことをパネルと一覧に示す', async ($, on) => {
  const calls = engine(on)
  await start($)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /まだ記録していません/ }))?.text).toBe('管理セッションがまだ記録していません。')
    expect(await ui.find({ type: 'Button' })).toBeUndefined()
    await ui.unmount()
  }

  const out = await runCommand($)
  await calls.clock.settle()
  expect(out.text).toContain('管理セッションがまだ記録していません')
  expect(calls.opened).toBe(1)
  expect(calls.mcp).toEqual([])
})

test('update_board の記録をパネルに表示し、claude の子だけ自動取得する', async ($, on) => {
  const calls = engine(on)
  await start($)

  const ran = await $.tool.call({ tool: 'mcp__task-board__update_board', ...BOARD })
  await calls.clock.settle()
  expect(ran.deny).toBeUndefined()
  expect(String(ran.result)).toContain('task 3 件、担当の子 2 件')
  expect(calls.opened).toBe(1)
  expect(calls.mcp).toEqual([
    `claude-code-remote/get_session/${CHILD}`,
    `claude-code-remote/list_events/${CHILD}`,
  ])

  // 2 回目の呼び出しではパネルを開き直さない。
  await $.tool.call({ tool: 'mcp__task-board__update_board', ...BOARD })
  await calls.clock.settle()
  expect(calls.opened).toBe(1)
  expect(calls.mcp.length).toBe(4)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    // 上部の要約: 完了数の Progress（terminal と desktop では Box と Text になる）と集計のラベル。
    expect(await ui.find({ type: 'Text', text: /task 3 件中 1 件完了/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: / レビュー待ち 1 件 / }))?.props.backgroundColor).toBe('success')
    expect(await ui.find({ type: 'Text', text: /対応待ち/ })).toBeUndefined()
    // 状態は色付きのラベルで、意味の色を揃える。
    expect((await ui.find({ type: 'Text', text: /^ レビュー待ち $/ }))?.props.backgroundColor).toBe('success')
    expect((await ui.find({ type: 'Text', text: /^ PR open $/ }))?.props.backgroundColor).toBe('success')
    expect((await ui.find({ type: 'Text', text: /^ review $/ }))?.props.backgroundColor).toBe('success')
    expect((await ui.find({ type: 'Text', text: /^ in-progress $/ }))?.props.backgroundColor).toBe('suggestion')
    expect((await ui.find({ type: 'Text', text: /^ closed $/ }))?.props.backgroundColor).toBe('inactive')
    expect(await ui.find({ type: 'Text', text: /最終取得 11\/27.*PR #50 を作成した/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Codex の子は自動取得しません/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '· 担当: なし' })).toBeDefined()
    // 最新の返信と入力欄は詳細を開くまで出さない。
    expect(await ui.find({ type: 'Text', text: /最新の返信/ })).toBeUndefined()
    expect(await ui.find({ type: 'Input', key: 'draft-48' })).toBeUndefined()
    // 担当の子がいる行にだけ送信手段と詳細がある。折りたたみ中も「状況を報告してもらう」は出す。
    expect(await ui.find({ type: 'Button', key: 'quick-48' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'quick-49' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'quick-51' })).toBeUndefined()
    expect(await ui.find({ type: 'Button', key: 'details-51' })).toBeUndefined()

    await ui.press({ key: 'details-48' })
    expect(await ui.find({ type: 'Text', text: /最新の返信.*PR #50 を作成しました/ })).toBeDefined()
    expect(await ui.find({ type: 'Input', key: 'draft-48' })).toBeDefined()
    expect((await ui.find({ type: 'Button', key: 'details-48' }))?.props.label).toBe('詳細を閉じる')
    expect(await ui.find({ type: 'Input', key: 'draft-49' })).toBeUndefined()
    await ui.press({ key: 'details-48' })
    expect(await ui.find({ type: 'Input', key: 'draft-48' })).toBeUndefined()
    await ui.unmount()
  }

  // 「状況を更新」で取り直す。
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'refresh' })
  expect(calls.mcp.length).toBe(6)
  await ui.unmount()

  // 60 秒ごとにも取り直す。
  await calls.clock.advance(60_000)
  expect(calls.mcp.length).toBe(8)
})

test('形の違う入力は理由を添えて断る', async ($, on) => {
  const calls = engine(on)
  await start($)

  const ran = await $.tool.call({
    tool: 'mcp__task-board__update_board',
    ...BOARD,
    tasks: [{ ...BOARD.tasks[0], child: { runner: 'devin', id: 'x' } }],
  })
  await calls.clock.settle()
  expect(String(ran.deny ?? ran.text)).toContain('runner は claude か codex')
  expect(calls.mcp).toEqual([])
})

test('取得に失敗した行は直前の表示を残して理由を示す', async ($, on) => {
  const calls = engine(on)
  await start($)
  await $.tool.call({ tool: 'mcp__task-board__update_board', ...BOARD })
  await calls.clock.settle()

  calls.fail = true
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'refresh' })
  expect(await ui.find({ type: 'Text', text: /^ レビュー待ち $/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /取得できませんでした: session not found/ })).toBeDefined()
  // 対応が必要な行は枠の色を変え、要約にも数える。
  const row = await ui.find({ type: 'Box', key: 'task-48' })
  expect(row?.props.borderColor).toBe('error')
  expect((await ui.find({ type: 'Box', key: 'task-49' }))?.props.borderColor).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: / 失敗・取得できず 1 件 / })).toBeDefined()
  await ui.unmount()
})

test('対応待ちの子は注意の色のラベルと枠で示し、要約に数える', async ($, on) => {
  const calls = engine(on)
  calls.bucket = 'SESSION_STATUS_BUCKET_BLOCKED'
  await start($)
  await $.tool.call({ tool: 'mcp__task-board__update_board', ...BOARD })
  await calls.clock.settle()

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /^ 対応待ち $/ }))?.props.backgroundColor).toBe('warning')
    expect((await ui.find({ type: 'Text', text: / 対応待ち 1 件 / }))?.props.backgroundColor).toBe('warning')
    expect((await ui.find({ type: 'Box', key: 'task-48' }))?.props.borderColor).toBe('warning')
    await ui.unmount()
  }
})

test('「状況を報告してもらう」は確認なしで、入力欄は確認の後で管理会話に依頼を入れる', async ($, on) => {
  const calls = engine(on)
  await start($)
  await $.tool.call({ tool: 'mcp__task-board__update_board', ...BOARD })
  await calls.clock.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  // 「状況を報告してもらう」は折りたたみ中でも押せる。
  await ui.press({ key: 'quick-48' })
  expect(calls.submitted).toEqual([
    [
      `[管理ボード] yami-beta/skills#48 の担当（Claude Code ${CHILD}）に次の追加指示を転送してください。`,
      '担当の記録と GitHub で宛先を照合してから同じ子に送り、子の返信を確認して報告してください。',
      '',
      '指示:',
      '現在の状態を一言で報告してください。何も変更しないでください。',
    ].join('\n'),
  ])

  await ui.press({ key: 'details-49' })
  await ui.input({ key: 'draft-49', text: '  テストを追加してください  ' })
  // 確認の前には送らない。
  expect(calls.submitted.length).toBe(1)
  expect(await ui.find({ type: 'Text', text: /宛先: #49 の担当（Codex task_codex49）/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'テストを追加してください' })).toBeDefined()
  await ui.press({ key: 'send-49' })
  expect(calls.submitted[1]).toBe(
    [
      '[管理ボード] yami-beta/skills#49 の担当（Codex task_codex49）に次の追加指示を転送してください。',
      '担当の記録と GitHub で宛先を照合してから同じ子に送り、子の返信を確認して報告してください。',
      '',
      '指示:',
      'テストを追加してください',
    ].join('\n'),
  )
  expect(await ui.find({ type: 'Text', text: /#49 への指示を管理セッションに送りました/ })).toBeDefined()

  // やめると送らない。
  await ui.press({ key: 'details-48' })
  await ui.input({ key: 'draft-48', text: '取り消す指示' })
  await ui.press({ key: 'cancel-48' })
  expect(calls.submitted.length).toBe(2)
  expect(await ui.find({ type: 'Input', key: 'draft-48' })).toBeDefined()
  await ui.unmount()
})

test('/task-board の返答は状況の一覧で、描画先では一言に描き替える', async ($, on) => {
  // engine の代わりに、描き替えた後の行の文字を描く。
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.component === 'CommandOutput' ? e.props.text : ''}</Text>
  })
  const calls = engine(on)
  await start($)
  await $.tool.call({ tool: 'mcp__task-board__update_board', ...BOARD })
  await calls.clock.settle()

  const out = await runCommand($)
  const list = String(out.text)
  expect(list).toContain('**管理ボード: yami-beta/skills#47 管理ボードを mod のパネルにする**（workflow:in-progress）')
  expect(list).toContain('- #48 mod 本体を作る')
  expect(list).toContain('  - workflow:review · PR #50 open')
  expect(list).toContain(`  - 担当: Claude Code ${CHILD} · 状態 レビュー待ち（最終取得 11/27`)
  expect(list).toContain('  - 最新の返信: PR #50 を作成しました。検証はすべて通っています。')
  expect(list).toContain('  - 担当: Codex task_codex49（自動取得しません')
  expect(list).toContain('task 3 件中 1 件完了 · 管理セッションの確認: ')
  expect(list).toContain('- #51 担当のいない完了済みの task')
  expect(list).toContain('  - 担当: なし')
  expect(list).toContain('この会話に「#<task 番号> の担当に〜と伝えて」のように書いてください。')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'task-board',
      surface,
      component: 'CommandOutput',
      props: { command: 'task-board', args: '', text: list, isErrored: false },
    })
    expect((await ui.find({ type: 'Text' }))?.text).toBe('管理ボードを開きました。')
    await ui.unmount()
  }
})

test('hot reload 後は同じセッションの記録を $.store から戻す', async ($, on) => {
  const calls = engine(on, { board: { sessionId: SESSION, board: BOARD } })
  await start($)
  await calls.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Link', text: '#48 mod 本体を作る' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'quick-48' })).toBeDefined()
  await ui.unmount()
})

test('別のセッションが残した記録は戻さない', async ($, on) => {
  const calls = engine(on, { board: { sessionId: 'session_other', board: BOARD } })
  await start($)
  await calls.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /まだ記録していません/ })).toBeDefined()
  await ui.unmount()
})
