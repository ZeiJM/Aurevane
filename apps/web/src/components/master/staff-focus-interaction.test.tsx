import { isValidElement, type ReactNode, type ReactElement } from 'react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const hooks = vi.hoisted(() => ({
  index: 0,
  cells: [] as unknown[],
  effects: [] as (() => unknown)[],
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
          typeof next === 'function' ? (next as (v: unknown) => unknown)(hooks.cells[i]) : next
      },
    ]
  },
  useRef(initial: unknown) {
    const i = hooks.index++
    if (!(i in hooks.cells)) hooks.cells[i] = { current: initial }
    return hooks.cells[i]
  },
  useEffect(effect: () => unknown) {
    hooks.effects.push(effect)
  },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
import { StaffManagement } from './staff-management'
type Props = Record<string, unknown> & { children?: ReactNode; ref?: { current: unknown } }
function find(
  node: ReactNode,
  predicate: (element: ReactElement<Props>) => boolean,
): ReactElement<Props> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const result = find(child, predicate)
      if (result) return result
    }
  }
  if (!isValidElement<Props>(node)) return null
  return predicate(node) ? node : find(node.props.children, predicate)
}
class Element {
  isConnected = true
  disabled = false
  focus = vi.fn()
  matches() {
    return this.disabled
  }
}
beforeEach(() => {
  hooks.index = 0
  hooks.cells = []
  hooks.effects = []
  vi.stubGlobal('HTMLElement', Element)
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
    callback()
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())
it.each(['Close editor', 'Save character access', 'Revoke access'])(
  'returns focus after %s only once mutation settles',
  async (action) => {
    const opener = new Element(),
      lookup = new Element(),
      heading = new Element()
    vi.stubGlobal('document', { activeElement: opener })
    let release: () => void = () => undefined
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          account: {
            userId: 'staff',
            email: 'staff@example.test',
            characters: [{ characterId: 'character', name: 'Staff Character', playable: true }],
          },
        }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            release = () => resolve(Response.json({ success: true }))
          }),
      )
    vi.stubGlobal('fetch', request)
    const props = {
      staff: [
        {
          userId: 'staff',
          email: 'staff@example.test',
          characterId: 'character',
          characterName: 'Staff Character',
          accessVersion: 8,
          roles: ['content-staff'],
          specialCapabilities: [],
          status: 'active',
          expiresAt: null,
        },
      ],
      roleOptions: [],
      capabilityOptions: [],
    }
    function render() {
      hooks.index = 0
      hooks.effects = []
      const tree = StaffManagement(props)
      const input = find(tree, (node) => node.props.id === 'staff-identity')!
      input.props.ref!.current = lookup
      const title = find(tree, (node) => node.props.id === 'staff-editor-title')
      if (title) title.props.ref!.current = heading
      for (const effect of hooks.effects) effect()
      return tree
    }
    const button = (name: string) =>
      find(render(), (node) => node.type === 'button' && node.props.children === name)!
    ;(button('Edit').props.onClick as () => void)()
    await vi.waitFor(() => expect(button('Close editor')).not.toBeNull())
    expect(heading.focus).toHaveBeenCalled()
    if (action !== 'Close editor') {
      const confirm = find(
        render(),
        (node) => node.type === 'input' && node.props.type === 'checkbox',
      )!
      ;(confirm.props.onChange as (event: unknown) => void)({ target: { checked: true } })
    }
    expect(button(action).props.disabled).not.toBe(true)
    ;(button(action).props.onClick as () => void)()
    if (action !== 'Close editor') {
      render()
      expect(opener.focus).not.toHaveBeenCalled()
      release()
      await vi.waitFor(() => expect(button('Close editor')).toBeNull())
      expect(JSON.parse(request.mock.calls[1]![1].body)).toMatchObject({
        operation: 'set-character-access',
        targetCharacterId: 'character',
        expectedVersion: 8,
        enabled: action === 'Save character access',
      })
    }
    render()
    expect(opener.focus).toHaveBeenCalledTimes(1)
    expect(lookup.focus).not.toHaveBeenCalled()
  },
)
it('returns focus to lookup when the opening control disappears', async () => {
  const opener = new Element(),
    lookup = new Element()
  vi.stubGlobal('document', { activeElement: opener })
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        Response.json({
          account: { userId: 'staff', email: 'staff@example.test', characters: [] },
        }),
      ),
  )
  function render() {
    hooks.index = 0
    hooks.effects = []
    const tree = StaffManagement({ staff: [], roleOptions: [], capabilityOptions: [] })
    find(tree, (node) => node.props.id === 'staff-identity')!.props.ref!.current = lookup
    for (const effect of hooks.effects) effect()
    return tree
  }
  ;(find(render(), (node) => node.type === 'form')!.props.onSubmit as (event: unknown) => void)({
    preventDefault() {},
  })
  await vi.waitFor(() =>
    expect(find(render(), (node) => node.props.children === 'Close editor')).not.toBeNull(),
  )
  opener.isConnected = false
  ;(find(render(), (node) => node.props.children === 'Close editor')!.props.onClick as () => void)()
  render()
  expect(lookup.focus).toHaveBeenCalledOnce()
  expect(opener.focus).not.toHaveBeenCalled()
})
