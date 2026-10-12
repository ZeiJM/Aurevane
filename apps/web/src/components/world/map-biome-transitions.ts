import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { atlasNeighbor } from '@/world/topology'
import type { WorldSectorView } from '@/world/types'

export interface BiomeTransitionEdge {
  regionId: string
  side: 0 | 1 | 2 | 3
  /** Half-open tile indices along the shared boundary: [from, to). */
  from: number
  to: number
  width: 3
}

export interface BiomeTransitionCorner {
  horizontalSide: 0 | 2
  verticalSide: 1 | 3
  horizontalRegionId: string
  verticalRegionId: string
  diagonalRegionId: string
  width: 3
}

export function buildBiomeTransitions(sectors: readonly WorldSectorView[]) {
  const publicSectors = sectors.filter(
    (sector) => sector.charted && sector.atlasColumn !== undefined && sector.atlasRow !== undefined,
  )
  const byAddress = new Map(
    publicSectors.map((sector) => [`${sector.atlasColumn}:${sector.atlasRow}`, sector]),
  )
  const boundaries = new Map(
    publicSectors.map((sector) => [
      sector.id,
      new Map(sector.cells.map((cell) => [`${cell.x}:${cell.y}`, cell.terrain])),
    ]),
  )
  const offsets = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ] as const
  return new Map(
    sectors.map((sector) => {
      const edges: BiomeTransitionEdge[] = []
      const corners: BiomeTransitionCorner[] = []
      const neighbors: unknown[] = []
      const diagonals: unknown[] = []
      if (boundaries.has(sector.id)) {
        for (const [sideIndex, [dx, dy]] of offsets.entries()) {
          const side = sideIndex as BiomeTransitionEdge['side']
          const address = atlasNeighbor(sector.atlasColumn!, sector.atlasRow!, dx, dy)
          const neighbor = address && byAddress.get(`${address.column}:${address.row}`)
          if (!neighbor) {
            neighbors.push(null)
            continue
          }
          const ownCells = boundaries.get(sector.id)!
          const otherCells = boundaries.get(neighbor.id)!
          const pairedTerrain: (string | undefined)[][] = []
          const length = side % 2 === 0 ? GRID_WIDTH : GRID_HEIGHT
          let from: number | null = null
          for (let index = 0; index <= length; index++) {
            let dry = false
            if (index < length) {
              const ownKey =
                side === 0
                  ? `${index}:0`
                  : side === 1
                    ? `${GRID_WIDTH - 1}:${index}`
                    : side === 2
                      ? `${index}:${GRID_HEIGHT - 1}`
                      : `0:${index}`
              const otherKey =
                side === 0
                  ? `${index}:${GRID_HEIGHT - 1}`
                  : side === 1
                    ? `0:${index}`
                    : side === 2
                      ? `${index}:0`
                      : `${GRID_WIDTH - 1}:${index}`
              const pair = [ownCells.get(ownKey), otherCells.get(otherKey)]
              pairedTerrain.push(pair)
              dry = pair.every(
                (terrain) => terrain !== undefined && terrain !== '~' && terrain !== 'l',
              )
            }
            if (dry && from === null) from = index
            if (!dry && from !== null) {
              if (neighbor.regionId !== sector.regionId)
                edges.push({ regionId: neighbor.regionId, side, from, to: index, width: 3 })
              from = null
            }
          }
          neighbors.push([neighbor.id, neighbor.regionId, pairedTerrain])
        }
        for (const horizontalSide of [0, 2] as const)
          for (const verticalSide of [1, 3] as const) {
            const dx = verticalSide === 1 ? 1 : -1
            const dy = horizontalSide === 0 ? -1 : 1
            const neighbor = (offsetX: number, offsetY: number) => {
              const address = atlasNeighbor(sector.atlasColumn!, sector.atlasRow!, offsetX, offsetY)
              return address ? byAddress.get(`${address.column}:${address.row}`) : undefined
            }
            const horizontal = neighbor(0, dy)
            const vertical = neighbor(dx, 0)
            const diagonal = neighbor(dx, dy)
            const ownX = dx > 0 ? GRID_WIDTH - 1 : 0
            const ownY = dy < 0 ? 0 : GRID_HEIGHT - 1
            const otherX = dx > 0 ? 0 : GRID_WIDTH - 1
            const otherY = dy < 0 ? GRID_HEIGHT - 1 : 0
            const diagonalTerrain =
              diagonal && boundaries.get(diagonal.id)!.get(`${otherX}:${otherY}`)
            diagonals.push(diagonal ? [diagonal.id, diagonal.regionId, diagonalTerrain] : null)
            if (!horizontal || !vertical || !diagonal) continue
            const meeting = [
              boundaries.get(sector.id)!.get(`${ownX}:${ownY}`),
              boundaries.get(horizontal.id)!.get(`${ownX}:${otherY}`),
              boundaries.get(vertical.id)!.get(`${otherX}:${ownY}`),
              diagonalTerrain,
            ]
            if (
              meeting.some((terrain) => terrain === undefined || terrain === '~' || terrain === 'l')
            )
              continue
            if (
              [horizontal, vertical, diagonal].every((entry) => entry.regionId === sector.regionId)
            )
              continue
            corners.push({
              horizontalSide,
              verticalSide,
              horizontalRegionId: horizontal.regionId,
              verticalRegionId: vertical.regionId,
              diagonalRegionId: diagonal.regionId,
              width: 3,
            })
          }
      }
      return [
        sector.id,
        {
          key: JSON.stringify([sector.regionId, neighbors, edges, diagonals, corners]),
          edges,
          corners,
        },
      ] as const
    }),
  )
}
