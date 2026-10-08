import type { MatureSkillEffectDefinition } from '@aurevane/game-core/combat/mature-skills'

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonical(entry)]),
    )
  return value
}

/** Presentation only: authored execution order and definitions remain untouched. */
export function groupSkillEffects<Effect extends MatureSkillEffectDefinition>(
  effects: readonly Effect[],
  descriptions?: readonly (string | null)[],
) {
  const groups: { effect: Effect; count: number; firstIndex: number }[] = []
  const byIdentity = new Map<string, number>()
  effects.forEach((effect, firstIndex) => {
    const identity = JSON.stringify([canonical(effect), descriptions?.[firstIndex]?.trim() || ''])
    const existing = byIdentity.get(identity)
    if (existing !== undefined) groups[existing]!.count += 1
    else {
      byIdentity.set(identity, groups.length)
      groups.push({ effect, count: 1, firstIndex })
    }
  })
  return groups
}
