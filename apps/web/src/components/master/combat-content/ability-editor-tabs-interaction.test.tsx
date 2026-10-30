import { isValidElement, type ReactNode, type ReactElement } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const hooks = vi.hoisted(() => ({ active: undefined as unknown }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useId: () => ':tabs:',
  useCallback: (callback: unknown) => callback,
  useState(initial: unknown) {
    if (hooks.active === undefined) hooks.active = initial
    return [
      hooks.active,
      (next: unknown) => {
        hooks.active = next
      },
    ]
  },
}))
import { AbilityEditorTabs, ABILITY_EDITOR_SECTIONS } from './ability-editor-tabs'
type Props = Record<string, unknown> & { children?: ReactNode }
function all(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(all)
  return isValidElement<Props>(node) ? [node, ...all(node.props.children)] : []
}
beforeEach(() => {
  hooks.active = undefined
})
afterEach(() => vi.unstubAllGlobals())
it('keeps every draft panel mounted while click and keyboard selection change the visible section', () => {
  const panels = Object.fromEntries(
    ABILITY_EDITOR_SECTIONS.map((section) => [
      section.id,
      <input key={section.id} defaultValue={`draft-${section.id}`} />,
    ]),
  ) as never
  const render = () => all(AbilityEditorTabs({ panels }))
  const tab = (name: string) =>
    render().find((node) => node.props.role === 'tab' && node.props.children === name)!
  const panel = (id: string) => render().find((node) => node.props['data-ability-section'] === id)!
  ;(tab('Effects').props.onClick as () => void)()
  expect(panel('effects').props.hidden).toBe(false)
  expect(panel('details').props.hidden).toBe(true)
  const original = panel('details').props.children
  const focus = vi.fn()
  ;(tab('Effects').props.onKeyDown as (event: unknown) => void)({
    key: 'Home',
    preventDefault: vi.fn(),
    currentTarget: { parentElement: { querySelectorAll: () => [{ focus }] } },
  })
  expect(focus).toHaveBeenCalledOnce()
  expect(panel('details').props.hidden).toBe(false)
  expect(panel('details').props.children).toBe(original)
  expect(render().filter((node) => node.props.role === 'tabpanel')).toHaveLength(6)
})

it('reveals covered fields after native focus scrolling and ignores stale focus', () => {
  const frames: (() => void)[] = []
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => frames.push(callback))
  const root = AbilityEditorTabs({ panels: {} as never })
  const onFocus = root.props.onFocusCapture as (event: unknown) => void
  const scrollIntoView = vi.fn()
  let insidePanel = true
  let top = 140
  const ownerDocument = { activeElement: null as unknown }
  const field = {
    closest: () => (insidePanel ? {} : null),
    getBoundingClientRect: () => ({ top, bottom: top + 44 }),
    scrollIntoView,
    ownerDocument,
  }
  ownerDocument.activeElement = field
  const workspace = {
    contains: () => true,
    querySelector: () => ({ getBoundingClientRect: () => ({ top: 0, bottom: 112 }) }),
  }
  const event = { target: field, currentTarget: workspace }
  onFocus(event)
  // The native focus default runs after capture and can move an initially clear field.
  top = 12
  event.currentTarget = null as never
  expect(scrollIntoView).not.toHaveBeenCalled()
  expect(frames).toHaveLength(1)
  frames.shift()!()
  expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', inline: 'nearest' })
  scrollIntoView.mockClear()
  event.currentTarget = workspace
  top = 140
  onFocus(event)
  frames.shift()!()
  expect(scrollIntoView).not.toHaveBeenCalled()
  top = 12
  onFocus(event)
  ownerDocument.activeElement = null
  frames.shift()!()
  expect(scrollIntoView).not.toHaveBeenCalled()
  insidePanel = false
  onFocus(event)
  expect(frames).toHaveLength(0)
})

it('reserves the measured tab height for native scrolling across wrapping and zoom', () => {
  let resize: () => void = () => {}
  const observe = vi.fn()
  const disconnect = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback
      }
      observe = observe
      disconnect = disconnect
    },
  )
  const root = AbilityEditorTabs({ panels: {} as never })
  const tabs = all(root).find((node) => node.props.role === 'tablist')!
  const setProperty = vi.fn()
  let height = 112
  const node = {
    parentElement: { style: { setProperty } },
    getBoundingClientRect: () => ({ height }),
  }
  expect(tabs.props.ref).toBeTypeOf('function')
  const cleanup = (tabs.props.ref as (node: unknown) => () => void)(node)
  expect(setProperty).toHaveBeenLastCalledWith('--ability-tabs-height', '112px')
  expect(observe).toHaveBeenCalledWith(node)
  height = 56
  resize()
  expect(setProperty).toHaveBeenLastCalledWith('--ability-tabs-height', '56px')
  cleanup()
  expect(disconnect).toHaveBeenCalledOnce()
})
