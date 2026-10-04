import { attachCombatStatusCopyProvenance } from './combat-status-copy'
import { combatEffectTimingMode, combatEffectTimingTag } from './combat-effect-timing'
import type {
  CombatActionDefinition,
  CombatContentCatalog,
  CombatEncounterState,
  CombatResolutionContext,
} from './actions'
import type { CombatActionEvaluation, CombatEffectRecipient } from './actions-legacy'
import { normalizeCombatEffectState } from './combat-effect-state'
import { usesUnlimitedCombatEffectStacking } from './combat-dots'
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

function bleedStackIdentity(stack: {
  targetCombatantId: string
  applicationOrder: number
}): string {
  return JSON.stringify([stack.targetCombatantId, stack.applicationOrder])
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
): CombatEncounterState {
  if (!evaluation.actorId) return after
  const copyEffect = action.effects[0]
  let provenanceAfter = after
  if (copyEffect?.type === 'copy-statuses' && evaluation.primaryCombatantId) {
    if (!content) throw new TypeError('Copied status provenance requires its pinned catalog.')
    if (
      copyEffect.beneficialEffects === true &&
      combatEffectTimingMode(
        before.effectTimingPolicy,
        action.effectTimingTags?.[0] ?? combatEffectTimingTag(copyEffect),
      ) === 'next-round'
    ) {
      provenanceAfter = {
        ...after,
        pendingEffects: after.pendingEffects?.map((pending, index) =>
          index >= (before.pendingEffects?.length ?? 0) &&
          pending.effect.type === 'copy-statuses' &&
          pending.effect.beneficialEffects === true &&
          pending.actorId === evaluation.actorId &&
          pending.actionId === action.id
            ? { ...pending, copyProvenance: { ...context.provenance } }
            : pending,
        ),
      }
    } else
      provenanceAfter = attachCombatStatusCopyProvenance(
        before,
        after,
        evaluation.actorId,
        evaluation.primaryCombatantId,
        copyEffect,
        content,
        context,
      )
  }

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
      effectOrdinal,
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
  if (independent) {
    for (const [effectOrdinal, effect] of action.effects.entries()) {
      if (
        combatEffectTimingMode(
          before.effectTimingPolicy,
          action.effectTimingTags?.[effectOrdinal] ?? combatEffectTimingTag(effect),
        ) === 'next-round'
      )
        continue
      const kinds =
        effect.type === 'remove-status'
          ? effect.statusIds.filter(
              (id): id is 'poison' | 'burn' => id === 'poison' || id === 'burn',
            )
          : effect.type === 'poison' || effect.type === 'burn'
            ? [effect.type]
            : effect.type === 'barrier-change'
              ? ['barrier' as const]
              : createsRecoverySchedule(effect)
                ? [effect.type === 'healing' ? ('hp' as const) : ('mp' as const)]
                : []
      if (kinds.length === 0 || effect.recipient === 'affected-tiles') continue
      for (const targetCombatantId of resolveRecipients(evaluation, effect.recipient)) {
        for (const kind of kinds) {
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
    if (effect.type !== 'bleed' && effect.type !== 'remove-status') continue
    const recipients = resolveRecipients(evaluation, effect.recipient)
    if (effect.type === 'remove-status') {
      if (!effect.statusIds.includes('bleed')) continue
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
    if (
      effect.type !== 'apply-status' &&
      effect.type !== 'poison' &&
      effect.type !== 'burn' &&
      effect.type !== 'barrier-change' &&
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
        if (independent) continue
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

  for (const application of independentApplications.values()) {
    const { kind, targetCombatantId, ordinals, cleared } = application
    if (ordinals.length === 0) continue
    if (kind === 'poison' || kind === 'burn' || kind === 'barrier') {
      const prior = new Set(
        (kind === 'barrier' ? (beforeEffects.barriers ?? []) : beforeEffects[kind]).map(
          (row) => row.applicationOrder,
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
            (cleared || !prior.has(row.applicationOrder)),
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

  const beforeBleedIdentities = new Set(beforeEffects.bleed.map(bleedStackIdentity))
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
          (targetWasCleared || !beforeBleedIdentities.has(bleedStackIdentity(stack))),
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
