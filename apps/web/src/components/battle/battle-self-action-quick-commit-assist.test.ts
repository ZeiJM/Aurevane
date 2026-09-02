import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function source(): string {
  return readFileSync(join(here, 'battle-self-action-quick-commit-assist.tsx'), 'utf8')
}

describe('category-slot hotkeys and self-action double-press shortcuts', () => {
  it('owns desktop category hotkeys without re-registering when account bindings refresh', () => {
    const content = source()

    expect(content).toContain('useLayoutEffect(() => {')
    expect(content).toContain('configuredAction(bindingsRef.current, eventChord(event))')
    expect(content).toContain('bindingsRef.current = parsed')
    expect(content).toContain("window.addEventListener('keydown', handleKeyDown, true)")
    expect(content).toContain('event.stopImmediatePropagation()')
  })

  it('dispatches swappable recovery by stable slot and commits through semantic battle controls', () => {
    const content = source()

    expect(content).toContain('button[data-battle-command="${slot}"]')
    expect(content).toContain("basicAttack: 'attack'")
    expect(content).toContain("recover: 'recover'")
    expect(content).toContain('main[data-unified-battle="true"][data-battle-kind]')
    expect(content).toContain('footer[data-unified-battle-footer="true"]')
    expect(content).toContain("button.textContent?.includes('Confirm Action')")
    expect(content).not.toContain('button:nth-of-type(2)')
    expect(content).toContain("action === 'guard' || action === 'recover'")
    expect(content).toContain('if (activeSlot && activeSlot !== slot) return')
    expect(content).toContain('button.click()')
    expect(content).toContain('confirm.click()')
  })
})
