import type { WorldPosition, WorldSectorView } from '../src/world/types'

/** Choose fixture ground before clicking; an occupied destination opens player inspection. */
export function unoccupiedArtStep(
  sector: Pick<WorldSectorView, 'id' | 'cells'>,
  from: { x: number; y: number },
  preferred: { x: number; y: number },
  occupants: readonly { position: WorldPosition }[],
): WorldPosition | undefined {
  const candidate = [preferred, ...sector.cells].find(
    (point) =>
      Math.abs(point.x - from.x) + Math.abs(point.y - from.y) === 1 &&
      sector.cells.some((cell) => cell.x === point.x && cell.y === point.y && cell.walkable) &&
      !occupants.some(
        ({ position }) =>
          position.sectorId === sector.id && position.x === point.x && position.y === point.y,
      ),
  )
  return candidate ? { sectorId: sector.id, x: candidate.x, y: candidate.y } : undefined
}
