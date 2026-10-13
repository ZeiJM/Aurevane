import { retainWorldSceneReferences } from './presence'
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
> & { kind: 'movement'; currentSector?: WorldView['sectors'][number] }
/** Supply the confirmed origin; retain the rest of the scene and public peer clocks. */
export function mergeWorldMovement(view: WorldView, receipt: WorldMovementReceipt): WorldView {
  const { kind, currentSector, ...owned } = receipt
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
  if (currentSector) {
    if (
      currentSector.id !== receipt.position.sectorId ||
      !currentSector.cells.some(
        (cell) => cell.x === receipt.position.x && cell.y === receipt.position.y && cell.walkable,
      )
    )
      throw new Error('Movement terrain could not be loaded safely.')
    sectors = sectors.some((sector) => sector.id === currentSector.id)
      ? sectors.map((sector) => (sector.id === currentSector.id ? currentSector : sector))
      : [...sectors.slice(0, 24), currentSector]
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
  return retainWorldSceneReferences(view, { ...view, ...owned, sectors, players })
}
