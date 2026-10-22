import { renderAbilityPresentationText } from '@aurevane/game-core/combat/battle-narration'
import { contentArtworkKey } from '@aurevane/game-core/combat/content-media'
import { airborneJump } from '@aurevane/game-core/combat/combat-airborne'
import { battleActionDealsDamage } from '@/components/battle/battle-attack-path'
import { abilityBehaviorInformation } from '@/components/character/ability-detail-presentation'
import type { BattleBasicActionPresentation } from '@/lib/battle/battle-basic-actions'
import { PV1F_BASIC_ATTACK_ID } from '@aurevane/game-core/combat/pv1f-skills'
import {
  effectiveBasicSkillBehavior,
  isFreeOffensiveBasicMove,
} from '@aurevane/game-core/combat/combat-basic-actions'
import {
  combatManualModifierAvailability,
  combatControlledAbilityAvailability,
  combatPrimedAbilityIds,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import 'server-only'
import {
  canonicalAbilityTargetSpec,
  canonicalAbilitySupportsFireGroundIntent,
} from '@aurevane/game-core/combat/combat-targeting-shapes'
import {
  combatCanonicalModifierRootFacts,
  combatModifierCompatibilityFacts,
} from '@aurevane/game-core/combat/combat-modifier-compatibility'
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
import type { CombatSourceCommandVisibility } from '@aurevane/game-core/combat/actions'

function pendingCovertConcealsInstance(
  state: Pick<StatDrivenCombatEncounterState, 'pendingEffects'>,
  instance: { sourceCombatantId: string; sourceCommandVisibility?: CombatSourceCommandVisibility },
): boolean {
  return (
    instance.sourceCommandVisibility?.kind === 'team-only' &&
    (state.pendingEffects ?? []).some(
      (pending) =>
        pending.actorId === instance.sourceCombatantId &&
        pending.sourceCommandVisibility &&
        pending.effect.type === 'apply-status' &&
        pending.effect.statusId === PV1F_COVERT_STATUS.id &&
        pending.recipientIds.includes(pending.actorId),
    )
  )
}

function capturedAbilityEffectContext(state: StatDrivenCombatEncounterState) {
  return {
    legacyTriggers: state.dotTriggerPolicyVersion === undefined,
    legacyPoisonMovement: state.dotTriggerPolicyVersion !== 2,
    legacyFrozenGround: state.frozenGroundPolicyVersion !== 1,
    legacyAirborne: state.airbornePolicyVersion !== 1,
    legacyAirborneJump: state.airborneJumpPolicyVersion !== 1,
    legacyHealingDown: state.healingDownPolicyVersion !== 1,
    legacyBlindsideActivation: state.blindsideActivationPolicyVersion !== 1,
    legacyElemental: state.elementalDamagePolicyVersion === undefined,
    explicitElemental: state.elementalDamagePolicyVersion === 2,
  }
}

/** Only controlled owners receive reference choices; allies/opponents/spectators receive none. */
export function projectBattleManualModifierAvailability(
  state: StatDrivenCombatEncounterState,
  viewer: BattleViewerEntitlement,
) {
  if (viewer.kind !== 'participant') return []
  return [...viewer.controlledCombatantIds]
    .sort()
    .flatMap((ownerId) => combatManualModifierAvailability(state, ownerId))
    .map((row) => {
      const source = state.capturedAbilitySources!.find(
        (source) => source.sourceInstanceId === row.sourceInstanceId,
      )!
      const behavior = source.definition.behaviors.find(
        (behavior) => behavior.id === row.behaviorId,
      )!
      return {
        ...row,
        abilityId: source.abilityId,
        contentVersion: source.contentVersion,
        compatibility: combatModifierCompatibilityFacts(behavior),
        report: abilityBehaviorInformation(behavior, {
          timingPolicy: state.effectTimingPolicy ?? null,
          effectContext: capturedAbilityEffectContext(state),
        }),
      }
    })
}

/** Safe geometry and payment metadata from the owner's immutable active Manual captures. */
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
          const controlled = combatControlledAbilityAvailability({
            state,
            actorId: source.ownerCombatantId,
            sourceInstanceId: source.sourceInstanceId,
            behaviorId: behavior.id,
          })
          const spec = canonicalAbilityTargetSpec(behavior.targeting!)
          const move =
            source.basic?.execution.kind === 'basic-move' &&
            source.basic.execution.costBasis === 'per-terrain-point'
              ? undefined
              : behavior.effects.find((effect) => effect.payload.type === 'move')
          return {
            ownerCombatantId: source.ownerCombatantId,
            actionId:
              source.basic?.execution.kind === 'basic-attack'
                ? PV1F_BASIC_ATTACK_ID
                : source.abilityId,
            behaviorId: behavior.id,
            ...(behavior.classification ? { classification: behavior.classification } : {}),
            dealsDamage: battleActionDealsDamage(behavior.effects.map((effect) => effect.payload)),
            modifierRoot: combatCanonicalModifierRootFacts(behavior),
            ...(canonicalAbilitySupportsFireGroundIntent(
              behavior,
              state.elementalDamagePolicyVersion,
            )
              ? { groundIntentCapable: true as const }
              : {}),
            costs: behavior.costs.map((cost) => ({ ...cost })),
            cooldown: behavior.cooldown ? { ...behavior.cooldown } : null,
            ...(source.basic
              ? {}
              : {
                  report: abilityBehaviorInformation(behavior, {
                    timingPolicy: state.effectTimingPolicy ?? null,
                    effectContext: capturedAbilityEffectContext(state),
                  }),
                }),
            ...(controlled ? { controlled } : {}),
            ...(move?.payload.type === 'move'
              ? {
                  move: {
                    maximumTiles: move.payload.maximumTiles,
                    conditional: move.requirements != null,
                  },
                }
              : {}),
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
              geometryVersion: spec.geometryVersion,
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

/** A controlled owner's saved Basic display data, without private execution envelopes or accuracy. */
/** Only viewer-owned captured presentation crosses the composed public boundary. */
export function projectBattleTagPresentations(
  state: StatDrivenCombatEncounterState,
  viewer: BattleViewerEntitlement,
) {
  if (viewer.kind !== 'participant') return []
  return (state.capturedAbilitySources ?? [])
    .filter(
      (source) =>
        viewer.controlledCombatantIds.has(source.ownerCombatantId) &&
        source.definition.tagPresentation,
    )
    .map((source) => ({
      ownerCombatantId: source.ownerCombatantId,
      abilityId: source.abilityId,
      contentVersion: source.contentVersion,
      tags: source.definition.tagPresentation!,
    }))
}

export function projectBattleBasicActions(
  state: StatDrivenCombatEncounterState,
  viewer: BattleViewerEntitlement,
): readonly BattleBasicActionPresentation[] | undefined {
  if (viewer.kind !== 'participant') return undefined
  const owned = (state.capturedAbilitySources ?? []).filter(
    (source) => source.basic && viewer.controlledCombatantIds.has(source.ownerCombatantId),
  )
  if (!owned.length) return undefined
  return owned
    .filter((source) => state.abilityRuntime?.activeSourceIds.includes(source.sourceInstanceId))
    .map((source) => {
      const basic = source.basic!
      const owner = state.tactical.battle.combatants.find(
        (unit) => unit.id === source.ownerCombatantId,
      )!
      const profile = state.statBridge.combatants.find(
        (row) => row.combatantId === source.ownerCombatantId,
      )!
      const behaviors = source.definition.behaviors
        .filter((behavior) => behavior.activation === 'manual' && behavior.mode === 'action')
        .map((behavior) => {
          const move = behavior.effects.find((effect) => effect.payload.type === 'move')
          const freeOffensiveMove = isFreeOffensiveBasicMove(source, behavior)
          const report = abilityBehaviorInformation(
            freeOffensiveMove ? effectiveBasicSkillBehavior(state, source, behavior) : behavior,
            {
              basic,
              tagPresentation: basic.ability.tagPresentation,
              timingPolicy: state.effectTimingPolicy ?? null,
              effectContext: capturedAbilityEffectContext(state),
              stats: {
                move: owner.baseMovementBudget,
                jump: airborneJump(
                  state,
                  source.ownerCombatantId,
                  profile.jump,
                  PV1F_COMBAT_CONTENT,
                ),
                physicalPower: profile.physicalPower,
                mysticPower: profile.mysticPower,
              },
            },
          )
          return {
            behaviorId: behavior.id,
            classification: behavior.classification,
            modifierRoot: combatCanonicalModifierRootFacts(behavior),
            costs: behavior.costs.map((cost) => ({ ...cost })),
            cooldown: behavior.cooldown ? { ...behavior.cooldown } : null,
            target: structuredClone(canonicalAbilityTargetSpec(behavior.targeting!)),
            ...(move?.payload.type === 'move'
              ? {
                  move: {
                    maximumTiles: move.payload.maximumTiles,
                    conditional: move.requirements != null,
                  },
                }
              : {}),
            ...report,
            ...(freeOffensiveMove
              ? {
                  limits: [
                    ...report.limits,
                    'Free offensive Move shares this limit across its action groups.',
                  ],
                }
              : {}),
          }
        })
      const native = basic.execution.kind === 'basic-move' ? behaviors[0]! : null
      return {
        ownerCombatantId: source.ownerCombatantId,
        actionId: basic.execution.kind === 'basic-attack' ? PV1F_BASIC_ATTACK_ID : source.abilityId,
        contentVersion: source.contentVersion,
        name: basic.name,
        description:
          renderAbilityPresentationText(basic, 'public', { ability: basic.name }) ??
          basic.description,
        ...(renderAbilityPresentationText(basic, 'compact', { ability: basic.name })
          ? {
              compactText: renderAbilityPresentationText(basic, 'compact', {
                ability: basic.name,
              })!,
            }
          : {}),
        enabled: basic.enabled,
        iconKey: contentArtworkKey(basic.media),
        ...(native
          ? {
              movement: {
                costBasis:
                  basic.execution.kind === 'basic-move' ? basic.execution.costBasis : 'flat',
                ...(basic.execution.kind === 'basic-move' &&
                basic.execution.costBasis === 'per-terrain-point'
                  ? {
                      apPerTraversalPoint: native.costs.find((cost) => cost.resource === 'ap')!
                        .amount,
                    }
                  : {}),
                maximumTiles: native.move!.maximumTiles,
              },
            }
          : {}),
        behaviors,
      }
    })
    .sort(
      (left, right) =>
        left.ownerCombatantId.localeCompare(right.ownerCombatantId) ||
        left.actionId.localeCompare(right.actionId),
    )
}

/** Public receipt projection, including per-application private execution metadata. */
export function omitCombatExecutionMetadata<T extends object>(receipt: T): T {
  const projected = { ...receipt }
  for (const key of [
    'effectOrigin',
    'abilityParticipants',
    'modifierSuppressions',
    'sourceCommandVisibility',
    'privateSharedLifetime',
    'abilityCommandFacts',
    'provenance',
  ])
    Reflect.deleteProperty(projected, key)
  if ('applicationModifiers' in projected && Array.isArray(projected.applicationModifiers)) {
    Object.assign(projected, {
      applicationModifiers: projected.applicationModifiers.map((application: object) =>
        omitCombatExecutionMetadata(application),
      ),
    })
  }
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
    | 'effectStackingPolicyVersion'
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
    | 'capturedAbilitySources'
    | 'abilityRuntime'
    | 'effectTimingPolicy'
  >,
  viewer: BattleViewerEntitlement,
): BattleStatusState {
  const combatantById = new Map(
    state.tactical.battle.combatants.map((combatant) => [combatant.id, combatant] as const),
  )

  const presentInteractionPolicy = (status: BattlePresentedStatus): BattlePresentedStatus => ({
    ...status,
    ...(state.effectStackingPolicyVersion === 1 ? { effectStackingPolicyVersion: 1 as const } : {}),
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
  const pending = [
    ...(state.pendingEffects ?? []).flatMap((effect) => {
      const rows = pendingCombatStatusRows({
        ...state,
        pendingEffects: [effect],
        pendingSummons: [],
      })
      const visibility = effect.sourceCommandVisibility
      if (
        !visibility ||
        (viewer.kind === 'participant' && viewer.friendlyTeamIds.has(visibility.teamId))
      )
        return rows
      // A protected cast's queued benefits stay private before its own Covert activates.
      return rows.filter(({ combatantId, status }) => {
        const recipient = combatantById.get(combatantId)
        const relationship = recipient ? battleViewerRelationship(viewer, recipient) : 'enemy'
        if (relationship === 'self' || relationship === 'ally') return true
        const definition = STATUS_DEFINITION_BY_KEY.get(
          statusDefinitionKey(status.statusId, status.statusVersion),
        )
        return definition && combatStatusMetadata(definition).polarity !== 'positive'
      })
    }),
    ...pendingCombatStatusRows({
      ...state,
      pendingEffects: [],
      pendingSummons: state.pendingSummons?.filter(
        (summon) =>
          !summon.sourceCommandVisibility ||
          (viewer.kind === 'participant' &&
            viewer.friendlyTeamIds.has(summon.sourceCommandVisibility.teamId)),
      ),
    }),
    ...activePersistentCombatStatusRows({
      ...state,
      effectState: projectBattleEffectStateForViewer(state, viewer),
    }),
  ]
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
    const relationship = combatant ? battleViewerRelationship(viewer, combatant) : 'enemy'
    const primedStatuses: BattlePresentedStatus[] =
      (relationship === 'self' || relationship === 'ally') &&
      combatPrimedAbilityIds(state, activeRow.combatantId).length > 0
        ? [
            {
              statusId: 'primed',
              statusVersion: 1,
              stacks: 1,
              remainingOwnerTurnStarts: 1,
              sourceCombatantId: activeRow.combatantId,
              timingState: 'active',
              presentationDuration: 'while-primed',
            },
          ]
        : []
    const row = {
      ...activeRow,
      statuses: [
        ...activeRow.statuses
          .flatMap((status) => {
            const recipient = combatantById.get(activeRow.combatantId)
            const relationship = recipient ? battleViewerRelationship(viewer, recipient) : 'enemy'
            if (relationship === 'self' || relationship === 'ally') return [status]
            const definition = STATUS_DEFINITION_BY_KEY.get(
              statusDefinitionKey(status.statusId, status.statusVersion),
            )
            if (definition && combatStatusMetadata(definition).polarity !== 'positive')
              return [status]
            if (pendingCovertConcealsInstance(state, status)) return []
            if (!status.applicationModifiers) return [status]
            if (
              status.applicationModifiers.some(
                (application) =>
                  application.privateSharedLifetime &&
                  pendingCovertConcealsInstance(state, application),
              )
            )
              return []
            const applications = status.applicationModifiers.filter(
              (application) => !pendingCovertConcealsInstance(state, application),
            )
            if (applications.length === status.applicationModifiers.length) return [status]
            const last = applications.at(-1)
            if (!last) return []
            const visible = {
              ...status,
              applicationModifiers: applications,
              stacks: applications.reduce((sum, application) => sum + application.stacks, 0),
              sourceCombatantId: last.sourceCombatantId,
            }
            delete visible.potencyBasisPoints
            delete visible.blindsideModifiersBasisPoints
            if (last.potencyBasisPoints !== undefined)
              visible.potencyBasisPoints = last.potencyBasisPoints
            if (last.blindsideModifiersBasisPoints !== undefined)
              visible.blindsideModifiersBasisPoints = last.blindsideModifiersBasisPoints
            return [visible]
          })
          .map((status) => presentInteractionPolicy(omitCombatExecutionMetadata(status))),
        ...terrainStatuses,
        ...primedStatuses,
        ...pending
          .filter((item) => item.combatantId === activeRow.combatantId)
          .map((item) => presentInteractionPolicy(omitCombatExecutionMetadata(item.status))),
      ],
    }
    // Validated snapshots should always resolve this row; omission is safer than disclosure if they do not.
    if (!combatant) return { ...row, statuses: [] }

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

    // Concealment is authoritative even when a private queued refresh hides the
    // active Covert instance from this viewer's presented rows.
    const covert = activeRow.statuses.some(
      (status) => status.statusId === PV1F_COVERT_STATUS.id && status.timingState !== 'pending',
    )
    if (!covert)
      return {
        ...row,
        statuses: row.statuses.filter((status) => status.statusId !== PV1F_COVERT_STATUS.id),
      }

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
  state: Pick<
    StatDrivenCombatEncounterState,
    'effectState' | 'tactical' | 'statusState' | 'pendingEffects'
  >,
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
  const positiveHolderVisible = (instance: {
    targetCombatantId: string
    sourceCombatantId: string
    sourceCommandVisibility?: CombatSourceCommandVisibility
  }) => {
    const holder = combatantById.get(instance.targetCombatantId)
    if (!holder) return false
    const relationship = battleViewerRelationship(viewer, holder)
    return (
      relationship === 'self' ||
      relationship === 'ally' ||
      (!pendingCovertConcealsInstance(state, instance) &&
        !state.statusState
          .find((row) => row.combatantId === holder.id)
          ?.statuses.some(
            (row) => row.statusId === PV1F_COVERT_STATUS.id && row.timingState !== 'pending',
          ))
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
    return omitCombatExecutionMetadata(publicEffect)
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

const PRIVATE_BATTLE_STATE_KEYS = [
  'nextGroundAreaId',
  'nextSkillPacketCommandId',
  'capturedAbilitySources',
  'abilityRuntime',
  'modifierSuppressions',
  'nativeBasicAttackCommand',
  'groundTargetedRecipientIds',
  'commandDamageBonuses',
  'effectEligibleRecipientIds',
  'effectTimingModes',
  'turnTriggerState',
  'pendingEffects',
  'pendingSummons',
] as const
export type PrivateBattleStateKey = (typeof PRIVATE_BATTLE_STATE_KEYS)[number]

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
): Omit<T, 'groundAreas' | PrivateBattleStateKey> & {
  groundAreas?: readonly PublicCombatGroundArea[]
} {
  const projected: Omit<T, 'groundAreas' | PrivateBattleStateKey> & {
    groundAreas?: readonly PublicCombatGroundArea[]
  } = {
    ...state,
  }
  for (const key of PRIVATE_BATTLE_STATE_KEYS) Reflect.deleteProperty(projected, key)
  if (state.groundAreas)
    projected.groundAreas = projectPublicCombatGroundAreas(
      state.groundAreas,
      state.tactical?.battle.round ?? 0,
      state.tactical?.battle.lifecycle ?? 'completed',
    )
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
