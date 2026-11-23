import { isValidElement, type ReactNode, type ReactElement } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const hooks = vi.hoisted(() => ({
  states: 0,
  layout: [] as (() => unknown)[],
  effects: [] as (() => unknown)[],
  portals: [] as unknown[],
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useId: () => 'reader',
  useContext: () => null,
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => [hooks.states++ === 0 ? true : value, vi.fn()],
  useCallback: (callback: unknown) => callback,
  useEffect: (callback: () => unknown) => hooks.effects.push(callback),
  useLayoutEffect: (callback: () => unknown) => {
    hooks.layout.push(callback)
  },
}))
vi.mock('react-dom', () => ({
  createPortal: (node: ReactNode, target: unknown) => {
    hooks.portals.push(target)
    return node
  },
}))
import { BattleInfoPopover } from './battle-info-popover'
import { battleInfoPopoverSession } from './battle-info-popover-session'

beforeEach(() => {
  hooks.states = 0
  hooks.layout = []
  hooks.portals = []
  hooks.effects = []
  vi.stubGlobal('document', { body: {} })
})
afterEach(() => vi.unstubAllGlobals())
type Props = Record<string, unknown> & { children?: ReactNode }
function find(node: ReactNode, predicate: (props: Props) => boolean): ReactElement<Props> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = find(child, predicate)
      if (match) return match
    }
  }
  if (!isValidElement<Props>(node)) return null
  return predicate(node.props) ? node : find(node.props.children, predicate)
}
function fixture() {
  const tree = BattleInfoPopover({ label: 'Parameters', trigger: 'i', children: 'Report' })
  const panel = find(tree, (props) => props['data-battle-info-panel'] === 'true')!
  const focused: string[] = []
  const buttons = ['first', 'middle', 'last'].map((id) => ({
    id,
    focus: () => focused.push(id),
    contains(target: unknown) {
      return target === this
    },
  }))
  const attributes: Record<string, string> = {}
  let hintAtFocus: string | undefined
  const rect = {
    left: 20,
    top: 20,
    right: 320,
    bottom: 220,
    width: 300,
    height: 200,
    x: 20,
    y: 20,
    toJSON: () => ({}),
  }
  const element = {
    querySelectorAll: (selector: string) =>
      selector.includes('data-combat-tag-reference') ? buttons : [],
    setAttribute: (name: string, value: string) => {
      attributes[name] = value
    },
    removeAttribute: (name: string) => {
      delete attributes[name]
    },
    getBoundingClientRect: () => rect,
    focus: () => {
      hintAtFocus = attributes['aria-describedby']
    },
    contains: (target: unknown) => target === element,
    scrollHeight: 200,
  }
  const dispatch = (
    key: string,
    target: unknown = element,
    modifiers: Record<string, boolean> = {},
  ) => {
    const event = {
      key,
      target,
      currentTarget: element,
      ...modifiers,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    }
    const handler = panel.props.onKeyDown as ((event: unknown) => void) | undefined
    handler?.(event)
    return event
  }
  return {
    tree,
    panel,
    buttons,
    focused,
    attributes,
    element,
    dispatch,
    hintAtFocus: () => hintAtFocus,
    rect,
  }
}
it.each([
  ['ArrowDown', 'first'],
  ['ArrowUp', 'last'],
  ['Home', 'first'],
  ['End', 'last'],
])('wires %s from the actual opened panel to its %s reference', (key, expected) => {
  const f = fixture()
  const event = f.dispatch(key!)
  expect(f.focused).toEqual([expected])
  expect(event.preventDefault).toHaveBeenCalledOnce()
  expect(event.stopPropagation).toHaveBeenCalledOnce()
})
it('wraps among explicit reference buttons from their actual key handler', () => {
  const f = fixture()
  f.dispatch('ArrowDown', f.buttons[2])
  f.dispatch('ArrowUp', f.buttons[0])
  expect(f.focused).toEqual(['first', 'last'])
})
it('does not steal modifier-picker, input or unrelated-control arrows', () => {
  const f = fixture()
  for (const target of [{ role: 'option' }, { tagName: 'INPUT' }, { tagName: 'BUTTON' }]) {
    const event = f.dispatch('ArrowDown', target)
    expect(event.preventDefault).not.toHaveBeenCalled()
  }
  expect(f.focused).toEqual([])
})
it('leaves Enter, Space, Tab and combat bindings to their existing authorities', () => {
  const f = fixture()
  for (const key of ['Enter', ' ', 'Tab', 'w']) {
    const event = f.dispatch(key, f.buttons[0])
    expect(event.preventDefault).not.toHaveBeenCalled()
  }
  expect(f.focused).toEqual([])
})
it('connects the linked-term instruction before programmatically focusing the opened report', () => {
  const f = fixture()
  const trigger = find(f.tree, (props) => props['data-battle-info-trigger'] === 'true')!
  ;(trigger.props.ref as (element: unknown) => void)({ ...f.element, focus: () => undefined })
  ;(f.panel.props.ref as { current: unknown }).current = f.element
  vi.stubGlobal('window', {
    innerWidth: 1280,
    innerHeight: 800,
    scrollX: 0,
    scrollY: 0,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  vi.stubGlobal('document', { activeElement: null, documentElement: { clientWidth: 1280 } })
  vi.stubGlobal('getComputedStyle', () => ({ position: 'fixed' }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  for (const layout of hooks.layout) layout()
  const hint = find(f.tree, (props) => props.id === f.hintAtFocus())
  expect(f.hintAtFocus()).toBeTruthy()
  expect(hint?.props.children).toContain('Up and Down')
  expect(hint?.props.hidden).toBe(true)
})

it('preserves browser and selection modifiers on reference navigation keys', () => {
  const f = fixture()
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
    const event = f.dispatch('Home', f.element, { [modifier]: true })
    expect(event.preventDefault).not.toHaveBeenCalled()
  }
  expect(f.focused).toEqual([])
})

it('places an inspection effect explanation inside its supplied modal host', () => {
  const host = { nodeType: 1 }
  BattleInfoPopover({
    label: 'Guard',
    trigger: 'GUA',
    children: 'Captured Guard',
    portalHost: { current: host as HTMLElement },
    layer: 'inspect',
  })
  expect(hooks.portals).toEqual([host])
})

it('the actual active effect Escape handler marks the event handled and returns focus to its trigger', () => {
  const f = fixture()
  const trigger = find(f.tree, (props) => props['data-battle-info-trigger'] === 'true')!
  const focus = vi.fn()
  ;(trigger.props.ref as (element: unknown) => void)({ ...f.element, focus })
  const listeners = new Map<string, (event: unknown) => void>()
  vi.stubGlobal('document', {
    activeElement: f.element,
    addEventListener: (type: string, callback: (event: unknown) => void) =>
      listeners.set(type, callback),
    removeEventListener: vi.fn(),
  })
  const cleanups = hooks.effects.map((effect) => effect())
  battleInfoPopoverSession.open('reader', vi.fn())
  const event = {
    key: 'Escape',
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true
    },
  }
  listeners.get('keydown')!(event)
  expect(event.defaultPrevented).toBe(true)
  expect(focus).toHaveBeenCalledOnce()
  expect(battleInfoPopoverSession.isActive('reader')).toBe(false)
  for (const cleanup of cleanups) if (typeof cleanup === 'function') cleanup()
})
