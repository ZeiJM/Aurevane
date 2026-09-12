import type { CombatActionEvaluation, CombatEncounterIssue, CombatEncounterState } from './actions'
import type { GridPosition } from './board'

export type CombatTerrainOverlayKind = 'frozen' | 'steam'
export interface CombatTerrainOverlay {
  kind: CombatTerrainOverlayKind
  position: GridPosition
  remainingRoundBoundaries: number
  sourceCombatantId: string
}
export interface CombatTerrainProjection {
  position: GridPosition
  before: CombatTerrainOverlayKind | null
  after: CombatTerrainOverlayKind | null
  remainingRoundBoundaries: number
}
export type CombatTerrainEvent =
  | ({
      event: 'terrain_overlay_changed'
      actionId: string
      sourceCombatantId: string
    } & CombatTerrainProjection)
  | { event: 'terrain_overlay_expired'; position: GridPosition; kind: CombatTerrainOverlayKind }

export const COMBAT_TERRAIN_OVERLAY_DETAILS = {
  frozen: {
    name: 'Frozen',
    description:
      'Adds 10 AP per entered tile for either team. Airborne ignores this surcharge; Movement allowance is unchanged.',
    additionalApPerTile: 10,
    blocksLineOfSight: false,
    roundBoundaries: 2,
  },
  steam: {
    name: 'Steam',
    description: 'Blocks line of sight through this tile for either team. Preserves base terrain.',
    additionalApPerTile: 0,
    blocksLineOfSight: true,
    roundBoundaries: 2,
  },
} as const

export function terrainOverlayAt(
  state: Pick<CombatEncounterState, 'terrainOverlays'>,
  position: GridPosition,
): CombatTerrainOverlay | null {
  return (
    state.terrainOverlays?.find(
      (overlay) => overlay.position.x === position.x && overlay.position.y === position.y,
    ) ?? null
  )
}

export function validateTerrainOverlays(
  state: CombatEncounterState,
): readonly CombatEncounterIssue[] {
  if (state.terrainOverlays === undefined) return []
  const invalid = [
    {
      field: 'terrainOverlays',
      message:
        'Overlays must occupy distinct board tiles with a known kind, source and one or two remaining round boundaries.',
    },
  ]
  if (
    !Array.isArray(state.terrainOverlays) ||
    state.terrainOverlays.length > state.tactical.tiles.length
  )
    return invalid
  const positions = new Set<string>()
  for (const overlay of state.terrainOverlays) {
    if (
      !overlay ||
      !['frozen', 'steam'].includes(overlay.kind) ||
      !overlay.position ||
      !Number.isSafeInteger(overlay.position.x) ||
      !Number.isSafeInteger(overlay.position.y) ||
      !state.tactical.tiles.some(
        (tile) => tile.position.x === overlay.position.x && tile.position.y === overlay.position.y,
      ) ||
      ![1, 2].includes(overlay.remainingRoundBoundaries) ||
      !state.tactical.battle.combatants.some((unit) => unit.id === overlay.sourceCombatantId)
    )
      return invalid
    const key = `${overlay.position.x},${overlay.position.y}`
    if (positions.has(key)) return invalid
    positions.add(key)
  }
  return []
}

export function setTerrainOverlay(
  state: CombatEncounterState,
  position: GridPosition,
  kind: CombatTerrainOverlayKind,
  sourceCombatantId: string,
  actionId: string,
): { state: CombatEncounterState; events: readonly CombatTerrainEvent[] } {
  const before = terrainOverlayAt(state, position)?.kind ?? null
  const overlay: CombatTerrainOverlay = {
    position: { ...position },
    kind,
    sourceCombatantId,
    remainingRoundBoundaries: COMBAT_TERRAIN_OVERLAY_DETAILS[kind].roundBoundaries,
  }
  return {
    state: {
      ...state,
      terrainOverlays: [
        ...(state.terrainOverlays ?? []).filter(
          (row) => row.position.x !== position.x || row.position.y !== position.y,
        ),
        overlay,
      ].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x),
    },
    events: [
      {
        event: 'terrain_overlay_changed',
        actionId,
        sourceCombatantId,
        position: { ...position },
        before,
        after: kind,
        remainingRoundBoundaries: overlay.remainingRoundBoundaries,
      },
    ],
  }
}

export function expireTerrainOverlays(state: CombatEncounterState): {
  state: CombatEncounterState
  events: readonly CombatTerrainEvent[]
} {
  if (state.terrainOverlays === undefined) return { state, events: [] }
  return {
    state: {
      ...state,
      terrainOverlays: state.terrainOverlays
        .filter((row) => row.remainingRoundBoundaries > 1)
        .map((row) => ({ ...row, remainingRoundBoundaries: row.remainingRoundBoundaries - 1 })),
    },
    events: state.terrainOverlays
      .filter((row) => row.remainingRoundBoundaries === 1)
      .map((row) => ({
        event: 'terrain_overlay_expired',
        kind: row.kind,
        position: { ...row.position },
      })),
  }
}

/** Shared AI values Frozen near opponents and avoids slowing its own team; no hidden information. */
export function terrainOverlayAiUtility(
  state: CombatEncounterState,
  evaluation: CombatActionEvaluation,
): number {
  const actorTeam = state.tactical.battle.combatants.find(
    (unit) => unit.id === evaluation.actorId,
  )?.teamId
  let utility = 0
  for (const terrain of evaluation.projectedTerrain) {
    if (
      terrain.after !== 'frozen' ||
      (terrain.before === terrain.after &&
        terrainOverlayAt(state, terrain.position)?.remainingRoundBoundaries === 2)
    )
      continue
    for (const placement of state.tactical.placements) {
      const unit = state.tactical.battle.combatants.find(
        (unit) => unit.id === placement.combatantId,
      )
      if (!unit || unit.hp <= 0) continue
      const distance =
        Math.abs(placement.position.x - terrain.position.x) +
        Math.abs(placement.position.y - terrain.position.y)
      if (distance <= 1) utility += unit.teamId === actorTeam ? -6 : 6
    }
  }
  return Math.max(-24, Math.min(24, utility))
}
