import { isValidElement, type ReactNode, type ReactElement } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
const hooks = vi.hoisted(() => ({ active: undefined as unknown }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useId: () => ':tabs:',
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

it('reveals a focused field covered by sticky section tabs without moving unobscured fields or tabs', () => {
  const root = AbilityEditorTabs({ panels: {} as never })
  const onFocus = root.props.onFocusCapture as (event: unknown) => void
  expect(onFocus).toBeTypeOf('function')
  const scrollIntoView = vi.fn()
  let insidePanel = true
  let top = 12
  const field = {
    closest: () => (insidePanel ? {} : null),
    getBoundingClientRect: () => ({ top, bottom: top + 44 }),
    scrollIntoView,
  }
  const event = {
    target: field,
    currentTarget: {
      querySelector: () => ({ getBoundingClientRect: () => ({ top: 0, bottom: 112 }) }),
    },
  }
  onFocus(event)
  expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', inline: 'nearest' })
  scrollIntoView.mockClear()
  top = 140
  onFocus(event)
  expect(scrollIntoView).not.toHaveBeenCalled()
  top = 12
  insidePanel = false
  onFocus(event)
  expect(scrollIntoView).not.toHaveBeenCalled()
})
