import type { AbilityBehavior, AbilityEffect } from '@aurevane/game-core/combat/combat-definition'
import {
  reconcileAuthoredEffectDependencies,
  retireAuthoredFrozenGround,
  hasSharedGroundAim,
} from './combat-effect-dependencies'

/** Keep conditions, timing, notes and ground references on the row that owns them. */
export function withAbilityEffectDependencies(
  previous: AbilityBehavior,
  next: AbilityBehavior,
): AbilityBehavior {
  const sources = new Map<AbilityEffect['payload'], AbilityEffect[]>()
  for (const row of next.effects)
    sources.set(row.payload, [...(sources.get(row.payload) ?? []), row])
  const payloads = reconcileAuthoredEffectDependencies(
    previous.effects.map((row) => row.payload),
    next.effects.map((row) => row.payload),
    {
      inheritedGround: hasSharedGroundAim(next.targeting),
      onLinked: (source, linked) => {
        const rows = sources.get(source)
        if (rows) sources.set(linked, rows)
      },
    },
  )
  const used = new Set(next.effects.map((row) => row.id))
  const retainedRows = new Set<AbilityEffect>()
  const effects: AbilityEffect[] = payloads.map((payload) => {
    const row = sources.get(payload)?.find((candidate) => !retainedRows.has(candidate))
    if (row) {
      retainedRows.add(row)
      return row.payload === payload ? row : { ...row, payload }
    }
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
    const owner = linkedTerrain ? sources.get(linkedTerrain)?.[0] : undefined
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
    const replacements = retireAuthoredFrozenGround(
      next.effects.map((row) => row.payload),
      { inheritedGround: hasSharedGroundAim(next.targeting) },
    ).replacements
    const replacementIds = new Map(
      next.effects.flatMap((row) => {
        const replacement = replacements.get(row.payload)
        const retained = replacement
          ? effects.find((effect) => effect.payload === replacement)
          : undefined
        return retained ? [[row.id, retained.id] as const] : []
      }),
    )
    const priorIds = new Set(previous.effects.map((row) => row.id))
    const ids = [
      ...new Set(
        result.groundArea.entryEffectIds
          .map((id) => replacementIds.get(id) ?? id)
          .filter((id) => effects.some((row) => row.id === id) || !priorIds.has(id)),
      ),
    ]
    if (ids.length)
      reconciled = {
        ...result,
        groundArea: {
          ...result.groundArea,
          entryEffectIds: ids,
          ...(replacements.size ? { contactPolicyVersion: 1 as const } : {}),
        },
      }
    else {
      const { groundArea: removed, ...rest } = result
      void removed
      reconciled = rest
    }
  }
  return JSON.stringify(reconciled) === JSON.stringify(next) ? next : reconciled
}
