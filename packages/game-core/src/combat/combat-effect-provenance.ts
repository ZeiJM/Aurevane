import type {
  CombatActionDefinition,
  CombatEncounterState,
  CombatResolutionContext,
} from './actions'
import type { CombatActionEvaluation, CombatEffectRecipient } from './actions-legacy'
import { normalizeCombatEffectState } from './combat-effect-state'
import { createCombatEffectInstanceProvenance } from './combat-kernel-types'

function resolveRecipients(
  evaluation: CombatActionEvaluation,
  recipient: CombatEffectRecipient,
): readonly string[] {
  if (!evaluation.actorId) return []
  if (recipient === 'actor') return [evaluation.actorId]
  if (recipient === 'primary-unit') {
    return evaluation.primaryCombatantId ? [evaluation.primaryCombatantId] : []
  }
  return evaluation.affectedCombatantIds
}

function createsRecoverySchedule(
  effect: CombatActionDefinition['effects'][number],
): effect is Extract<
  CombatActionDefinition['effects'][number],
  { type: 'healing' | 'resource-change' }
> {
  if (effect.type === 'healing') return (effect.ticks ?? 1) > 1
  return effect.type === 'resource-change' && effect.delta >= 0 && (effect.ticks ?? 1) > 1
}

/**
 * Adds K3 causal identity only after the legacy resolver has committed authoritative state.
 * Historical four-argument execution never calls this function, so old snapshots retain their
 * published shape unless a K3 resolution context explicitly opts in.
 */
export function attachCombatEffectProvenance(
  before: CombatEncounterState,
  after: CombatEncounterState,
  action: CombatActionDefinition,
  evaluation: CombatActionEvaluation,
  context: CombatResolutionContext,
): CombatEncounterState {
  if (!evaluation.actorId) return after

  const actorId = evaluation.actorId
  const createdRound = before.tactical.battle.round
  const createdTurn = before.tactical.battle.turnNumber
  const beforeEffects = normalizeCombatEffectState(before.effectState)
  const afterEffects = normalizeCombatEffectState(after.effectState)

  let statusState = after.statusState
  let ongoingRecovery = afterEffects.ongoingRecovery
  let poison = afterEffects.poison
  let bleed = afterEffects.bleed
  let burn = afterEffects.burn
  let statusChanged = false
  let effectStateChanged = false

  const provenanceFor = (targetCombatantId: string, effectOrdinal: number) =>
    createCombatEffectInstanceProvenance({
      action: context.provenance,
      targetCombatantId,
      effectOrdinal,
      createdRound,
      createdTurn,
    })

  const maximumPriorBleedOrder = beforeEffects.bleed.reduce(
    (maximum, stack) => Math.max(maximum, stack.applicationOrder),
    0,
  )
  let nextBleedOrder = maximumPriorBleedOrder

  for (const [effectOrdinal, effect] of action.effects.entries()) {
    if (
      effect.type !== 'apply-status' &&
      effect.type !== 'poison' &&
      effect.type !== 'bleed' &&
      effect.type !== 'burn' &&
      !createsRecoverySchedule(effect)
    ) {
      continue
    }

    for (const targetCombatantId of resolveRecipients(evaluation, effect.recipient)) {
      const provenance = provenanceFor(targetCombatantId, effectOrdinal)

      if (effect.type === 'apply-status') {
        let updated = false
        statusState = statusState.map((row) => {
          if (row.combatantId !== targetCombatantId) return row
          const statuses = row.statuses.map((status) => {
            if (status.statusId !== effect.statusId) return status
            updated = true
            return { ...status, provenance }
          })
          return updated ? { ...row, statuses } : row
        })
        statusChanged ||= updated
        continue
      }

      if (effect.type === 'poison') {
        let updated = false
        poison = poison.map((instance) => {
          if (
            instance.targetCombatantId !== targetCombatantId ||
            instance.sourceCombatantId !== actorId ||
            instance.sourceActionId !== action.id
          ) {
            return instance
          }
          updated = true
          return { ...instance, provenance }
        })
        effectStateChanged ||= updated
        continue
      }

      if (effect.type === 'burn') {
        let updated = false
        burn = burn.map((instance) => {
          if (
            instance.targetCombatantId !== targetCombatantId ||
            instance.sourceCombatantId !== actorId ||
            instance.sourceActionId !== action.id
          ) {
            return instance
          }
          updated = true
          return { ...instance, provenance }
        })
        effectStateChanged ||= updated
        continue
      }

      if (effect.type === 'bleed') {
        nextBleedOrder += 1
        let updated = false
        bleed = bleed.map((stack) => {
          if (
            stack.applicationOrder !== nextBleedOrder ||
            stack.targetCombatantId !== targetCombatantId ||
            stack.sourceCombatantId !== actorId ||
            stack.sourceActionId !== action.id
          ) {
            return stack
          }
          updated = true
          return { ...stack, provenance }
        })
        effectStateChanged ||= updated
        continue
      }

      const kind = effect.type === 'healing' ? 'hp' : 'mp'
      let updated = false
      ongoingRecovery = ongoingRecovery.map((schedule) => {
        if (
          schedule.kind !== kind ||
          schedule.targetCombatantId !== targetCombatantId ||
          schedule.sourceCombatantId !== actorId ||
          schedule.sourceActionId !== action.id
        ) {
          return schedule
        }
        updated = true
        return { ...schedule, provenance }
      })
      effectStateChanged ||= updated
    }
  }

  if (!statusChanged && !effectStateChanged) return after

  return {
    ...after,
    ...(statusChanged ? { statusState } : {}),
    ...(effectStateChanged
      ? {
          effectState: {
            ...afterEffects,
            ongoingRecovery,
            poison,
            bleed,
            burn,
          },
        }
      : {}),
  }
}
