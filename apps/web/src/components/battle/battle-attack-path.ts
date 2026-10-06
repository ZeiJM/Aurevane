import { resolveTargetShapeTiles, type CombatTargetSpec } from '@aurevane/game-core/combat/actions'
import type { TacticalBattleState } from '@aurevane/game-core/combat/board'

/** Potential hit tiles are informational: no occupant or forecast is required to show reach. */
export function battleAttackReachTiles(
  tactical: Pick<TacticalBattleState, 'width' | 'height' | 'tiles'>,
  origin: { x: number; y: number },
  target: CombatTargetSpec,
  effects: readonly { type: string }[],
  selectedAffectedTiles: readonly { x: number; y: number }[] = [],
): ReadonlySet<string> {
  const result = new Set<string>()
  if (!effects.some((effect) => ['damage', 'burn', 'bleed', 'poison'].includes(effect.type)))
    return result
  // Aimed area moves display their exact authored footprint, even when it is empty.
  if (target.shape.kind !== 'single' && selectedAffectedTiles.length > 0) {
    for (const tile of selectedAffectedTiles) result.add(`${tile.x}:${tile.y}`)
    return result
  }
  // Without an aim, show the possible footprint in every direction. Use the same shape
  // resolver as combat, including cardinal-only lines and board-clipped circles.
  for (const tile of tactical.tiles) {
    const distance = Math.abs(tile.position.x - origin.x) + Math.abs(tile.position.y - origin.y)
    if (distance < target.minimumRange || distance > target.maximumRange) continue
    if (target.kind === 'self' && distance !== 0) continue
    for (const affected of resolveTargetShapeTiles(tactical, origin, tile.position, target.shape))
      result.add(`${affected.x}:${affected.y}`)
  }
  return result
}
