export const COMBAT_EFFECT_CATEGORIES = Object.freeze([
  'Damage',
  'Healing',
  'Control',
  'Movement',
  'ForcedMovement',
  'Buff',
  'Debuff',
  'DamageOverTime',
  'HealingOverTime',
  'Barrier',
  'Summon',
  'Resource',
  'Stealth',
  'Mark',
  'Terrain',
  'Transformation',
] as const)

export type CombatEffectCategory = (typeof COMBAT_EFFECT_CATEGORIES)[number]

export function validateCombatEffectCategory(value: unknown): asserts value is CombatEffectCategory {
  if (
    typeof value !== 'string' ||
    !COMBAT_EFFECT_CATEGORIES.some((category) => category === value)
  ) {
    throw new TypeError(`Unknown combat effect category: ${String(value)}`)
  }
}
