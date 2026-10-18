import type { WorldSceneViewport, WorldView } from './types'

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

function sameSceneData(previous: unknown, incoming: unknown): boolean {
  if (previous === incoming) return true
  if (
    previous === null ||
    incoming === null ||
    typeof previous !== 'object' ||
    typeof incoming !== 'object'
  )
    return false
  if (Array.isArray(previous) || Array.isArray(incoming))
    return (
      Array.isArray(previous) &&
      Array.isArray(incoming) &&
      previous.length === incoming.length &&
      previous.every((value, index) => sameSceneData(value, incoming[index]))
    )
  const left = previous as Record<string, unknown>,
    right = incoming as Record<string, unknown>
  const keys = Object.keys(left).filter((key) => left[key] !== undefined)
  return (
    keys.length === Object.keys(right).filter((key) => right[key] !== undefined).length &&
    keys.every((key) => Object.hasOwn(right, key) && sameSceneData(left[key], right[key]))
  )
}

/** Reuse only complete unchanged scene content, including private discovery and topology. */
export function retainWorldSceneReferences(previous: WorldView, incoming: WorldView): WorldView {
  if (previous.characterId !== incoming.characterId) return incoming
  const sectors = sameSceneData(previous.sectors, incoming.sectors)
    ? previous.sectors
    : incoming.sectors
  const atlas = sameSceneData(previous.atlas, incoming.atlas) ? previous.atlas : incoming.atlas
  const scenery = sameSceneData(previous.scenery, incoming.scenery)
    ? previous.scenery
    : incoming.scenery
  if (sectors === incoming.sectors && atlas === incoming.atlas && scenery === incoming.scenery)
    return incoming
  return { ...incoming, sectors, scenery, atlas }
}

/** The server derives the scene; the client supplies only its last owned receipt identity. */
export function worldRefreshUrl(view: WorldView, viewport?: WorldSceneViewport) {
  if (viewport) {
    const query = new URLSearchParams({
      sceneWidth: String(viewport.width),
      sceneHeight: String(viewport.height),
    })
    return `/api/world?${query}`
  }
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
  if (!('kind' in receipt) || receipt.kind !== 'presence')
    return retainWorldSceneReferences(view, receipt as WorldView)
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
