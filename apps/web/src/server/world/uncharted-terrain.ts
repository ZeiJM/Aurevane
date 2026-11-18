import 'server-only'
import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { encodeTerrainRows } from '@/world/terrain'
import {
  parseVoidSectorId,
  voidSectorId,
  VOID_REALM_COLUMNS,
  VOID_REALM_ROWS,
} from '@/world/void-realms'
import type { WorldSceneViewport, WorldState, WorldUnchartedTerrain } from '@/world/types'
import { MAP_X, MAP_Y } from '@/components/world/map-projection'
import { resolveSector } from './world-content'
import {
  applyWarpedContinentPhase,
  isWarpedContinentSector,
  warpedContinentSceneIds,
} from './warped-continent'

/** Terrain presentation never writes survey history or expands navigation/presence. */
export function projectUnchartedTerrain(
  state: WorldState,
  viewport?: WorldSceneViewport,
): WorldUnchartedTerrain[] | undefined {
  const active = resolveSector(state.position.sectorId)
  const realm = parseVoidSectorId(state.position.sectorId)
  if (!active?.warpedTheme || active.charted || (!realm && !isWarpedContinentSector(active.id)))
    return
  const column = active.sceneColumn!,
    row = active.sceneRow!
  const width = Math.min(3840, Math.max(1, viewport?.width ?? 1296))
  const height = Math.min(2160, Math.max(1, viewport?.height ?? 944))
  const tile = (width < 600 ? 48 : 64) * 0.35
  // One full sector of halo covers art overhang and approved near-term movement.
  const halfWidth = width / tile / 2 + GRID_WIDTH * MAP_X
  const halfHeight = height / tile / 2 + (GRID_WIDTH + GRID_HEIGHT) * MAP_Y
  const radius = Math.min(
    16,
    Math.ceil((halfWidth / (2 * MAP_X) + halfHeight / (2 * MAP_Y)) / GRID_HEIGHT) + 2,
  )
  const ids = realm
    ? Array.from({ length: (radius * 2 + 1) ** 2 }, (_, index) => {
        const c = column + (index % (radius * 2 + 1)) - radius
        const r = row + Math.floor(index / (radius * 2 + 1)) - radius
        return c >= 0 && c < VOID_REALM_COLUMNS && r >= 0 && r < VOID_REALM_ROWS
          ? [voidSectorId(realm.realmId, c, r)]
          : []
      }).flat()
    : warpedContinentSceneIds(active.id, radius)
  const anchor = {
    x: column * GRID_WIDTH + state.position.x + 0.5,
    y: row * GRID_HEIGHT + state.position.y + 0.5,
  }
  const buffer: WorldUnchartedTerrain[] = []
  for (const id of ids) {
    // Cull cheap addresses before generating any terrain outside the painted window.
    const generated = parseVoidSectorId(id)
    const expanse = /^uncharted-expanse:(\d+):(\d+)$/.exec(id)
    const authored = !generated && !expanse ? resolveSector(id) : null
    const c = generated?.column ?? (expanse ? Number(expanse[1]) : authored?.sceneColumn)
    const r = generated?.row ?? (expanse ? Number(expanse[2]) : authored?.sceneRow)
    if (c === undefined || r === undefined) continue
    const dx = c * GRID_WIDTH - anchor.x
    const dy = r * GRID_HEIGHT - anchor.y
    const x = (dx - dy) * MAP_X,
      y = (dx + dy) * MAP_Y
    if (
      x - GRID_HEIGHT * MAP_X > halfWidth ||
      x + GRID_WIDTH * MAP_X < -halfWidth ||
      y > halfHeight ||
      y + (GRID_WIDTH + GRID_HEIGHT) * MAP_Y < -halfHeight
    )
      continue
    const sector = authored ?? resolveSector(id)
    if (!sector?.warpedTheme) continue
    const painted = applyWarpedContinentPhase(state, sector)
    buffer.push([
      id,
      encodeTerrainRows(painted.rows),
      painted.regionId,
      c,
      r,
      painted.warpedTheme!,
      painted.landscape ?? null,
    ])
  }
  return buffer.slice(0, 512)
}
