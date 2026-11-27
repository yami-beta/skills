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

type Calls = {
  opened: number
  submitted: string[]
  mcp: string[]
  fail: boolean
  bucket: string
  remote: boolean
  throws: boolean
  connects: number
  reply: string
  replyAt: string
  clock: MockClock
}

function text(value: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(value) }], isError: false }
}

// 管理セッションの代わりに engine の各呼び出しへ答える。
function engine(on: On, store: Record<string, unknown> = {}): Calls {
  mock.store(on, store)
  const clock = mock.clock(on, { now: Date.UTC(2026, 10, 27, 9, 5) })
  const calls: Calls = {
    opened: 0,
    submitted: [],
    mcp: [],
    fail: false,
    bucket: 'SESSION_STATUS_BUCKET_REVIEW_READY',
    remote: true,
    throws: false,
    connects: 0,
    reply: 'PR #50 を作成しました。検証はすべて通っています。',
    replyAt: '2026-11-27T09:01:00Z',
    clock,
  }
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
  // 手元の Claude Code のように claude-code-remote がない場合は、接続の確認でつながっていないと答え、呼び出しも失敗する。
  on('mcp.connect', (_, e) => {
    calls.connects++
    return calls.remote
      ? { value: { isConnected: true, server: e.server } }
      : { value: { isConnected: false, reason: 'unlisted', message: `${e.server} is not listed` } }
  })
  on('mcp.call', (_, e) => {
    calls.mcp.push(`${e.server}/${e.tool}/${String(e.args.session_id)}`)
    if (!calls.remote) {
      throw new Error(`$.mcp.call: no connected MCP tool "${e.tool}" on a server named "${e.server}"`)
    }
    if (calls.throws) throw new Error('request timed out')
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
            { created_at: calls.replyAt, result: { internal_anthropic_catchall: { result: calls.reply } } },
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
    expect((await ui.find({ type: 'Text', text: /^ open $/ }))?.props.backgroundColor).toBe('success')
    expect((await ui.find({ type: 'Text', text: /^ review $/ }))?.props.backgroundColor).toBe('success')
    expect((await ui.find({ type: 'Text', text: /^ in-progress $/ }))?.props.backgroundColor).toBe('suggestion')
    expect((await ui.find({ type: 'Text', text: /^ closed $/ }))?.props.backgroundColor).toBe('inactive')
    // カードの情報は短い見出しと値で並べる。
    const fields = (await ui.findAll({ type: 'Text' })).map(x => x.text)
    expect(fields).toContain('最終取得')
    expect(fields.some(x => /^11\/27 /.test(x))).toBe(true)
    expect(fields).toContain('PR #50 を作成した')
    expect(fields).toContain(`Claude Code ${CHILD}`)
    expect(fields).toContain('自動取得なし（Codex）')
    // #49 と #51 の PR、#51 の担当。
    expect(fields.filter(x => x === 'なし').length).toBe(3)
    // 最新の返信と入力欄は詳細を開くまで出さない。
    expect(await ui.find({ type: 'Text', text: /最新の返信/ })).toBeUndefined()
    expect(await ui.find({ type: 'Input', key: 'draft-48' })).toBeUndefined()
    // 担当の子がいる行にだけ送信手段と詳細がある。折りたたみ中も「状況を報告してもらう」は出す。
    expect(await ui.find({ type: 'Button', key: 'quick-48' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'quick-49' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'quick-51' })).toBeUndefined()
    expect(await ui.find({ type: 'Button', key: 'details-51' })).toBeUndefined()

    await ui.press({ key: 'details-48' })
    expect(await ui.find({ type: 'Text', text: /^最新の返信（11\/27 / })).toBeDefined()
    expect(await ui.find({ type: 'Markdown', text: 'PR #50 を作成しました。検証はすべて通っています。' })).toBeDefined()
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

test('パネルが広いときは task のカードを 2 列、狭いときは 1 列に並べる', async ($, on) => {
  const calls = engine(on)
  await start($)
  await $.tool.call({ tool: 'mcp__task-board__update_board', ...BOARD })
  await calls.clock.settle()

  const cases = [
    { surface: 'desktop', bodyColumns: 140, direction: 'row', width: 68 },
    { surface: 'terminal', bodyColumns: 120, direction: 'row', width: 58 },
    { surface: 'desktop', bodyColumns: 80, direction: 'column', width: undefined },
    { surface: 'terminal', bodyColumns: 40, direction: 'column', width: undefined },
  ] as const
  for (const c of cases) {
    const ui = await $.ui.mount({ ...PANE, surface: c.surface, props: { ...PANE.props, bodyColumns: c.bodyColumns } })
    const cards = await ui.find({ type: 'Box', key: 'cards' })
    expect(cards?.props.flexDirection).toBe(c.direction)
    for (const n of [48, 49, 51]) {
      const card = await ui.find({ type: 'Box', key: `task-${n}` })
      expect(card?.props.width).toBe(c.width)
      // カードは枠と内側の余白を持ち、区画の間を 1 行空ける。
      expect(card?.props.borderStyle).toBe('round')
      expect(card?.props.paddingX).toBe(2)
      expect(card?.props.paddingY).toBe(1)
      expect(card?.props.gap).toBe(1)
    }
    // 要約も 1 枚のカードにする。
    expect((await ui.find({ type: 'Box', key: 'summary' }))?.props.borderStyle).toBe('round')
    // 狭い幅でも送信手段は残る。
    expect(await ui.find({ type: 'Button', key: 'quick-48' })).toBeDefined()
    await ui.unmount()
  }
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

const MARKDOWN_REPLY = [
  '**変更したこと**',
  '',
  '- **カード**: 要約と task をカードにしました。',
  '- **2 列表示**: 100 列以上で 2 列にします。',
  '',
  '',
  '**検証結果**',
  '- validate: エラーなし',
  '- test: 10 件通過',
  '',
  '**未確認**',
  '- 実機表示',
  '- 余白の見え方',
].join('\n')

test('詳細の返信は Markdown のまま先頭 10 行で切り、一覧では記号を除いた 1 行にする', async ($, on) => {
  const calls = engine(on)
  calls.reply = MARKDOWN_REPLY
  await start($)
  await $.tool.call({ tool: 'mcp__task-board__update_board', ...BOARD })
  await calls.clock.settle()

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'details-48' })
    const md = await ui.find({ type: 'Markdown' })
    // 空行の連続は 1 行に詰めて 12 行、そのうち先頭 10 行を改行ごと描く。
    expect(md?.props.text).toBe(MARKDOWN_REPLY.replace('\n\n\n', '\n\n').split('\n').slice(0, 10).join('\n'))
    expect(await ui.find({ type: 'Text', text: /続きがあります（全 12 行のうち先頭 10 行）/ })).toBeDefined()
    await ui.press({ key: 'details-48' })
    await ui.unmount()
  }

  const out = await runCommand($)
  expect(String(out.text)).toContain(
    '  - 最新の返信: 変更したこと カード: 要約と task をカードにしました。 2 列表示: 100 列以上で 2 列にします。',
  )
  const replyLine = String(out.text).split('\n').find(l => l.startsWith('  - 最新の返信'))
  expect(replyLine).not.toMatch(/\*\*|^\s*- \*/)
})

test('指示を送ったあとは 30 秒後と 90 秒後に取り直し、それより前の返信には印を付ける', async ($, on) => {
  const calls = engine(on)
  await start($)
  await $.tool.call({ tool: 'mcp__task-board__update_board', ...BOARD })
  await calls.clock.settle()
  expect(calls.mcp.length).toBe(2)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'details-48' })
  expect(await ui.find({ type: 'Text', text: /より前の返信/ })).toBeUndefined()

  // 09:05 に送る。表示中の返信は 09:01 なので印が付く。
  await ui.press({ key: 'quick-48' })
  expect(calls.submitted.length).toBe(1)
  const mark = await ui.find({ type: 'Text', text: /指示（11\/27 \d\d:05）より前の返信/ })
  expect(mark?.props.backgroundColor).toBe('warning')
  expect(String((await runCommand($)).text)).toMatch(/最新の返信（指示 11\/27 \d\d:05 より前の返信）: PR #50/)
  const afterCommand = calls.mcp.length

  // 30 秒後に担当の子だけを取り直す。まだ新しい返信はない。
  await calls.clock.advance(30_000)
  expect(calls.mcp.length).toBe(afterCommand + 2)
  expect(calls.mcp.slice(-2)).toEqual([`claude-code-remote/get_session/${CHILD}`, `claude-code-remote/list_events/${CHILD}`])
  expect(await ui.find({ type: 'Text', text: /より前の返信/ })).toBeDefined()

  // 指示への返事が届くと、次の取得で印が消える。
  calls.reply = '状態: レビュー待ちです。'
  calls.replyAt = new Date(calls.clock.now() + 10_000).toISOString()
  await calls.clock.advance(30_000)
  expect(await ui.find({ type: 'Markdown', text: '状態: レビュー待ちです。' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /より前の返信/ })).toBeUndefined()

  // 90 秒後にももう 1 回取り直す。
  const before = calls.mcp.length
  await calls.clock.advance(30_000)
  expect(calls.mcp.length).toBe(before + 2)
  await ui.unmount()
})

const OFFLINE = 'このセッションでは claude-code-remote が使えないため、子の状態は自動取得しません。表示は管理セッションの記録です。'

test('claude-code-remote がないセッションでは自動取得を止め、記録だけを表示する', async ($, on) => {
  const calls = engine(on)
  calls.remote = false
  await start($)
  await $.tool.call({ tool: 'mcp__task-board__update_board', ...BOARD })
  await calls.clock.settle()
  // 接続の確認でつながっていないと分かり、1 回の呼び出しも失敗したところで止める。
  expect(calls.mcp).toEqual([`claude-code-remote/get_session/${CHILD}`])

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const texts = (await ui.findAll({ type: 'Text' })).map(x => x.text)
    expect(texts.filter(x => x === OFFLINE).length).toBe(1)
    expect(texts.some(x => x.includes('取得できませんでした'))).toBe(false)
    // 行の状態ラベルは記録された state だけ。
    expect(await ui.find({ type: 'Text', text: /^ 未取得 $/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /^ review $/ })).toBeDefined()
    expect(texts).toContain('自動取得なし')
    expect((await ui.find({ type: 'Box', key: 'task-48' }))?.props.borderColor).toBeUndefined()
    await ui.press({ key: 'details-48' })
    expect(await ui.find({ type: 'Text', text: /最新の返信/ })).toBeUndefined()
    expect(await ui.find({ type: 'Input', key: 'draft-48' })).toBeDefined()
    await ui.press({ key: 'details-48' })
    await ui.unmount()
  }

  // 60 秒ごとの取得も、送信後の追加取得もしない。送信はこれまでどおり管理会話に入れる。
  await calls.clock.advance(60_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'quick-48' })
  expect(calls.submitted.length).toBe(1)
  expect(calls.submitted[0]).toContain(`[管理ボード] yami-beta/skills#48 の担当（Claude Code ${CHILD}）`)
  await calls.clock.advance(120_000)
  expect(calls.mcp.length).toBe(1)
  await ui.unmount()

  // /task-board の一覧にも同じ旨を添え、自動取得の状態は出さない。
  const list = String((await runCommand($)).text)
  expect(list).toContain(OFFLINE)
  expect(list).toContain(`  - 担当: Claude Code ${CHILD}\n`)
  expect(list).not.toContain('最終取得')
  expect(calls.mcp.length).toBe(1)
})

test('「状況を更新」を押したときだけもう一度試し、つながれば自動取得を再開する', async ($, on) => {
  const calls = engine(on)
  calls.remote = false
  await start($)
  await $.tool.call({ tool: 'mcp__task-board__update_board', ...BOARD })
  await calls.clock.settle()
  expect(calls.mcp.length).toBe(1)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, bodyColumns: 60 } })
  // まだない: 押すと 1 回だけ試して、止めたままにする。
  await ui.press({ key: 'refresh' })
  expect(calls.mcp.length).toBe(2)
  expect(await ui.find({ type: 'Text', text: OFFLINE })).toBeDefined()

  // つながった: 押すと取得し、表示と 60 秒ごとの取得が戻る。
  calls.remote = true
  await ui.press({ key: 'refresh' })
  expect(calls.mcp.length).toBe(4)
  expect(await ui.find({ type: 'Text', text: OFFLINE })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^ レビュー待ち $/ })).toBeDefined()
  await calls.clock.advance(60_000)
  expect(calls.mcp.length).toBe(6)
  await ui.unmount()
})

test('つながっているのに呼び出しが失敗した行は、自動取得を止めずにその行の失敗として示す', async ($, on) => {
  const calls = engine(on)
  await start($)
  await $.tool.call({ tool: 'mcp__task-board__update_board', ...BOARD })
  await calls.clock.settle()

  // 接続の確認ではつながっているが、呼び出しが例外で失敗する（一時的なエラー）。
  const connected = calls.connects
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  calls.throws = true
  await ui.press({ key: 'refresh' })
  expect(calls.connects).toBe(connected + 1)
  // テストの模擬が投げた例外は、kit を通ると別の文面で届く。行に失敗が出ることを確かめる。
  expect(await ui.find({ type: 'Text', text: /^取得できませんでした: / })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: OFFLINE })).toBeUndefined()
  // 直前の表示は残す。
  expect(await ui.find({ type: 'Text', text: /^ レビュー待ち $/ })).toBeDefined()
  const before = calls.mcp.length
  await calls.clock.advance(60_000)
  expect(calls.mcp.length).toBeGreaterThan(before)
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
