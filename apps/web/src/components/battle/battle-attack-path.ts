import type { BattleActionPreview } from '@/server/battle/battle-preview-service'

/** Highlight only the affected area of a canonical legal damaging forecast. */
export function battleAttackPathTiles(
  previews: readonly BattleActionPreview[],
  livingCombatants: readonly { id: string; hp: number }[],
  placements: readonly { combatantId: string; position: { x: number; y: number } }[],
): ReadonlySet<string> {
  const tiles = new Set<string>()
  for (const preview of previews) {
    if (
      !preview.legal ||
      !preview.projectedEffects.some(
        (effect) =>
          effect.effectType === 'damage' &&
          preview.affectedCombatantIds.includes(effect.combatantId) &&
          livingCombatants.some((unit) => unit.id === effect.combatantId && unit.hp > 0),
      )
    )
      continue
    for (const tile of preview.affectedTiles) tiles.add(`${tile.x}:${tile.y}`)
    for (const placement of placements)
      if (preview.affectedCombatantIds.includes(placement.combatantId))
        tiles.add(`${placement.position.x}:${placement.position.y}`)
  }
  return tiles
}
