import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CompleteCombatContentRecord } from '@aurevane/db/combat-content'

const hooks = vi.hoisted(() => ({
  index: 0,
  cells: [] as unknown[],
  effects: [] as (() => void)[],
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState(initial: unknown) {
    const i = hooks.index++
    if (!(i in hooks.cells))
      hooks.cells[i] = typeof initial === 'function' ? (initial as () => unknown)() : initial
    return [
      hooks.cells[i],
      (next: unknown) => {
        hooks.cells[i] =
          typeof next === 'function' ? (next as (old: unknown) => unknown)(hooks.cells[i]) : next
      },
    ]
  },
  useRef(initial: unknown) {
    const i = hooks.index++
    if (!(i in hooks.cells)) hooks.cells[i] = { current: initial }
    return hooks.cells[i]
  },
  useEffect(effect: () => void, dependencies: unknown[]) {
    const i = hooks.index++
    const old = hooks.cells[i] as unknown[] | undefined
    if (!old || dependencies.some((entry, index) => entry !== old[index])) {
      hooks.cells[i] = dependencies
      hooks.effects.push(effect)
    }
  },
}))
vi.mock('./content-record-workflow', () => ({ contentRecordCommand: vi.fn() }))
import { contentRecordCommand } from './content-record-workflow'
import { ItemMasterActions } from './item-master-actions'

type Props = Record<string, unknown> & { children?: ReactNode }
function find(
  node: ReactNode,
  predicate: (node: ReactElement<Props>) => boolean,
): ReactElement<Props> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = find(child, predicate)
      if (found) return found
    }
  }
  if (!isValidElement<Props>(node)) return
  return predicate(node) ? node : find(node.props.children, predicate)
}
function plain(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(plain).join('')
  if (isValidElement<Props>(node)) return plain(node.props.children)
  return typeof node === 'string' || typeof node === 'number' ? String(node) : ''
}
const self = '00000000-0000-4000-8000-000000007001'
const target = { characterId: '00000000-0000-4000-8000-000000007002', name: 'Twin Name' }
const otherTarget = { characterId: '00000000-0000-4000-8000-000000007003', name: 'Twin Name' }
const token = 'a'.repeat(32)
const endpoint = '/api/master/combat-content/item-grant'
const record = {
  contentKey: 'test.helm',
  revision: 4,
  contentKind: 'item',
  current: { definition: { schemaVersion: 2, enabled: true, inventoryCategory: 'materials' } },
} as unknown as CompleteCombatContentRecord
beforeEach(() => {
  hooks.index = 0
  hooks.cells = []
  hooks.effects = []
  vi.clearAllMocks()
})
afterEach(() => vi.unstubAllGlobals())
function fixture(
  options: {
    results?: (typeof target)[]
    battle?: boolean
    mutation?: (url: string, body: Record<string, unknown>) => Promise<Response>
    preflight?: () => Promise<Response>
    record?: CompleteCombatContentRecord
    recoveryScope?: string
  } = {},
) {
  const calls: { url: string; body: Record<string, unknown> | null }[] = []
  let disabled = false
  let currentRecord = options.record ?? record
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null
    calls.push({ url, body })
    if (url === '/api/character/items')
      return Response.json({
        view: {
          characterId: self,
          revision: 9,
          catalogueToken: token,
          battleLocked: options.battle ?? false,
        },
      })
    if (body?.action === 'search') return Response.json({ characters: options.results ?? [target] })
    if (body?.action === 'read')
      return (
        options.preflight?.() ??
        Response.json({
          target,
          revision: 12,
          catalogueToken: token,
          battleLocked: options.battle ?? false,
        })
      )
    return (
      options.mutation?.(url, body!) ??
      Response.json(url === endpoint ? { target, revision: 13 } : { view: {} })
    )
  })
  const duplicated = vi.fn()
  function render() {
    hooks.index = 0
    const tree = ItemMasterActions({
      record: currentRecord,
      disabled,
      onDuplicated: duplicated,
      recoveryScope: options.recoveryScope,
    })
    for (const effect of hooks.effects.splice(0)) effect()
    return tree
  }
  const field = (name: string) =>
    find(
      render(),
      (n) => (n.type === 'input' || n.type === 'select') && n.props['aria-label'] === name,
    )!
  const button = (name: string) => find(render(), (n) => n.type === 'button' && plain(n) === name)!
  const change = (name: string, value: string) =>
    (field(name).props.onChange as (event: unknown) => void)({ currentTarget: { value } })
  const click = (name: string) => (button(name).props.onClick as () => void)()
  const status = () => plain(find(render(), (n) => n.props.role === 'status'))
  async function select(id = target.characterId) {
    change('Character', 'Twin')
    click('Find')
    await vi.waitFor(() => expect(field('Matching characters')).toBeDefined())
    change('Matching characters', id)
  }
  return {
    render,
    field,
    button,
    change,
    click,
    calls,
    status,
    select,
    duplicated,
    updateRecord: (next: CompleteCombatContentRecord) => {
      currentRecord = next
    },
    disable: () => {
      disabled = true
    },
  }
}
it('targets the explicitly selected character using fresh target revision and catalogue, without self fallback', async () => {
  const f = fixture()
  await f.select()
  f.change('Quantity', '7')
  f.click('Grant Item')
  await vi.waitFor(() => expect(f.status()).toContain('Item granted'))
  expect(f.calls).toEqual([
    { url: endpoint, body: { action: 'search', query: 'Twin' } },
    { url: endpoint, body: { action: 'read', characterId: target.characterId } },
    {
      url: endpoint,
      body: {
        action: 'grant',
        characterId: target.characterId,
        itemId: record.contentKey,
        quantity: 7,
        expectedRevision: 12,
        catalogueToken: token,
        requestId: expect.any(String),
      },
    },
  ])
  expect(f.status()).toContain(target.name)
})
it('requires explicit selection for ambiguous names and distinguishes matches by character ID', async () => {
  const f = fixture({ results: [target, otherTarget] })
  f.change('Character', 'Twin')
  expect(f.button('Grant Item').props.disabled).toBe(true)
  f.click('Grant Item')
  expect(f.calls).toEqual([])
  f.click('Find')
  await vi.waitFor(() => expect(f.field('Matching characters')).toBeDefined())
  expect(plain(f.field('Matching characters'))).toContain(target.characterId)
  expect(plain(f.field('Matching characters'))).toContain(otherTarget.characterId)
  expect(f.button('Grant Item').props.disabled).toBe(true)
  f.change('Matching characters', otherTarget.characterId)
  f.change('Character', 'Changed query')
  expect(f.button('Grant Item').props.disabled).toBe(true)
  f.click('Grant Item')
  expect(f.calls).toHaveLength(1)
})
it('does not grant an unresolved or missing search match to the selected self character', async () => {
  const f = fixture({ results: [] })
  f.change('Character', 'Unknown')
  f.click('Find')
  await vi.waitFor(() => expect(f.status()).toContain('No characters'))
  f.click('Grant Item')
  expect(f.calls).toEqual([{ url: endpoint, body: { action: 'search', query: 'Unknown' } }])
})
it('rejects battle locked target preflight without a mutation', async () => {
  const f = fixture({ battle: true })
  await f.select()
  f.click('Grant Item')
  await vi.waitFor(() => expect(f.status()).toContain('pending or active battle'))
  expect(f.calls.filter((c) => c.body?.action === 'grant')).toEqual([])
  expect(f.field('Character').props.disabled).toBe(false)
})
it('releases rejected 4xx requests so a corrected command reads fresh state with a new request ID', async () => {
  const f = fixture({
    mutation: async () =>
      Response.json({ error: { message: 'Inventory changed.' } }, { status: 409 }),
  })
  await f.select()
  f.click('Grant Item')
  await vi.waitFor(() => expect(f.status()).toBe('Inventory changed.'))
  const first = f.calls.find((c) => c.body?.action === 'grant')!.body!
  expect(f.field('Character').props.disabled).toBe(false)
  expect(f.field('Quantity').props.disabled).toBe(false)
  f.click('Grant Item')
  await vi.waitFor(() => expect(f.calls.filter((c) => c.body?.action === 'grant')).toHaveLength(2))
  const second = f.calls.filter((c) => c.body?.action === 'grant')[1]!.body!
  expect(second.requestId).not.toBe(first.requestId)
  expect(f.calls.filter((c) => c.body?.action === 'read')).toHaveLength(2)
})
it('retains the exact endpoint, recipient, quantity and request ID after an uncertain targeted grant until explicit retry', async () => {
  let attempt = 0
  const f = fixture({
    mutation: async () => {
      if (++attempt === 1) throw new Error('Connection lost.')
      return Response.json({ target, revision: 13 })
    },
  })
  await f.select()
  f.change('Quantity', '3')
  f.click('Grant Item')
  await vi.waitFor(() => expect(f.button('Retry grant')).toBeDefined())
  expect(f.field('Character').props.disabled).toBe(true)
  expect(f.field('Quantity').props.disabled).toBe(true)
  expect(f.button('Find').props.disabled).toBe(true)
  expect(f.button('Duplicate Item').props.disabled).toBe(true)
  expect(f.calls.filter((c) => c.body?.action === 'grant')).toHaveLength(1)
  f.click('Retry grant')
  await vi.waitFor(() => expect(f.status()).toContain('Item granted'))
  const requests = f.calls.filter((c) => c.body?.action === 'grant')
  expect(requests).toHaveLength(2)
  expect(requests[1]).toEqual(requests[0])
  expect(f.calls.filter((c) => c.body?.action === 'read')).toHaveLength(1)
})
it('blocks double clicks synchronously while the fresh target read and mutation are pending', async () => {
  let resolve!: (response: Response) => void
  const f = fixture({
    preflight: () =>
      new Promise((done) => {
        resolve = done
      }),
  })
  await f.select()
  const click = f.button('Grant Item').props.onClick as () => void
  click()
  click()
  expect(f.calls.filter((c) => c.body?.action === 'read')).toHaveLength(1)
  resolve(Response.json({ target, revision: 12, catalogueToken: token, battleLocked: false }))
  await vi.waitFor(() => expect(f.status()).toContain('Item granted'))
  expect(f.calls.filter((c) => c.body?.action === 'grant')).toHaveLength(1)
})
it('preserves selected self grant compatibility using the original endpoint and current inventory token', async () => {
  const f = fixture()
  expect(plain(f.render())).toContain('My selected character')
  f.click('Grant Item')
  await vi.waitFor(() => expect(f.status()).toContain('Item granted'))
  expect(f.calls).toEqual([
    { url: '/api/character/items', body: null },
    {
      url: '/api/master/combat-content/item-test-grant',
      body: {
        characterId: self,
        itemId: record.contentKey,
        quantity: 1,
        expectedRevision: 9,
        catalogueToken: token,
        requestId: expect.any(String),
      },
    },
  ])
})
it('retains self grants on server errors for exact explicit retry', async () => {
  const f = fixture({
    mutation: async () => Response.json({ error: { message: 'Unavailable.' } }, { status: 503 }),
  })
  f.click('Grant Item')
  await vi.waitFor(() => expect(f.button('Retry grant')).toBeDefined())
  f.click('Retry grant')
  await vi.waitFor(() => expect(f.calls).toHaveLength(3))
  expect(f.calls[2]).toEqual(f.calls[1])
  expect(f.calls.filter((c) => c.url === '/api/character/items')).toHaveLength(1)
})
it.each([401, 403])(
  'retains an already uncertain receipt after retry authentication/context refusal %s',
  async (status) => {
    let attempt = 0
    const f = fixture({
      mutation: async () =>
        ++attempt === 1
          ? Response.json({ error: { message: 'Unavailable.' } }, { status: 503 })
          : Response.json(
              { error: { message: 'Restore the original account and selected character.' } },
              { status },
            ),
    })
    f.click('Grant Item')
    await vi.waitFor(() => expect(f.button('Retry grant')).toBeDefined())
    f.click('Retry grant')
    await vi.waitFor(() => expect(f.status()).toContain('Restore the original account'))
    expect(f.button('Retry grant')).toBeDefined()
    expect(f.field('Character').props.disabled).toBe(true)
    expect(f.calls[2]).toEqual(f.calls[1])
  },
)
it('restores the original pending request across a fresh keyed mount on another Item, without automatically sending it', async () => {
  const storage = new Map<string, string>()
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
    },
  })
  const f = fixture({
    recoveryScope: 'account-a',
    mutation: async () => Response.json({ error: { message: 'Unavailable.' } }, { status: 503 }),
  })
  f.render()
  await vi.waitFor(() => expect(f.button('Grant Item').props.disabled).toBe(false))
  f.click('Grant Item')
  await vi.waitFor(() => expect(f.button('Retry grant')).toBeDefined())
  const original = f.calls[1]!
  hooks.cells = []
  hooks.effects = []
  const remount = fixture({
    recoveryScope: 'account-a',
    record: { ...record, contentKey: 'test.other-item' },
  })
  remount.render()
  await vi.waitFor(() => expect(remount.button('Retry grant')).toBeDefined())
  expect(remount.calls).toEqual([])
  remount.click('Retry grant')
  await vi.waitFor(() => expect(remount.status()).toContain('Item granted'))
  expect(remount.calls).toEqual([original])
  expect(storage.size).toBe(0)
})
it('does not load another account pending receipt or issue a scoped mutation when recovery storage is unavailable', async () => {
  const values = new Map<string, string>()
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: () => {
        throw new Error('Storage denied')
      },
      removeItem() {},
    },
  })
  const f = fixture({ recoveryScope: 'account-b' })
  f.render()
  await vi.waitFor(() => expect(f.button('Grant Item').props.disabled).toBe(false))
  f.click('Grant Item')
  await vi.waitFor(() => expect(f.status()).toContain('preserve'))
  expect(f.calls).toEqual([{ url: '/api/character/items', body: null }])
})
it('keeps pending grants isolated by authenticated account across fresh mounts', async () => {
  const values = new Map<string, string>()
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value)
      },
      removeItem: (key: string) => {
        values.delete(key)
      },
    },
  })
  const first = fixture({
    recoveryScope: 'account-a',
    mutation: async () => Response.json({ error: { message: 'Unavailable.' } }, { status: 503 }),
  })
  first.render()
  await vi.waitFor(() => expect(first.button('Grant Item').props.disabled).toBe(false))
  first.click('Grant Item')
  await vi.waitFor(() => expect(first.button('Retry grant')).toBeDefined())
  const retained = new Map(values)
  hooks.cells = []
  hooks.effects = []
  const second = fixture({ recoveryScope: 'account-b' })
  second.render()
  await vi.waitFor(() => expect(second.button('Grant Item').props.disabled).toBe(false))
  expect(second.button('Retry grant')).toBeUndefined()
  second.click('Grant Item')
  await vi.waitFor(() => expect(second.status()).toContain('Item granted'))
  expect(second.calls[1]!.body!.requestId).not.toBe(first.calls[1]!.body!.requestId)
  expect(values).toEqual(retained)
})
it('keeps the exact uncertain request retryable when the displayed Item changes or local edits become dirty', async () => {
  const f = fixture({
    mutation: async () => Response.json({ error: { message: 'Unavailable.' } }, { status: 503 }),
  })
  f.click('Grant Item')
  await vi.waitFor(() => expect(f.button('Retry grant')).toBeDefined())
  f.disable()
  f.updateRecord({
    ...record,
    current: { ...record.current!, definition: { ...record.current!.definition, enabled: false } },
  })
  expect(f.button('Retry grant')).toBeDefined()
  expect(f.button('Retry grant').props.disabled).toBe(false)
  f.click('Retry grant')
  await vi.waitFor(() => expect(f.calls).toHaveLength(3))
  expect(f.calls[2]).toEqual(f.calls[1])
})
it('blocks the self grant before mutation when its current inventory is battle locked', async () => {
  const f = fixture({ battle: true })
  f.click('Grant Item')
  await vi.waitFor(() => expect(f.status()).toContain('pending or active battle'))
  expect(f.calls).toEqual([{ url: '/api/character/items', body: null }])
})
it('shows target preflight refusals and releases inputs without preparing a grant or falling back to self', async () => {
  const f = fixture({
    preflight: async () =>
      Response.json({ error: { message: 'Character is pending deletion.' } }, { status: 400 }),
  })
  await f.select()
  f.click('Grant Item')
  await vi.waitFor(() => expect(f.status()).toBe('Character is pending deletion.'))
  expect(
    f.calls.filter((c) => c.body?.action === 'grant' || c.url === '/api/character/items'),
  ).toEqual([])
  expect(f.field('Quantity').props.disabled).toBe(false)
  expect(f.field('Character').props.disabled).toBe(false)
})
it('bounds quantity to whole Item counts and one for Gear', () => {
  const f = fixture()
  f.change('Quantity', '2.8')
  expect(f.field('Quantity').props.value).toBe(2)
  f.change('Quantity', '999')
  expect(f.field('Quantity').props.value).toBe(99)
  f.change('Quantity', '0')
  expect(f.field('Quantity').props.value).toBe(1)
  hooks.cells = []
  const gear = fixture({
    record: {
      ...record,
      current: {
        ...record.current!,
        definition: { ...record.current!.definition, inventoryCategory: 'gear' },
      },
    },
  })
  gear.change('Quantity', '3')
  expect(gear.field('Quantity').props.max).toBe(1)
  expect(gear.field('Quantity').props.value).toBe(1)
})
it('preserves Duplicate Item and prevents duplicate simultaneous commands or dirty saved Item grants', async () => {
  const f = fixture()
  let resolve!: (value: { record: CompleteCombatContentRecord }) => void
  vi.mocked(contentRecordCommand).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  const click = f.button('Duplicate Item').props.onClick as () => void
  click()
  click()
  expect(contentRecordCommand).toHaveBeenCalledTimes(1)
  resolve({ record })
  await vi.waitFor(() => expect(f.duplicated).toHaveBeenCalledWith(record))
  f.disable()
  f.click('Grant Item')
  expect(f.calls).toEqual([])
})
