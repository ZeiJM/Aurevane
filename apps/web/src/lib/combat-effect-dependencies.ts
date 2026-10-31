/** Persisted editor links describe generated companions; combat never infers mechanics from them. */
interface DependencyEffect {
  readonly type: string
  readonly recipient?: string
  readonly target?: string
  readonly amount?: number
  readonly statusId?: string
  readonly authoringLink?: string
  readonly damageProfile?: { readonly kind: string }
  readonly vengeance?: unknown
  readonly applicationOrigin?: 'frozen-ground'
}
const attackModifier = (value: DependencyEffect) =>
  ['weak-point', 'spike', 'ruin'].includes(value.type)
const requiresDamage = (value: DependencyEffect) =>
  (['burn', 'bleed', 'poison'].includes(value.type) &&
    value.damageProfile?.kind === 'attack-percentage') ||
  attackModifier(value)
const damage = (value: DependencyEffect) =>
  ['damage', 'pierce'].includes(value.type) &&
  value.vengeance === undefined &&
  (value.amount ?? 0) > 0 &&
  value.recipient !== 'actor'
const same = (a: DependencyEffect, b: DependencyEffect) =>
  a === b || JSON.stringify(a) === JSON.stringify(b)
function covers(hit: DependencyEffect, effect: DependencyEffect): boolean {
  if (!damage(hit)) return false
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
/** Apply only to a deliberate edit. Saved history is never reconciled on read. */
export function reconcileAuthoredEffectDependencies<T extends DependencyEffect>(
  previous: readonly T[],
  proposed: readonly T[],
  options: { onLinked?: (source: T, linked: T) => void } = {},
): readonly T[] {
  let next = [...proposed]
  // Removing either member of an existing terrain pair removes its exact partner.
  for (const old of previous) {
    if (!old.authoringLink?.startsWith('frozen-ground.')) continue
    if (!next.some((row) => row.authoringLink === old.authoringLink && row.type === old.type))
      next = next.filter((row) => row.authoringLink !== old.authoringLink)
  }
  // Upgrade only a deliberate edit of an existing generated pair; history is never rewritten.
  next = next.map((effect) => {
    if (
      effect.type !== 'apply-status' ||
      effect.statusId !== 'frozen' ||
      effect.applicationOrigin !== undefined ||
      !effect.authoringLink?.startsWith('frozen-ground.') ||
      !next.some(
        (row) => row.type === 'create-terrain' && row.authoringLink === effect.authoringLink,
      )
    )
      return effect
    const linked = { ...effect, applicationOrigin: 'frozen-ground' as const }
    options.onLinked?.(effect, linked)
    return linked
  })
  // A removed or retargeted Damage must not leave its existing damage-dependent effects silently invalid.
  next = next.filter(
    (effect) =>
      !requiresDamage(effect) ||
      !previous.some((old) => same(old, effect)) ||
      !previous.some((old) => covers(old, effect)) ||
      next.some((hit) => covers(hit, effect)),
  )
  for (const effect of [...next]) {
    if (requiresDamage(effect) && !next.some((hit) => covers(hit, effect))) {
      const hit = {
        type: 'damage',
        recipient: attackModifier(effect) ? 'primary-unit' : effect.recipient,
        amount: 1,
        authoringLink: freshLink('dot-damage', next),
        ...(effect.target && !attackModifier(effect) ? { target: effect.target } : {}),
      } as unknown as T
      next.splice(next.indexOf(effect), 0, hit)
    }
    if (effect.type === 'create-terrain' && !effect.authoringLink?.startsWith('frozen-ground.')) {
      const link = freshLink('frozen-ground', next)
      const linked = { ...effect, target: effect.target ?? 'ground', authoringLink: link }
      options.onLinked?.(effect, linked)
      next[next.indexOf(effect)] = linked
      next.splice(next.indexOf(linked) + 1, 0, {
        type: 'apply-status',
        recipient: 'affected-units',
        target: 'ground',
        statusId: 'frozen',
        applicationOrigin: 'frozen-ground',
        stacks: 1,
        durationTurns: 2,
        authoringLink: link,
      } as unknown as T)
    }
  }
  next = next.filter(
    (effect) =>
      !effect.authoringLink?.startsWith('dot-damage.') ||
      !damage(effect) ||
      next.some((dependency) => requiresDamage(dependency) && covers(effect, dependency)),
  )
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
