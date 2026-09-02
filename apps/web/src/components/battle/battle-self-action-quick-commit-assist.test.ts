import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function source(file = 'battle-self-action-quick-commit-assist.tsx'): string {
  return readFileSync(join(here, file), 'utf8')
}

describe('category-slot hotkeys and self-action double-press shortcuts', () => {
  it('owns category hotkeys at every viewport without re-registering when account bindings refresh', () => {
    const content = source()

    expect(content).toContain('useLayoutEffect(() => {')
    expect(content).toContain('configuredAction(bindingsRef.current, eventChord(event))')
    expect(content).toContain('bindingsRef.current = parsed')
    expect(content).toContain("window.addEventListener('keydown', handleKeyDown, true)")
    expect(content).toContain('event.stopImmediatePropagation()')
    expect(content).toContain('event.repeat')
    expect(content).not.toContain("matchMedia('(min-width: 821px)')")
  })

  it('dispatches swappable recovery by stable slot and commits through semantic battle controls', () => {
    const content = source()

    expect(content).toContain('button[data-battle-command="${slot}"]')
    expect(content).toContain("basicAttack: 'attack'")
    expect(content).toContain("recover: 'recover'")
    expect(content).toContain('main[data-unified-battle="true"][data-battle-kind]')
    expect(content).toContain('root.getClientRects().length > 0')
    expect(content).toContain('footer[data-unified-battle-footer="true"]')
    expect(content).toContain("button.textContent?.includes('Confirm Action')")
    expect(content).not.toContain('button:nth-of-type(2)')
    expect(content).toContain("action === 'guard' || action === 'recover'")
    expect(content).toContain('if (activeSlot && activeSlot !== slot) {')
    expect(content).toContain('TRANSIENT_SECOND_PRESS_MS')
    expect(content).toContain('button.click()')
    expect(content).toContain('confirm.click()')
  })

  it('cancels pending commits when the page loses focus or becomes hidden', () => {
    const content = source()

    expect(content).toContain("window.addEventListener('blur', cancelPendingCommit)")
    expect(content).toContain(
      "document.addEventListener('visibilitychange', handleVisibilityChange)",
    )
    expect(content).toContain('document.hidden || !document.hasFocus()')
  })

  it('keeps legacy PvE and PvP keyboard assists from consuming shared category hotkeys', () => {
    for (const file of ['battle-keyboard-assist.tsx', 'pvp-battle-keyboard-assist.tsx']) {
      const content = source(file)
      expect(content).toContain('function isSharedCategoryAction(action: CombatKeybindAction)')
      expect(content).toContain(
        "if (isSharedCategoryAction(action) || action === 'endTurn') return",
      )
      expect(content).not.toContain("window.matchMedia('(min-width: 821px)').matches")
      expect(content).toContain("['recover', ['Recover', 'HP Recovery', 'MP Recovery']]")
    }
  })
})
