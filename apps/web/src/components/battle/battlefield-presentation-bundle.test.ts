import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function readLocalFile(name: string): string {
  return readFileSync(join(here, name), 'utf8')
}

describe('shared battlefield presentation bundle', () => {
  it('owns terrain and tile-scaled combatant token presentation', () => {
    const source = readLocalFile('battlefield-presentation-bundle.tsx')

    expect(source).toContain('<BattleTerrainPresentationPolish />')
    expect(source).not.toContain('BattleCoordinateToggle')
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
    const mobileControls = readLocalFile('pvp-spectator-mobile-control-balance.module.css')

    expect(spectator).toContain('data-board-auto-fit={`${tactical.width}x${tactical.height}`}')
    expect(spectator).toContain('<BattleMapKey />')
    expect(spectator).not.toContain('className={styles.tileMeta}')
    expect(mobileLayout).toContain("[data-spectator-terrain-cost='true']")
    expect(mobileLayout).toContain('display: none !important;')
    expect(mobileControls).toContain('color: #dcded6 !important;')
  })

  it('keeps active tokens halo-free and spectator mobile identity rings slim', () => {
    const styles = readLocalFile('battlefield-presentation-bundle.module.css')

    expect(styles).toContain(
      "section#battlefield button[aria-label*='occupied by'] > [data-team][data-active]",
    )
    expect(styles).toContain('box-shadow: 0 0.35rem 0.9rem rgba(0, 0, 0, 0.5) !important;')
    expect(styles).toContain("main[data-pvp-spectator='true']")
    expect(styles).toContain('border-width: 1px !important;')
  })

  it('places courtyard atmosphere beneath the real grid while retaining state exclusions', () => {
    const styles = readLocalFile('battlefield-presentation-bundle.module.css')

    expect(styles).toContain("[data-battlefield-backdrop='true']")
    expect(styles).toContain(":not([data-pvp-spectator='true'])")
    expect(styles).toContain("url('/media/art/concept-ui/battle-hall-v01.webp')")
    expect(styles).toContain('background-color: rgba(42, 53, 59, 0.58) !important;')
    expect(styles).toContain("button[data-terrain-presentation='difficult']")
    expect(styles).toContain(':not([data-reachable])')
    expect(styles).toContain(':not([data-target])')
    expect(styles).toContain(':not([data-terrain-overlay])')
  })

  it('composes spectator teams as portrait rails around a central board and communication dock', () => {
    const spectator = readLocalFile('pvp-spectator-experience.tsx')
    const spectatorStyles = readLocalFile('pvp-spectator-experience.module.css')
    const battleChat = readLocalFile('pvp-battle-chat.tsx')
    const viewportPolish = readLocalFile('pvp-spectator-viewport-polish.tsx')

    expect(spectator).toContain('data-spectator-team-rail="left"')
    expect(spectator).toContain('data-spectator-team-rail="right"')
    expect(spectator).toContain('data-member-count={String(team.members.length)}')
    expect(spectator).toContain('data-battlefield-backdrop="true"')
    expect(spectator).toContain('showBattleLog')
    expect(spectator).toContain('requestedTab="log"')
    expect(spectator).toContain(
      "logRecentTurnCount={battleState.lifecycle === 'active' ? 4 : null}",
    )
    expect(spectator).toContain('logCurrentTurnNumber={battleState.turnNumber}')
    expect(battleChat).toContain('logRecentTurnCount = 4')
    expect(battleChat).toContain('recentTurnCount={logRecentTurnCount ?? undefined}')
    expect(battleChat).toContain('currentTurnNumber={logCurrentTurnNumber}')
    expect(spectatorStyles).toContain(".teamCard[data-member-count='1'] .memberPortrait")
    expect(spectatorStyles).toContain(
      'grid-template-columns: clamp(10rem, 13vw, 15rem) minmax(0, 1fr) clamp(10rem, 13vw, 15rem);',
    )
    expect(viewportPolish).not.toContain('pvp-spectator-viewport-polish.module.css')
  })
})
