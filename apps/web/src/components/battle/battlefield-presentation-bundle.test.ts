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
})
