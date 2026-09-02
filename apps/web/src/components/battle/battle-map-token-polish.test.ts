import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function readLocalFile(name: string): string {
  return readFileSync(join(here, name), 'utf8')
}

describe('battlefield semantic target polish', () => {
  it('uses the reserved damage, healing, and defense colors for legal target tiles', () => {
    const source = readLocalFile('battle-map-token-polish.tsx')

    expect(source).toContain("const DAMAGE_COLOR = '#ff766f'")
    expect(source).toContain("const HEALING_COLOR = '#59d39b'")
    expect(source).toContain("const DEFENSE_COLOR = '#6c91c6'")
    expect(source).toContain('section[aria-label="Command Deck"] button[data-active="true"]')
    expect(source).toContain("if (label === 'Guard') return 'guard'")
    expect(source).toContain(
      "if (activeCommand === 'recover' && targetRelation === 'friendly') return HEALING_COLOR",
    )
    expect(source).toContain(
      "if (activeCommand === 'guard' && targetRelation === 'friendly') return DEFENSE_COLOR",
    )
    expect(source).toContain("attributeFilter: ['data-active', 'data-battle-active']")
    expect(source).toContain("tile.style.setProperty('background-color', background, 'important')")
    expect(source).toContain("tile.style.setProperty('border-color', semanticAccent, 'important')")
    expect(source).toContain("tile.style.setProperty('box-shadow', shadow, 'important')")
  })

  it('clears the semantic tile override when the target is no longer active', () => {
    const source = readLocalFile('battle-map-token-polish.tsx')

    expect(source).toContain("tile.style.removeProperty('background-color')")
    expect(source).toContain("tile.style.removeProperty('border-color')")
    expect(source).toContain("tile.style.removeProperty('box-shadow')")
  })

  it('keeps shared token identity authority from being overwritten by playable-only polish', () => {
    const shared = readLocalFile('battle-map-token-polish.tsx')
    const playable = readLocalFile('battle-presentation-polish.tsx')

    expect(shared).toContain("token.style.setProperty('border-color', tokenAccent, 'important')")
    expect(shared).toContain('const compactViewport = !desktopPvpScale')
    expect(shared).toContain(
      "token.style.setProperty('box-shadow', PLAYER_TOKEN_SHADOW, 'important')",
    )
    expect(playable).toContain('pvpParticipantAccent(')
    expect(playable).not.toContain('COMBATANT_COLORS')
    expect(playable).not.toContain('token.style.borderColor')
    expect(playable).not.toContain('token.style.boxShadow')
  })

  it('keeps participant card accents on tokens even when the hidden token name is absent', () => {
    const source = readLocalFile('battle-map-token-polish.tsx')

    expect(source).toContain(
      'const combatantName = combatantNameForTile(tile, token, combatantAccents)',
    )
    expect(source).toContain('const occupiedName = label.match(/occupied by ([^;]+)(?:;|$)/i)')
    expect(source).toContain(
      'const identityAccent = combatantName ? combatantAccents[combatantName] : undefined',
    )
    expect(source).toContain("token.style.setProperty('border-color', tokenAccent, 'important')")
  })
})
