import 'server-only'

import type { BattleCombatant } from '@aurevane/game-core/combat/battle-state'

export type BattleViewerRelationship = 'self' | 'ally' | 'opponent' | 'spectator'

export interface BattleViewerEntitlement {
  kind: 'participant' | 'spectator'
  controlledCombatantIds: ReadonlySet<string>
  friendlyTeamIds: ReadonlySet<string>
}

function invalidControlledCombatants(): Error {
  return new Error('Battle viewer entitlement requires valid controlled combatants from one team.')
}

export function deriveParticipantBattleViewerEntitlement(
  combatants: readonly Pick<BattleCombatant, 'id' | 'teamId'>[],
  controlledCombatantIds: readonly string[],
): BattleViewerEntitlement {
  if (
    controlledCombatantIds.length === 0 ||
    new Set(controlledCombatantIds).size !== controlledCombatantIds.length
  ) {
    throw invalidControlledCombatants()
  }

  const combatantById = new Map(combatants.map((combatant) => [combatant.id, combatant] as const))
  const friendlyTeamIds = new Set<string>()

  for (const combatantId of controlledCombatantIds) {
    const combatant = combatantById.get(combatantId)
    if (!combatant) throw invalidControlledCombatants()
    friendlyTeamIds.add(combatant.teamId)
  }

  if (friendlyTeamIds.size !== 1) throw invalidControlledCombatants()

  return {
    kind: 'participant',
    controlledCombatantIds: new Set(controlledCombatantIds),
    friendlyTeamIds,
  }
}

export function createSpectatorBattleViewerEntitlement(): BattleViewerEntitlement {
  return {
    kind: 'spectator',
    controlledCombatantIds: new Set(),
    friendlyTeamIds: new Set(),
  }
}

export function battleViewerRelationship(
  viewer: BattleViewerEntitlement,
  combatant: Pick<BattleCombatant, 'id' | 'teamId'>,
): BattleViewerRelationship {
  if (viewer.kind === 'spectator') return 'spectator'
  if (viewer.controlledCombatantIds.has(combatant.id)) return 'self'
  if (viewer.friendlyTeamIds.has(combatant.teamId)) return 'ally'
  return 'opponent'
}
