import type { CombatContentDefinition, CombatContentKind } from '@aurevane/db/combat-content'
import type { CombatEffectDefinition } from '@aurevane/game-core/combat/actions'
import type { AbilityBehavior } from '@aurevane/game-core/combat/combat-definition'
import type { CombatGroundAreaDefinition } from '@aurevane/game-core/combat/combat-ground-areas'
import { withAbilityEffectDependencies } from './combat-ability-effect-dependencies'
import { retireAuthoredFrozenGround, hasSharedGroundAim } from './combat-effect-dependencies'
import { withRemappedGroundEntries } from './combat-ground-entry-authoring'
import { remapAbilityEffectDescriptions } from './combat-damage-authoring'

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/** Detached current drafts only. Published definitions and battle captures remain literal. */
export function combatGroundForAuthoring(
  kind: CombatContentKind,
  definition: CombatContentDefinition,
): CombatContentDefinition {
  if (!['skill', 'essence', 'resonance'].includes(kind)) return definition
  function native(container: Record<string, unknown>, key: string, notes?: unknown) {
    const rows = container[key]
    if (!Array.isArray(rows) || !rows.every((row) => record(row) && typeof row.type === 'string'))
      return { container, notes }
    const currentRows = rows.map(visit) as CombatEffectDefinition[]
    const { effects, replacements } = retireAuthoredFrozenGround(currentRows, {
      inheritedGround: hasSharedGroundAim(container.target),
    })
    if (!replacements.size)
      return {
        container: currentRows.some((row, index) => row !== rows[index])
          ? { ...container, [key]: currentRows }
          : container,
        notes,
      }
    const area = container.groundArea
    const groundArea =
      record(area) &&
      Array.isArray(area.entryEffectOrdinals) &&
      area.entryEffectOrdinals.every(
        (ordinal) => Number.isSafeInteger(ordinal) && ordinal >= 0 && ordinal < rows.length,
      )
        ? (area as unknown as CombatGroundAreaDefinition)
        : undefined
    const remapped = withRemappedGroundEntries(
      { effects: rows as CombatEffectDefinition[], groundArea, target: container.target },
      { effects, groundArea, target: container.target },
    )
    const next = { ...container, [key]: effects }
    if (groundArea) {
      if (remapped.groundArea) next.groundArea = remapped.groundArea
      else delete next.groundArea
    }
    const sources = new Map(currentRows.map((row, index) => [row, index]))
    for (const [source, replacement] of replacements)
      if (!sources.has(replacement)) sources.set(replacement, sources.get(source)!)
    return {
      container: next,
      notes:
        Array.isArray(notes) && notes.length === rows.length
          ? effects.map((effect) => notes[sources.get(effect) ?? -1] ?? null)
          : notes,
    }
  }
  function visit(value: unknown): unknown {
    if (!record(value)) return value
    let next = value
    for (const key of ['skill', 'ability', 'summonProfile', 'profile', 'payload']) {
      const child = visit(value[key])
      if (child !== value[key]) next = { ...next, [key]: child }
    }
    for (const key of ['behaviors', 'abilities']) {
      const rows = value[key]
      if (!Array.isArray(rows)) continue
      const current = rows.map(visit)
      if (current.some((row, index) => row !== rows[index])) next = { ...next, [key]: current }
    }
    if (Array.isArray(next.effects)) {
      const effects = next.effects.map(visit)
      if (effects.some((row, index) => row !== (next.effects as unknown[])[index]))
        next = { ...next, effects }
    }
    if (
      Array.isArray(next.effects) &&
      next.effects.every((row) => record(row) && record(row.payload)) &&
      next.effects.some((row) => row.payload.type === 'create-terrain') &&
      (next.groundArea === undefined ||
        (record(next.groundArea) && Array.isArray(next.groundArea.entryEffectIds)))
    )
      next = withAbilityEffectDependencies(
        next as unknown as AbilityBehavior,
        next as unknown as AbilityBehavior,
      ) as unknown as Record<string, unknown>
    else {
      const converted = native(next, 'effects', next.effectDescriptions)
      next = converted.container
      if (converted.notes !== next.effectDescriptions)
        next = { ...next, effectDescriptions: converted.notes }
    }
    if (record(next.trigger)) {
      for (const key of ['resultEffects', 'payoffEffects']) {
        const converted = native(
          next.trigger as Record<string, unknown>,
          key,
          next.effectDescriptions,
        )
        if (converted.container !== next.trigger) next = { ...next, trigger: converted.container }
        if (converted.notes !== next.effectDescriptions)
          next = { ...next, effectDescriptions: converted.notes }
      }
    }
    if (next.ability !== value.ability && Array.isArray(value.effectDescriptions))
      next = {
        ...next,
        effectDescriptions: remapAbilityEffectDescriptions(
          value.ability,
          next.ability,
          value.effectDescriptions,
        ),
      }
    return next
  }
  return visit(definition) as CombatContentDefinition
}
