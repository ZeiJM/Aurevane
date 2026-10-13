import type { WorldView } from './types'

type WorldPresence = Pick<
  WorldView,
  | 'characterId'
  | 'version'
  | 'serverNow'
  | 'players'
  | 'movementBlocked'
  | 'battleSessionId'
  | 'environment'
  | 'objectives'
  | 'livePresence'
> & { kind: 'presence' }

/** The server derives the scene; the client supplies only its last owned receipt identity. */
export function worldRefreshUrl(view: WorldView) {
  if (view.route.length) return '/api/world'
  const query = new URLSearchParams({
    presenceVersion: String(view.version),
    characterId: view.characterId,
  })
  return `/api/world?${query}`
}
export function worldRefreshResponse(view: WorldView, url: string): WorldView | WorldPresence {
  const query = new URL(url, 'https://world.invalid').searchParams
  if (
    query.get('presenceVersion') !== String(view.version) ||
    query.get('characterId') !== view.characterId ||
    view.route.length
  )
    return view
  return {
    kind: 'presence',
    characterId: view.characterId,
    version: view.version,
    serverNow: view.serverNow,
    players: view.players,
    movementBlocked: view.movementBlocked,
    battleSessionId: view.battleSessionId,
    environment: view.environment,
    objectives: view.objectives,
    livePresence: view.livePresence,
  }
}
export function mergeWorldRefresh(view: WorldView, receipt: WorldView | WorldPresence): WorldView {
  if (!('kind' in receipt) || receipt.kind !== 'presence') return receipt as WorldView
  if (receipt.characterId !== view.characterId || receipt.version !== view.version)
    throw new Error('The world changed. Refresh your position and try again.')
  return {
    ...view,
    serverNow: receipt.serverNow,
    players: receipt.players,
    movementBlocked: receipt.movementBlocked,
    battleSessionId: receipt.battleSessionId,
    environment: receipt.environment,
    objectives: receipt.objectives,
    livePresence: receipt.livePresence ?? view.livePresence,
  }
}
