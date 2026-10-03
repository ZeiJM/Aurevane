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
  currentBleedStacks,
  currentBurnInstance,
  currentPoisonInstance,
} from './combat-dots'
import {
  normalizeCombatEffectState,
  type CombatBleedStack,
  type CombatBurnInstance,
  type CombatPoisonInstance,
  type CombatBarrierInstance,
  type CombatOngoingRecovery,
} from './combat-effect-state'
import { grantBarrier } from './combat-barrier'
import { replaceRecoverySchedule } from './combat-recovery'
import { createCombatEffectInstanceProvenance } from './combat-kernel-types'
import { combatEffectTimingTag } from './combat-effect-timing'

export const CURRENT_COMBAT_COPY_POLICY_VERSION = 1 as const

/** Absence retains the historical random temporary-Skill contract. */
export function usesBeneficialCombatCopy(
  state: Pick<CombatEncounterState, 'copyPolicyVersion'>,
): boolean {
  return state.copyPolicyVersion === CURRENT_COMBAT_COPY_POLICY_VERSION
}

/** Reuse the status transfer kernel without rewriting immutable authored Skill definitions. */
export function materializeBeneficialCombatCopyAction(
  state: Pick<CombatEncounterState, 'copyPolicyVersion'>,
  action: CombatActionDefinition,
): CombatActionDefinition {
  if (!usesBeneficialCombatCopy(state) || !action.effects.some((effect) => effect.type === 'copy'))
    return action
  const rows = action.effects.map((effect, index) => ({
    effect:
      effect.type === 'copy'
        ? {
            type: 'copy-statuses' as const,
            recipient: effect.recipient,
            mode: 'amplify' as const,
            beneficialEffects: true,
          }
        : effect,
    origin: action.effectOrigins?.[index],
    timingTag: action.effectTimingTags?.[index] ?? combatEffectTimingTag(effect),
    copy: effect.type === 'copy',
  }))
  // The shared transfer operation executes first; all other authored effects retain their order.
  const ordered = [...rows.filter((row) => row.copy), ...rows.filter((row) => !row.copy)]
  return {
    ...action,
    effects: ordered.map((row) => row.effect),
    effectOrigins: ordered.map((row) => row.origin),
    effectTimingTags: ordered.map((row) => row.timingTag),
  }
}

export interface CombatStatusCopyEffect {
  type: 'copy-statuses'
  recipient: 'primary-unit'
  mode: 'amplify' | 'curse'
  /** Current Copy includes positive named buffs beyond the historical Amplify opt-in list. */
  beneficialEffects?: boolean
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
    (effect.beneficialEffects !== undefined && typeof effect.beneficialEffects !== 'boolean') ||
    (effect.beneficialEffects === true && effect.mode !== 'amplify')
  ) {
    throw new TypeError('Beneficial effect copying requires a boolean Amplify policy.')
  }
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
    (effect.beneficialEffects === true
      ? !['unit', 'ground-tile'].includes(action.target.kind)
      : action.target.kind !== 'unit' || action.target.shape.kind !== 'single') ||
    effect.recipient !== 'primary-unit' ||
    (effect.mode !== 'amplify' && effect.mode !== 'curse')
  ) {
    throw new TypeError(
      'Status copying requires one copy-first, single-unit Amplify or Curse operation, never Basic Attack.',
    )
  }
}

function isCopyable(definition: CombatStatusDefinition, effect: CombatStatusCopyEffect): boolean {
  const mode = effect.mode
  const permitted = mode === 'amplify' ? definition.amplifyCopyable : definition.curseCopyable
  return (
    (effect.beneficialEffects === true || permitted === true) &&
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
): void {
  if (
    instance.statusVersion !== definition.version ||
    !Number.isSafeInteger(instance.stacks) ||
    instance.stacks < 1 ||
    instance.stacks > definition.maximumStacks ||
    !Number.isSafeInteger(instance.remainingOwnerTurnStarts) ||
    instance.remainingOwnerTurnStarts < 1 ||
    instance.remainingOwnerTurnStarts >
      (instance.remainingOwnerTurnEnds !== undefined ? 4 : definition.durationOwnerTurnStarts)
  ) {
    throw new TypeError(
      'Copied status state must match its pinned version, stack cap and remaining duration.',
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
  previous: CombatPoisonInstance | undefined
}

interface BurnCopy {
  donor: CombatBurnInstance
  previous: CombatBurnInstance | undefined
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
  const donors = currentBleedStacks(state, donorId).filter((stack) => stack.curseCopyable === true)
  if (donors.length === 0) return []

  const effectState = normalizeCombatEffectState(state.effectState)
  let maximumOrder = effectState.bleed.reduce(
    (maximum, stack) => Math.max(maximum, stack.applicationOrder),
    0,
  )
  let simulated: SimulatedBleedRow[] = effectState.bleed.map((stack) => ({
    targetCombatantId: stack.targetCombatantId,
    damagePerTick: stack.damagePerTick,
    remainingTicks: stack.remainingTicks,
    applicationOrder: stack.applicationOrder,
    existing: stack,
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
    const replaced = targetRows.length >= 3 ? targetRows[0] : undefined
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
  copies: readonly StatusCopy[]
  poison: PoisonCopy | undefined
  burn: BurnCopy | undefined
  bleed: readonly BleedCopy[]
  barriers: readonly {
    donor: CombatBarrierInstance
    previous: CombatBarrierInstance | undefined
    appliedAmount: number
  }[]
  recovery: readonly { donor: CombatOngoingRecovery; previous: CombatOngoingRecovery | undefined }[]
}

/** Current Copy includes persistent benefits; historical modes keep their pinned eligibility. */
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
      copies: [],
      poison: undefined,
      burn: undefined,
      bleed: [],
      barriers: [],
      recovery: [],
    }
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
    if (donor.timingState === 'pending' || !isCopyable(definition, effect)) continue
    assertPinnedStatus(donor, definition)
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
    if (previous) assertPinnedStatus(previous, definition)
    const previousStacks = previous?.stacks ?? 0
    const next: CombatStatusInstance = {
      ...(donor.sourceScopedMark === true ? { sourceScopedMark: true as const } : {}),
      statusId: donor.statusId,
      statusVersion: donor.statusVersion,
      ...(effect.beneficialEffects === true && donor.potencyBasisPoints !== undefined
        ? { potencyBasisPoints: donor.potencyBasisPoints }
        : {}),
      // Both inputs are bounded; adding only the remaining capacity avoids unsafe integer sums.
      stacks: previousStacks + Math.min(donor.stacks, definition.maximumStacks - previousStacks),
      remainingOwnerTurnStarts: Math.max(
        donor.remainingOwnerTurnStarts,
        previous?.remainingOwnerTurnStarts ?? 0,
      ),
      sourceCombatantId: actorId,
      ...(donor.remainingOwnerTurnEnds !== undefined
        ? {
            remainingOwnerTurnEnds: Math.max(
              donor.remainingOwnerTurnEnds,
              previous?.remainingOwnerTurnEnds ?? 0,
            ),
            timingState: 'active' as const,
          }
        : {}),
    }
    return { donor, previous, next }
  })
  const donorPoison = effect.mode === 'curse' ? currentPoisonInstance(state, donorId) : null
  const poison =
    donorPoison?.curseCopyable === true
      ? { donor: donorPoison, previous: currentPoisonInstance(state, receiverId) ?? undefined }
      : undefined
  const donorBurn = effect.mode === 'curse' ? currentBurnInstance(state, donorId) : null
  const burn =
    donorBurn?.curseCopyable === true
      ? { donor: donorBurn, previous: currentBurnInstance(state, receiverId) ?? undefined }
      : undefined
  const bleed = planBleedCopies(state, donorId, receiverId, effect.mode)
  const persistent = normalizeCombatEffectState(state.effectState)
  let barrierCapacity =
    effect.beneficialEffects === true
      ? Math.max(
          0,
          (state.tactical.battle.combatants.find((row) => row.id === receiverId)?.maxHp ?? 0) -
            (persistent.barriers ?? [])
              .filter((row) => row.targetCombatantId === receiverId)
              .reduce((sum, row) => sum + row.amount, 0),
        )
      : 0
  const barriers =
    effect.beneficialEffects === true
      ? (persistent.barriers ?? [])
          .filter((row) => row.targetCombatantId === donorId && row.amount > 0)
          .sort(
            (left, right) =>
              left.sourceActionId.localeCompare(right.sourceActionId) ||
              left.sourceCombatantId.localeCompare(right.sourceCombatantId),
          )
          .map((donor) => {
            const appliedAmount = Math.min(donor.amount, barrierCapacity)
            barrierCapacity -= appliedAmount
            return {
              donor,
              appliedAmount,
              previous: persistent.barriers?.find(
                (row) =>
                  row.targetCombatantId === receiverId &&
                  row.sourceCombatantId === actorId &&
                  row.sourceActionId === donor.sourceActionId,
              ),
            }
          })
      : []
  const recovery =
    effect.beneficialEffects === true
      ? persistent.ongoingRecovery
          .filter(
            (row) =>
              row.targetCombatantId === donorId &&
              row.remainingFutureTicks > 0 &&
              row.amountPerTick > 0,
          )
          .sort(
            (left, right) =>
              left.kind.localeCompare(right.kind) ||
              left.sourceActionId.localeCompare(right.sourceActionId),
          )
          .map((donor) => ({
            donor,
            previous: persistent.ongoingRecovery.find(
              (row) =>
                row.targetCombatantId === receiverId &&
                row.kind === donor.kind &&
                row.sourceActionId === donor.sourceActionId,
            ),
          }))
      : []
  return { receiverId, copies, poison, burn, bleed, barriers, recovery }
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
  resolvingPending = false,
): CombatResolutionTransition & { projections: CombatEffectProjection[] } {
  const { receiverId, copies, poison, burn, bleed, barriers, recovery } = planCombatStatusCopies(
    state,
    actorId,
    selectedId,
    effect,
    content,
  )
  if (
    copies.length === 0 &&
    !poison &&
    !burn &&
    bleed.length === 0 &&
    barriers.length === 0 &&
    recovery.length === 0
  ) {
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
  const nextPoison = poison
    ? {
        targetCombatantId: receiverId,
        sourceCombatantId: actorId,
        sourceActionId: actionId,
        profileVersion: poison.donor.profileVersion,
        movementRemainder: poison.previous?.movementRemainder ?? poison.donor.movementRemainder,
        curseCopyable: true as const,
      }
    : undefined
  const nextBurn = burn
    ? {
        targetCombatantId: receiverId,
        sourceCombatantId: actorId,
        sourceActionId: actionId,
        profileVersion: burn.donor.profileVersion,
        stage: burn.previous ? 0 : burn.donor.stage,
        curseCopyable: true as const,
      }
    : undefined
  const effectState =
    nextPoison || nextBurn ? normalizeCombatEffectState(state.effectState) : undefined
  const nextEffectState = effectState
    ? {
        ...effectState,
        ...(nextPoison
          ? {
              poison: [
                ...effectState.poison.filter((entry) => entry.targetCombatantId !== receiverId),
                nextPoison,
              ].sort((left, right) =>
                left.targetCombatantId.localeCompare(right.targetCombatantId),
              ),
            }
          : {}),
        ...(nextBurn
          ? {
              burn: [
                ...effectState.burn.filter((entry) => entry.targetCombatantId !== receiverId),
                nextBurn,
              ].sort((left, right) =>
                left.targetCombatantId.localeCompare(right.targetCombatantId),
              ),
            }
          : {}),
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
  const persistentEvents: CombatResolutionTransition['events'][number][] = []
  const persistentProjections: CombatEffectProjection[] = []
  for (const { donor } of barriers) {
    const granted = grantBarrier(
      copiedState,
      actorId,
      receiverId,
      donor.sourceActionId,
      donor.amount,
    )
    copiedState = granted.state
    if (granted.applied > 0) {
      const persistent = normalizeCombatEffectState(copiedState.effectState)
      copiedState = {
        ...copiedState,
        effectState: {
          ...persistent,
          barriers: persistent.barriers?.map((row) => {
            if (
              row.targetCombatantId !== receiverId ||
              row.sourceCombatantId !== actorId ||
              row.sourceActionId !== donor.sourceActionId
            )
              return row
            const fresh = { ...row }
            delete fresh.provenance
            return fresh
          }),
        },
      }
    }
    persistentProjections.push({
      effectType: 'copy-statuses',
      combatantId: receiverId,
      before: `barrier:${granted.before}`,
      after: `barrier:${granted.after}`,
      statusId: 'barrier',
      durationScope: 'until-spent',
    })
    persistentEvents.push({
      event: 'barrier_changed',
      actionId,
      sourceCombatantId: actorId,
      targetCombatantId: receiverId,
      amount: granted.applied,
      before: granted.before,
      after: granted.after,
    })
  }
  for (const { donor, previous } of recovery) {
    copiedState = replaceRecoverySchedule(copiedState, {
      kind: donor.kind,
      sourceCombatantId: actorId,
      targetCombatantId: receiverId,
      sourceActionId: donor.sourceActionId,
      amountPerTick: donor.amountPerTick,
      remainingFutureTicks: donor.remainingFutureTicks,
      ...(!resolvingPending && state.tactical.battle.currentTurn?.combatantId === receiverId
        ? { skipCurrentOwnerTurnEnd: true }
        : {}),
    })
    persistentProjections.push({
      effectType: 'copy-statuses',
      combatantId: receiverId,
      before: previous
        ? `recovery:${previous.kind}:${previous.amountPerTick}:${previous.remainingFutureTicks}`
        : 'none',
      after: `recovery:${donor.kind}:${donor.amountPerTick}:${donor.remainingFutureTicks}`,
      statusId: donor.kind === 'hp' ? 'healing' : 'mp-recovery',
      remainingOwnerTurnEnds: donor.remainingFutureTicks,
    })
    persistentEvents.push({
      event: 'recovery_scheduled',
      actionId,
      sourceCombatantId: actorId,
      targetCombatantId: receiverId,
      resource: donor.kind,
      amountPerTick: donor.amountPerTick,
      remainingFutureTicks: donor.remainingFutureTicks,
    })
  }
  return {
    state: copiedState,
    events: [
      ...copies.map(({ previous, next }) => ({
        event: 'status_applied' as const,
        actionId,
        sourceCombatantId: actorId,
        targetCombatantId: receiverId,
        statusId: next.statusId,
        stacks: next.stacks,
        remainingOwnerTurnStarts: next.remainingOwnerTurnStarts,
        ...(next.remainingOwnerTurnEnds !== undefined
          ? { expiryBoundary: 'owner-turn-end' as const }
          : {}),
        refreshed: previous !== undefined,
        stacked: previous !== undefined && next.stacks > previous.stacks,
      })),
      ...persistentEvents,
    ],
    projections: [
      ...persistentProjections,
      ...copies.map(({ previous, next }) => ({
        effectType: 'copy-statuses' as const,
        combatantId: receiverId,
        before: statusSummary(previous),
        after: statusSummary(next),
      })),
      ...(nextPoison
        ? [
            {
              effectType: 'copy-statuses' as const,
              combatantId: receiverId,
              before: poison?.previous ? `poison:${poison.previous.movementRemainder}` : 'none',
              after: `poison:${nextPoison.movementRemainder}`,
            },
          ]
        : []),
      ...(nextBurn
        ? [
            {
              effectType: 'copy-statuses' as const,
              combatantId: receiverId,
              before: burn?.previous ? `burn:${burn.previous.stage}` : 'none',
              after: `burn:${nextBurn.stage}`,
            },
          ]
        : []),
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
  const { receiverId, copies, poison, burn, bleed, barriers, recovery } = planCombatStatusCopies(
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
  if (barriers.length || recovery.length) {
    const persistent = normalizeCombatEffectState(after.effectState)
    const copiedProvenance = (
      donor: { provenance?: CombatBarrierInstance['provenance'] },
      previous: { provenance?: CombatBarrierInstance['provenance'] } | undefined,
      copyOrdinal: number,
    ) =>
      createCombatEffectInstanceProvenance({
        action: context.provenance,
        targetCombatantId: receiverId,
        effectOrdinal: 0,
        copyOrdinal,
        createdRound: before.tactical.battle.round,
        createdTurn: before.tactical.battle.turnNumber,
        copiedFromInstanceId: donor.provenance?.instanceId,
        inheritedFromInstanceId: previous?.provenance?.instanceId,
      })
    after = {
      ...after,
      effectState: {
        ...persistent,
        barriers: persistent.barriers?.map((row) => {
          if (row.targetCombatantId !== receiverId || row.sourceCombatantId !== actorId) return row
          let index = barriers.length - 1
          while (
            index >= 0 &&
            (barriers[index]!.donor.sourceActionId !== row.sourceActionId ||
              barriers[index]!.appliedAmount === 0)
          )
            index -= 1
          const copy = barriers[index]
          return copy
            ? {
                ...row,
                provenance: copiedProvenance(copy.donor, copy.previous, copies.length + index),
              }
            : row
        }),
        ongoingRecovery: persistent.ongoingRecovery.map((row) => {
          if (row.targetCombatantId !== receiverId || row.sourceCombatantId !== actorId) return row
          const index = recovery.findIndex(
            (copy) =>
              copy.donor.kind === row.kind && copy.donor.sourceActionId === row.sourceActionId,
          )
          const copy = recovery[index]
          return copy
            ? {
                ...row,
                provenance: copiedProvenance(
                  copy.donor,
                  copy.previous,
                  copies.length + barriers.length + index,
                ),
              }
            : row
        }),
      },
    }
  }
  if (!poison && !burn && bleed.length === 0) return { ...after, statusState }
  const poisonProvenance = poison
    ? createCombatEffectInstanceProvenance({
        action: context.provenance,
        targetCombatantId: receiverId,
        effectOrdinal: 0,
        copyOrdinal: copies.length,
        createdRound: before.tactical.battle.round,
        createdTurn: before.tactical.battle.turnNumber,
        copiedFromInstanceId: poison.donor.provenance?.instanceId,
        inheritedFromInstanceId: poison.previous?.provenance?.instanceId,
      })
    : undefined
  const burnProvenance = burn
    ? createCombatEffectInstanceProvenance({
        action: context.provenance,
        targetCombatantId: receiverId,
        effectOrdinal: 0,
        copyOrdinal: copies.length + (poison ? 1 : 0),
        createdRound: before.tactical.battle.round,
        createdTurn: before.tactical.battle.turnNumber,
        copiedFromInstanceId: burn.donor.provenance?.instanceId,
        inheritedFromInstanceId: burn.previous?.provenance?.instanceId,
      })
    : undefined
  const bleedBaseOrdinal = copies.length + (poison ? 1 : 0) + (burn ? 1 : 0)
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
      poison: poisonProvenance
        ? effectState.poison.map((entry) =>
            entry.targetCombatantId === receiverId && entry.sourceCombatantId === actorId
              ? { ...entry, provenance: poisonProvenance }
              : entry,
          )
        : effectState.poison,
      burn: burnProvenance
        ? effectState.burn.map((entry) =>
            entry.targetCombatantId === receiverId && entry.sourceCombatantId === actorId
              ? { ...entry, provenance: burnProvenance }
              : entry,
          )
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
