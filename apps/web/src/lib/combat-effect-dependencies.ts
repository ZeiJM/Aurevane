/** Persisted editor links describe generated companions; combat never infers mechanics from them. */
interface DependencyEffect {
  readonly type: string
  readonly recipient?: string
  readonly target?: string
  readonly amount?: number
  readonly statusId?: string
  readonly authoringLink?: string
  readonly damageProfile?: { readonly kind: string; readonly damageBasis?: 'command-hostile-total' }
  readonly vengeance?: unknown
  readonly applicationOrigin?: 'frozen-ground'
}
const attackModifier = (value: DependencyEffect) =>
  ['weak-point', 'spike', 'ruin'].includes(value.type)
const requiresDamage = (value: DependencyEffect) =>
  (['burn', 'bleed', 'poison'].includes(value.type) &&
    value.damageProfile?.kind === 'attack-percentage') ||
  attackModifier(value)
const damage = (value: DependencyEffect) => ['damage', 'pierce'].includes(value.type)
const same = (a: DependencyEffect, b: DependencyEffect) =>
  a === b || JSON.stringify(a) === JSON.stringify(b)
function covers(hit: DependencyEffect, effect: DependencyEffect): boolean {
  if (
    !damage(hit) ||
    hit.recipient === 'actor' ||
    hit.vengeance !== undefined ||
    (hit.amount ?? 0) <= 0
  )
    return false
  if (attackModifier(effect)) return true
  if (effect.target === 'all' && hit.target !== 'all') return false
  const hitTarget = hit.target === 'ground' ? 'enemy' : hit.target
  const effectTarget = effect.target === 'ground' ? 'enemy' : effect.target
  if (
    hitTarget &&
    effectTarget &&
    hitTarget !== effectTarget &&
    !['all', 'anyone'].includes(hitTarget)
  )
    return false
  return (
    hit.recipient === effect.recipient ||
    (hit.recipient === 'affected-units' && effect.recipient === 'primary-unit')
  )
}
function freshLink(prefix: string, effects: readonly DependencyEffect[]): string {
  let index = 1
  while (effects.some((row) => row.authoringLink === `${prefix}.${index}`)) index++
  return `${prefix}.${index}`
}
/** An omitted packet target inherits Ground only from a Ground-only shared aim. */
export function hasSharedGroundAim(aim: unknown): boolean {
  if (!aim || typeof aim !== 'object') return false
  const value = aim as { kind?: unknown; categories?: unknown }
  return value.categories !== undefined
    ? Array.isArray(value.categories) &&
        value.categories.length === 1 &&
        value.categories[0] === 'ground'
    : value.kind === 'ground-tile'
}
/** Current editing retires the AP terrain packet, never its independently authored companions.
 * The mapping is also used by native ordinals and canonical stable-ID references. */
export function retireAuthoredFrozenGround<T extends DependencyEffect>(
  effects: readonly T[],
  options: { inheritedGround?: boolean } = {},
): {
  effects: readonly T[]
  replacements: ReadonlyMap<T, T>
} {
  const replacements = new Map<T, T>()
  const inheritedTerrain = effects.filter(
    (row) =>
      row.type === 'create-terrain' &&
      row.authoringLink === undefined &&
      (row.target === undefined || row.target === 'ground'),
  )
  const inheritedChilled =
    options.inheritedGround && inheritedTerrain.length === 1
      ? effects.filter(
          (row) =>
            row.type === 'apply-status' &&
            row.statusId === 'frozen' &&
            row.recipient === 'affected-units' &&
            row.target === undefined &&
            row.authoringLink === undefined,
        )
      : []
  const next = effects.flatMap((effect) => {
    if (effect.type !== 'create-terrain') return [effect]
    const companion = effect.authoringLink?.startsWith('frozen-ground.')
      ? effects.find(
          (row) =>
            row.type === 'apply-status' &&
            row.statusId === 'frozen' &&
            row.authoringLink === effect.authoringLink,
        )
      : effect === inheritedTerrain[0] && inheritedChilled.length === 1
        ? inheritedChilled[0]
        : undefined
    const replacement =
      companion ??
      ({
        type: 'apply-status',
        recipient: 'affected-units',
        target: effect.target === 'empty-tile' ? 'ground' : (effect.target ?? 'ground'),
        statusId: 'frozen',
        stacks: 1,
        durationTurns: 2,
        applicationOrigin: 'frozen-ground',
        authoringLink:
          effect.authoringLink ??
          freshLink('frozen-ground', [...effects, ...replacements.values()]),
      } as unknown as T)
    replacements.set(effect, replacement)
    return companion ? [] : [replacement]
  })
  return { effects: replacements.size ? next : effects, replacements }
}
/** Apply only to a deliberate edit. Saved history is never reconciled on read. */
export function reconcileAuthoredEffectDependencies<T extends DependencyEffect>(
  previous: readonly T[],
  proposed: readonly T[],
  options: { onLinked?: (source: T, linked: T) => void; inheritedGround?: boolean } = {},
): readonly T[] {
  const retired = retireAuthoredFrozenGround(proposed, options)
  for (const [source, replacement] of retired.replacements)
    if (!proposed.includes(replacement)) options.onLinked?.(source, replacement)
  let next = [...retired.effects]
  // Deleting the final direct packet removes its dependents; never resurrect the deleted row.
  // Retargeting either packet is independent and keeps the existing dependency satisfied.
  if (previous.some(damage) && !next.some(damage))
    next = next.filter(
      (effect) => !requiresDamage(effect) || !previous.some((old) => same(old, effect)),
    )
  // Earlier editors generated one companion per target. Explicit authoring links are the only
  // evidence that a packet is generated: independently authored hits are never deduplicated.
  const generated = (effect: DependencyEffect) =>
    damage(effect) && effect.authoringLink?.startsWith('dot-damage.')
  const independentHit = next.some((effect) => damage(effect) && !generated(effect))
  let retainedGenerated = false
  next = next.filter((effect) => {
    if (!generated(effect)) return true
    if (independentHit || retainedGenerated || !next.some(requiresDamage)) return false
    retainedGenerated = true
    return true
  })
  next = next.map((effect) => {
    if (!generated(effect) || (effect.recipient !== 'actor' && effect.target !== 'self'))
      return effect
    const linked = { ...effect, recipient: 'primary-unit', target: 'enemy' }
    options.onLinked?.(effect, linked)
    return linked
  })
  for (const effect of [...next]) {
    if (requiresDamage(effect) && !next.some(damage)) {
      const self = effect.recipient === 'actor'
      const hit = {
        type: 'damage',
        recipient: attackModifier(effect) || self ? 'primary-unit' : effect.recipient,
        amount: 1,
        authoringLink: freshLink('dot-damage', next),
        ...(self && !attackModifier(effect)
          ? { target: 'enemy' }
          : effect.target && !attackModifier(effect)
            ? { target: effect.target }
            : {}),
      } as unknown as T
      next.splice(next.indexOf(effect), 0, hit)
    }
  }
  next = next.map((effect) => {
    if (!requiresDamage(effect) || attackModifier(effect) || !effect.damageProfile) return effect
    const needsCommandBasis = !next.some((hit) => covers(hit, effect))
    if (needsCommandBasis === (effect.damageProfile.damageBasis === 'command-hostile-total'))
      return effect
    const { damageBasis: removed, ...profile } = effect.damageProfile
    void removed
    const linked = {
      ...effect,
      damageProfile: {
        ...profile,
        ...(needsCommandBasis ? { damageBasis: 'command-hostile-total' as const } : {}),
      },
    }
    options.onLinked?.(effect, linked)
    return linked
  })
  return next.length === proposed.length && next.every((row, index) => row === proposed[index])
    ? proposed
    : next
}

/** Reversal prepares a defensive window rather than an offensive packet. */
export function authoredReversalCombinationIssue(
  effects: readonly { readonly type: string }[],
  addedType: string | undefined,
): string | undefined {
  if (!addedType) return undefined
  const reversal = effects.some((effect) => effect.type === 'reversal')
  if (addedType === 'reversal' && reversal) return 'Use one Reversal per preparation.'
  const offensive = [
    'damage',
    'pierce',
    'damage-bonus',
    'burn',
    'bleed',
    'poison',
    'weak-point',
    'spike',
    'ruin',
    'summon',
  ]
  if (
    (addedType === 'reversal' && effects.some((effect) => offensive.includes(effect.type))) ||
    (reversal && offensive.includes(addedType))
  )
    return 'Reversal requires a separate preparation without offensive damage effects.'
  return undefined
}
