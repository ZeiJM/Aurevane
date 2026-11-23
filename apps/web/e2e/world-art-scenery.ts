import { regionalScenery } from '../src/components/world/map-dressing'
import { terrainWalkable } from '../src/world/terrain'
import type { WorldSector, WorldSectorView } from '../src/world/types'

/** Deterministic legal survey positions for actual scenery, not invented fixture terrain. */
export function sceneryReviewCandidates(sectors: readonly WorldSector[]) {
  const candidates = new Map<string, { sectorId: string; x: number; y: number }>()
  for (const sector of sectors) {
    const view: WorldSectorView = {
      ...sector,
      art: sector.art ?? null,
      exits: [...sector.roads],
      cells: sector.rows.flatMap((row, y) =>
        [...row].map((terrain, x) => ({
          x,
          y,
          terrain,
          safe: false,
          walkable: terrainWalkable(terrain),
        })),
      ),
    }
    for (const prop of regionalScenery(view)) {
      const key = `${prop.sheet}-${prop.index}`
      if (!candidates.has(key))
        candidates.set(key, { sectorId: sector.id, x: prop.x, y: prop.y + 1 })
    }
  }
  return candidates
}

export const VOID_SCENERY_VIEWS = [
  { sectorId: 'uncharted-belfry', phase: 0, x: 8, y: 5, key: 'regional-scenery-extra-3' },
  { sectorId: 'uncharted-belfry', phase: 3, x: 9, y: 5, key: 'rare-scenery-3' },
  { sectorId: 'uncharted-pale', phase: 4, x: 6, y: 4, key: 'rare-scenery-1' },
  { sectorId: 'uncharted-landing', phase: 0, x: 10, y: 5, key: 'regional-scenery-7' },
  { sectorId: 'uncharted-verge', phase: 2, x: 8, y: 5, key: 'rare-scenery-2' },
] as const
