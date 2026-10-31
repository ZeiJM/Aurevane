import type { AbilityBehavior, AbilityEffect } from '@aurevane/game-core/combat/combat-definition'
import { reconcileAuthoredEffectDependencies } from './combat-effect-dependencies'

/** Keep conditions, timing, notes and ground references on the row that owns them. */
export function withAbilityEffectDependencies(
  previous: AbilityBehavior,
  next: AbilityBehavior,
): AbilityBehavior {
  const sources = new Map(next.effects.map((row) => [row.payload, row]))
  const payloads = reconcileAuthoredEffectDependencies(
    previous.effects.map((row) => row.payload),
    next.effects.map((row) => row.payload),
    {
      onLinked: (source, linked) => {
        const row = sources.get(source)
        if (row) sources.set(linked, row)
      },
    },
  )
  const used = new Set(next.effects.map((row) => row.id))
  const effects: AbilityEffect[] = payloads.map((payload) => {
    const row = sources.get(payload)
    if (row) return row.payload === payload ? row : { ...row, payload }
    const prefix = `auto.${'authoringLink' in payload ? payload.authoringLink : 'effect'}.${payload.type}`
    let id = prefix
    for (let suffix = 1; used.has(id); suffix++) id = `${prefix}.${suffix}`
    used.add(id)
    const linkedTerrain =
      'authoringLink' in payload && payload.authoringLink?.startsWith('frozen-ground.')
        ? payloads.find(
            (candidate) =>
              candidate.type === 'create-terrain' &&
              'authoringLink' in candidate &&
              candidate.authoringLink === payload.authoringLink,
          )
        : undefined
    const owner = linkedTerrain ? sources.get(linkedTerrain) : undefined
    return {
      id,
      payload,
      ...(owner?.requirements ? { requirements: owner.requirements } : {}),
      ...(owner?.timing ? { timing: owner.timing } : {}),
    }
  })
  let result: AbilityBehavior = {
    ...next,
    effects,
    ...(payloads.some((row) =>
      ['burn', 'bleed', 'poison', 'weak-point', 'spike', 'ruin'].includes(row.type),
    )
      ? { classification: 'attack' as const, attackFamily: next.attackFamily ?? 'physical' }
      : {}),
  }
  if (payloads.some((payload) => payload.type === 'reversal')) {
    const prepared = { ...result, classification: 'utility' as const }
    delete prepared.attackFamily
    result = prepared
  }
  let reconciled = result
  if (result.groundArea) {
    const priorIds = new Set(previous.effects.map((row) => row.id))
    const ids = result.groundArea.entryEffectIds.filter(
      (id) => effects.some((row) => row.id === id) || !priorIds.has(id),
    )
    if (ids.length)
      reconciled = { ...result, groundArea: { ...result.groundArea, entryEffectIds: ids } }
    else {
      const { groundArea: removed, ...rest } = result
      void removed
      reconciled = rest
    }
  }
  return JSON.stringify(reconciled) === JSON.stringify(next) ? next : reconciled
}
