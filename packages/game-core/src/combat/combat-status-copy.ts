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
import { combatStatusApplications } from './combat-status-applications'
import {
  applyCurrentBleedState,
  currentBleedStacks,
  currentBurnInstance,
  currentPoisonInstance,
  currentBurnInstances,
  currentPoisonInstances,
  compareCombatDotApplications,
  nextCombatDotApplicationOrder,
  usesUnlimitedCombatEffectStacking,
} from './combat-dots'
import {
  normalizeCombatEffectState,
  type CombatBleedStack,
  type CombatBurnInstance,
  type CombatPoisonInstance,
  type CombatBarrierInstance,
  type CombatOngoingRecovery,
} from './combat-effect-state'
import { currentBarrierAmount, grantBarrier } from './combat-barrier'
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
  unlimited: boolean,
): void {
  if (
    instance.statusVersion !== definition.version ||
    !Number.isSafeInteger(instance.stacks) ||
    instance.stacks < 1 ||
    (!unlimited && instance.stacks > definition.maximumStacks) ||
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
  applicationOrder?: number
}

interface BurnCopy {
  donor: CombatBurnInstance
  previous: CombatBurnInstance | undefined
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
    const replaced =
      !usesUnlimitedCombatEffectStacking(state) && targetRows.length >= 3
        ? targetRows[0]
        : undefined
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
  poisons: readonly PoisonCopy[]
  burns: readonly BurnCopy[]
  bleed: readonly BleedCopy[]
  barriers: readonly {
    donor: CombatBarrierInstance
    previous: CombatBarrierInstance | undefined
    appliedAmount: number
    applicationOrder?: number
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
      poisons: [],
      burns: [],
      bleed: [],
      barriers: [],
      recovery: [],
    }
  const donors = state.statusState.find((row) => row.combatantId === donorId)?.statuses ?? []
  const receiver = state.statusState.find((row) => row.combatantId === receiverId)?.statuses ?? []
  const definitions = new Map(content.statuses.map((definition) => [definition.id, definition]))
  const selected = new Map<
    string,
    {
      donor: CombatStatusInstance
      donors: CombatStatusInstance[]
      definition: CombatStatusDefinition
    }
  >()
  for (const donor of [...donors].sort(compareCombatStatusInstances)) {
    const definition = definitions.get(donor.statusId)
    if (!definition) throw new TypeError(`Missing pinned status definition ${donor.statusId}.`)
    if (donor.timingState === 'pending' || !isCopyable(definition, effect)) continue
    assertPinnedStatus(donor, definition, usesUnlimitedCombatEffectStacking(state))
    const previous = selected.get(donor.statusId)
    if (usesUnlimitedCombatEffectStacking(state) && previous) {
      previous.donors.push(donor)
      if (donor.remainingOwnerTurnStarts > previous.donor.remainingOwnerTurnStarts)
        previous.donor = donor
    } else if (
      !previous ||
      donor.remainingOwnerTurnStarts > previous.donor.remainingOwnerTurnStarts
    ) {
      // Historical rebound Marks retain the longest-lived source, stable on ties.
      selected.set(donor.statusId, { donor, donors: [donor], definition })
    }
  }
  const copies = [...selected.values()].map(
    ({ donor, donors: selectedDonors, definition }): StatusCopy => {
      const previous = receiver.find(
        (status) =>
          status.statusId === donor.statusId &&
          (status.sourceScopedMark !== true || status.sourceCombatantId === actorId),
      )
      if (previous)
        assertPinnedStatus(previous, definition, usesUnlimitedCombatEffectStacking(state))
      const previousStacks = previous?.stacks ?? 0
      const donorStacks = selectedDonors.reduce((sum, row) => {
        const total = sum + row.stacks
        if (!Number.isSafeInteger(total))
          throw new RangeError('Copied status stacks have reached the safe integer limit.')
        return total
      }, 0)
      const stacks = usesUnlimitedCombatEffectStacking(state)
        ? previousStacks + donorStacks
        : previousStacks + Math.min(donorStacks, definition.maximumStacks - previousStacks)
      if (!Number.isSafeInteger(stacks))
        throw new RangeError('Copied status stacks have reached the safe integer limit.')
      const next: CombatStatusInstance = {
        ...(donor.sourceScopedMark === true ? { sourceScopedMark: true as const } : {}),
        statusId: donor.statusId,
        statusVersion: donor.statusVersion,
        ...(effect.beneficialEffects === true && donor.potencyBasisPoints !== undefined
          ? { potencyBasisPoints: donor.potencyBasisPoints }
          : {}),
        stacks,
        ...(usesUnlimitedCombatEffectStacking(state)
          ? {
              applicationModifiers: [
                ...(previous ? combatStatusApplications(previous) : []),
                ...selectedDonors.flatMap((row) =>
                  combatStatusApplications(row).map((application) => ({
                    ...application,
                    sourceCombatantId: actorId,
                  })),
                ),
              ],
            }
          : {}),
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
    },
  )
  const independent = usesUnlimitedCombatEffectStacking(state)
  const persistentDots = normalizeCombatEffectState(state.effectState)
  const poisonDonors =
    effect.mode === 'curse'
      ? (independent
          ? currentPoisonInstances(state, donorId)
          : [currentPoisonInstance(state, donorId)].filter(
              (row): row is CombatPoisonInstance => row !== null,
            )
        ).filter((row) => row.curseCopyable === true)
      : []
  const burnDonors =
    effect.mode === 'curse'
      ? (independent
          ? currentBurnInstances(state, donorId)
          : [currentBurnInstance(state, donorId)].filter(
              (row): row is CombatBurnInstance => row !== null,
            )
        ).filter((row) => row.curseCopyable === true)
      : []
  function orders(rows: readonly { applicationOrder?: number }[], count: number): number[] {
    if (!independent || count === 0) return []
    const first = nextCombatDotApplicationOrder(rows)
    if (!Number.isSafeInteger(first + count - 1))
      throw new RangeError('Copied DoT application orders have reached the safe integer limit.')
    return Array.from({ length: count }, (_, index) => first + index)
  }
  const poisonOrders = orders(persistentDots.poison, poisonDonors.length)
  const burnOrders = orders(persistentDots.burn, burnDonors.length)
  const poisons: PoisonCopy[] = poisonDonors.map((donor, index) => ({
    donor,
    previous: independent ? undefined : (currentPoisonInstance(state, receiverId) ?? undefined),
    ...(independent ? { applicationOrder: poisonOrders[index] } : {}),
  }))
  const burns: BurnCopy[] = burnDonors.map((donor, index) => ({
    donor,
    previous: independent ? undefined : (currentBurnInstance(state, receiverId) ?? undefined),
    ...(independent ? { applicationOrder: burnOrders[index] } : {}),
  }))
  const poison = poisons[0]
  const burn = burns[0]
  const bleed = planBleedCopies(state, donorId, receiverId, effect.mode)
  const persistent = normalizeCombatEffectState(state.effectState)
  let barrierCapacity =
    effect.beneficialEffects === true
      ? Math.max(
          0,
          (state.tactical.battle.combatants.find((row) => row.id === receiverId)?.maxHp ?? 0) -
            currentBarrierAmount(state, receiverId),
        )
      : 0
  let barrierTotal = BigInt(currentBarrierAmount(state, receiverId))
  let nextBarrierOrder: number | undefined
  const barriers =
    effect.beneficialEffects === true
      ? (persistent.barriers ?? [])
          .filter((row) => row.targetCombatantId === donorId && row.amount > 0)
          .sort(
            (left, right) =>
              left.sourceActionId.localeCompare(right.sourceActionId) ||
              left.sourceCombatantId.localeCompare(right.sourceCombatantId) ||
              (left.applicationOrder ?? 0) - (right.applicationOrder ?? 0),
          )
          .map((donor, index) => {
            const appliedAmount = independent
              ? donor.amount
              : Math.min(donor.amount, barrierCapacity)
            if (independent) {
              barrierTotal += BigInt(appliedAmount)
              if (barrierTotal > BigInt(Number.MAX_SAFE_INTEGER))
                throw new RangeError('Copied Barrier total exceeds the safe integer range.')
              nextBarrierOrder ??= nextCombatDotApplicationOrder(persistent.barriers ?? [])
              if (!Number.isSafeInteger(nextBarrierOrder + index))
                throw new RangeError(
                  'Copied Barrier application order exceeds the safe integer range.',
                )
            } else barrierCapacity -= appliedAmount
            return {
              donor,
              appliedAmount,
              ...(independent ? { applicationOrder: nextBarrierOrder! + index } : {}),
              previous: independent
                ? undefined
                : persistent.barriers?.find(
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
            previous: independent
              ? undefined
              : persistent.ongoingRecovery.find(
                  (row) =>
                    row.targetCombatantId === receiverId &&
                    row.kind === donor.kind &&
                    row.sourceActionId === donor.sourceActionId,
                ),
          }))
      : []
  return { receiverId, copies, poison, burn, poisons, burns, bleed, barriers, recovery }
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
  const { receiverId, copies, poisons, burns, bleed, barriers, recovery } = planCombatStatusCopies(
    state,
    actorId,
    selectedId,
    effect,
    content,
  )
  if (
    copies.length === 0 &&
    poisons.length === 0 &&
    burns.length === 0 &&
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
  const independent = usesUnlimitedCombatEffectStacking(state)
  const nextPoisons: CombatPoisonInstance[] = poisons.map((copy) => ({
    targetCombatantId: receiverId,
    sourceCombatantId: actorId,
    sourceActionId: actionId,
    profileVersion: copy.donor.profileVersion,
    movementRemainder: copy.previous?.movementRemainder ?? copy.donor.movementRemainder,
    ...(copy.applicationOrder !== undefined ? { applicationOrder: copy.applicationOrder } : {}),
    ...(independent && copy.donor.damagePerTick !== undefined
      ? { damagePerTick: copy.donor.damagePerTick }
      : {}),
    ...(independent && copy.donor.remainingTicks !== undefined
      ? { remainingTicks: copy.donor.remainingTicks }
      : {}),
    curseCopyable: true,
  }))
  const nextBurns: CombatBurnInstance[] = burns.map((copy) => ({
    targetCombatantId: receiverId,
    sourceCombatantId: actorId,
    sourceActionId: actionId,
    profileVersion: copy.donor.profileVersion,
    stage: copy.previous ? 0 : copy.donor.stage,
    ...(copy.applicationOrder !== undefined ? { applicationOrder: copy.applicationOrder } : {}),
    ...(independent && copy.donor.basePower !== undefined
      ? { basePower: copy.donor.basePower }
      : {}),
    ...(independent && copy.donor.remainingTicks !== undefined
      ? { remainingTicks: copy.donor.remainingTicks }
      : {}),
    curseCopyable: true,
  }))
  const effectState =
    nextPoisons.length || nextBurns.length
      ? normalizeCombatEffectState(state.effectState)
      : undefined
  const nextEffectState = effectState
    ? {
        ...effectState,
        ...(nextPoisons.length
          ? {
              poison: [
                ...effectState.poison.filter(
                  (row) => independent || row.targetCombatantId !== receiverId,
                ),
                ...nextPoisons,
              ].sort(compareCombatDotApplications),
            }
          : {}),
        ...(nextBurns.length
          ? {
              burn: [
                ...effectState.burn.filter(
                  (row) => independent || row.targetCombatantId !== receiverId,
                ),
                ...nextBurns,
              ].sort(compareCombatDotApplications),
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
  for (const { donor, applicationOrder } of barriers) {
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
              row.sourceActionId !== donor.sourceActionId ||
              (independent && row.applicationOrder !== applicationOrder)
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
      ...nextPoisons.map((row, index) => ({
        effectType: 'copy-statuses' as const,
        combatantId: receiverId,
        before: poisons[index]?.previous
          ? `poison:${poisons[index]!.previous!.movementRemainder}`
          : 'none',
        after: `poison:${row.movementRemainder}`,
      })),
      ...nextBurns.map((row, index) => ({
        effectType: 'copy-statuses' as const,
        combatantId: receiverId,
        before: burns[index]?.previous ? `burn:${burns[index]!.previous!.stage}` : 'none',
        after: `burn:${row.stage}`,
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
  const { receiverId, copies, poison, burn, poisons, burns, bleed, barriers, recovery } =
    planCombatStatusCopies(before, actorId, selectedId, effect, content)
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
          if (usesUnlimitedCombatEffectStacking(before)) {
            const index = barriers.findIndex(
              (copy) => copy.applicationOrder === row.applicationOrder,
            )
            const copy = barriers[index]
            return copy
              ? {
                  ...row,
                  provenance: copiedProvenance(copy.donor, undefined, copies.length + index),
                }
              : row
          }
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
        ongoingRecovery: (() => {
          const prior = new Set(normalizeCombatEffectState(before.effectState).ongoingRecovery)
          const usedCopies = new Set<number>()
          return persistent.ongoingRecovery.map((row) => {
            if (
              row.targetCombatantId !== receiverId ||
              row.sourceCombatantId !== actorId ||
              (usesUnlimitedCombatEffectStacking(before) && prior.has(row))
            )
              return row
            const index = recovery.findIndex(
              (copy, candidateIndex) =>
                !usedCopies.has(candidateIndex) &&
                copy.donor.kind === row.kind &&
                copy.donor.sourceActionId === row.sourceActionId &&
                (!usesUnlimitedCombatEffectStacking(before) ||
                  (copy.donor.amountPerTick === row.amountPerTick &&
                    copy.donor.remainingFutureTicks === row.remainingFutureTicks)),
            )
            const copy = recovery[index]
            if (!copy) return row
            usedCopies.add(index)
            return {
              ...row,
              provenance: copiedProvenance(
                copy.donor,
                copy.previous,
                copies.length + barriers.length + index,
              ),
            }
          })
        })(),
      },
    }
  }
  if (!poison && !burn && bleed.length === 0) return { ...after, statusState }
  const dotProvenance = (copy: PoisonCopy | BurnCopy, copyOrdinal: number) =>
    createCombatEffectInstanceProvenance({
      action: context.provenance,
      targetCombatantId: receiverId,
      effectOrdinal: 0,
      copyOrdinal,
      createdRound: before.tactical.battle.round,
      createdTurn: before.tactical.battle.turnNumber,
      copiedFromInstanceId: copy.donor.provenance?.instanceId,
      inheritedFromInstanceId: copy.previous?.provenance?.instanceId,
    })
  const bleedBaseOrdinal = copies.length + poisons.length + burns.length
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
      poison: effectState.poison.map((entry) => {
        const index = poisons.findIndex((copy) => copy.applicationOrder === entry.applicationOrder)
        const copy = poisons[index]
        return copy && entry.targetCombatantId === receiverId && entry.sourceCombatantId === actorId
          ? { ...entry, provenance: dotProvenance(copy, copies.length + index) }
          : entry
      }),
      burn: effectState.burn.map((entry) => {
        const index = burns.findIndex((copy) => copy.applicationOrder === entry.applicationOrder)
        const copy = burns[index]
        return copy && entry.targetCombatantId === receiverId && entry.sourceCombatantId === actorId
          ? { ...entry, provenance: dotProvenance(copy, copies.length + poisons.length + index) }
          : entry
      }),
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
