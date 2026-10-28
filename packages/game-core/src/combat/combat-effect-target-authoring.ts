import { isCleanseChilledEffect } from './gameplay-tags'
import type { CombatTargetSpec } from './actions'
import { type CombatEffectTarget, validateCombatEffectTarget } from './combat-effect-recipients'

export interface TargetedEffect {
  readonly type: string
  readonly recipient?: string
  readonly target?: CombatEffectTarget
}

/** Only an explicit authoring action changes a recipient. Reading a definition never migrates it. */
export function withAuthoredEffectTarget<T extends TargetedEffect>(
  effect: T,
  target: CombatEffectTarget,
): T & { target: CombatEffectTarget } {
  if ((effect.type === 'damage' || effect.type === 'pierce') && target === 'self')
    throw new TypeError('Direct damage cannot target Self.')
  if (isCleanseChilledEffect(effect) && target !== 'self')
    throw new TypeError('Cleanse Chilled supports only Self.')
  const recipient =
    effect.type === 'summon'
      ? 'selected-tile'
      : effect.type === 'create-terrain'
        ? 'affected-tiles'
        : target === 'self'
          ? 'actor'
          : ['copy-statuses', 'sensory'].includes(effect.type)
            ? 'primary-unit'
            : 'affected-units'
  const next = { ...effect, target, recipient }
  validateCombatEffectTarget(next)
  return next
}

/** One selection/footprint drives explicitly authored recipients. Inherited external packets
 * keep their existing shared aim until the author has assigned every external packet a target.
 * This prevents a newly broadened aim from broadening an untouched historical packet.
 */
export function deriveSharedEffectAim<T extends CombatTargetSpec>(
  current: T,
  effects: readonly TargetedEffect[],
  options: { requiresSelectedUnit?: boolean } = {},
): T {
  if (!effects.some((effect) => effect.target !== undefined)) return current
  if (effects.some((effect) => effect.target === undefined && effect.recipient !== 'actor'))
    return current
  if ((current.maximumSelections ?? 1) > 1)
    throw new TypeError(
      'This retained definition uses multiple selections; its targeting must be reviewed before adopting one shared aim.',
    )
  const targets = new Set(effects.map((effect) => effect.target ?? 'self'))
  const ground = targets.has('ground') || targets.has('empty-tile')
  const categories = (['self', 'ally', 'enemy', 'ground'] as const).filter((category) =>
    category === 'ground'
      ? ground
      : category === 'self'
        ? targets.has('anyone')
        : targets.has(category) || targets.has('anyone'),
  )
  const hasLocalAim = categories.length > 0
  if (!hasLocalAim && options.requiresSelectedUnit) return current
  const shape = !hasLocalAim ? { kind: 'single' as const } : current.shape
  if (hasLocalAim && shape.kind === 'all')
    throw new TypeError(
      'Choose Single, Circle or Line for the shared area; All belongs to each effect target.',
    )
  if (targets.has('empty-tile') && shape.kind !== 'single')
    throw new TypeError('Empty Tile requires a Single shared aim.')
  const reach =
    shape.kind === 'circle'
      ? shape.radius
      : shape.kind === 'line'
        ? shape.length
        : Math.max(1, current.maximumRange)
  return {
    ...current,
    geometryVersion: 3,
    kind: !hasLocalAim
      ? 'self'
      : targets.has('empty-tile')
        ? 'empty-tile'
        : ground &&
            !categories.some(
              (category) => category === 'ally' || category === 'enemy' || category === 'self',
            )
          ? 'ground-tile'
          : 'unit',
    teamPolicy: !hasLocalAim
      ? 'self'
      : categories.length === 1 && categories[0] !== 'ground'
        ? categories[0]!
        : 'any',
    categories: hasLocalAim ? categories : ['self'],
    maximumSelections: 1,
    shape,
    minimumRange:
      !hasLocalAim || shape.kind !== 'single' ? 0 : Math.min(current.minimumRange, reach),
    maximumRange: hasLocalAim ? reach : 0,
    requiresLineOfSight: hasLocalAim ? current.requiresLineOfSight : false,
  }
}

/** Native target prerequisites and canonical selected-subject conditions retain their aim. */
export function hasSelectedAimRequirement(value: unknown, depth = 0): boolean {
  if (!value || typeof value !== 'object') return false
  if (depth > 16) return true
  if (Array.isArray(value))
    return value.some((child) => hasSelectedAimRequirement(child, depth + 1))
  const row = value as Record<string, unknown>
  return (
    row.subject === 'selected' ||
    row.otherSubject === 'selected' ||
    (typeof row.kind === 'string' && row.kind.startsWith('target-')) ||
    Object.values(row).some((child) => hasSelectedAimRequirement(child, depth + 1))
  )
}
