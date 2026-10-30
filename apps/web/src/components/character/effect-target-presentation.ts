import type { CombatTargetSpec } from '@aurevane/game-core/combat/actions'
import type { CombatEffectTarget } from '@aurevane/game-core/combat/combat-effect-recipients'
import { combatTargetCategories } from '@aurevane/game-core/combat/combat-targeting-shapes'
import { combatTargetIncludesActor } from '@aurevane/game-core/combat/gameplay-tags'

export const EFFECT_TARGET_LABELS: Record<CombatEffectTarget, string> = {
  self: 'Self',
  ally: 'Ally',
  enemy: 'Enemy',
  anyone: 'Anyone',
  all: 'All',
  ground: 'Ground',
  'empty-tile': 'Empty Tile',
}

/** Read only the authored/captured packet and its own delivery, never today's catalogue. */
export function effectTargetLabel(
  effect: { type: string; recipient?: string; target?: CombatEffectTarget },
  aim?: CombatTargetSpec,
): string {
  if (effect.type === 'move') return 'Ground'
  if (effect.target) return EFFECT_TARGET_LABELS[effect.target]
  if (effect.recipient === 'actor') return 'Self'
  if (effect.type === 'summon') return 'Empty Tile'
  if (effect.recipient === 'affected-tiles' || effect.recipient === 'selected-tile') return 'Ground'
  if (!aim)
    return effect.recipient === 'primary-unit'
      ? 'Trigger Skill selected unit'
      : 'Trigger Skill affected units'
  if (effect.recipient === 'primary-unit') {
    if (aim.geometryVersion === 3)
      return (
        combatTargetCategories(aim)
          .filter((category) => category !== 'ground')
          .map((category) => EFFECT_TARGET_LABELS[category])
          .join(' / ') || 'Selected unit'
      )
    if (aim.kind === 'self' || aim.teamPolicy === 'self') return 'Self'
    if (aim.teamPolicy === 'enemy') return 'Enemy'
    if (aim.teamPolicy === 'ally') return combatTargetIncludesActor(aim) ? 'Self / Ally' : 'Ally'
    return 'Anyone'
  }
  const mask =
    aim.friendlyFire === 'enemies-only'
      ? ['enemy']
      : aim.friendlyFire === 'allies-only'
        ? ['self', 'ally']
        : aim.friendlyFire === 'all-except-actor'
          ? ['ally', 'enemy']
          : ['self', 'ally', 'enemy']
  let categories: readonly string[] = mask
  if (aim.geometryVersion === 3) {
    const selected = combatTargetCategories(aim)
    categories = ['self', 'ally', 'enemy'].filter(
      (category) =>
        selected.some((value) => value === category) ||
        (category !== 'self' && selected.includes('ground') && mask.includes(category)),
    )
  } else if ((aim.geometryVersion === 2 || aim.shape.kind === 'single') && aim.kind === 'unit') {
    categories = mask.filter(
      (category) =>
        aim.teamPolicy === 'any' ||
        (aim.teamPolicy === 'ally' ? category !== 'enemy' : category === aim.teamPolicy),
    )
  } else if (aim.kind === 'self' && aim.shape.kind === 'single') {
    categories = mask.filter((category) => category === 'self')
  }
  if (aim.geometryVersion === 2 && ['circle', 'line'].includes(aim.shape.kind))
    categories = categories.filter((category) => category !== 'self')
  if (aim.shape.kind === 'single' && aim.kind === 'unit' && !combatTargetIncludesActor(aim))
    categories = categories.filter((category) => category !== 'self')
  if (categories.length === 3) return 'Anyone'
  if (categories.join('/') === 'ally/enemy') return 'Anyone except Self'
  return (
    categories
      .map((category) => EFFECT_TARGET_LABELS[category as 'self' | 'ally' | 'enemy'])
      .join(' / ') || 'No eligible units'
  )
}

/** A shared hostile-area rule supplements, but never replaces, each packet's target. */
export function effectFriendlyFireNote(
  effects: readonly { type: string; target?: CombatEffectTarget }[],
  aim?: CombatTargetSpec,
): string {
  if (
    !aim ||
    !effects.some(
      (effect) =>
        effect.target === 'all' ||
        (aim.shape.kind !== 'single' &&
          ['enemy', 'ground', 'empty-tile'].includes(effect.target ?? '')),
    )
  )
    return ''
  return ` · Friendly fire: ${['all-units', 'all-except-actor'].includes(aim.friendlyFire) ? 'On' : 'Off'}`
}
