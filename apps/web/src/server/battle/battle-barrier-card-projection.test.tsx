import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { reattachStatDrivenCombatBridge } from '@aurevane/game-core/combat/stat-driven-combat'
import { grantBarrier } from '@aurevane/game-core/combat/combat-barrier'
import { percentageDotEncounter } from '../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { BattleCombatantCard } from '@/components/battle/battle-combatant-card'
import type { BattlePresentationParticipant } from '@/components/battle/battle-runtime'
import type { BattleSessionView } from './battle-session-service'

vi.mock('server-only', () => ({}))
import { projectBattleSnapshot } from './battle-session-service'
import {
  createSpectatorBattleViewerEntitlement,
  deriveParticipantBattleViewerEntitlement,
} from './battle-viewer-entitlement'

it.each(['self', 'ally', 'opponent', 'spectator'] as const)(
  'uses only the authorized %s Barrier projection for effective HP, grey fill and accessibility',
  (relationship) => {
    const initial = percentageDotEncounter()
    const hidden = {
      ...initial,
      statusState: initial.statusState.map((row) =>
        row.combatantId === 'actor'
          ? {
              ...row,
              statuses: [
                {
                  statusId: 'covert',
                  statusVersion: 1,
                  stacks: 1,
                  sourceCombatantId: 'actor',
                  remainingOwnerTurnStarts: 3,
                },
              ],
            }
          : row,
      ),
    }
    const shielded = reattachStatDrivenCombatBridge(
      grantBarrier(hidden, 'actor', 'actor', 'hidden.barrier', 200).state,
      initial.statBridge,
    )
    const viewer =
      relationship === 'spectator'
        ? createSpectatorBattleViewerEntitlement()
        : deriveParticipantBattleViewerEntitlement(initial.tactical.battle.combatants, [
            relationship === 'self' ? 'actor' : relationship === 'ally' ? 'ally' : 'enemy',
          ])
    const participant: BattlePresentationParticipant = {
      combatantId: 'actor',
      characterId: 'actor',
      name: 'Protected',
      level: 1,
      teamIndex: 0,
      seatIndex: 0,
      local: relationship === 'self',
      portraitAssetId: null,
      profileImageUrl: null,
    }
    function render(state: typeof shielded) {
      const battle = {
        snapshot: projectBattleSnapshot(state, viewer),
      } as unknown as BattleSessionView
      return renderToStaticMarkup(
        <BattleCombatantCard
          participant={participant}
          battle={battle}
          teamCount={2}
          role={
            relationship === 'spectator' ? 'acting' : relationship === 'self' ? 'local' : 'selected'
          }
        />,
      )
    }
    const markup = render(shielded)
    if (relationship === 'self' || relationship === 'ally') {
      expect(markup).toContain('data-battle-hp-barrier="true"')
      expect(markup).toContain('HP 1200 / 1000, HP 1000, Barrier 200')
      expect(markup).toContain('>1200/1000</span>')
    } else {
      expect(markup).toBe(render(hidden))
      expect(markup).not.toContain('data-battle-hp-barrier')
      expect(markup).not.toContain('Barrier 200')
      expect(markup).toContain('aria-label="HP 1000 / 1000"')
    }
  },
)
