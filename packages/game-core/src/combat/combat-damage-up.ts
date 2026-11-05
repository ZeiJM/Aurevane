/** Optional captured scope: absence preserves historical All Damage. */
export const DAMAGE_UP_TYPES = ['pierce', 'fire', 'water', 'ice', 'storm'] as const
export type DamageUpType = (typeof DAMAGE_UP_TYPES)[number]
export interface DamageUpScope {
  readonly damageTypes?: readonly DamageUpType[]
}
export function validateDamageUpTypes(value: unknown): void {
  if (value === undefined) return
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > DAMAGE_UP_TYPES.length ||
    new Set(value).size !== value.length ||
    value.some((type) => !DAMAGE_UP_TYPES.includes(type))
  )
    throw new TypeError('Choose distinct Damage Up types: Pierce, Fire, Water, Ice or Storm.')
}
export function damageUpTypeSummary(types?: readonly DamageUpType[]): string {
  return types === undefined
    ? 'All Damage'
    : types.map((type) => type[0]!.toUpperCase() + type.slice(1)).join(' / ')
}
/** A packet matches once even if its retained element and piercing identity both match. */
export function damageUpMatchesPacket(
  scope: DamageUpScope & { readonly elementFilter?: string },
  element?: string,
  piercing = false,
): boolean {
  if (scope.damageTypes !== undefined)
    return (
      (piercing && scope.damageTypes.includes('pierce')) ||
      scope.damageTypes.some((type) => type !== 'pierce' && type === element)
    )
  return scope.elementFilter === undefined || scope.elementFilter === element
}
