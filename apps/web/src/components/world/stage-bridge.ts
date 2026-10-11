import { resolvePublicCharacterImageUrl } from '@/media/public-character-portrait'
import type { WorldPosition, WorldView } from '@/world/types'

/** Message envelope the host posts into the World stage iframe. */
export interface WorldStageState {
  characterId: string
  version: number
  name: string
  portrait: string
  position: WorldPosition
  route: WorldView['route']
  nextStepAt: number | null
  serverNow: number
  sectors: WorldView['sectors']
  players: Array<WorldView['players'][number] & { portrait: string | null }>
  busy: boolean
  movementBlocked: string | null
  environment: WorldView['environment']
  objectives: Array<{
    id: string
    name: string
    description: string
    kind: 'quest' | 'event'
    autoPath: boolean
    destination: WorldPosition | null
    completed: boolean
    progress?: string
  }>
  routeObjectiveId: string | null
}

export type WorldStageMessage =
  | { type: 'ready' }
  | { type: 'walk'; destination: WorldPosition }
  | { type: 'attack'; targetId: string }
  | { type: 'travel'; sectorId: string }
  | { type: 'autopath'; objectiveId: string }

const isPosition = (value: unknown): value is WorldPosition => {
  const p = value as WorldPosition | null
  return (
    Boolean(p) &&
    typeof p!.sectorId === 'string' &&
    Number.isInteger(p!.x) &&
    Number.isInteger(p!.y)
  )
}

/** Validates a message from the iframe; the host never trusts its shape. */
export function parseStageMessage(data: unknown): WorldStageMessage | null {
  if (!data || typeof data !== 'object') return null
  const m = data as Record<string, unknown>
  if (m.av !== 'world-stage') return null
  if (m.type === 'ready') return { type: 'ready' }
  if (m.type === 'walk' && isPosition(m.destination))
    return { type: 'walk', destination: m.destination }
  if (m.type === 'attack' && typeof m.targetId === 'string')
    return { type: 'attack', targetId: m.targetId }
  if (m.type === 'travel' && typeof m.sectorId === 'string')
    return { type: 'travel', sectorId: m.sectorId }
  if (m.type === 'autopath' && typeof m.objectiveId === 'string')
    return { type: 'autopath', objectiveId: m.objectiveId }
  return null
}

export function buildStageState(
  view: WorldView,
  character: { name: string; portrait: string },
  now: number,
  busy: boolean,
): WorldStageState {
  return {
    characterId: view.characterId,
    version: view.version,
    name: character.name,
    portrait: character.portrait,
    position: view.position,
    route: view.route,
    nextStepAt: view.nextStepAt,
    serverNow: now,
    sectors: view.sectors,
    players: view.players.map((player) => ({
      ...player,
      portrait: resolvePublicCharacterImageUrl(player.imageUrl, player.portraitRef),
    })),
    busy,
    movementBlocked: view.movementBlocked,
    environment: view.environment,
    objectives: view.objectives.map((o) => ({
      id: o.id,
      name: o.name,
      description: o.description,
      kind: o.kind,
      autoPath: o.autoPath,
      destination: o.destination,
      completed: o.completed,
      progress: o.progress,
    })),
    routeObjectiveId: view.routeObjectiveId ?? null,
  }
}

/**
 * Picks the ground a globe "travel" request should walk to in another sector:
 * the arrival tile of a known road into it, otherwise the walkable known tile
 * nearest its centre (preferring a settlement). The server still plots and
 * validates the actual route.
 */
export function travelDestination(view: WorldView, sectorId: string): WorldPosition | null {
  for (const sector of view.sectors) {
    const road = sector.exits.find((exit) => exit.to.sectorId === sectorId)
    if (road) return road.to
  }
  const target = view.sectors.find((sector) => sector.id === sectorId)
  if (!target) return null
  const walkable = target.cells.filter((cell) => cell.walkable)
  if (!walkable.length) return null
  const centre = (cell: { x: number; y: number }) => Math.abs(cell.x - 6) + Math.abs(cell.y - 4)
  const pool = walkable.some((cell) => cell.safe) ? walkable.filter((cell) => cell.safe) : walkable
  const best = [...pool].sort((a, b) => centre(a) - centre(b) || a.y - b.y || a.x - b.x)[0]!
  return { sectorId, x: best.x, y: best.y }
}
