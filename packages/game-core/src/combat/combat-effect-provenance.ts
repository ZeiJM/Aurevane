import { resolvedCombatRemovalStatusIds } from './combat-status-selection'
import { combatEvaluatedEffectRecipientIds } from './combat-effect-recipients'
import type { CombatResistedEffectOrdinals } from './combat-status-resistance'
import { attachCombatStatusCopyProvenance } from './combat-status-copy'
import { combatEffectTimingMode, combatEffectTimingTag } from './combat-effect-timing'
import type {
  CombatActionDefinition,
  CombatContentCatalog,
  CombatEncounterState,
  CombatResolutionContext,
} from './actions'
import type { CombatActionEvaluation } from './actions-legacy'
import { normalizeCombatEffectState } from './combat-effect-state'
import { usesUnlimitedCombatEffectStacking } from './combat-dots'
import { createCombatEffectInstanceProvenance } from './combat-kernel-types'

function createsRecoverySchedule(
  effect: CombatActionDefinition['effects'][number],
): effect is Extract<
  CombatActionDefinition['effects'][number],
  { type: 'healing' | 'resource-change' | 'percentage-recovery' }
> {
  if (effect.type === 'healing' || effect.type === 'percentage-recovery')
    return (effect.ticks ?? 1) > 1
  return effect.type === 'resource-change' && effect.delta >= 0 && (effect.ticks ?? 1) > 1
}

function dotApplicationIdentity(
  application: {
    targetCombatantId: string
    applicationOrder?: number
    ruinApplicationId?: number
  },
  currentRuin: boolean,
): string {
  // Native order can restart after Ruin consumes the last application. Captured
  // identities distinguish a surviving old application from its new suffix replacement.
  return currentRuin && application.ruinApplicationId !== undefined
    ? JSON.stringify([application.targetCombatantId, 'ruin', application.ruinApplicationId])
    : JSON.stringify([application.targetCombatantId, application.applicationOrder])
}

interface BleedApplication {
  targetCombatantId: string
  effectOrdinal: number
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
  content?: CombatContentCatalog,
  resistedEffectOrdinalsByTarget?: CombatResistedEffectOrdinals,
  settledEffectOrdinals?: ReadonlySet<number>,
  copySourceStates?: ReadonlyMap<number, CombatEncounterState>,
): CombatEncounterState {
  if (!evaluation.actorId) return after
  let provenanceAfter = after

  const independent = usesUnlimitedCombatEffectStacking(before)
  const actorId = evaluation.actorId
  const createdRound = before.tactical.battle.round
  const createdTurn = before.tactical.battle.turnNumber
  const beforeEffects = normalizeCombatEffectState(before.effectState)
  const afterEffects = normalizeCombatEffectState(provenanceAfter.effectState)

  let statusState = provenanceAfter.statusState
  let ongoingRecovery = afterEffects.ongoingRecovery
  let poison = afterEffects.poison
  let bleed = afterEffects.bleed
  let burn = afterEffects.burn
  let barriers = afterEffects.barriers ?? []
  let statusChanged = false
  let effectStateChanged = false

  const provenanceFor = (targetCombatantId: string, effectOrdinal: number) =>
    createCombatEffectInstanceProvenance({
      action: context.provenance,
      targetCombatantId,
      effectOrdinal: action.effectSourceOrdinals?.[effectOrdinal] ?? effectOrdinal,
      createdRound,
      createdTurn,
    })

  const independentApplications = new Map<
    string,
    {
      kind: 'poison' | 'burn' | 'barrier' | 'hp' | 'mp'
      targetCombatantId: string
      ordinals: number[]
      cleared: boolean
    }
  >()
  if (independent || before.dotTriggerPolicyVersion === 2) {
    for (const [effectOrdinal, effect] of action.effects.entries()) {
      if (settledEffectOrdinals && !settledEffectOrdinals.has(effectOrdinal)) continue
      if (
        combatEffectTimingMode(
          before.effectTimingPolicy,
          action.effectTimingTags?.[effectOrdinal] ?? combatEffectTimingTag(effect),
        ) !== 'instant'
      )
        continue
      const kinds =
        effect.type === 'remove-status'
          ? resolvedCombatRemovalStatusIds(effect, content).filter(
              (id): id is 'poison' | 'burn' => id === 'poison' || id === 'burn',
            )
          : effect.type === 'poison' || effect.type === 'burn'
            ? [effect.type]
            : effect.type === 'barrier-change'
              ? ['barrier' as const]
              : createsRecoverySchedule(effect)
                ? [
                    effect.type === 'percentage-recovery'
                      ? effect.resource
                      : effect.type === 'healing'
                        ? ('hp' as const)
                        : ('mp' as const),
                  ]
                : []
      if (kinds.length === 0 || effect.recipient === 'affected-tiles') continue
      for (const targetCombatantId of combatEvaluatedEffectRecipientIds(
        before,
        action,
        evaluation,
        effectOrdinal,
        content,
      )) {
        if (resistedEffectOrdinalsByTarget?.get(targetCombatantId)?.has(effectOrdinal)) continue
        for (const kind of kinds) {
          if (!independent && kind !== 'poison') continue
          const key = JSON.stringify([targetCombatantId, kind])
          const application = independentApplications.get(key) ?? {
            kind,
            targetCombatantId,
            ordinals: [],
            cleared: false,
          }
          if (effect.type === 'remove-status') {
            application.ordinals = []
            application.cleared = true
          } else application.ordinals.push(effectOrdinal)
          independentApplications.set(key, application)
        }
      }
    }
  }

  const bleedApplications: BleedApplication[] = []
  const lastBleedClearOrdinalByTarget = new Map<string, number>()
  for (const [effectOrdinal, effect] of action.effects.entries()) {
    if (settledEffectOrdinals && !settledEffectOrdinals.has(effectOrdinal)) continue
    if (effect.type !== 'bleed' && effect.type !== 'remove-status') continue
    const recipients = combatEvaluatedEffectRecipientIds(
      before,
      action,
      evaluation,
      effectOrdinal,
      content,
    ).filter((id) => !resistedEffectOrdinalsByTarget?.get(id)?.has(effectOrdinal))
    if (effect.type === 'remove-status') {
      if (!resolvedCombatRemovalStatusIds(effect, content).includes('bleed')) continue
      for (const targetCombatantId of recipients) {
        lastBleedClearOrdinalByTarget.set(targetCombatantId, effectOrdinal)
      }
      continue
    }
    for (const targetCombatantId of recipients) {
      bleedApplications.push({ targetCombatantId, effectOrdinal })
    }
  }

  for (const [effectOrdinal, effect] of action.effects.entries()) {
    if (settledEffectOrdinals && !settledEffectOrdinals.has(effectOrdinal)) continue
    if (effect.type === 'copy-statuses') {
      if (!content) throw new TypeError('Copied status provenance requires its pinned catalog.')
      const recipient = evaluation.primaryCombatantId
      if (
        !recipient ||
        (action.effectEligibleRecipientIds?.[effectOrdinal] !== undefined &&
          !action.effectEligibleRecipientIds[effectOrdinal]!.includes(recipient)) ||
        resistedEffectOrdinalsByTarget?.get(recipient)?.has(effectOrdinal)
      )
        continue
      const sourceAtCopy = copySourceStates?.get(effectOrdinal) ?? before
      // Earlier applications need their own identity before becoming a Copy donor.
      const priorOrdinals = new Set(
        [...(settledEffectOrdinals ?? action.effects.map((_, ordinal) => ordinal))].filter(
          (ordinal) => ordinal < effectOrdinal,
        ),
      )
      const source =
        effectOrdinal === 0
          ? sourceAtCopy
          : attachCombatEffectProvenance(
              before,
              sourceAtCopy,
              action,
              evaluation,
              context,
              content,
              resistedEffectOrdinalsByTarget,
              priorOrdinals,
            )
      const timing =
        action.effectTimingModes?.[effectOrdinal] ??
        combatEffectTimingMode(
          before.effectTimingPolicy,
          action.effectTimingTags?.[effectOrdinal] ?? combatEffectTimingTag(effect),
        )
      if (timing !== 'instant') {
        provenanceAfter = {
          ...provenanceAfter,
          pendingEffects: provenanceAfter.pendingEffects?.map((pending, index) => {
            if (
              index < (before.pendingEffects?.length ?? 0) ||
              pending.effect.type !== 'copy-statuses' ||
              pending.actorId !== actorId ||
              pending.actionId !== action.id
            )
              return pending
            const donorId = pending.copySource?.combatantId
            const effects = normalizeCombatEffectState(source.effectState)
            return {
              ...pending,
              copyProvenance: { ...context.provenance },
              ...(effectOrdinal > 0 ? { copyEffectOrdinal: effectOrdinal } : {}),
              ...(donorId && pending.copySource
                ? {
                    copySource: {
                      ...pending.copySource,
                      statuses:
                        source.statusState.find((row) => row.combatantId === donorId)?.statuses ??
                        [],
                      effectState: {
                        ...pending.copySource.effectState,
                        poison: effects.poison.filter((row) => row.targetCombatantId === donorId),
                        burn: effects.burn.filter((row) => row.targetCombatantId === donorId),
                        bleed: effects.bleed.filter((row) => row.targetCombatantId === donorId),
                      },
                    },
                  }
                : {}),
            }
          }),
        }
      } else {
        const attributed = attachCombatStatusCopyProvenance(
          source,
          {
            ...provenanceAfter,
            statusState,
            effectState: { ...afterEffects, ongoingRecovery, poison, bleed, burn, barriers },
          },
          actorId,
          recipient,
          effect,
          content,
          context,
          effectOrdinal,
        )
        statusState = attributed.statusState
        const effects = normalizeCombatEffectState(attributed.effectState)
        poison = effects.poison
        burn = effects.burn
        bleed = effects.bleed
        statusChanged = true
        effectStateChanged = true
      }
      continue
    }
    if (
      effect.type !== 'apply-status' &&
      effect.type !== 'poison' &&
      effect.type !== 'burn' &&
      effect.type !== 'barrier-change' &&
      !createsRecoverySchedule(effect)
    ) {
      continue
    }

    for (const targetCombatantId of combatEvaluatedEffectRecipientIds(
      before,
      action,
      evaluation,
      effectOrdinal,
      content,
    )) {
      if (resistedEffectOrdinalsByTarget?.get(targetCombatantId)?.has(effectOrdinal)) continue
      const provenance = provenanceFor(targetCombatantId, effectOrdinal)

      if (effect.type === 'apply-status') {
        let updated = false
        statusState = statusState.map((row) => {
          if (row.combatantId !== targetCombatantId) return row
          const statuses = row.statuses.map((status) => {
            if (
              status.statusId !== effect.statusId ||
              (status.sourceScopedMark === true && status.sourceCombatantId !== actorId)
            )
              return status
            updated = true
            return { ...status, provenance }
          })
          return updated ? { ...row, statuses } : row
        })
        statusChanged ||= updated
        continue
      }

      if (effect.type === 'poison') {
        if (independent || before.dotTriggerPolicyVersion === 2) continue
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
        if (independent) continue
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

      if (effect.type === 'barrier-change') {
        if (independent) continue
        let updated = false
        barriers = barriers.map((instance) => {
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

      if (independent) continue
      const kind =
        effect.type === 'percentage-recovery'
          ? effect.resource
          : effect.type === 'healing'
            ? 'hp'
            : 'mp'
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

  for (const application of independentApplications.values()) {
    const { kind, targetCombatantId, ordinals, cleared } = application
    if (ordinals.length === 0) continue
    if (kind === 'poison' || kind === 'burn' || kind === 'barrier') {
      const prior = new Set(
        (kind === 'barrier' ? (beforeEffects.barriers ?? []) : beforeEffects[kind]).map((row) =>
          kind === 'barrier'
            ? row.applicationOrder
            : dotApplicationIdentity(row, before.ruinPolicyVersion === 1),
        ),
      )
      const rows = kind === 'poison' ? poison : kind === 'burn' ? burn : barriers
      const candidates = rows
        .map((row, index) => ({ row, index }))
        .filter(
          ({ row }) =>
            row.targetCombatantId === targetCombatantId &&
            row.sourceCombatantId === actorId &&
            row.sourceActionId === action.id &&
            row.provenance?.copyOrdinal === undefined &&
            (cleared ||
              !prior.has(
                kind === 'barrier'
                  ? row.applicationOrder
                  : dotApplicationIdentity(row, before.ruinPolicyVersion === 1),
              )),
        )
        .sort((left, right) => (left.row.applicationOrder ?? 0) - (right.row.applicationOrder ?? 0))
      const assignments = new Map(
        candidates.map(({ index }, candidateIndex) => [index, ordinals[candidateIndex]]),
      )
      if (kind === 'poison')
        poison = poison.map((row, index) => {
          const ordinal = assignments.get(index)
          if (ordinal === undefined) return row
          effectStateChanged = true
          return { ...row, provenance: provenanceFor(targetCombatantId, ordinal) }
        })
      else if (kind === 'burn')
        burn = burn.map((row, index) => {
          const ordinal = assignments.get(index)
          if (ordinal === undefined) return row
          effectStateChanged = true
          return { ...row, provenance: provenanceFor(targetCombatantId, ordinal) }
        })
      else
        barriers = barriers.map((row, index) => {
          const ordinal = assignments.get(index)
          if (ordinal === undefined) return row
          effectStateChanged = true
          return { ...row, provenance: provenanceFor(targetCombatantId, ordinal) }
        })
    } else {
      const prior = new Set(beforeEffects.ongoingRecovery)
      let assignedIndex = 0
      ongoingRecovery = ongoingRecovery.map((row) => {
        if (
          row.kind !== kind ||
          row.targetCombatantId !== targetCombatantId ||
          row.sourceCombatantId !== actorId ||
          row.sourceActionId !== action.id ||
          row.provenance?.copyOrdinal !== undefined ||
          prior.has(row)
        )
          return row
        const ordinal = ordinals[assignedIndex++]
        if (ordinal === undefined) return row
        effectStateChanged = true
        return { ...row, provenance: provenanceFor(targetCombatantId, ordinal) }
      })
    }
  }

  const beforeBleedIdentities = new Set(
    beforeEffects.bleed.map((row) => dotApplicationIdentity(row, before.ruinPolicyVersion === 1)),
  )
  const bleedTargets = new Set(
    bleedApplications.map((application) => application.targetCombatantId),
  )
  for (const targetCombatantId of bleedTargets) {
    const lastClearOrdinal = lastBleedClearOrdinalByTarget.get(targetCombatantId)
    const survivingApplications = bleedApplications
      .filter(
        (application) =>
          application.targetCombatantId === targetCombatantId &&
          (lastClearOrdinal === undefined || application.effectOrdinal > lastClearOrdinal),
      )
      .sort((left, right) => right.effectOrdinal - left.effectOrdinal)
    if (survivingApplications.length === 0) continue

    const targetWasCleared = lastClearOrdinal !== undefined
    const candidates = bleed
      .map((stack, index) => ({ stack, index }))
      .filter(
        ({ stack }) =>
          stack.targetCombatantId === targetCombatantId &&
          stack.sourceCombatantId === actorId &&
          stack.sourceActionId === action.id &&
          (targetWasCleared ||
            !beforeBleedIdentities.has(
              dotApplicationIdentity(stack, before.ruinPolicyVersion === 1),
            )),
      )
      .sort((left, right) => right.stack.applicationOrder - left.stack.applicationOrder)

    const assignments = Math.min(survivingApplications.length, candidates.length)
    if (assignments === 0) continue
    const nextBleed = [...bleed]
    for (let index = 0; index < assignments; index += 1) {
      const application = survivingApplications[index]
      const candidate = candidates[index]
      if (!application || !candidate) continue
      nextBleed[candidate.index] = {
        ...candidate.stack,
        provenance: provenanceFor(targetCombatantId, application.effectOrdinal),
      }
    }
    bleed = nextBleed
    effectStateChanged = true
  }

  if (!statusChanged && !effectStateChanged) return provenanceAfter

  return {
    ...provenanceAfter,
    ...(statusChanged ? { statusState } : {}),
    ...(effectStateChanged
      ? {
          effectState: {
            ...afterEffects,
            ongoingRecovery,
            poison,
            bleed,
            burn,
            barriers,
          },
        }
      : {}),
  }
}
