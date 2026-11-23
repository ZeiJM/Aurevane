import { afterEach, expect, it, vi } from 'vitest'
import { registerBattleTabCyclePrevention } from './battle-tab-cycle-prevention'

afterEach(() => vi.unstubAllGlobals())

function fixture(inspect = false) {
  let active: FakeElement
  let panelOpen = false
  class FakeElement {
    disabled = false
    isConnected = true
    tagName = 'BUTTON'
    isContentEditable = false
    constructor(
      readonly kind: 'board' | 'effect' | 'inspect' | 'input',
      readonly name: string,
    ) {}
    focus() {
      setFocus(this)
    }
    getClientRects() {
      return [{}]
    }
    closest(selector: string) {
      if (selector.includes('[data-battle-live-effect-trigger]') && this.kind === 'effect')
        return this
      if (selector.includes('[data-battle-effect-inspect]') && inspect) return owner
      if (selector.includes('input') && this.kind === 'input') return this
      return null
    }
    querySelectorAll() {
      return buttons
    }
    hasAttribute() {
      return false
    }
    contains(other: unknown) {
      return other === this
    }
  }
  function setFocus(element: FakeElement) {
    active = element
  }
  const board = new FakeElement('board', 'board')
  const body = new FakeElement('board', 'body')
  const owner = new FakeElement('inspect', 'inspection')
  const input = new FakeElement('input', 'input')
  const buttons = [new FakeElement('effect', 'Guard'), new FakeElement('effect', 'Poison')]
  active = inspect ? owner : board
  const doc = {
    body,
    get activeElement() {
      return active
    },
    hidden: false,
    hasFocus: () => true,
    querySelectorAll: () => buttons,
    querySelector: (selector: string) =>
      selector.includes('[data-battle-info-panel]')
        ? panelOpen
          ? {}
          : null
        : selector.includes('[data-battle-effect-inspect]')
          ? inspect
            ? owner
            : null
          : selector.includes('main[data-battle-keyboard-focus-root')
            ? board
            : null,
  }
  vi.stubGlobal('HTMLElement', FakeElement)
  vi.stubGlobal('Element', FakeElement)
  const target = new EventTarget()
  const cleanup = registerBattleTabCyclePrevention(target, doc as unknown as Document)
  const commands = vi.fn()
  target.addEventListener('keydown', commands)
  const key = (code: string, fields: Partial<KeyboardEvent> = {}) => {
    const event = Object.assign(new Event('keydown', { cancelable: true }), {
      code,
      key: code,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      shiftKey: false,
      repeat: false,
      ...fields,
    }) as KeyboardEvent
    Object.defineProperty(event, 'target', { value: active })
    target.dispatchEvent(event)
    return event
  }
  return {
    key,
    buttons,
    board,
    body,
    owner,
    input,
    doc,
    active: () => active,
    panel: (value: boolean) => {
      panelOpen = value
    },
    cleanup,
    commands,
  }
}

it.each(['playable-pve', 'playable-pvp', 'spectator'])(
  'reaches two effect controls and returns to battlefield while the actual Tab guard is registered: %s',
  () => {
    const f = fixture()
    expect(f.key('Tab').defaultPrevented).toBe(true)
    expect(f.key('Tab', { shiftKey: true }).defaultPrevented).toBe(true)
    expect(f.active()).toBe(f.board)
    expect(f.key('KeyE', { key: 'e', ctrlKey: true, altKey: true }).defaultPrevented).toBe(true)
    expect(f.active()).toBe(f.buttons[0])
    f.key('ArrowDown')
    expect(f.active()).toBe(f.buttons[1])
    f.key('ArrowUp')
    expect(f.active()).toBe(f.buttons[0])
    f.panel(true)
    expect(f.key('Escape').defaultPrevented).toBe(false) // Existing popup owns its topmost Escape.
    f.commands.mockClear()
    f.panel(false)
    expect(f.key('Escape').defaultPrevented).toBe(true)
    expect(f.active()).toBe(f.board)
    expect(f.commands).not.toHaveBeenCalled()
    f.cleanup()
  },
)

it('navigates from inspection focus and returns to that owner without changing combat bindings', () => {
  const f = fixture(true)
  expect(f.key('ArrowDown').defaultPrevented).toBe(true)
  expect(f.active()).toBe(f.buttons[0])
  f.key('End')
  expect(f.active()).toBe(f.buttons[1])
  f.key('Escape')
  expect(f.active()).toBe(f.owner)
  expect(f.commands).not.toHaveBeenCalled()
  f.cleanup()
})

it('returns to the battle focus root when information entry began on the document body', () => {
  const f = fixture()
  f.body.focus()
  f.key('KeyE', { ctrlKey: true, altKey: true })
  expect(f.active()).toBe(f.buttons[0])
  f.key('Escape')
  expect(f.active().name).toBe('board')
  f.cleanup()
})

it.each([false, true])(
  'does not leak the information chord to combat when no effect exists (repeat=%s)',
  (repeat) => {
    const f = fixture()
    f.doc.querySelectorAll = () => []
    expect(f.key('KeyE', { ctrlKey: true, altKey: true, repeat }).defaultPrevented).toBe(true)
    expect(f.commands).not.toHaveBeenCalled()
    expect(f.active()).toBe(f.board)
    f.cleanup()
  },
)

it('preserves text entry, picker/native activation, browser modifiers and ordinary custom combat chords', () => {
  const f = fixture()
  f.input.focus()
  expect(f.key('KeyE', { ctrlKey: true, altKey: true }).defaultPrevented).toBe(false)
  f.board.focus()
  for (const [code, modifiers] of [
    ['Enter', {}],
    ['Space', {}],
    ['KeyE', {}],
    ['KeyM', { shiftKey: true }],
    ['Home', { ctrlKey: true }],
  ] as const)
    expect(f.key(code, modifiers).defaultPrevented).toBe(false)
  expect(f.active()).toBe(f.board)
  f.cleanup()
  f.key('KeyE', { ctrlKey: true, altKey: true })
  expect(f.active()).toBe(f.board)
})
