import 'server-only'

import {
  combatStatusMetadata,
  type CombatEffectState,
} from '@aurevane/game-core/combat/combat-effect-state'
import {
  PV1F_COMBAT_CONTENT,
  PV1F_COVERT_STATUS,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import type { StatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'

import { battleViewerRelationship, type BattleViewerEntitlement } from './battle-viewer-entitlement'

type BattleStatusState = StatDrivenCombatEncounterState['statusState']

function statusDefinitionKey(statusId: string, statusVersion: number): string {
  return `${statusId}@${statusVersion}`
}

const STATUS_DEFINITION_BY_KEY = new Map(
  PV1F_COMBAT_CONTENT.statuses.map(
    (definition) => [statusDefinitionKey(definition.id, definition.version), definition] as const,
  ),
)

export function projectBattleStatusStateForViewer(
  state: Pick<StatDrivenCombatEncounterState, 'statusState' | 'tactical'>,
  viewer: BattleViewerEntitlement,
): BattleStatusState {
  const combatantById = new Map(
    state.tactical.battle.combatants.map((combatant) => [combatant.id, combatant] as const),
  )

  return state.statusState.map((row) => {
    const combatant = combatantById.get(row.combatantId)
    // Validated snapshots should always resolve this row; omission is safer than disclosure if they do not.
    if (!combatant) return { ...row, statuses: [] }

    const relationship = battleViewerRelationship(viewer, combatant)
    if (relationship === 'self' || relationship === 'ally') return row

    const covert = row.statuses.some((status) => status.statusId === PV1F_COVERT_STATUS.id)
    if (!covert) return row

    return {
      ...row,
      statuses: row.statuses.filter((status) => {
        const definition = STATUS_DEFINITION_BY_KEY.get(
          statusDefinitionKey(status.statusId, status.statusVersion),
        )
        // Unknown or mismatched pinned status versions fail closed for unauthorized Covert viewers.
        if (!definition) return false
        return combatStatusMetadata(definition).polarity !== 'positive'
      }),
    }
  })
}


export function projectBattleEffectStateForViewer(
  state: Pick<StatDrivenCombatEncounterState, 'effectState' | 'tactical'>,
  viewer: BattleViewerEntitlement,
): CombatEffectState | undefined {
  if (!state.effectState) return undefined

  const combatantById = new Map(
    state.tactical.battle.combatants.map((combatant) => [combatant.id, combatant] as const),
  )
  return {
    ...state.effectState,
    temporarySkills: state.effectState.temporarySkills.filter((grant) => {
      const holder = combatantById.get(grant.combatantId)
      if (!holder) return false
      const relationship = battleViewerRelationship(viewer, holder)
      return relationship === 'self' || relationship === 'ally'
    }),
  }
}
