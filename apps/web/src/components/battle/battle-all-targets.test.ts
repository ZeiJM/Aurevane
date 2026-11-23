import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { captureCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import { source } from '../../../../../packages/game-core/src/combat/combat-behavior.test-utils'
import { percentageDotEncounter } from '../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { reconcileCombatAbilitySources } from '@aurevane/game-core/combat/combat-behavior-runtime'
import { preparePv1fTurnEconomy } from '@aurevane/game-core/combat/pv1f-action-economy'
import { projectBattleSnapshot } from '@/server/battle/battle-session-service'
import { deriveParticipantBattleViewerEntitlement } from '@/server/battle/battle-viewer-entitlement'
import { battleTargetReachTiles } from './battle-attack-path'
import { resolveBattleCapturedSkill } from './battle-preview-selection'
import { reattachStatDrivenCombatBridge } from '@aurevane/game-core/combat/stat-driven-combat'

it.each(['self', 'unit'] as const)(
  'separates captured %s All activation tiles from an aimed Single range',
  (kind) => {
    const original = source().definition.behaviors[0]!.targeting!
    const target = {
      ...original,
      kind,
      teamPolicy: kind === 'self' ? ('self' as const) : ('enemy' as const),
      minimumRange: kind === 'self' ? 0 : 1,
      maximumRange: kind === 'self' ? 0 : 1,
    }
    const captured = captureCombatAbilitySource(
      source({
        targeting: target,
        effects: [
          {
            id: 'all-hit',
            timing: 'instant',
            payload: { type: 'damage', recipient: 'affected-units', target: 'all', amount: 20 },
          },
          {
            id: 'all-push',
            timing: 'instant',
            payload: {
              type: 'displace',
              recipient: 'affected-units',
              target: 'all',
              direction: 'push',
              distance: 8,
            },
          },
        ],
      }),
    )
    const base = preparePv1fTurnEconomy(percentageDotEncounter())
    const state = reattachStatDrivenCombatBridge(
      reconcileCombatAbilitySources(base, [captured]),
      base.statBridge,
    )
    const snapshot = projectBattleSnapshot(
      state,
      deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, ['actor']),
    )
    const skill = resolveBattleCapturedSkill(
      {
        id: captured.abilityId,
        targetKind: 'self',
        targetTeamPolicy: 'self',
        minimumRange: 0,
        maximumRange: 0,
      },
      snapshot.manualActionTargets!,
    )!
    expect(skill.hasAllTargetEffects).toBe(true)
    const tiles = battleTargetReachTiles(
      snapshot.tactical,
      { x: 1, y: 1 },
      skill.target!,
      [],
      { aimSource: 'implicit' },
      { tactical: snapshot.tactical, actorId: 'actor' },
      skill.hasAllTargetEffects,
    )
    expect([...tiles].sort()).toEqual(
      kind === 'self' ? ['1:1', '1:2', '2:1', '3:1'] : ['0:1', '1:0', '1:2', '2:1'],
    )
    expect(tiles.has('3:1')).toBe(kind === 'self')
  },
)
