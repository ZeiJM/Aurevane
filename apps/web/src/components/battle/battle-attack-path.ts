import {
  resolveTargetShapeTiles,
  type CombatTargetSpec,
  type CombatTargetSelection,
} from '@aurevane/game-core/combat/actions'
import {
  resolveCombatTargetFootprint,
  combatCardinalDirections,
  type CombatTargetFootprintBoard,
  type CombatTargetSpatialBoard,
  filterCombatTargetSpatialFootprint,
} from '@aurevane/game-core/combat/combat-targeting-shapes'

export interface BattleTargetAim {
  aimSource: 'implicit' | 'player'
  selection?: CombatTargetSelection
}
interface BattleTargetSpatialContext {
  tactical: Omit<CombatTargetSpatialBoard, 'battle'> & {
    battle: { combatants: readonly { id: string; hp: number; teamId: string }[] }
  }
  actorId?: string
  terrainOverlays?: readonly { kind: string; position: { x: number; y: number } }[]
}

/** Potential coverage never depends on victims, forecast success, or automatic recipient selection. */
export function battleTargetReachTiles(
  tactical: CombatTargetFootprintBoard,
  origin: { x: number; y: number },
  target: CombatTargetSpec,
  selectedAffectedTiles: readonly { x: number; y: number }[] = [],
  aim: BattleTargetAim = { aimSource: 'implicit' },
  spatial?: BattleTargetSpatialContext,
): ReadonlySet<string> {
  const result = new Set<string>()
  const add = (positions: readonly { x: number; y: number }[]) => {
    for (const tile of positions) result.add(`${tile.x}:${tile.y}`)
  }
  const footprint = (selection: CombatTargetSelection, spec = target) => {
    const positions = resolveCombatTargetFootprint(tactical, origin, spec, selection)
    if (!spatial) return positions
    if (spec.geometryVersion === 2 && spec.shape.kind !== 'single')
      return filterCombatTargetSpatialFootprint(
        spatial.tactical,
        origin,
        spec,
        positions,
        spatial.terrainOverlays,
      )
    // Historical area methods validate the endpoint, then keep their historical footprint.
    const endpoint =
      selection.kind === 'tile' ? selection.position : selection.kind === 'self' ? origin : null
    return endpoint &&
      filterCombatTargetSpatialFootprint(
        spatial.tactical,
        origin,
        spec,
        [endpoint],
        spatial.terrainOverlays,
      ).length
      ? positions
      : []
  }
  if (
    target.kind === 'ground-tile' &&
    target.shape.kind === 'single' &&
    aim.aimSource === 'player' &&
    aim.selection?.kind === 'tile'
  ) {
    const distance =
      Math.abs(aim.selection.position.x - origin.x) + Math.abs(aim.selection.position.y - origin.y)
    if (distance >= target.minimumRange && distance <= target.maximumRange)
      add(footprint(aim.selection))
    return result
  }
  if (target.geometryVersion === 2 && target.shape.kind !== 'single') {
    const selections: readonly CombatTargetSelection[] =
      target.shape.kind === 'line'
        ? aim.aimSource === 'player' && aim.selection?.kind === 'direction'
          ? [aim.selection]
          : combatCardinalDirections.map((direction) => ({ kind: 'direction', direction }))
        : [{ kind: 'activate' }]
    for (const selection of selections) add(footprint(selection))
    if (target.shape.kind === 'all' && target.kind === 'unit' && spatial) {
      const actor = spatial.tactical.battle.combatants.find(
        (unit) =>
          unit.id ===
          (spatial.actorId ??
            spatial.tactical.placements.find(
              (placement) => placement.position.x === origin.x && placement.position.y === origin.y,
            )?.combatantId),
      )
      const eligible = new Set(
        spatial.tactical.placements
          .filter((placement) => {
            const unit = spatial.tactical.battle.combatants.find(
              (unit) => unit.id === placement.combatantId,
            )
            if (!actor || !unit || unit.hp <= 0) return false
            const ally = actor.teamId === unit.teamId
            const teamAllowed =
              target.teamPolicy === 'any' ||
              (target.teamPolicy === 'self'
                ? unit.id === actor.id
                : target.teamPolicy === 'ally'
                  ? ally
                  : !ally)
            const friendlyAllowed =
              target.friendlyFire === 'all-units' ||
              (target.friendlyFire === 'all-except-actor'
                ? unit.id !== actor.id
                : target.friendlyFire === 'allies-only'
                  ? ally
                  : !ally)
            return teamAllowed && friendlyAllowed
          })
          .map((placement) => `${placement.position.x}:${placement.position.y}`),
      )
      for (const key of result) if (!eligible.has(key)) result.delete(key)
    }
    return result
  }
  // Historical destination-based shapes retain explicit endpoint behavior only for a player aim.
  if (
    aim.aimSource === 'player' &&
    target.shape.kind !== 'single' &&
    selectedAffectedTiles.length
  ) {
    add(selectedAffectedTiles)
    return result
  }
  for (const tile of tactical.tiles) {
    const distance = Math.abs(tile.position.x - origin.x) + Math.abs(tile.position.y - origin.y)
    if (distance < target.minimumRange || distance > target.maximumRange) continue
    if (target.kind === 'self' && distance !== 0) continue
    add(
      spatial
        ? footprint(
            target.kind === 'self' ? { kind: 'self' } : { kind: 'tile', position: tile.position },
            target.kind === 'unit' ? { ...target, kind: 'ground-tile' } : target,
          )
        : resolveTargetShapeTiles(tactical, origin, tile.position, target.shape),
    )
  }
  return result
}

export function battleActionDealsDamage(effects: readonly { type: string }[]) {
  return effects.some((effect) => ['damage', 'burn', 'bleed', 'poison'].includes(effect.type))
}

/** Red is reserved for damage; buffs, healing and terrain share the same potential geometry. */
export function battleAttackReachTiles(
  tactical: CombatTargetFootprintBoard,
  origin: { x: number; y: number },
  target: CombatTargetSpec,
  effects: readonly { type: string }[],
  selectedAffectedTiles: readonly { x: number; y: number }[] = [],
  aim: BattleTargetAim = { aimSource: 'implicit' },
  spatial?: BattleTargetSpatialContext,
): ReadonlySet<string> {
  return battleActionDealsDamage(effects)
    ? battleTargetReachTiles(tactical, origin, target, selectedAffectedTiles, aim, spatial)
    : new Set<string>()
}
