import { retainWorldSceneReferences } from './presence'
import { samePosition } from './travel'
import { GRID_HEIGHT, GRID_WIDTH } from './catalog'
import { encodeTerrainRows } from './terrain'
import type { TravelStep, WorldPosition, WorldView } from './types'
export type WorldMovementReceipt = Pick<
  WorldView,
  | 'characterId'
  | 'version'
  | 'serverNow'
  | 'position'
  | 'route'
  | 'routeObjectiveId'
  | 'routeDestination'
  | 'nextStepAt'
  | 'battleSessionId'
  | 'movementBlocked'
  | 'ferry'
> & {
  kind: 'movement'
  currentSector?: WorldView['sectors'][number]
  upcomingSector?: WorldView['sectors'][number]
  interactions?: WorldView['interactions']
  npcs?: WorldView['npcs']
}

/** The same bounded lookahead selects and validates the supplied upcoming sector. */
export function worldMovementReceiptBoundary(
  origin: WorldPosition,
  route: readonly TravelStep[],
): TravelStep | undefined {
  return route.slice(0, 8).find(({ position }) => position.sectorId !== origin.sectorId)
}

/** Supply the confirmed origin; retain the rest of the scene and public peer clocks. */
export function mergeWorldMovement(view: WorldView, receipt: WorldMovementReceipt): WorldView {
  const { kind, currentSector, upcomingSector, interactions, npcs, ...owned } = receipt
  if (
    kind !== 'movement' ||
    receipt.characterId !== view.characterId ||
    !Number.isSafeInteger(receipt.version) ||
    receipt.version < view.version ||
    !Number.isFinite(receipt.serverNow) ||
    !Array.isArray(receipt.route)
  )
    throw new Error('The world changed. Refresh your position and try again.')
  let sectors = view.sectors
  let scenery = view.scenery
  const hasCell = (sector: WorldView['sectors'][number], position: WorldView['position']) =>
    sector.id === position.sectorId &&
    sector.cells.some((cell) => cell.x === position.x && cell.y === position.y && cell.walkable)
  if (currentSector && !hasCell(currentSector, receipt.position))
    throw new Error('Movement terrain could not be loaded safely.')
  const boundary = worldMovementReceiptBoundary(receipt.position, receipt.route)
  if (upcomingSector && (!boundary || !hasCell(upcomingSector, boundary.position)))
    throw new Error('Movement terrain could not be loaded safely.')
  // Insert the active boundary first so the confirmed sector always keeps its
  // slot when the command arrives before the full scene has moved.
  for (const supplied of [upcomingSector, currentSector]) {
    if (!supplied) continue
    if (sectors.some((sector) => sector.id === supplied.id)) {
      sectors = sectors.map((sector) => (sector.id === supplied.id ? supplied : sector))
    } else {
      const keep = sectors.filter(
        (sector) => sector.id === upcomingSector?.id || sector.id === currentSector?.id,
      )
      const retained = sectors.filter((sector) => !keep.includes(sector)).slice(0, 24 - keep.length)
      retained.push(...keep)
      const retainedIds = new Set(retained.map((sector) => sector.id))
      // Presence is capped at25 sectors, but replacing its last slot must not
      // punch a hole in already supplied public ground while scene loading waits.
      const displaced = sectors
        .filter((sector) => !retainedIds.has(sector.id))
        .filter(
          (sector) =>
            sector.charted &&
            sector.cells.length === GRID_WIDTH * GRID_HEIGHT &&
            view.atlas?.some((metadata) => metadata.id === sector.id && metadata.charted),
        )
      if (displaced.length) {
        const demotedIds = new Set(displaced.map((sector) => sector.id))
        scenery = [
          ...displaced.map((sector): NonNullable<WorldView['scenery']>[number] => {
            const ground = Array<string>(GRID_WIDTH * GRID_HEIGHT)
            for (const cell of sector.cells) ground[cell.y * GRID_WIDTH + cell.x] = cell.terrain
            const rows = Array.from({ length: GRID_HEIGHT }, (_, y) =>
              ground.slice(y * GRID_WIDTH, (y + 1) * GRID_WIDTH).join(''),
            )
            return [
              sector.id,
              encodeTerrainRows(rows),
              sector.landscape ?? null,
              sector.buildings ?? [],
              sector.landmarks,
            ]
          }),
          ...(scenery ?? []).filter(
            (sector) => sector[0] !== supplied.id && !demotedIds.has(sector[0]),
          ),
        ].slice(0, 512)
      }
      sectors = [...retained, supplied]
    }
  }
  const players = view.players
    .filter(
      (player) =>
        (!currentSector && !upcomingSector) ||
        sectors.some(
          (sector) =>
            sector.id === player.position.sectorId &&
            sector.cells.some(
              (cell) => cell.x === player.position.x && cell.y === player.position.y,
            ),
        ),
    )
    .map((player) => ({ ...player, attackable: false }))
  return retainWorldSceneReferences(view, {
    ...view,
    ...owned,
    ferry: receipt.ferry,
    sectors,
    scenery,
    players,
    npcs: npcs ?? view.npcs?.filter((npc) => npc.position.sectorId === receipt.position.sectorId),
    interactions:
      interactions ?? (samePosition(view.position, receipt.position) ? view.interactions : []),
  })
}
