import { combatEvaluatedEffectRecipientIds } from './combat-effect-recipients'
import { combatStatusMetadata } from './combat-effect-state'
import type {
  CombatActionDefinition,
  CombatContentCatalog,
  CombatEncounterState,
  CombatResolutionTransition,
  CombatStatusDefinition,
} from './actions'
import type {
  CombatActionEvaluation,
  CombatEffectDefinition as LegacyCombatEffectDefinition,
  CombatTargetSelection,
} from './actions-legacy'

export const CSR_STATUS_VERSION = 1 as const
export const CSR_MINIMUM_DURATION_OWNER_TURN_STARTS = 1 as const
export const CSR_MAXIMUM_DURATION_OWNER_TURN_STARTS = 4 as const
export const COVERT_STATUS_ID = 'covert' as const
export const REVEALED_STATUS_ID = 'revealed' as const

/** A successful concealment cast protects its own receipts and future delayed packets. */
export function protectCovertEstablishingAction<T extends CombatResolutionTransition>(
  before: CombatEncounterState,
  transition: T,
  actorId: string | undefined,
  actionId: string,
): T {
  if (!actorId) return transition
  const establishesCovert = transition.events.some(
    (event) =>
      ((event.event === 'status_applied' && event.statusId === COVERT_STATUS_ID) ||
        (event.event === 'effect_pending' && event.effectTag === COVERT_STATUS_ID)) &&
      event.actionId === actionId &&
      event.sourceCombatantId === actorId &&
      event.targetCombatantId === actorId,
  )
  if (!establishesCovert) return transition
  const teamId = before.tactical.battle.combatants.find((unit) => unit.id === actorId)!.teamId
  const visibility = { kind: 'team-only' as const, teamId }
  const existingPending = new Set(before.pendingEffects ?? [])
  const existingSummons = new Set(before.pendingSummons ?? [])
  const existingGroundIds = new Set(before.groundAreas?.map((area) => area.id) ?? [])
  const existingBarriers = new Set(
    before.effectState?.barriers?.map((pool) => pool.applicationOrder) ?? [],
  )
  const existingBarrierInstances = new Set(before.effectState?.barriers ?? [])
  const existingRecovery = new Set(before.effectState?.ongoingRecovery ?? [])
  const appliedStatuses = new Set(
    transition.events.flatMap((event) =>
      event.event === 'status_applied' &&
      event.actionId === actionId &&
      event.sourceCombatantId === actorId
        ? [JSON.stringify([event.targetCombatantId, event.statusId])]
        : [],
    ),
  )
  return {
    ...transition,
    state: {
      ...transition.state,
      statusState: transition.state.statusState.map((row) => ({
        ...row,
        statuses: row.statuses.map((status) => {
          if (!appliedStatuses.has(JSON.stringify([row.combatantId, status.statusId])))
            return status
          if (!status.applicationModifiers)
            return status.sourceCombatantId === actorId && !status.sourceCommandVisibility
              ? { ...status, sourceCommandVisibility: visibility }
              : status
          const previous = before.statusState
            .find((item) => item.combatantId === row.combatantId)
            ?.statuses.find(
              (item) =>
                item.statusId === status.statusId &&
                (!status.sourceScopedMark || item.sourceCombatantId === status.sourceCombatantId),
            )
          const previousApplications = new Set(previous?.applicationModifiers ?? [])
          const removed = transition.events.some(
            (event) =>
              (event.event === 'status_removed' &&
                event.targetCombatantId === row.combatantId &&
                event.statusId === status.statusId) ||
              (event.event === 'status_expired' &&
                event.combatantId === row.combatantId &&
                event.statusId === status.statusId),
          )
          // Legacy single statuses are promoted to an application record by the native append.
          // It is public only when the original survived and its exact application facts remain.
          const promotedPrevious =
            previous && !previous.applicationModifiers && !removed
              ? status.applicationModifiers.find(
                  (application) =>
                    application.stacks === previous.stacks &&
                    application.sourceCombatantId === previous.sourceCombatantId &&
                    application.potencyBasisPoints === previous.potencyBasisPoints &&
                    application.blindsideModifiersBasisPoints ===
                      previous.blindsideModifiersBasisPoints &&
                    application.sourceCommandVisibility === previous.sourceCommandVisibility,
                )
              : undefined
          const clockFields = [
            'remainingOwnerTurnStarts',
            'remainingOwnerTurnEnds',
            'remainingRoundBoundaries',
            'durationScope',
            'skipCurrentOwnerTurnEnd',
            'activationRound',
            'timingState',
          ] as const
          const privateClock = previous && clockFields.some((key) => previous[key] !== status[key])
          return {
            ...status,
            applicationModifiers: status.applicationModifiers.map((application) =>
              !previousApplications.has(application) &&
              application !== promotedPrevious &&
              application.sourceCombatantId === actorId
                ? {
                    ...application,
                    sourceCommandVisibility: application.sourceCommandVisibility ?? visibility,
                    // The shared refreshed lifetime cannot be attributed to public applications.
                    ...(privateClock ? { privateSharedLifetime: true as const } : {}),
                  }
                : application,
            ),
          }
        }),
      })),
      ...(transition.state.effectState
        ? {
            effectState: {
              ...transition.state.effectState,
              ongoingRecovery: transition.state.effectState.ongoingRecovery.map((instance) =>
                !existingRecovery.has(instance) &&
                instance.sourceCombatantId === actorId &&
                instance.sourceActionId === actionId &&
                !instance.sourceCommandVisibility
                  ? { ...instance, sourceCommandVisibility: visibility }
                  : instance,
              ),
              ...(transition.state.effectState.barriers
                ? {
                    barriers: transition.state.effectState.barriers.map((instance) =>
                      (instance.applicationOrder === undefined
                        ? !existingBarrierInstances.has(instance)
                        : !existingBarriers.has(instance.applicationOrder)) &&
                      instance.sourceCombatantId === actorId &&
                      instance.sourceActionId === actionId &&
                      !instance.sourceCommandVisibility
                        ? { ...instance, sourceCommandVisibility: visibility }
                        : instance,
                    ),
                  }
                : {}),
            },
          }
        : {}),
      ...(transition.state.pendingEffects
        ? {
            pendingEffects: transition.state.pendingEffects.map((pending) =>
              !existingPending.has(pending) &&
              pending.actorId === actorId &&
              pending.actionId === actionId &&
              !pending.sourceCommandVisibility
                ? { ...pending, sourceCommandVisibility: visibility }
                : pending,
            ),
          }
        : {}),
      ...(transition.state.pendingSummons
        ? {
            pendingSummons: transition.state.pendingSummons.map((pending) =>
              !existingSummons.has(pending) &&
              pending.input.ownerCombatantId === actorId &&
              pending.input.sourceSkillId === actionId &&
              !pending.sourceCommandVisibility
                ? { ...pending, sourceCommandVisibility: visibility }
                : pending,
            ),
          }
        : {}),
      ...(transition.state.groundAreas
        ? {
            groundAreas: transition.state.groundAreas.map((area) =>
              !existingGroundIds.has(area.id) &&
              area.sourceCombatantId === actorId &&
              area.sourceActionId === actionId &&
              !area.sourceCommandVisibility
                ? { ...area, sourceCommandVisibility: visibility }
                : area,
            ),
          }
        : {}),
    },
    events: transition.events.map((event) =>
      event.sourceCommandVisibility ? event : { ...event, sourceCommandVisibility: visibility },
    ),
  }
}

export interface CombatSensoryEffect {
  readonly type: 'sensory'
  readonly recipient: 'primary-unit'
  readonly revealedDurationOwnerTurnStarts: number
}

export function createCovertStatusDefinition(
  durationOwnerTurnStarts: number,
): CombatStatusDefinition {
  validateCsrDuration(durationOwnerTurnStarts, 'Covert duration')
  return {
    id: COVERT_STATUS_ID,
    version: CSR_STATUS_VERSION,
    maximumStacks: 1,
    durationOwnerTurnStarts,
    damageTakenMultiplierBasisPoints: 10_000,
    polarity: 'positive',
    amplifyCopyable: false,
    curseCopyable: false,
    reactionClass: 'ordinary',
    effectCategories: ['Buff', 'Stealth'],
  }
}

export function createRevealedStatusDefinition(
  durationOwnerTurnStarts: number,
): CombatStatusDefinition {
  validateCsrDuration(durationOwnerTurnStarts, 'Revealed duration')
  return {
    id: REVEALED_STATUS_ID,
    version: CSR_STATUS_VERSION,
    maximumStacks: 1,
    durationOwnerTurnStarts,
    damageTakenMultiplierBasisPoints: 10_000,
    polarity: 'negative',
    amplifyCopyable: false,
    curseCopyable: false,
    reactionClass: 'ordinary',
    effectCategories: ['Debuff'],
  }
}

export function hasCombatStatus(
  state: Pick<CombatEncounterState, 'statusState'>,
  combatantId: string,
  statusId: string,
): boolean {
  return (
    state.statusState
      .find((row) => row.combatantId === combatantId)
      ?.statuses.some(
        (status) => status.statusId === statusId && status.timingState !== 'pending',
      ) === true
  )
}

export function revealedSkillApCost(
  state: Pick<CombatEncounterState, 'statusState'>,
  combatantId: string,
  intrinsicApCost: number,
): number {
  if (!Number.isSafeInteger(intrinsicApCost) || intrinsicApCost < 0) {
    throw new RangeError('Skill AP cost must be a non-negative safe integer.')
  }
  if (!hasCombatStatus(state, combatantId, REVEALED_STATUS_ID)) return intrinsicApCost
  const doubled = intrinsicApCost * 2
  if (!Number.isSafeInteger(doubled))
    throw new RangeError('Revealed Skill AP cost exceeds safe range.')
  return doubled
}

export function validateCsrActionDefinition(
  action: Pick<CombatActionDefinition, 'target' | 'effects'>,
): void {
  let sensoryCount = 0
  for (const effect of action.effects) {
    if (effect.type === 'sensory') {
      sensoryCount += 1
      if (effect.recipient !== 'primary-unit' || action.target.kind !== 'unit') {
        throw new TypeError('Sensory requires a primary-unit effect on a unit-targeting Skill.')
      }
      validateCsrDuration(effect.revealedDurationOwnerTurnStarts, 'Sensory Revealed duration')
    }
    if (effect.type === 'apply-status' && effect.statusId === REVEALED_STATUS_ID) {
      throw new TypeError('Revealed may only be applied by a successful Sensory effect.')
    }
  }
  if (sensoryCount > 1) {
    throw new TypeError('A combat action may contain at most one Sensory effect.')
  }
}

export function materializeCsrPreviewAction(
  action: CombatActionDefinition,
): CombatActionDefinition {
  validateCsrActionDefinition(action)
  return {
    ...action,
    effects: action.effects.filter((effect) => effect.type !== 'sensory'),
    ...(action.effectTimingTags
      ? {
          effectTimingTags: action.effectTimingTags.filter(
            (_, index) => action.effects[index]?.type !== 'sensory',
          ),
        }
      : {}),
    ...(action.effectOrigins
      ? {
          effectOrigins: action.effectOrigins.filter(
            (_, index) => action.effects[index]?.type !== 'sensory',
          ),
        }
      : {}),
    ...(action.effectTimingModes
      ? {
          effectTimingModes: action.effectTimingModes.filter(
            (_, index) => action.effects[index]?.type !== 'sensory',
          ),
        }
      : {}),
    ...(action.effectEligibleRecipientIds
      ? {
          effectEligibleRecipientIds: action.effectEligibleRecipientIds.filter(
            (_, index) => action.effects[index]?.type !== 'sensory',
          ),
        }
      : {}),
  }
}

export function materializeCsrCommittedAction(input: {
  state: CombatEncounterState
  action: CombatActionDefinition
  selection: CombatTargetSelection
  evaluation: CombatActionEvaluation | null
  content: CombatContentCatalog
  missedCombatantIds: ReadonlySet<string>
}): {
  action: CombatActionDefinition
  content: CombatContentCatalog
  effectSourceOrdinals: readonly number[]
} {
  const { state, action, evaluation, content, missedCombatantIds } = input
  validateCsrActionDefinition(action)
  const primaryCombatantId = evaluation?.primaryCombatantId ?? null
  let sensoryDuration: number | null = null
  const effects: CombatActionDefinition['effects'][number][] = []
  const effectSourceOrdinals: number[] = []
  const effectTimingTags: (string | undefined)[] = []
  const effectOrigins: NonNullable<CombatActionDefinition['effectOrigins']>[number][] = []
  const effectTimingModes: NonNullable<CombatActionDefinition['effectTimingModes']>[number][] = []
  const effectEligibleRecipientIds: NonNullable<
    CombatActionDefinition['effectEligibleRecipientIds']
  >[number][] = []

  for (const [effectIndex, effect] of action.effects.entries()) {
    const initialEffectCount = effects.length
    try {
      if (effect.type !== 'sensory') {
        effects.push(effect)
        continue
      }

      if (
        !primaryCombatantId ||
        missedCombatantIds.has(primaryCombatantId) ||
        !primaryWouldBeCovertAtEffect(state, action, evaluation, primaryCombatantId, effectIndex)
      ) {
        continue
      }

      sensoryDuration = effect.revealedDurationOwnerTurnStarts
      const purgeIds = content.statuses
        .filter(isSensoryPurgeEligibleStatus)
        .map((status) => status.id)
        .sort(compareIdentity)
      if (!purgeIds.includes(COVERT_STATUS_ID)) {
        throw new TypeError(
          'Sensory requires Covert to be an explicitly positive removable status.',
        )
      }

      for (let index = 0; index < purgeIds.length; index += 8) {
        effects.push({
          type: 'remove-status',
          recipient: 'primary-unit',
          statusIds: purgeIds.slice(index, index + 8),
          removalMode: 'specified',
        })
      }
      effects.push({
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: REVEALED_STATUS_ID,
        stacks: 1,
      })
    } finally {
      for (let index = initialEffectCount; index < effects.length; index += 1) {
        effectSourceOrdinals.push(effectIndex)
        effectOrigins.push(action.effectOrigins?.[effectIndex])
        effectTimingModes.push(action.effectTimingModes?.[effectIndex])
        effectEligibleRecipientIds.push(action.effectEligibleRecipientIds?.[effectIndex])
        effectTimingTags.push(
          action.effectTimingTags?.[effectIndex] ??
            (effect.type === 'sensory' ? 'sensory' : undefined),
        )
      }
    }
  }

  return {
    action: {
      ...action,
      effects,
      effectTimingTags,
      ...(action.effectOrigins ? { effectOrigins } : {}),
      ...(action.effectTimingModes ? { effectTimingModes } : {}),
      ...(action.effectEligibleRecipientIds ? { effectEligibleRecipientIds } : {}),
    },
    effectSourceOrdinals,
    content: sensoryDuration === null ? content : withRevealedDuration(content, sensoryDuration),
  }
}

export function filterBlockedCovertApplication(input: {
  before: CombatEncounterState
  after: CombatEncounterState
  events: readonly unknown[]
}): { state: CombatEncounterState; events: readonly unknown[] } {
  const revealedByCombatant = new Map<string, boolean>()
  const covertAllowedByCombatant = new Map<string, boolean>()
  for (const row of input.before.statusState) {
    revealedByCombatant.set(
      row.combatantId,
      row.statuses.some((status) => status.statusId === REVEALED_STATUS_ID),
    )
    covertAllowedByCombatant.set(
      row.combatantId,
      row.statuses.some((status) => status.statusId === COVERT_STATUS_ID),
    )
  }

  const blockedIndexes = new Set<number>()
  input.events.forEach((event, index) => {
    if (!event || typeof event !== 'object' || Array.isArray(event)) return
    const value = event as Record<string, unknown>
    const target =
      typeof value.targetCombatantId === 'string'
        ? value.targetCombatantId
        : typeof value.combatantId === 'string'
          ? value.combatantId
          : null
    if (!target || typeof value.statusId !== 'string') return

    if (value.statusId === REVEALED_STATUS_ID) {
      if (value.event === 'status_applied') revealedByCombatant.set(target, true)
      if (value.event === 'status_removed' || value.event === 'status_expired') {
        revealedByCombatant.set(target, false)
      }
      return
    }
    if (value.statusId !== COVERT_STATUS_ID) return
    if (value.event === 'status_removed' || value.event === 'status_expired') {
      covertAllowedByCombatant.set(target, false)
      return
    }
    if (value.event !== 'status_applied') return
    if (revealedByCombatant.get(target) === true) {
      blockedIndexes.add(index)
      return
    }
    covertAllowedByCombatant.set(target, true)
  })

  const statusState = input.after.statusState.map((row) => {
    const shouldHaveCovert = covertAllowedByCombatant.get(row.combatantId) === true
    const hasCovert = row.statuses.some((status) => status.statusId === COVERT_STATUS_ID)
    if (shouldHaveCovert || !hasCovert) return row
    return {
      ...row,
      statuses: row.statuses.filter((status) => status.statusId !== COVERT_STATUS_ID),
    }
  })

  return {
    state: { ...input.after, statusState },
    events: input.events.filter((_, index) => !blockedIndexes.has(index)),
  }
}

function primaryWouldBeCovertAtEffect(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  evaluation: CombatActionEvaluation | null,
  primaryCombatantId: string,
  effectIndex: number,
): boolean {
  let covert = hasCombatStatus(state, primaryCombatantId, COVERT_STATUS_ID)
  let revealed = hasCombatStatus(state, primaryCombatantId, REVEALED_STATUS_ID)

  for (let index = 0; index < effectIndex; index += 1) {
    const effect = action.effects[index]
    if (
      !effect ||
      !evaluation ||
      !combatEvaluatedEffectRecipientIds(state, action, evaluation, index).includes(
        primaryCombatantId,
      )
    )
      continue
    if (effect.type === 'apply-status') {
      if (effect.statusId === REVEALED_STATUS_ID) revealed = true
      if (effect.statusId === COVERT_STATUS_ID && !revealed) covert = true
      continue
    }
    if (effect.type === 'remove-status') {
      if (effect.statusIds.includes(COVERT_STATUS_ID)) covert = false
      if (effect.statusIds.includes(REVEALED_STATUS_ID)) revealed = false
    }
  }
  return covert
}

function isSensoryPurgeEligibleStatus(status: CombatStatusDefinition): boolean {
  const metadata = combatStatusMetadata(status)
  return metadata.polarity === 'positive' && metadata.reactionClass !== 'system'
}

function withRevealedDuration(
  content: CombatContentCatalog,
  durationOwnerTurnStarts: number,
): CombatContentCatalog {
  validateCsrDuration(durationOwnerTurnStarts, 'Sensory Revealed duration')
  let found = false
  const statuses = content.statuses.map((status) => {
    if (status.id !== REVEALED_STATUS_ID) return status
    found = true
    if (status.version !== CSR_STATUS_VERSION) {
      throw new TypeError('Sensory requires the current Revealed status version.')
    }
    return { ...status, durationOwnerTurnStarts }
  })
  if (!found) throw new TypeError('Sensory requires a Revealed status definition.')
  return { ...content, statuses }
}

function validateCsrDuration(value: number, field: string): void {
  if (
    !Number.isSafeInteger(value) ||
    value < CSR_MINIMUM_DURATION_OWNER_TURN_STARTS ||
    value > CSR_MAXIMUM_DURATION_OWNER_TURN_STARTS
  ) {
    throw new RangeError(`${field} must be an integer from 1 to 4 owner-turn starts.`)
  }
}

function compareIdentity(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

export type MaterializedLegacyCsrEffect = LegacyCombatEffectDefinition
