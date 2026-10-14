import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { decodeTerrainRows } from '@/world/terrain'
import { ATLAS_ROWS } from '@/world/topology'
import { isSafe, isWalkable } from '@/world/travel'
import type { WorldScenerySector, WorldSectorView, WorldView } from '@/world/types'

const expandedScenery = new WeakMap<WorldScenerySector, { key: string; sector: WorldSectorView }>()
const contentKeys = new WeakMap<WorldSectorView, string>()
const sceneryKeys = new WeakMap<WorldScenerySector, string>()
const expandedSourceKeys = new WeakMap<WorldSectorView, string>()
function sceneryKey(sector: WorldScenerySector) {
  const cached = sceneryKeys.get(sector)
  if (cached !== undefined) return cached
  const key = JSON.stringify(sector)
  sceneryKeys.set(sector, key)
  return key
}
function contentKey(sector: WorldSectorView): string {
  const previous = contentKeys.get(sector)
  if (previous !== undefined) return previous
  // Only painting fields belong here. Exits and clocks stay in live navigation.
  const key = JSON.stringify([
    sector.id,
    sector.regionId,
    sector.charted,
    sector.atlasColumn,
    sector.atlasRow,
    sector.townId,
    sector.landscape,
    sector.buildings ?? [],
    sector.landmarks,
    sector.cells,
  ])
  contentKeys.set(sector, key)
  return key
}
function reuseTerrain(previous: WorldSectorView[] | undefined, incoming: WorldSectorView[]) {
  if (!previous || previous === incoming) return incoming
  const byId = new Map(previous.map((sector) => [sector.id, sector]))
  const next = incoming.map((sector) => {
    const old = byId.get(sector.id)
    return old && contentKey(old) === contentKey(sector) ? old : sector
  })
  return next.length === previous.length && next.every((sector) => byId.get(sector.id) === sector)
    ? previous
    : next
}
const cache = new WeakMap<
  WorldView['sectors'],
  {
    scenery: WorldView['scenery']
    atlas: WorldView['atlas']
    sectors: WorldSectorView[]
  }
>()
/** Expand only server-supplied public scenery; authority/presence stays intact. */
export function worldRenderTerrain(
  view: Pick<WorldView, 'sectors' | 'scenery' | 'atlas'>,
  retained?: WorldSectorView[],
): WorldSectorView[] {
  if (!view.scenery?.length) return reuseTerrain(retained, view.sectors)
  const previous = cache.get(view.sectors)
  if (previous?.scenery === view.scenery && previous.atlas === view.atlas)
    return reuseTerrain(retained, previous.sectors)
  const atlas = new Map(
    view.atlas?.filter((sector) => sector.charted).map((sector) => [sector.id, sector]),
  )
  const retainedById = new Map(retained?.map((sector) => [sector.id, sector]))
  const ids = new Set(view.sectors.map((sector) => sector.id))
  const sectors = [...view.sectors]
  for (const scenery of view.scenery) {
    const [id, encodedGround, landscape, buildings, landmarks] = scenery
    const ground = decodeTerrainRows(encodedGround, GRID_WIDTH * GRID_HEIGHT)
    const metadata = atlas.get(id)
    if (!metadata || ids.has(id) || ground === null) continue
    const key = sceneryKey(scenery) + JSON.stringify(metadata)
    const cached = expandedScenery.get(scenery)
    const old = retainedById.get(id)
    const expanded =
      cached?.key === key
        ? cached.sector
        : old && expandedSourceKeys.get(old) === key
          ? old
          : undefined
    if (expanded) {
      sectors.push(expanded)
      ids.add(id)
      continue
    }
    const rows = Array.from({ length: GRID_HEIGHT }, (_, y) =>
      ground.slice(y * GRID_WIDTH, (y + 1) * GRID_WIDTH),
    )
    const terrain = {
      id,
      name: metadata.name,
      coordinate: metadata.coordinate,
      regionId: metadata.regionId,
      atlasColumn: metadata.column,
      atlasRow: metadata.row,
      townId: metadata.townId,
      east: metadata.column * GRID_WIDTH,
      north: (ATLAS_ROWS - metadata.row) * GRID_HEIGHT,
      art: null,
      charted: true,
      landscape: landscape ?? undefined,
      buildings,
      landmarks,
      rows,
      roads: [],
    }
    const cells = Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, (_, i) => {
      const position = { x: i % GRID_WIDTH, y: Math.floor(i / GRID_WIDTH) }
      return {
        ...position,
        terrain: ground[i]!,
        walkable: isWalkable(terrain, position),
        safe: isSafe(terrain, position),
      }
    })
    const { rows: _rows, roads: _roads, ...presentation } = terrain
    void _rows
    void _roads
    const result = { ...presentation, cells, exits: [] }
    expandedScenery.set(scenery, { key, sector: result })
    expandedSourceKeys.set(result, key)
    sectors.push(result)
    ids.add(id)
  }
  const result = reuseTerrain(retained, sectors)
  cache.set(view.sectors, { scenery: view.scenery, atlas: view.atlas, sectors: result })
  return result
}
