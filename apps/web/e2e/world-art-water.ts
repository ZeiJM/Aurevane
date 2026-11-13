import { terrainWalkable } from '../src/world/terrain'
import type { WorldSector } from '../src/world/types'
import { buildWaterField, isWaterTerrain } from '../src/components/world/map-water'

function hasVisibleBank(sector: WorldSector) {
  const cells = sector.rows.flatMap((row, y) =>
    [...row].map((terrain, x) => ({
      x,
      y,
      terrain,
      walkable: terrainWalkable(terrain),
      safe: false,
    })),
  )
  return [
    ...buildWaterField([{ ...sector, cells, exits: [] }])
      .get(sector.id)!
      .cells.values(),
  ].some(({ banks }) => banks.length > 0)
}

export function waterReviewCandidate(sectors: readonly WorldSector[], regionId: string) {
  return sectors
    .filter((sector) => sector.regionId === regionId)
    .map((sector) => {
      const ground = sector.rows.flatMap((row, y) =>
        [...row].flatMap((terrain, x) =>
          terrainWalkable(terrain) &&
          !isWaterTerrain(terrain) &&
          [
            [0, 1],
            [1, 0],
            [0, -1],
            [-1, 0],
          ].some(([dx, dy]) => isWaterTerrain(sector.rows[y + dy!]?.[x + dx!]))
            ? [{ x, y }]
            : [],
        ),
      )
      return { sector, ground, water: [...sector.rows.join('')].filter(isWaterTerrain).length }
    })
    .filter(({ sector, ground, water }) => ground.length && water > 0 && hasVisibleBank(sector))
    .sort(
      (a, b) =>
        Number(Boolean(a.sector.townId)) - Number(Boolean(b.sector.townId)) || b.water - a.water,
    )[0]
}
