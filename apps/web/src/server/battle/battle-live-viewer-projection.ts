import { combatManualModifierAvailability } from '@aurevane/game-core/combat/combat-behavior-runtime'
import 'server-only'
import {
  projectPublicCombatGroundAreas,
  type PublicCombatGroundArea,
} from '@aurevane/game-core/combat/combat-ground-visuals'

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

/** Only controlled owners receive reference choices; allies/opponents/spectators receive none. */
export function projectBattleManualModifierAvailability(
  state: StatDrivenCombatEncounterState,
  viewer: BattleViewerEntitlement,
) {
  if (viewer.kind !== 'participant') return []
  return [...viewer.controlledCombatantIds]
    .sort()
    .flatMap((ownerId) => combatManualModifierAvailability(state, ownerId))
}

/** Safe geometry only, from the owner's immutable active Manual action captures. */
export function projectBattleManualActionTargets(
  state: StatDrivenCombatEncounterState,
  viewer: BattleViewerEntitlement,
) {
  if (viewer.kind !== 'participant') return []
  return (state.capturedAbilitySources ?? [])
    .filter(
      (source) =>
        viewer.controlledCombatantIds.has(source.ownerCombatantId) &&
        state.abilityRuntime?.activeSourceIds.includes(source.sourceInstanceId),
    )
    .flatMap((source) =>
      source.definition.behaviors
        .filter(
          (behavior) =>
            behavior.activation === 'manual' && behavior.mode === 'action' && behavior.targeting,
        )
        .map((behavior) => {
          const spec = behavior.targeting!
          return {
            actionId: source.abilityId,
            behaviorId: behavior.id,
            target: {
              kind: spec.kind,
              teamPolicy: spec.teamPolicy,
              friendlyFire: spec.friendlyFire,
              shape: { ...spec.shape },
              minimumRange: spec.minimumRange,
              maximumRange: spec.maximumRange,
              requiresLineOfSight: spec.requiresLineOfSight,
              maximumElevationDifference: spec.maximumElevationDifference,
              maximumSelections: spec.maximumSelections,
              ...(spec.geometryVersion !== undefined
                ? { geometryVersion: spec.geometryVersion }
                : {}),
              ...(spec.categories ? { categories: [...spec.categories] } : {}),
            },
          }
        }),
    )
    .sort((a, b) =>
      a.actionId < b.actionId
        ? -1
        : a.actionId > b.actionId
          ? 1
          : a.behaviorId < b.behaviorId
            ? -1
            : a.behaviorId > b.behaviorId
              ? 1
              : 0,
    )
}

/** Shallow public receipt projection; private execution records stay in persistence. */
export function omitCombatExecutionMetadata<T extends object>(receipt: T): T {
  const projected = { ...receipt }
  for (const key of [
    'effectOrigin',
    'abilityParticipants',
    'modifierSuppressions',
    'sourceCommandVisibility',
    'abilityCommandFacts',
    'provenance',
  ])
    Reflect.deleteProperty(projected, key)
  return projected
}

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
    | 'airbornePolicyVersion'
    | 'airborneJumpPolicyVersion'
    | 'healingDownPolicyVersion'
    | 'elementalDamagePolicyVersion'
    | 'blindsideActivationPolicyVersion'
    | 'dotTriggerPolicyVersion'
    | 'skillPacketPolicyVersion'
  >,
  viewer: BattleViewerEntitlement,
): BattleStatusState {
  const combatantById = new Map(
    state.tactical.battle.combatants.map((combatant) => [combatant.id, combatant] as const),
  )

  const presentInteractionPolicy = (status: BattlePresentedStatus): BattlePresentedStatus => ({
    ...status,
    ...(status.statusId === 'blindside' && state.blindsideActivationPolicyVersion === 1
      ? { blindsideActivationPolicyVersion: 1 as const }
      : {}),
    ...(status.statusId === 'airborne' && state.airbornePolicyVersion === 1
      ? { airbornePolicyVersion: 1 as const }
      : {}),
    ...(status.statusId === 'airborne' && state.airborneJumpPolicyVersion === 1
      ? { airborneJumpPolicyVersion: 1 as const }
      : {}),
    ...(['wet', 'frozen', 'conductive'].includes(status.statusId) &&
    state.elementalDamagePolicyVersion !== undefined
      ? { elementalDamagePolicyVersion: state.elementalDamagePolicyVersion }
      : {}),
    ...(status.statusId === 'hexed' && state.healingDownPolicyVersion === 1
      ? { healingDownPolicyVersion: 1 as const }
      : {}),
  })
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
        ...activeRow.statuses.map((status) =>
          presentInteractionPolicy(omitCombatExecutionMetadata(status)),
        ),
        ...terrainStatuses,
        ...pending
          .filter((item) => item.combatantId === activeRow.combatantId)
          .map((item) => presentInteractionPolicy(omitCombatExecutionMetadata(item.status))),
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
    if (!covert) return row

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
    if (sourceAllowed(instance.sourceCombatantId)) return omitCombatExecutionMetadata(instance)
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
  }
}

/** Internal delayed payloads and narration pins must never reach live viewers. */
export function omitPendingBattlePayloads<
  T extends {
    groundAreas?: readonly PublicCombatGroundArea[]
    nextGroundAreaId?: unknown
    tactical?: { battle: { round: number; lifecycle: string } }
    pendingEffects?: unknown
    turnTriggerState?: unknown
    pendingSummons?: unknown
    buildAuthority?: unknown
  },
>(
  state: T,
): Omit<T, 'groundAreas' | 'nextGroundAreaId'> & {
  groundAreas?: readonly PublicCombatGroundArea[]
} {
  const projected: Omit<T, 'groundAreas' | 'nextGroundAreaId'> & {
    groundAreas?: readonly PublicCombatGroundArea[]
  } = {
    ...state,
  }
  Reflect.deleteProperty(projected, 'nextGroundAreaId')
  Reflect.deleteProperty(projected, 'nextSkillPacketCommandId')
  for (const key of [
    'capturedAbilitySources',
    'abilityRuntime',
    'modifierSuppressions',
    'nativeBasicAttackCommand',
    'commandDamageBonuses',
    'effectEligibleRecipientIds',
    'effectTimingModes',
  ])
    Reflect.deleteProperty(projected, key)
  if (state.groundAreas)
    projected.groundAreas = projectPublicCombatGroundAreas(
      state.groundAreas,
      state.tactical?.battle.round ?? 0,
      state.tactical?.battle.lifecycle ?? 'completed',
    )
  delete projected.turnTriggerState
  delete projected.pendingEffects
  delete projected.pendingSummons
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
