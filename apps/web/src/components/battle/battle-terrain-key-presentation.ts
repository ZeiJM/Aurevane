import type { TacticalBattleState } from '@aurevane/game-core/combat/board'
import { PV1F_MOVEMENT_COST_PER_TERRAIN_POINT } from '@aurevane/game-core/combat/pv1f-skills'
import {
  COMBAT_TERRAIN_OVERLAY_DETAILS,
  type CombatTerrainOverlay,
} from '@aurevane/game-core/combat/terrain-overlays'

export type BattleTerrainKeyKind = 'open' | 'rough' | 'elevated' | 'blocked' | 'frozen' | 'steam'
export type BattleTerrainKeySnapshot = {
  tactical: Pick<TacticalBattleState, 'tiles' | 'terrains'>
  terrainOverlays?: readonly CombatTerrainOverlay[]
}

export function battleTerrainName(terrainId: string, elevation = 0): string {
  if (elevation > 0) return 'Elevated ground'
  if (terrainId === 'blocked') return 'Blocked terrain'
  return terrainId.includes('rough') || terrainId.includes('difficult')
    ? 'Difficult terrain'
    : 'Neutral ground'
}

export const BATTLE_TERRAIN_KEY_DETAILS = {
  open: {
    name: 'Neutral ground',
    glyph: '',
    description: `Normal ground costs ${PV1F_MOVEMENT_COST_PER_TERRAIN_POINT} AP and 1 Movement per tile entered. Movement allowance still limits the route.`,
  },
  rough: {
    name: 'Difficult terrain',
    glyph: '',
    description: `Costs ${PV1F_MOVEMENT_COST_PER_TERRAIN_POINT * 2} AP and 1 Movement per tile entered. Check the path preview before moving.`,
  },
  elevated: {
    name: 'Elevated ground',
    glyph: '▲',
    description:
      'The raised ledge marks elevation. The elevation change between adjacent tiles must fit your character’s Jump. Base terrain still determines traversal cost.',
  },
  blocked: {
    name: 'Blocked terrain',
    glyph: '×',
    description:
      'Ordinary movement cannot enter blocked terrain. Check the path preview for legal routes.',
  },
  frozen: {
    name: COMBAT_TERRAIN_OVERLAY_DETAILS.frozen.name,
    glyph: '❄',
    description: `${COMBAT_TERRAIN_OVERLAY_DETAILS.frozen.description} Preserves base terrain and expires after ${COMBAT_TERRAIN_OVERLAY_DETAILS.frozen.roundBoundaries} round boundaries.`,
  },
  steam: {
    name: COMBAT_TERRAIN_OVERLAY_DETAILS.steam.name,
    glyph: '≋',
    description: `${COMBAT_TERRAIN_OVERLAY_DETAILS.steam.description} Only intervening tiles block line of sight. Expires after ${COMBAT_TERRAIN_OVERLAY_DETAILS.steam.roundBoundaries} round boundaries.`,
  },
} as const

/** Project the current board, including live overlays; catalog entries alone do not imply presence. */
export function presentBattleTerrainKeys(
  snapshot: BattleTerrainKeySnapshot,
): BattleTerrainKeyKind[] {
  const present = new Set<BattleTerrainKeyKind>()
  const terrainById = new Map(snapshot.tactical.terrains.map((terrain) => [terrain.id, terrain]))
  const boardPositions = new Set<string>()
  for (const tile of snapshot.tactical.tiles) {
    boardPositions.add(`${tile.position.x}:${tile.position.y}`)
    const terrain = terrainById.get(tile.terrainId)
    if (terrain?.traversalCost === null || tile.terrainId === 'blocked') present.add('blocked')
    else if (battleTerrainName(tile.terrainId) === 'Difficult terrain') present.add('rough')
    else present.add('open')
    if (tile.elevation > 0) present.add('elevated')
  }
  for (const overlay of snapshot.terrainOverlays ?? []) {
    if (
      overlay.remainingRoundBoundaries > 0 &&
      boardPositions.has(`${overlay.position.x}:${overlay.position.y}`)
    ) {
      present.add(overlay.kind)
    }
  }
  return (Object.keys(BATTLE_TERRAIN_KEY_DETAILS) as BattleTerrainKeyKind[]).filter((kind) =>
    present.has(kind),
  )
}
