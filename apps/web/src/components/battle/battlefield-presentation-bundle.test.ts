import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function readLocalFile(name: string): string {
  return readFileSync(join(here, name), 'utf8')
}

describe('shared battlefield presentation bundle', () => {
  it('owns terrain, coordinates, and combatant token presentation', () => {
    const source = readLocalFile('battlefield-presentation-bundle.tsx')

    expect(source).toContain('<BattleTerrainPresentationPolish />')
    expect(source).toContain('<BattleCoordinateToggle battleSessionId={battleSessionId} />')
    expect(source).toContain(
      '<BattleMapTokenPolish playerName={playerName} combatantAccents={combatantAccents} />',
    )
  })

  it('is mounted by both playable and spectator battle surfaces', () => {
    const playable = readLocalFile('battle-client-boundary.tsx')
    const spectator = readFileSync(
      join(here, '../../app/game/battle/spectate/[battleKey]/page.tsx'),
      'utf8',
    )

    expect(playable).toContain('<BattlefieldPresentationBundle')
    expect(spectator).toContain('<BattlefieldPresentationBundle')
    expect(spectator).toContain('pvpParticipantAccent(')
    expect(spectator).toContain('battleSessionId={spectator.battle.battleSessionId}')
  })

  it('keeps spectator mobile board metadata aligned with playable token sizing and hides R50', () => {
    const spectator = readLocalFile('pvp-spectator-experience.tsx')
    const mobileLayout = readLocalFile('pvp-spectator-mobile-board-layout.module.css')

    expect(spectator).toContain('data-board-auto-fit={`${tactical.width}x${tactical.height}`}')
    expect(spectator).toContain('data-spectator-terrain-cost="true"')
    expect(mobileLayout).toContain("[data-spectator-terrain-cost='true']")
    expect(mobileLayout).toContain('display: none !important;')
  })

  it('keeps active tokens halo-free and spectator mobile identity rings slim', () => {
    const styles = readLocalFile('battlefield-presentation-bundle.module.css')

    expect(styles).toContain(
      "section#battlefield button[aria-label*='occupied by'] > [data-team][data-active]",
    )
    expect(styles).toContain(
      'box-shadow: 0 0.35rem 0.9rem rgba(0, 0, 0, 0.5) !important;',
    )
    expect(styles).toContain("main[data-pvp-spectator='true']")
    expect(styles).toContain('border-width: 1px !important;')
  })
})
