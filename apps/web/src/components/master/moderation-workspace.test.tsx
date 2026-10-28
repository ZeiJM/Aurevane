import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const hooks = vi.hoisted(() => ({ index: 0, cells: [] as unknown[] }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState(initial: unknown) {
    const i = hooks.index++
    if (!(i in hooks.cells)) hooks.cells[i] = initial
    return [
      hooks.cells[i],
      (value: unknown) => {
        hooks.cells[i] =
          typeof value === 'function' ? (value as (old: unknown) => unknown)(hooks.cells[i]) : value
      },
    ]
  },
  useRef(initial: unknown) {
    const i = hooks.index++
    if (!(i in hooks.cells)) hooks.cells[i] = { current: initial }
    return hooks.cells[i]
  },
}))
import { ModerationWorkspace } from './moderation-workspace'
type Props = Record<string, unknown> & { children?: ReactNode }
function find(
  node: ReactNode,
  predicate: (node: ReactElement<Props>) => boolean,
): ReactElement<Props> | null {
  if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean) ?? null
  if (!isValidElement<Props>(node)) return null
  return predicate(node) ? node : find(node.props.children, predicate)
}
beforeEach(() => {
  hooks.index = 0
  hooks.cells = []
})
afterEach(() => vi.unstubAllGlobals())
function fixture(failOnce = false) {
  const commands: unknown[] = []
  const ban = {
    userId: '11111111-1111-4111-8111-111111111111',
    characterId: null,
    name: 'Player',
    revision: 'a'.repeat(32),
    active: true as const,
    permanent: true,
    expiresAt: null,
    protected: false,
    reason: 'Reviewed conduct',
  }
  vi.stubGlobal('fetch', async (_url: unknown, options: RequestInit) => {
    commands.push(JSON.parse(String(options.body)))
    if (failOnce) {
      failOnce = false
      throw new Error('Connection interrupted')
    }
    return Response.json({
      record: { ...ban, active: false, permanent: false, history: [], nextCursor: null },
    })
  })
  const render = () => {
    hooks.index = 0
    return ModerationWorkspace({ initialBans: { bans: [ban], nextCursor: null } })
  }
  const lift = () => find(render(), (node) => node.props['aria-label'] === 'Lift ban for Player')!
  return { render, commands, lift }
}
it('opens on active bans and lifts directly once without a reason or confirmation form', async () => {
  const f = fixture()
  const button = f.lift()
  expect(find(f.render(), (node) => node.type === 'textarea')).toBeNull()
  ;(button.props.onClick as () => void)()
  ;(button.props.onClick as () => void)()
  await vi.waitFor(() => expect(f.lift()).toBeNull())
  expect(f.commands).toEqual([
    {
      operation: 'lift',
      targetUserId: '11111111-1111-4111-8111-111111111111',
      expectedRevision: 'a'.repeat(32),
    },
  ])
})
it('keeps an uncertain lift available for an exact reviewed-version retry', async () => {
  const f = fixture(true)
  ;(f.lift().props.onClick as () => void)()
  await vi.waitFor(() =>
    expect(find(f.render(), (node) => node.props.role === 'alert')).not.toBeNull(),
  )
  ;(f.lift().props.onClick as () => void)()
  await vi.waitFor(() => expect(f.lift()).toBeNull())
  expect(f.commands[1]).toEqual(f.commands[0])
})
