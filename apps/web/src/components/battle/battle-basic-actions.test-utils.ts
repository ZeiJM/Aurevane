import {
  captureBasicSkillSources,
  defaultBasicSkills,
} from '@aurevane/game-core/combat/combat-basic-actions'
import { reconcileCombatAbilitySources } from '@aurevane/game-core/combat/combat-behavior-runtime'
import { percentageDotEncounter } from '../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { preparePv1fTurnEconomy } from '@aurevane/game-core/combat/pv1f-action-economy'
import { projectBattleSnapshot } from '@/server/battle/battle-session-service'
import { deriveParticipantBattleViewerEntitlement } from '@/server/battle/battle-viewer-entitlement'
import type { SupportActionId } from '@aurevane/game-core/combat/support-actions'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

export function capturedBasicBattle(
  support: SupportActionId = 'basic.recover',
  disabled = false,
  move: {
    costBasis?: 'flat' | 'per-terrain-point'
    maximumTiles?: number
    apCost?: number
    enabled?: boolean
  } = {},
) {
  const original = preparePv1fTurnEconomy(percentageDotEncounter())
  const base = {
    ...original,
    statBridge: {
      ...original.statBridge,
      combatants: original.statBridge.combatants.map((row) =>
        row.combatantId === 'actor'
          ? {
              ...row,
              provenance: {
                kind: 'character-derived' as const,
                sourceId: 'actor',
                sourceRulesVersion: 1,
              },
            }
          : row,
      ),
    },
  }
  const definitions = defaultBasicSkills().map((basic) => ({
    ...basic,
    contentVersion: 2,
    name:
      basic.id === 'unarmed.basic'
        ? 'Open Palm'
        : basic.id === support
          ? 'Second Wind'
          : basic.name,
    enabled: basic.id === 'basic.move' ? (move.enabled ?? true) : basic.id !== support || !disabled,
    ...(basic.id === 'basic.move'
      ? {
          execution: {
            kind: 'basic-move' as const,
            costBasis: move.costBasis ?? ('per-terrain-point' as const),
          },
        }
      : {}),
    ability: {
      ...basic.ability,
      behaviors: basic.ability.behaviors.map((behavior) => ({
        ...behavior,
        costs:
          basic.id === 'basic.move'
            ? [{ resource: 'ap' as const, amount: move.apCost ?? 35 }]
            : [
                { resource: 'ap' as const, amount: 47 },
                { resource: 'mp' as const, amount: 3 },
                { resource: 'hp' as const, amount: 2 },
              ],
        cooldown:
          basic.id === 'unarmed.basic' ? { key: 'open-palm', ownerTurns: 4 } : behavior.cooldown,
        effects: behavior.effects.map((effect) =>
          effect.payload.type === 'move'
            ? { ...effect, payload: { ...effect.payload, maximumTiles: move.maximumTiles ?? 20 } }
            : effect.payload.type === 'percentage-recovery'
              ? { ...effect, payload: { ...effect.payload, percentageBasisPoints: 2200 } }
              : effect,
        ),
      })),
    },
  }))
  const sources = captureBasicSkillSources({
    ownerCombatantId: 'actor',
    supportActionId: support,
    definitions,
  })
  const state = { ...reconcileCombatAbilitySources(base, sources), statBridge: base.statBridge }
  const snapshot = projectBattleSnapshot(
    state,
    deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, ['actor']),
  )
  return {
    state,
    view: {
      battleSessionId: '33333333-3333-4333-8333-333333333333',
      battleVersion: 1,
      snapshot,
    } as BattleSessionView,
  }
}
