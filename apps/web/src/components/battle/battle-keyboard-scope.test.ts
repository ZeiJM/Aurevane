import { afterEach, describe, expect, it, vi } from 'vitest'
import { isBattleShortcutBlocked } from './battle-keyboard-scope'

// Node has no DOM. The document adapter contains only the open reading surface being tested.
function openSurface(selector: string) {
  vi.stubGlobal('HTMLElement', class {})
  vi.stubGlobal('document', {
    querySelector: (query: string) =>
      query.split(',').some((part) => part.trim() === selector) ? {} : null,
  })
}
afterEach(() => vi.unstubAllGlobals())
describe('combat shortcuts while reading', () => {
  it.each(['[role="dialog"][aria-modal="true"]', 'dialog[open]', '[data-battle-info-panel]'])(
    'blocks actions with %s open even when focus stays on the battlefield',
    (surface) => {
      openSurface(surface)
      expect(isBattleShortcutBlocked(null)).toBe(true)
    },
  )
})

describe('closed information trigger focus', () => {
  it('allows numbered commands after closing information while retaining native Space activation', () => {
    class Trigger {
      isContentEditable = false
      closest(selector: string) {
        return selector.includes('[data-battle-info-trigger]') ? this : null
      }
    }
    vi.stubGlobal('document', { querySelector: () => null })
    vi.stubGlobal('HTMLElement', Trigger)
    vi.stubGlobal('HTMLInputElement', class {})
    vi.stubGlobal('HTMLTextAreaElement', class {})
    vi.stubGlobal('HTMLSelectElement', class {})
    const trigger = new Trigger() as unknown as EventTarget
    expect(isBattleShortcutBlocked(trigger, 'Digit9')).toBe(false)
    expect(isBattleShortcutBlocked(trigger, 'Space')).toBe(true)
    expect(isBattleShortcutBlocked(trigger, 'Enter')).toBe(true)
  })
})

describe('forecast lane focus', () => {
  it.each(['ArrowRight', 'ArrowLeft', 'KeyD', 'Space', 'Digit4'])(
    'keeps %s inside a scrollable reading lane',
    (code) => {
      class ForecastLane {
        isContentEditable = false
        closest(selector: string) {
          return selector.includes('[data-battle-preview-lane]') ? this : null
        }
      }
      vi.stubGlobal('document', { querySelector: () => null })
      vi.stubGlobal('HTMLElement', ForecastLane)
      vi.stubGlobal('HTMLInputElement', class {})
      vi.stubGlobal('HTMLTextAreaElement', class {})
      vi.stubGlobal('HTMLSelectElement', class {})
      expect(isBattleShortcutBlocked(new ForecastLane() as unknown as EventTarget, code)).toBe(true)
    },
  )
})
