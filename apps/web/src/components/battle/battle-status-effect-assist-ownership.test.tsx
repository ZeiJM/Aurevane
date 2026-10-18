import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const hooks = vi.hoisted(() => ({ effects: [] as (() => unknown)[], set: vi.fn() }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useEffect: (callback: () => unknown) => hooks.effects.push(callback),
  useState: () => [null, hooks.set],
}))
import { BattleStatusEffectAssist } from './battle-status-effect-assist'
class Target {
  dataset: Record<string, string> = {}
  textContent = 'Guarded'
  native = false
  child = false
  getAttribute() {
    return null
  }
  querySelector() {
    return this.child ? {} : null
  }
  closest(selector: string) {
    return selector.includes('data-battle-info') ? (this.native ? this : null) : this
  }
}
let listeners: Record<string, (event: unknown) => void>
beforeEach(() => {
  hooks.effects = []
  hooks.set.mockClear()
  listeners = {}
  vi.stubGlobal('Element', Target)
  vi.stubGlobal('document', {
    body: {},
    querySelectorAll: () => [],
    addEventListener: (name: string, callback: (event: unknown) => void) => {
      listeners[name] = callback
    },
    removeEventListener: vi.fn(),
  })
  vi.stubGlobal('window', { requestAnimationFrame: () => 1, cancelAnimationFrame: vi.fn() })
  vi.stubGlobal(
    'MutationObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
})
afterEach(() => vi.unstubAllGlobals())
function setup() {
  BattleStatusEffectAssist()
  return hooks.effects[0]!() as () => void
}
it.each(['click', 'keydown'])('leaves a native effect popup %s to its existing owner', (type) => {
  const cleanup = setup(),
    target = new Target()
  target.native = true
  const event = { target, key: 'Enter', preventDefault: vi.fn(), stopPropagation: vi.fn() }
  listeners[type]!(event)
  expect(hooks.set).not.toHaveBeenCalled()
  expect(event.preventDefault).not.toHaveBeenCalled()
  expect(event.stopPropagation).not.toHaveBeenCalled()
  cleanup()
})
it('does not open a dictionary popup from the empty part of a row containing a native reader', () => {
  const cleanup = setup(),
    target = new Target()
  target.child = true
  const event = { target, preventDefault: vi.fn(), stopPropagation: vi.fn() }
  listeners.click!(event)
  expect(hooks.set).not.toHaveBeenCalled()
  expect(event.preventDefault).not.toHaveBeenCalled()
  cleanup()
})
it('retains the existing historical transcript fallback until its separate reader integration', () => {
  const cleanup = setup(),
    target = new Target()
  const event = { target, preventDefault: vi.fn(), stopPropagation: vi.fn() }
  listeners.click!(event)
  expect(hooks.set).toHaveBeenCalledTimes(1)
  expect(event.preventDefault).toHaveBeenCalledTimes(1)
  cleanup()
})
