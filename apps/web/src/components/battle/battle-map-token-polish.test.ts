import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import { fitBattleArenaBoard, fitBattleBoard } from './battle-map-token-polish'

const here = dirname(fileURLToPath(import.meta.url))

describe('battle board viewport fit', () => {
  it.each([
    [7, 7, 950, 300],
    [9, 7, 950, 230],
    [13, 9, 760, 330],
    [9, 7, 280, 650],
  ])('keeps the full %s by %s map inside its viewport', (columns, rows, width, height) => {
    const fit = fitBattleBoard(columns, rows, width, height)
    expect(fit.width).toBeLessThanOrEqual(width)
    expect(fit.height).toBeLessThanOrEqual(height)
    expect(fit.width / fit.height).toBeCloseTo(columns / rows)
    expect(Math.min(width - fit.width, height - fit.height)).toBeCloseTo(0)
  })

  it('keeps the same seven-row tile scale across all standard arena widths', () => {
    const fits = [9, 12, 15].map((width) => fitBattleArenaBoard(width, 7, 900, 470))
    expect(fits.map((fit) => fit.height)).toEqual([420, 420, 420])
    expect(fits.map((fit, index) => fit.width / [9, 12, 15][index])).toEqual([60, 60, 60])
    expect(fitBattleArenaBoard(3, 3, 900, 470)).toEqual(fitBattleBoard(3, 3, 900, 470))
  })

  it('accounts for grid gutters so tiles stay exactly the same size across standard widths', () => {
    const widths = [9, 12, 15]
    const fits = widths.map((width) => fitBattleArenaBoard(width, 7, 900, 470, 2))
    const cells = fits.map((fit, index) => (fit.width - (widths[index]! - 1) * 2) / widths[index]!)
    for (const [index, fit] of fits.entries()) {
      expect(cells[index]).toBeCloseTo(cells[0]!, 8)
      expect((fit.height - 12) / 7).toBeCloseTo(cells[0]!, 8)
      expect(fit.width).toBeLessThanOrEqual(900)
      expect(fit.height).toBeLessThanOrEqual(470)
    }
  })

  it('uses the dedicated map area beyond the retired desktop size ceiling', () => {
    const fit = fitBattleBoard(11, 7, 1300, 640)
    expect(fit.height).toBe(640)
    expect(fit.width).toBeCloseTo(1005.714, 2)
  })
})

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
    expect(source).toContain(
      "attributeFilter: ['data-active', 'data-battle-active', 'data-battle-action-mode']",
    )
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

  it('keeps identity rings distinct from target highlights and fills 85% of each tile', () => {
    const source = readLocalFile('battle-map-token-polish.tsx')
    expect(source).toContain('Math.min(cell.width, cell.height) * 0.85')
    expect(source).toContain('const tokenAccent = identityAccent')
    expect(source).not.toContain('semanticAccent ?? identityAccent')
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
