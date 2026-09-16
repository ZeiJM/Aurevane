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
import { currentBurnInstance, currentPoisonInstance } from './combat-dots'
import {
  normalizeCombatEffectState,
  type CombatBurnInstance,
  type CombatPoisonInstance,
} from './combat-effect-state'
import { createCombatEffectInstanceProvenance } from './combat-kernel-types'

export interface CombatStatusCopyEffect {
  type: 'copy-statuses'
  recipient: 'primary-unit'
  mode: 'amplify' | 'curse'
}

/** Copying is staged as a pure, single-unit command until composition/repeat/AI gates exist. */
export function validateCombatStatusCopyAction(action: CombatActionDefinition): void {
  for (const effect of action.effects) {
    if (effect.type !== 'copy-statuses') continue
    if (
      action.effects.length !== 1 ||
      action.sourceType === 'basic-attack' ||
      action.target.kind !== 'unit' ||
      action.target.shape.kind !== 'single' ||
      effect.recipient !== 'primary-unit' ||
      (effect.mode !== 'amplify' && effect.mode !== 'curse')
    ) {
      throw new TypeError(
        'Status copying requires one pure, single-unit Amplify or Curse operation, never Basic Attack.',
      )
    }
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
): void {
  if (
    instance.statusVersion !== definition.version ||
    !Number.isSafeInteger(instance.stacks) ||
    instance.stacks < 1 ||
    instance.stacks > definition.maximumStacks ||
    !Number.isSafeInteger(instance.remainingOwnerTurnStarts) ||
    instance.remainingOwnerTurnStarts < 1 ||
    instance.remainingOwnerTurnStarts > definition.durationOwnerTurnStarts
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

interface CombatCopyPlan {
  receiverId: string
  copies: readonly StatusCopy[]
  poison: PoisonCopy | undefined
  burn: BurnCopy | undefined
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
  if (donorId === receiverId) return { receiverId, copies: [], poison: undefined, burn: undefined }
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
      // Both inputs are bounded; adding only the remaining capacity avoids unsafe integer sums.
      stacks: previousStacks + Math.min(donor.stacks, definition.maximumStacks - previousStacks),
      remainingOwnerTurnStarts: Math.max(
        donor.remainingOwnerTurnStarts,
        previous?.remainingOwnerTurnStarts ?? 0,
      ),
      sourceCombatantId: actorId,
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
  return { receiverId, copies, poison, burn }
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
  const { receiverId, copies, poison, burn } = planCombatStatusCopies(
    state,
    actorId,
    selectedId,
    effect,
    content,
  )
  if (copies.length === 0 && !poison && !burn)
    throw new Error('Status copying requires eligible active statuses.')
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
  return {
    state: { ...state, statusState, effectState: nextEffectState },
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
  const { receiverId, copies, poison, burn } = planCombatStatusCopies(
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
  if (!poison && !burn) return { ...after, statusState }
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
    },
  }
}
