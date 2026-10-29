import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const hooks = vi.hoisted(() => ({ index: 0, cells: [] as unknown[], refresh: vi.fn() }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState(initial: unknown) {
    const i = hooks.index++
    if (!(i in hooks.cells)) hooks.cells[i] = initial
    return [
      hooks.cells[i],
      (next: unknown) => {
        hooks.cells[i] = next
      },
    ]
  },
  useRef(initial: unknown) {
    const i = hooks.index++
    if (!(i in hooks.cells)) hooks.cells[i] = { current: initial }
    return hooks.cells[i]
  },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: hooks.refresh }) }))
import { MASTER_PANEL_NAVIGATION } from '@/lib/master-panel-pages'
import { MasterPanelNavigation, NavigationOrder } from './master-panel-navigation'
type Props = {
  children?: ReactNode
  'aria-label'?: string
  disabled?: boolean
  onClick?(): unknown
}
function all(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(all)
  return isValidElement<Props>(node) ? [node, ...all(node.props.children)] : []
}
const defaults = MASTER_PANEL_NAVIGATION.map((p) => p.id)
function mount(order = defaults, revision = 1) {
  const render = () => {
    hooks.index = 0
    return NavigationOrder({ initial: { revision, order } })
  }
  const button = (label: string) => {
    const result = all(render()).find(
      (node) =>
        node.type === 'button' &&
        (node.props['aria-label'] === label || node.props.children === label),
    )
    if (!result) throw new Error(`Missing ${label}`)
    return result.props
  }
  return {
    render,
    button,
    labels: () =>
      all(render())
        .filter((node) => node.type === 'li')
        .map(
          (node) => all(node.props.children).find((child) => child.type === 'span')!.props.children,
        ),
  }
}
beforeEach(() => {
  hooks.index = 0
  hooks.cells = []
  hooks.refresh.mockClear()
})
afterEach(() => vi.unstubAllGlobals())
it('moves the intended tab, persists its complete order once, and refreshes dependent access lists', async () => {
  const fixture = mount()
  expect(fixture.button('Save order').disabled).toBe(true)
  fixture.button('Move Game Content down').onClick!()
  expect(fixture.labels().slice(0, 2)).toEqual(['Combat Rules', 'Game Content'])
  const order = [defaults[1]!, defaults[0]!, ...defaults.slice(2)]
  const requests: unknown[] = []
  vi.stubGlobal('fetch', async (_url: string, request: { body: string }) => {
    requests.push(JSON.parse(request.body))
    return Response.json({ settings: { revision: 2, order } })
  })
  const save = fixture.button('Save order').onClick!
  save()
  save()
  await new Promise<void>((resolve) => setImmediate(resolve))
  expect(requests).toEqual([{ expectedRevision: 1, order }])
  expect(fixture.button('Save order').disabled).toBe(true)
  expect(hooks.refresh).toHaveBeenCalledOnce()
})
it('retains edits on a failed save and resets the order with an explicit save', async () => {
  const fixture = mount(defaults.toReversed(), 3)
  fixture.button('Reset order').onClick!()
  expect(fixture.labels()).toEqual(MASTER_PANEL_NAVIGATION.map((p) => p.label))
  vi.stubGlobal('fetch', async () =>
    Response.json(
      { error: { message: 'Tab order changed. Refresh this page before saving again.' } },
      { status: 409 },
    ),
  )
  fixture.button('Save order').onClick!()
  await new Promise<void>((resolve) => setImmediate(resolve))
  expect(fixture.button('Save order').disabled).toBe(false)
  expect(hooks.refresh).not.toHaveBeenCalled()
  expect(
    all(fixture.render()).some(
      (node) => node.props.children === 'Tab order changed. Refresh this page before saving again.',
    ),
  ).toBe(true)
})
it('loads the persisted order after a fresh mount', () => {
  const fixture = mount(defaults.toReversed(), 4)
  expect(fixture.labels()).toEqual(MASTER_PANEL_NAVIGATION.map((p) => p.label).toReversed())
  expect(fixture.button('Move Activity Log up').disabled).toBe(true)
})

it.each([
  MASTER_PANEL_NAVIGATION,
  MASTER_PANEL_NAVIGATION.toReversed(),
  [
    MASTER_PANEL_NAVIGATION.find((item) => item.id === 'activity')!,
    ...MASTER_PANEL_NAVIGATION.filter((item) => item.id !== 'activity'),
  ],
])('keeps the arrange control after all tabs regardless of their order', (...items) => {
  const html = renderToStaticMarkup(
    <MasterPanelNavigation items={items} activeSection="activity" canArrange />,
  )
  const gear = html.indexOf('aria-label="Arrange Master Panel tabs"')
  expect(gear).toBeGreaterThan(html.lastIndexOf('</a>'))
  expect(html.match(/aria-label="Arrange Master Panel tabs"/g)).toHaveLength(1)
})

it('does not grant an arrange control to staff without permission', () => {
  const html = renderToStaticMarkup(
    <MasterPanelNavigation
      items={MASTER_PANEL_NAVIGATION}
      activeSection="activity"
      canArrange={false}
    />,
  )
  expect(html).not.toContain('aria-label="Arrange Master Panel tabs"')
})
