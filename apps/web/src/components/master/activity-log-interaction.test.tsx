import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const hooks = vi.hoisted(() => ({
  index: 0,
  cells: [] as unknown[],
  effects: [] as (() => unknown)[],
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState(initial: unknown) {
    const index = hooks.index++
    if (!(index in hooks.cells)) hooks.cells[index] = initial
    return [
      hooks.cells[index],
      (next: unknown) => {
        hooks.cells[index] =
          typeof next === 'function'
            ? (next as (value: unknown) => unknown)(hooks.cells[index])
            : next
      },
    ]
  },
  useRef(initial: unknown) {
    const index = hooks.index++
    if (!(index in hooks.cells)) hooks.cells[index] = { current: initial }
    return hooks.cells[index]
  },
  useCallback(callback: unknown) {
    return callback
  },
  useEffect(effect: () => unknown) {
    hooks.effects.push(effect)
  },
}))
import { MasterActivityLog } from './activity-log'
type Props = Record<string, unknown> & { children?: ReactNode }
function find(
  node: ReactNode,
  predicate: (element: ReactElement<Props>) => boolean,
): ReactElement<Props> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = find(child, predicate)
      if (found) return found
    }
  }
  if (!isValidElement<Props>(node)) return null
  return predicate(node) ? node : find(node.props.children, predicate)
}
const entry = {
  id: '200',
  actor: 'Mira',
  action: 'Published content',
  subject: 'Ember',
  detail: '',
  occurredAt: '2026-10-26T06:00:00Z',
}
const feed = {
  entries: [entry],
  weekStartsAt: '2026-10-26T00:00:00Z',
  resetsAt: '2026-11-02T00:00:00Z',
  nextCursor: '200',
}
function render() {
  hooks.index = 0
  hooks.effects = []
  return MasterActivityLog({ initialFeed: feed })
}
const button = (label: string) =>
  find(render(), (node) => node.type === 'button' && node.props.children === label)!
const click = (label: string) => (button(label).props.onClick as () => void)()
beforeEach(() => {
  hooks.index = 0
  hooks.cells = []
  hooks.effects = []
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-01T23:59:59Z'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
it('merges earlier pages without duplicates and retains visible rows when refresh fails', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        ...feed,
        entries: [entry, { ...entry, id: '199', subject: 'Earlier' }],
        nextCursor: null,
      }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
  vi.stubGlobal('fetch', request)
  click('Load earlier')
  await vi.waitFor(() =>
    expect(
      find(render(), (node) => node.type === 'strong' && node.props.children === 'Earlier'),
    ).not.toBeNull(),
  )
  expect(request.mock.calls[0]![0]).toBe('/api/master/activity?before=200')
  const list = find(render(), (node) => node.type === 'ol')!
  expect((list.props.children as ReactNode[]).length).toBe(2)
  click('Refresh')
  await vi.waitFor(() =>
    expect(find(render(), (node) => node.props.role === 'alert')).not.toBeNull(),
  )
  expect(
    find(render(), (node) => node.type === 'strong' && node.props.children === 'Earlier'),
  ).not.toBeNull()
})
it('clears at the UTC week boundary even when an older in-flight response arrives afterward', async () => {
  let release!: (response: Response) => void
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve
        }),
    ),
  )
  render()
  const cleanup = hooks.effects[0]!() as () => void
  click('Refresh')
  await vi.advanceTimersByTimeAsync(1500)
  expect(
    find(render(), (node) => node.props.children === 'No changes recorded this week.'),
  ).not.toBeNull()
  release(Response.json(feed))
  await vi.waitFor(() => expect(button('Refresh').props.disabled).toBe(false))
  expect(
    find(render(), (node) => node.props.children === 'No changes recorded this week.'),
  ).not.toBeNull()
  cleanup()
})
