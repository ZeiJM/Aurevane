import 'server-only'

import {
  activePersistentCombatStatusRows,
  pendingCombatStatusRows,
} from '@aurevane/game-core/combat/combat-effect-timing'

import {
  combatStatusMetadata,
  type CombatEffectState,
} from '@aurevane/game-core/combat/combat-effect-state'
import {
  PV1F_COMBAT_CONTENT,
  PV1F_COVERT_STATUS,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import type { StatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'
import {
  terrainAdjustedDefense,
  terrainEvasionBonusBasisPoints,
} from '@aurevane/game-core/combat/combat-stat-balance'
import {
  terrainBattleEffectPresentation,
  TERRAIN_DEFENSE_STATUS_ID,
  TERRAIN_EVASION_STATUS_ID,
  type BattlePresentedStatus,
} from '../../lib/battle/battle-elevation-effects'

import { battleViewerRelationship, type BattleViewerEntitlement } from './battle-viewer-entitlement'

type BattleStatusState = readonly {
  combatantId: string
  statuses: readonly BattlePresentedStatus[]
}[]

function statusDefinitionKey(statusId: string, statusVersion: number): string {
  return `${statusId}@${statusVersion}`
}

const STATUS_DEFINITION_BY_KEY = new Map(
  PV1F_COMBAT_CONTENT.statuses.map(
    (definition) => [statusDefinitionKey(definition.id, definition.version), definition] as const,
  ),
)

export function projectBattleStatusStateForViewer(
  state: Pick<
    StatDrivenCombatEncounterState,
    | 'statusState'
    | 'statBalancePolicyVersion'
    | 'tactical'
    | 'effectState'
    | 'terrainOverlays'
    | 'pendingEffects'
    | 'pendingSummons'
    | 'pendingSkillGrants'
  >,
  viewer: BattleViewerEntitlement,
): BattleStatusState {
  const combatantById = new Map(
    state.tactical.battle.combatants.map((combatant) => [combatant.id, combatant] as const),
  )

  const pending = [...pendingCombatStatusRows(state), ...activePersistentCombatStatusRows(state)]
  return state.statusState.map((activeRow) => {
    const combatant = combatantById.get(activeRow.combatantId)
    const terrainBonus =
      combatant && combatant.hp > 0
        ? terrainEvasionBonusBasisPoints(state, activeRow.combatantId)
        : 0
    const terrainStatuses: BattlePresentedStatus[] =
      terrainBonus > 0
        ? [
            { statusId: TERRAIN_EVASION_STATUS_ID, potencyBasisPoints: terrainBonus },
            {
              statusId: TERRAIN_DEFENSE_STATUS_ID,
              potencyBasisPoints:
                10000 - terrainAdjustedDefense(state, activeRow.combatantId, 10000),
            },
          ].map((effect) => ({
            ...effect,
            statusVersion: 1,
            stacks: 1,
            // Compatibility field only; presentationDuration supplies the positional lifetime.
            remainingOwnerTurnStarts: 1,
            sourceCombatantId: activeRow.combatantId,
            timingState: 'active',
            presentationDuration: 'while-elevated',
          }))
        : []
    const row = {
      ...activeRow,
      statuses: [
        ...activeRow.statuses,
        ...terrainStatuses,
        ...pending
          .filter((item) => item.combatantId === activeRow.combatantId)
          .map((item) => item.status),
      ],
    }
    // Validated snapshots should always resolve this row; omission is safer than disclosure if they do not.
    if (!combatant) return { ...row, statuses: [] }

    const relationship = battleViewerRelationship(viewer, combatant)

    // Opposing applied debuffs may retain a concealed cast's engine provenance.
    row.statuses = row.statuses.map((status) => {
      const source = combatantById.get(status.sourceCombatantId)
      const sourceRelationship = source ? battleViewerRelationship(viewer, source) : 'enemy'
      if (sourceRelationship === 'self' || sourceRelationship === 'ally') return status
      const publicStatus = { ...status }
      delete publicStatus.provenance
      return publicStatus
    })

    if (relationship === 'self' || relationship === 'ally') return row

    const covert = row.statuses.some(
      (status) => status.statusId === PV1F_COVERT_STATUS.id && status.timingState !== 'pending',
    )
    if (!covert)
      return { ...row, statuses: row.statuses.filter((status) => status.statusId !== 'copy') }

    return {
      ...row,
      statuses: row.statuses.filter((status) => {
        const terrainEffect = terrainBattleEffectPresentation(status)
        if (terrainEffect) return terrainEffect.kind !== 'Buff'
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
  state: Pick<StatDrivenCombatEncounterState, 'effectState' | 'tactical' | 'statusState'>,
  viewer: BattleViewerEntitlement,
): CombatEffectState | undefined {
  if (!state.effectState) return undefined

  const combatantById = new Map(
    state.tactical.battle.combatants.map((combatant) => [combatant.id, combatant] as const),
  )
  const sourceAllowed = (sourceId: string) => {
    const source = combatantById.get(sourceId)
    if (!source) return false
    const relationship = battleViewerRelationship(viewer, source)
    return relationship === 'self' || relationship === 'ally'
  }
  const positiveHolderVisible = (instance: { targetCombatantId: string }) => {
    const holder = combatantById.get(instance.targetCombatantId)
    if (!holder) return false
    const relationship = battleViewerRelationship(viewer, holder)
    return (
      relationship === 'self' ||
      relationship === 'ally' ||
      !state.statusState
        .find((row) => row.combatantId === holder.id)
        ?.statuses.some(
          (row) => row.statusId === PV1F_COVERT_STATUS.id && row.timingState !== 'pending',
        )
    )
  }
  const publicInstance = <
    T extends { sourceCombatantId: string; sourceActionId: string; provenance?: unknown },
  >(
    instance: T,
  ): T => {
    if (sourceAllowed(instance.sourceCombatantId)) return instance
    const publicEffect = { ...instance, sourceActionId: 'combat.effect' }
    delete publicEffect.provenance
    return publicEffect
  }
  return {
    ...state.effectState,
    poison: state.effectState.poison.map(publicInstance),
    burn: state.effectState.burn.map(publicInstance),
    bleed: state.effectState.bleed.map(publicInstance),
    ongoingRecovery: state.effectState.ongoingRecovery
      .filter(positiveHolderVisible)
      .map(publicInstance),
    ...(state.effectState.barriers
      ? { barriers: state.effectState.barriers.filter(positiveHolderVisible).map(publicInstance) }
      : {}),
    ...(state.effectState.summons
      ? {
          summons: state.effectState.summons.map((instance) =>
            sourceAllowed(instance.ownerCombatantId)
              ? instance
              : { ...instance, sourceSkillId: 'combat.summon' },
          ),
        }
      : {}),
    temporarySkills: state.effectState.temporarySkills.filter((grant) => {
      const holder = combatantById.get(grant.combatantId)
      if (!holder) return false
      const relationship = battleViewerRelationship(viewer, holder)
      return relationship === 'self' || relationship === 'ally'
    }),
  }
}

/** Internal delayed payloads and narration pins must never reach live viewers. */
export function omitPendingBattlePayloads<
  T extends {
    pendingEffects?: unknown
    pendingSummons?: unknown
    pendingSkillGrants?: unknown
    buildAuthority?: unknown
  },
>(state: T): T {
  const projected = { ...state }
  delete projected.pendingEffects
  delete projected.pendingSummons
  delete projected.pendingSkillGrants
  const authority = projected.buildAuthority
  if (
    authority &&
    typeof authority === 'object' &&
    'combatants' in authority &&
    Array.isArray(authority.combatants)
  ) {
    Object.assign(projected, {
      buildAuthority: {
        ...authority,
        combatants: authority.combatants.map((combatant: Record<string, unknown>) => {
          const publicCombatant = { ...combatant }
          delete publicCombatant.narratorIdentity
          return publicCombatant
        }),
      },
    })
  }
  return projected
}
