import { ASTERWAKE_GOLDEN_TREE } from '@/world/asterwake'
import { canWalkPublicAtlas, reachableAtlasArrival } from '@/world/atlas-walking'
import { grandDiscoverySectorName } from '@/world/discovery-sites'
import { PUBLIC_FERRY_TERMINALS } from '@/world/ferry'
import type { WorldPosition, WorldView } from '@/world/types'

export function worldTravelDestination(sectorId: string): WorldPosition {
  if (sectorId === ASTERWAKE_GOLDEN_TREE.sectorId) return { sectorId, x: 6, y: 6 }
  return (
    PUBLIC_FERRY_TERMINALS.find(({ dock }) => dock.sectorId === sectorId)?.dock ?? {
      sectorId,
      x: 6,
      y: 4,
    }
  )
}

export function worldReachableTravelDestination(from: WorldPosition, sectorId: string) {
  const preferred = worldTravelDestination(sectorId)
  if (
    sectorId === ASTERWAKE_GOLDEN_TREE.sectorId ||
    PUBLIC_FERRY_TERMINALS.some(({ dock }) => dock.sectorId === sectorId)
  ) {
    return canWalkPublicAtlas(from, preferred) ? preferred : null
  }
  return reachableAtlasArrival(from, preferred)
}

export function worldKeyLocations(
  { atlas, anchors }: Pick<WorldView, 'atlas' | 'anchors'>,
  favorite: string | null,
) {
  const named = new Set([
    ...anchors.map((anchor) => anchor.sectorId),
    ...PUBLIC_FERRY_TERMINALS.map(({ dock }) => dock.sectorId),
    ASTERWAKE_GOLDEN_TREE.sectorId,
    favorite,
  ])
  return (atlas ?? [])
    .filter(
      (cell) =>
        cell.charted &&
        (cell.townId === cell.id ||
          named.has(cell.id) ||
          grandDiscoverySectorName(cell.id) !== undefined),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'en') || a.row - b.row || a.column - b.column)
}
