import type { WorldSceneViewport, WorldView } from './types'

export const WORLD_ATLAS_HEADER = 'x-world-atlas'
export type WorldAtlasScene = Omit<WorldView, 'atlas' | 'atlasToken'> & {
  kind: 'scene'
  atlasToken: string
}

export function isWorldAtlasToken(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
}

type WorldPresence = Pick<
  WorldView,
  | 'characterId'
  | 'version'
  | 'serverNow'
  | 'players'
  | 'ferry'
  | 'npcs'
  | 'movementBlocked'
  | 'battleSessionId'
  | 'environment'
  | 'objectives'
  | 'interactions'
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
    ...(view.ferry ? { ferry: view.ferry } : {}),
    ...(view.npcs ? { npcs: view.npcs } : {}),
    movementBlocked: view.movementBlocked,
    battleSessionId: view.battleSessionId,
    environment: view.environment,
    objectives: view.objectives,
    interactions: view.interactions,
    livePresence: view.livePresence,
  }
}
/** Reuse only the atlas held by the requesting view. The rest of the scene is fresh. */
export async function readWorldSceneRefresh(
  source: WorldView,
  current: () => WorldView,
  load: (knownAtlas?: string) => Promise<WorldView | WorldAtlasScene>,
): Promise<WorldView> {
  const token =
    Array.isArray(source.atlas) && isWorldAtlasToken(source.atlasToken) ? source.atlasToken : null
  const receipt = await load(`${source.characterId}:${token ?? 'full'}`)
  if (!('kind' in receipt)) return retainWorldSceneReferences(source, receipt)
  const { kind, ...fresh } = receipt
  const active = current()
  if (
    kind === 'scene' &&
    token !== null &&
    receipt.atlasToken === token &&
    receipt.characterId === source.characterId &&
    active.characterId === source.characterId &&
    active.atlas === source.atlas &&
    active.atlasToken === token &&
    Number.isSafeInteger(receipt.version) &&
    receipt.version >= source.version &&
    receipt.version >= active.version &&
    Number.isFinite(receipt.serverNow) &&
    (receipt.version > active.version || receipt.serverNow >= active.serverNow) &&
    receipt.position &&
    receipt.environment &&
    Array.isArray(receipt.route) &&
    Array.isArray(receipt.sectors) &&
    Array.isArray(receipt.players) &&
    Array.isArray(receipt.objectives) &&
    Array.isArray(receipt.interactions) &&
    Array.isArray(receipt.anchors) &&
    Array.isArray(receipt.archive)
  ) {
    return retainWorldSceneReferences(source, { ...fresh, atlas: source.atlas })
  }
  const full = await load()
  if ('kind' in full) throw new Error('The world scene could not be refreshed safely.')
  return retainWorldSceneReferences(source, full)
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
    ferry: receipt.ferry,
    ...(receipt.npcs ? { npcs: receipt.npcs } : {}),
    movementBlocked: receipt.movementBlocked,
    battleSessionId: receipt.battleSessionId,
    environment: receipt.environment,
    objectives: receipt.objectives,
    interactions: receipt.interactions ?? view.interactions,
    livePresence: receipt.livePresence ?? view.livePresence,
  }
}
