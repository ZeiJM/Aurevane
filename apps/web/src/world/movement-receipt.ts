import { retainWorldSceneReferences } from './presence'
import { samePosition } from './travel'
import { GRID_HEIGHT, GRID_WIDTH } from './catalog'
import { encodeTerrainRows } from './terrain'
import type { WorldView } from './types'
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
  interactions?: WorldView['interactions']
  npcs?: WorldView['npcs']
}
/** Supply the confirmed origin; retain the rest of the scene and public peer clocks. */
export function mergeWorldMovement(view: WorldView, receipt: WorldMovementReceipt): WorldView {
  const { kind, currentSector, interactions, npcs, ...owned } = receipt
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
  if (currentSector) {
    if (
      currentSector.id !== receipt.position.sectorId ||
      !currentSector.cells.some(
        (cell) => cell.x === receipt.position.x && cell.y === receipt.position.y && cell.walkable,
      )
    )
      throw new Error('Movement terrain could not be loaded safely.')
    if (sectors.some((sector) => sector.id === currentSector.id))
      sectors = sectors.map((sector) => (sector.id === currentSector.id ? currentSector : sector))
    else {
      // Presence is capped at25 sectors, but replacing its last slot must not
      // punch a hole in already supplied public ground while scene loading waits.
      const displaced = sectors
        .slice(24)
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
            (sector) => sector[0] !== currentSector.id && !demotedIds.has(sector[0]),
          ),
        ].slice(0, 512)
      }
      sectors = [...sectors.slice(0, 24), currentSector]
    }
  }
  const players = view.players
    .filter(
      (player) =>
        !currentSector ||
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
