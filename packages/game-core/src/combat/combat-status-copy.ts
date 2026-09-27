import type {
  CombatActionDefinition,
  CombatContentCatalog,
  CombatEffectDefinition,
  CombatEffectProjection,
  CombatEncounterState,
  CombatResolutionContext,
  CombatResolutionTransition,
  CombatStatusDefinition,
  CombatStatusInstance,
} from './actions'
import { compareCombatStatusInstances } from './combat-accuracy-status'
import {
  applyCurrentBleedState,
  CURRENT_BLEED_MAX_STACKS,
  currentBleedStacks,
  currentBurnInstances,
  currentPoisonInstances,
} from './combat-dots'
import {
  normalizeCombatEffectState,
  type CombatBleedStack,
  type CombatBurnInstance,
  type CombatPoisonInstance,
} from './combat-effect-state'
import { createCombatEffectInstanceProvenance } from './combat-kernel-types'
import { usesUnboundedEffectApplications } from './effect-application-rules'

export interface CombatStatusCopyEffect {
  type: 'copy-statuses'
  recipient: 'primary-unit'
  mode: 'amplify' | 'curse'
  /** Composed commands may explicitly permit an empty clone block while later effects still matter. */
  allowNoEligibleEffects?: boolean
}

/** Copying remains single-unit and copy-first while composition is introduced incrementally. */
export function validateCombatStatusCopyAction(action: CombatActionDefinition): void {
  const copyEntries = action.effects
    .map((effect, index) => ({ effect, index }))
    .filter(
      (entry): entry is { effect: CombatStatusCopyEffect; index: number } =>
        entry.effect.type === 'copy-statuses',
    )
  if (copyEntries.length === 0) return
  if (copyEntries.length !== 1) {
    throw new TypeError('Status copying supports exactly one copy operation per command.')
  }

  const entry = copyEntries[0]!
  const effect = entry.effect
  if (
    effect.allowNoEligibleEffects !== undefined &&
    typeof effect.allowNoEligibleEffects !== 'boolean'
  ) {
    throw new TypeError('Status copy allowNoEligibleEffects must be boolean when supplied.')
  }
  if (effect.allowNoEligibleEffects === true && action.effects.length === 1) {
    throw new TypeError('Status copy no-op permission is only valid on a composed command.')
  }
  if (
    entry.index !== 0 ||
    action.sourceType === 'basic-attack' ||
    action.target.kind !== 'unit' ||
    action.target.shape.kind !== 'single' ||
    effect.recipient !== 'primary-unit' ||
    (effect.mode !== 'amplify' && effect.mode !== 'curse')
  ) {
    throw new TypeError(
      'Status copying requires one copy-first, single-unit Amplify or Curse operation, never Basic Attack.',
    )
  }
}

function isCopyable(
  definition: CombatStatusDefinition,
  mode: CombatStatusCopyEffect['mode'],
): boolean {
  const permitted = mode === 'amplify' ? definition.amplifyCopyable : definition.curseCopyable
  return (
    permitted === true &&
    definition.polarity === (mode === 'amplify' ? 'positive' : 'negative') &&
    (definition.reactionClass === undefined ||
      definition.reactionClass === 'ordinary' ||
      definition.reactionClass === 'periodic' ||
      definition.reactionClass === 'reactive')
  )
}

function assertPinnedStatus(
  instance: CombatStatusInstance,
  definition: CombatStatusDefinition,
  unbounded: boolean,
): void {
  if (
    instance.statusVersion !== definition.version ||
    !Number.isSafeInteger(instance.stacks) ||
    instance.stacks < 1 ||
    (!unbounded && instance.stacks > definition.maximumStacks) ||
    !Number.isSafeInteger(instance.remainingOwnerTurnStarts) ||
    instance.remainingOwnerTurnStarts < 1 ||
    instance.remainingOwnerTurnStarts > definition.durationOwnerTurnStarts
  ) {
    throw new TypeError(
      'Copied status state must match its pinned version, application count and remaining duration.',
    )
  }
}

interface StatusCopy {
  donor: CombatStatusInstance
  previous: CombatStatusInstance | undefined
  next: CombatStatusInstance
}

interface PoisonCopy {
  donor: CombatPoisonInstance
  previous?: CombatPoisonInstance
  applicationOrder?: number
}

interface BurnCopy {
  donor: CombatBurnInstance
  previous?: CombatBurnInstance
  applicationOrder?: number
}

interface BleedCopy {
  donor: CombatBleedStack
  previous: CombatBleedStack | undefined
  replacedSummary: string | undefined
  applicationOrder: number
  attemptIndex: number
  survives: boolean
}

interface SimulatedBleedRow {
  targetCombatantId: string
  damagePerTick: number
  remainingTicks: number
  applicationOrder: number
  existing?: CombatBleedStack
  attemptIndex?: number
}

function planBleedCopies(
  state: CombatEncounterState,
  donorId: string,
  receiverId: string,
  mode: CombatStatusCopyEffect['mode'],
): readonly BleedCopy[] {
  if (mode !== 'curse') return []
  const donors = currentBleedStacks(state, donorId).filter(
    (application) => application.curseCopyable === true,
  )
  if (donors.length === 0) return []

  const effectState = normalizeCombatEffectState(state.effectState)
  let maximumOrder = effectState.bleed.reduce(
    (maximum, application) => Math.max(maximum, application.applicationOrder),
    0,
  )
  if (usesUnboundedEffectApplications(state)) {
    return donors.map((donor, attemptIndex) => {
      if (maximumOrder >= Number.MAX_SAFE_INTEGER) {
        throw new RangeError('Bleed application order has reached the safe integer limit.')
      }
      maximumOrder += 1
      return {
        donor,
        previous: undefined,
        replacedSummary: undefined,
        applicationOrder: maximumOrder,
        attemptIndex,
        survives: true,
      }
    })
  }

  let simulated: SimulatedBleedRow[] = effectState.bleed.map((application) => ({
    targetCombatantId: application.targetCombatantId,
    damagePerTick: application.damagePerTick,
    remainingTicks: application.remainingTicks,
    applicationOrder: application.applicationOrder,
    existing: application,
  }))
  const attempts: Omit<BleedCopy, 'survives'>[] = []

  donors.forEach((donor, attemptIndex) => {
    if (maximumOrder >= Number.MAX_SAFE_INTEGER) {
      throw new RangeError('Bleed application order has reached the safe integer limit.')
    }
    const targetRows = simulated
      .filter((row) => row.targetCombatantId === receiverId)
      .sort(
        (left, right) =>
          left.remainingTicks - right.remainingTicks ||
          left.applicationOrder - right.applicationOrder,
      )
    const replaced =
      targetRows.length >= CURRENT_BLEED_MAX_STACKS ? targetRows[0] : undefined
    if (replaced) {
      simulated = simulated.filter(
        (row) =>
          row.targetCombatantId !== replaced.targetCombatantId ||
          row.applicationOrder !== replaced.applicationOrder,
      )
    }
    maximumOrder += 1
    const applicationOrder = maximumOrder
    simulated.push({
      targetCombatantId: receiverId,
      damagePerTick: donor.damagePerTick,
      remainingTicks: donor.remainingTicks,
      applicationOrder,
      attemptIndex,
    })
    attempts.push({
      donor,
      previous: replaced?.existing,
      replacedSummary: replaced
        ? `bleed:${replaced.damagePerTick}:${replaced.remainingTicks}`
        : undefined,
      applicationOrder,
      attemptIndex,
    })
  })

  const survivingOrders = new Set(
    simulated
      .filter((row) => row.targetCombatantId === receiverId && row.attemptIndex !== undefined)
      .map((row) => row.applicationOrder),
  )
  return attempts.map((attempt) => ({
    ...attempt,
    survives: survivingOrders.has(attempt.applicationOrder),
  }))
}

interface CombatCopyPlan {
  receiverId: string
  unbounded: boolean
  copies: readonly StatusCopy[]
  poison: readonly PoisonCopy[]
  burn: readonly BurnCopy[]
  bleed: readonly BleedCopy[]
}

/** Only ordinary status rows are enumerated; typed DoT/resource/terrain state is never inferred. */
export function planCombatStatusCopies(
  state: CombatEncounterState,
  actorId: string,
  selectedId: string,
  effect: CombatStatusCopyEffect,
  content: CombatContentCatalog,
): CombatCopyPlan {
  const donorId = effect.mode === 'amplify' ? selectedId : actorId
  const receiverId = effect.mode === 'amplify' ? actorId : selectedId
  if (donorId === receiverId)
    return {
      receiverId,
      unbounded: usesUnboundedEffectApplications(state),
      copies: [],
      poison: [],
      burn: [],
      bleed: [],
    }
  const unbounded = usesUnboundedEffectApplications(state)
  const donors = state.statusState.find((row) => row.combatantId === donorId)?.statuses ?? []
  const receiver = state.statusState.find((row) => row.combatantId === receiverId)?.statuses ?? []
  const definitions = new Map(content.statuses.map((definition) => [definition.id, definition]))
  const selected = new Map<
    string,
    { donor: CombatStatusInstance; definition: CombatStatusDefinition }
  >()
  for (const donor of [...donors].sort(compareCombatStatusInstances)) {
    const definition = definitions.get(donor.statusId)
    if (!definition) throw new TypeError(`Missing pinned status definition ${donor.statusId}.`)
    if (!isCopyable(definition, effect.mode)) continue
    assertPinnedStatus(donor, definition, unbounded)
    const previous = selected.get(donor.statusId)
    // Rebound Marks share one receiver relationship: choose the longest-lived source, stable on ties.
    if (!previous || donor.remainingOwnerTurnStarts > previous.donor.remainingOwnerTurnStarts) {
      selected.set(donor.statusId, { donor, definition })
    }
  }
  const copies = [...selected.values()].map(({ donor, definition }): StatusCopy => {
    const previous = receiver.find(
      (status) =>
        status.statusId === donor.statusId &&
        (status.sourceScopedMark !== true || status.sourceCombatantId === actorId),
    )
    if (previous) assertPinnedStatus(previous, definition, unbounded)
    const previousStacks = previous?.stacks ?? 0
    const next: CombatStatusInstance = {
      ...(donor.sourceScopedMark === true ? { sourceScopedMark: true as const } : {}),
      statusId: donor.statusId,
      statusVersion: donor.statusVersion,
      stacks: unbounded
        ? addEffectApplications(previousStacks, donor.stacks)
        : previousStacks + Math.min(donor.stacks, definition.maximumStacks - previousStacks),
      remainingOwnerTurnStarts: Math.max(
        donor.remainingOwnerTurnStarts,
        previous?.remainingOwnerTurnStarts ?? 0,
      ),
      sourceCombatantId: actorId,
    }
    return { donor, previous, next }
  })
  const effectState = normalizeCombatEffectState(state.effectState)
  let poisonOrder = effectState.poison.reduce(
    (maximum, instance) => Math.max(maximum, instance.applicationOrder ?? 0),
    0,
  )
  const poison =
    effect.mode !== 'curse'
      ? []
      : unbounded
        ? currentPoisonInstances(state, donorId)
            .filter((instance) => instance.curseCopyable === true)
            .map((donor) => {
              if (poisonOrder >= Number.MAX_SAFE_INTEGER) {
                throw new RangeError('Poison application order has reached the safe integer limit.')
              }
              poisonOrder += 1
              return { donor, applicationOrder: poisonOrder }
            })
        : currentPoisonInstances(state, donorId)
            .filter((instance) => instance.curseCopyable === true)
            .slice(0, 1)
            .map((donor) => ({
              donor,
              previous: currentPoisonInstances(state, receiverId)[0],
            }))
  let burnOrder = effectState.burn.reduce(
    (maximum, instance) => Math.max(maximum, instance.applicationOrder ?? 0),
    0,
  )
  const burn =
    effect.mode !== 'curse'
      ? []
      : unbounded
        ? currentBurnInstances(state, donorId)
            .filter((instance) => instance.curseCopyable === true)
            .map((donor) => {
              if (burnOrder >= Number.MAX_SAFE_INTEGER) {
                throw new RangeError('Burn application order has reached the safe integer limit.')
              }
              burnOrder += 1
              return { donor, applicationOrder: burnOrder }
            })
        : currentBurnInstances(state, donorId)
            .filter((instance) => instance.curseCopyable === true)
            .slice(0, 1)
            .map((donor) => ({
              donor,
              previous: currentBurnInstances(state, receiverId)[0],
            }))
  const bleed = planBleedCopies(state, donorId, receiverId, effect.mode)
  return { receiverId, unbounded, copies, poison, burn, bleed }
}

function compareTypedApplication<
  T extends { targetCombatantId: string; applicationOrder?: number },
>(left: T, right: T): number {
  return (
    left.targetCombatantId.localeCompare(right.targetCombatantId) ||
    (left.applicationOrder ?? 0) - (right.applicationOrder ?? 0)
  )
}

function addEffectApplications(current: number, added: number): number {
  const total = BigInt(current) + BigInt(added)
  return Number(
    total > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : total,
  )
}

function statusSummary(status: CombatStatusInstance | undefined): string {
  return status ? `${status.statusId}:${status.stacks}:${status.remainingOwnerTurnStarts}` : 'none'
}

export function applyCombatStatusCopies(
  state: CombatEncounterState,
  actorId: string,
  selectedId: string,
  actionId: string,
  effect: CombatStatusCopyEffect,
  content: CombatContentCatalog,
): CombatResolutionTransition & { projections: CombatEffectProjection[] } {
  const { receiverId, unbounded, copies, poison, burn, bleed } = planCombatStatusCopies(
    state,
    actorId,
    selectedId,
    effect,
    content,
  )
  if (copies.length === 0 && poison.length === 0 && burn.length === 0 && bleed.length === 0) {
    if (effect.allowNoEligibleEffects === true) {
      return { state, events: [], projections: [] }
    }
    throw new Error('Status copying requires eligible active statuses.')
  }
  const replaced = new Set(
    copies.map((copy) => copy.previous).filter((entry) => entry !== undefined),
  )
  const statusState = state.statusState.map((row) =>
    row.combatantId === receiverId
      ? {
          ...row,
          statuses: [
            ...row.statuses.filter((status) => !replaced.has(status)),
            ...copies.map((copy) => copy.next),
          ].sort(compareCombatStatusInstances),
        }
      : row,
  )
  const nextPoison = poison.map(({ donor, previous, applicationOrder }) => ({
    ...(applicationOrder !== undefined ? { applicationOrder } : {}),
    targetCombatantId: receiverId,
    sourceCombatantId: actorId,
    sourceActionId: actionId,
    profileVersion: donor.profileVersion,
    movementRemainder: unbounded
      ? donor.movementRemainder
      : (previous?.movementRemainder ?? donor.movementRemainder),
    curseCopyable: true as const,
  }))
  const nextBurn = burn.map(({ donor, previous, applicationOrder }) => ({
    ...(applicationOrder !== undefined ? { applicationOrder } : {}),
    targetCombatantId: receiverId,
    sourceCombatantId: actorId,
    sourceActionId: actionId,
    profileVersion: donor.profileVersion,
    stage: unbounded ? donor.stage : previous ? 0 : donor.stage,
    curseCopyable: true as const,
  }))
  const effectState =
    nextPoison.length > 0 || nextBurn.length > 0
      ? normalizeCombatEffectState(state.effectState)
      : undefined
  const nextEffectState = effectState
    ? {
        ...effectState,
        poison: (
          unbounded
            ? [...effectState.poison, ...nextPoison]
            : [
                ...effectState.poison.filter((entry) => entry.targetCombatantId !== receiverId),
                ...nextPoison,
              ]
        ).sort(compareTypedApplication),
        burn: (
          unbounded
            ? [...effectState.burn, ...nextBurn]
            : [
                ...effectState.burn.filter((entry) => entry.targetCombatantId !== receiverId),
                ...nextBurn,
              ]
        ).sort(compareTypedApplication),
      }
    : state.effectState
  let copiedState: CombatEncounterState = { ...state, statusState, effectState: nextEffectState }
  for (const attempt of bleed) {
    copiedState = applyCurrentBleedState(
      copiedState,
      actorId,
      receiverId,
      actionId,
      attempt.donor.damagePerTick,
      attempt.donor.remainingTicks,
      true,
    )
  }
  return {
    state: copiedState,
    events: copies.map(({ previous, next }) => ({
      event: 'status_applied',
      actionId,
      sourceCombatantId: actorId,
      targetCombatantId: receiverId,
      statusId: next.statusId,
      stacks: next.stacks,
      remainingOwnerTurnStarts: next.remainingOwnerTurnStarts,
      refreshed: previous !== undefined,
      stacked: previous !== undefined && next.stacks > previous.stacks,
    })),
    projections: [
      ...copies.map(({ previous, next }) => ({
        effectType: 'copy-statuses' as const,
        combatantId: receiverId,
        before: statusSummary(previous),
        after: statusSummary(next),
      })),
      ...nextPoison.map((instance, index) => ({
        effectType: 'copy-statuses' as const,
        combatantId: receiverId,
        before: poison[index]?.previous
          ? `poison:${poison[index]!.previous!.movementRemainder}`
          : 'none',
        after: `poison:${instance.movementRemainder}`,
      })),
      ...nextBurn.map((instance, index) => ({
        effectType: 'copy-statuses' as const,
        combatantId: receiverId,
        before: burn[index]?.previous ? `burn:${burn[index]!.previous!.stage}` : 'none',
        after: `burn:${instance.stage}`,
      })),
      ...bleed.map((attempt) => ({
        effectType: 'copy-statuses' as const,
        combatantId: receiverId,
        before: attempt.replacedSummary ?? 'none',
        after: `bleed:${attempt.donor.damagePerTick}:${attempt.donor.remainingTicks}`,
      })),
    ],
  }
}

/** Called by the existing K3 attachment stage only after the single copy operation commits. */
export function attachCombatStatusCopyProvenance(
  before: CombatEncounterState,
  after: CombatEncounterState,
  actorId: string,
  selectedId: string,
  effect: Extract<CombatEffectDefinition, { type: 'copy-statuses' }>,
  content: CombatContentCatalog,
  context: CombatResolutionContext,
): CombatEncounterState {
  const { receiverId, unbounded, copies, poison, burn, bleed } = planCombatStatusCopies(
    before,
    actorId,
    selectedId,
    effect,
    content,
  )
  const assignments = new Map(
    copies.map((copy, copyOrdinal) => [copy.next.statusId, { copy, copyOrdinal }]),
  )
  const statusState = after.statusState.map((row) =>
    row.combatantId === receiverId
      ? {
          ...row,
          statuses: row.statuses.map((status) => {
            const assigned = assignments.get(status.statusId)
            if (!assigned || status.sourceCombatantId !== actorId) return status
            const provenance = createCombatEffectInstanceProvenance({
              action: context.provenance,
              targetCombatantId: receiverId,
              effectOrdinal: 0,
              copyOrdinal: assigned.copyOrdinal,
              createdRound: before.tactical.battle.round,
              createdTurn: before.tactical.battle.turnNumber,
              copiedFromInstanceId: assigned.copy.donor.provenance?.instanceId,
              inheritedFromInstanceId: assigned.copy.previous?.provenance?.instanceId,
            })
            return { ...status, provenance }
          }),
        }
      : row,
  )
  if (poison.length === 0 && burn.length === 0 && bleed.length === 0)
    return { ...after, statusState }
  const poisonProvenance = new Map(
    poison.map((copy, index) => [
      copy.applicationOrder ?? 0,
      createCombatEffectInstanceProvenance({
        action: context.provenance,
        targetCombatantId: receiverId,
        effectOrdinal: 0,
        copyOrdinal: copies.length + index,
        createdRound: before.tactical.battle.round,
        createdTurn: before.tactical.battle.turnNumber,
        copiedFromInstanceId: copy.donor.provenance?.instanceId,
        inheritedFromInstanceId: copy.previous?.provenance?.instanceId,
      }),
    ]),
  )
  const burnProvenance = new Map(
    burn.map((copy, index) => [
      copy.applicationOrder ?? 0,
      createCombatEffectInstanceProvenance({
        action: context.provenance,
        targetCombatantId: receiverId,
        effectOrdinal: 0,
        copyOrdinal: copies.length + poison.length + index,
        createdRound: before.tactical.battle.round,
        createdTurn: before.tactical.battle.turnNumber,
        copiedFromInstanceId: copy.donor.provenance?.instanceId,
        inheritedFromInstanceId: copy.previous?.provenance?.instanceId,
      }),
    ]),
  )
  const bleedBaseOrdinal = copies.length + poison.length + burn.length
  const survivingBleed = new Map(
    bleed
      .filter((attempt) => attempt.survives)
      .map((attempt) => [attempt.applicationOrder, attempt] as const),
  )
  const effectState = normalizeCombatEffectState(after.effectState)
  return {
    ...after,
    statusState,
    effectState: {
      ...effectState,
      poison:
        poisonProvenance.size > 0
          ? effectState.poison.map((entry) => {
              const provenance = poisonProvenance.get(entry.applicationOrder ?? 0)
              return provenance &&
                entry.targetCombatantId === receiverId &&
                entry.sourceCombatantId === actorId &&
                entry.sourceActionId === actionId
                ? { ...entry, provenance }
                : entry
            })
          : effectState.poison,
      burn:
        burnProvenance.size > 0
          ? effectState.burn.map((entry) => {
              const provenance = burnProvenance.get(entry.applicationOrder ?? 0)
              return provenance &&
                entry.targetCombatantId === receiverId &&
                entry.sourceCombatantId === actorId &&
                entry.sourceActionId === actionId
                ? { ...entry, provenance }
                : entry
            })
          : effectState.burn,
      bleed:
        survivingBleed.size > 0
          ? effectState.bleed.map((entry) => {
              const assigned = survivingBleed.get(entry.applicationOrder)
              if (
                !assigned ||
                entry.targetCombatantId !== receiverId ||
                entry.sourceCombatantId !== actorId
              )
                return entry
              const provenance = createCombatEffectInstanceProvenance({
                action: context.provenance,
                targetCombatantId: receiverId,
                effectOrdinal: 0,
                copyOrdinal: bleedBaseOrdinal + assigned.attemptIndex,
                createdRound: before.tactical.battle.round,
                createdTurn: before.tactical.battle.turnNumber,
                copiedFromInstanceId: assigned.donor.provenance?.instanceId,
                inheritedFromInstanceId: assigned.previous?.provenance?.instanceId,
              })
              return { ...entry, provenance }
            })
          : effectState.bleed,
    },
  }
}
