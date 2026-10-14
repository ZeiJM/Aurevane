import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import { FRONTIER_APPROACH, GRID_HEIGHT, GRID_WIDTH, STEP_MS } from '@/world/catalog'
import { resolveWorldEnvironment, type WorldEnvironment } from '@/world/environment'
import {
  advanceWorldRoute,
  canAutoPath,
  findWorldRoute,
  isSafe,
  isCurrentWorldRoute,
  isWalkable,
  revealNearby,
  samePosition,
  MAX_PERSISTED_ROUTE_STEPS,
} from '@/world/travel'
import type {
  TravelStep,
  WorldIntent,
  WorldObjective,
  WorldPlayer,
  WorldPosition,
  WorldSector,
  WorldSectorView,
  WorldState,
  WorldView,
} from '@/world/types'
import {
  SURVEY_SECTOR,
  WORLD_OBJECTIVES,
  WORLD_SECTORS,
  isKnownCell,
  resolveSector,
  visibleSectors,
} from './world-content'
import { worldArchiveEntries } from './world-archive'
import { atlasAddress } from '@/world/atlas'
import { wrappedColumnDistance, wrappedMapX } from '@/world/topology'
import {
  advanceWorldObjectiveProgress,
  effectiveWorldObjectives,
  isInteractionWorldObjectiveId,
  localWorldInteractions,
  resolveWorldInteraction,
} from './world-objectives'

const invalid = (message: string): never => {
  throw new AurevaneError('INVALID_REQUEST', message)
}
const isKnown = isKnownCell
// Public sector terrain is immutable. Avoid scanning every charted cell on each
// 200ms walking confirmation just to build the small globe water overlay.
const atlasSurfaceCache = new WeakMap<object, { townId?: string; waterTiles?: string }>()
function publicAtlasSurface(sector: ReturnType<typeof visibleSectors>[number]) {
  if (!sector.charted) return {}
  let surface = atlasSurfaceCache.get(sector)
  if (!surface) {
    surface = {
      ...(sector.townId ? { townId: sector.townId } : {}),
      ...(sector.rows.some((row) => /[~l]/.test(row))
        ? { waterTiles: sector.rows.join('').replace(/[^~l]/g, '.') }
        : {}),
    }
    atlasSurfaceCache.set(sector, surface)
  }
  return surface
}
export function resolveWorldIntent(
  state: WorldState,
  intent: Exclude<WorldIntent, { kind: 'attack' }>,
  now: number,
  objectives: readonly WorldObjective[] = WORLD_OBJECTIVES,
): WorldState {
  if (
    state.route.length &&
    !isCurrentWorldRoute(state.position, state.route, visibleSectors(state), (p) =>
      isKnown(state, p),
    )
  )
    state = {
      ...state,
      route: [],
      routeObjectiveId: null,
      routeDestination: null,
      nextStepAt: null,
    }
  const effectiveObjectives = effectiveWorldObjectives(state, objectives)
  let next: WorldState = { ...state }
  if (intent.kind === 'stop')
    next = { ...state, route: [], routeObjectiveId: null, routeDestination: null, nextStepAt: null }
  else if (intent.kind === 'tick') {
    const objective = state.routeObjectiveId
      ? effectiveObjectives.find((o) => o.id === state.routeObjectiveId)
      : null
    next =
      (state.routeObjectiveId && (!objective || !canAutoPath(objective))) ||
      !isCurrentWorldRoute(state.position, state.route, visibleSectors(state), (p) =>
        isKnown(state, p),
      )
        ? { ...state, route: [], routeObjectiveId: null, routeDestination: null, nextStepAt: null }
        : advanceWorldRoute(state, now)
  } else if (intent.kind === 'cross') {
    if (!samePosition(state.position, FRONTIER_APPROACH) || state.route.length)
      invalid('Walk to the last reliable survey and stop before crossing.')
    next = {
      ...state,
      position: { sectorId: SURVEY_SECTOR.id, x: 6, y: 8 },
      route: [],
      routeDestination: null,
      nextStepAt: null,
    }
  } else if (intent.kind === 'interact') {
    next =
      resolveWorldInteraction(state, intent.interactionId) ??
      invalid('That interaction is not available here.')
  } else {
    let destination: WorldPosition
    if (intent.kind === 'autopath') {
      const objective = effectiveObjectives.find((o) => o.id === intent.objectiveId)
      if (!objective || !canAutoPath(objective) || !objective.destination)
        invalid('Auto-path is unavailable for this objective.')
      destination = objective!.destination!
    } else destination = intent.destination
    if (!isKnown(state, destination)) invalid('Survey this ground before plotting a route.')
    // Plan from where the character really is: steps that came due since the last tick are
    // applied first, so a new click never pulls a walking character back to a stale tile.
    const walking = advanceWorldRoute(state, now)
    const origin = walking.position
    const sectors = visibleSectors(state)
    const route = findWorldRoute(origin, destination, sectors, (p) => isKnown(state, p))
    if (!route) invalid('There is no known walkable route to that location.')
    // Replanning never accelerates movement: a step already under way keeps its schedule,
    // otherwise the first new step waits a full interval.
    const underWay =
      walking.route.length > 0 && walking.nextStepAt !== null && walking.nextStepAt > now
    // A step under way keeps its deadline. Every new authoritative step costs its full
    // interval; the immediate client preview does not grant an instant server step.
    next = {
      ...state,
      position: origin,
      route: route!.slice(0, MAX_PERSISTED_ROUTE_STEPS),
      routeDestination: route!.length > MAX_PERSISTED_ROUTE_STEPS ? destination : null,
      routeObjectiveId: intent.kind === 'autopath' ? intent.objectiveId : null,
      nextStepAt: route!.length
        ? underWay
          ? Math.min(walking.nextStepAt!, now + route![0]!.durationMs)
          : now + route![0]!.durationMs
        : null,
    }
  }
  next = advanceWorldObjectiveProgress(revealNearby(next))
  const discoveredAnchors = new Set(next.discoveredAnchors ?? [])
  const currentSector = resolveSector(next.position.sectorId)
  const currentAnchor = currentSector?.landmarks.find(
    (landmark) =>
      landmark.kind === 'anchor' &&
      landmark.x === next.position.x &&
      landmark.y === next.position.y,
  )
  if (currentAnchor) discoveredAnchors.add(currentAnchor.id)

  const completed = new Set(next.completedObjectives)
  for (const objective of effectiveWorldObjectives(next, objectives))
    if (
      !isInteractionWorldObjectiveId(objective.id) &&
      objective.destination &&
      samePosition(next.position, objective.destination)
    )
      completed.add(objective.id)
  const landmark = SURVEY_SECTOR.landmarks[0]!
  if (
    next.position.sectorId === SURVEY_SECTOR.id &&
    next.position.x === landmark.x &&
    next.position.y === landmark.y
  )
    completed.add(landmark.id)
  return {
    ...next,
    discoveredAnchors: [...discoveredAnchors].sort(),
    completedObjectives: [...completed],
  }
}
export function projectWorldPlayers(
  state: WorldState,
  players: readonly WorldPlayer[],
  sceneSectorIds: readonly string[],
): WorldPlayer[] {
  const ids = new Set(sceneSectorIds)
  const sector = resolveSector(state.position.sectorId)!
  const supplied = players.some((player) => player.movement !== undefined)
    ? visibleSectors(state).filter((sector) => ids.has(sector.id))
    : []
  const object = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
  const clock = (value: unknown): value is number =>
    Number.isSafeInteger(value) && (value as number) >= 0
  function projectMovement(raw: unknown, from: WorldPosition): WorldPlayer['movement'] {
    if (
      !object(raw) ||
      !clock(raw.version) ||
      !clock(raw.serverNow) ||
      !(raw.nextStepAt === null || clock(raw.nextStepAt)) ||
      !Array.isArray(raw.route) ||
      (raw.route.length > 0 && raw.nextStepAt === null)
    )
      return undefined
    const route: TravelStep[] = []
    let previous = from
    for (const entry of raw.route.slice(0, 12)) {
      if (!object(entry) || !object(entry.position)) break
      const position = entry.position
      if (
        typeof position.sectorId !== 'string' ||
        !ids.has(position.sectorId) ||
        !clock(position.x) ||
        position.x >= GRID_WIDTH ||
        !clock(position.y) ||
        position.y >= GRID_HEIGHT ||
        !clock(entry.durationMs) ||
        entry.durationMs < STEP_MS
      )
        break
      const step: TravelStep = {
        position: { sectorId: position.sectorId, x: position.x, y: position.y },
        durationMs: entry.durationMs,
      }
      if (
        !isCurrentWorldRoute(
          previous,
          [step],
          supplied,
          (p) => ids.has(p.sectorId) && isKnown(state, p),
        )
      )
        break
      route.push(step)
      previous = step.position
    }
    if (route.length && raw.nextStepAt! > raw.serverNow + route[0]!.durationMs) return undefined
    return {
      version: raw.version,
      serverNow: raw.serverNow,
      nextStepAt: route.length ? raw.nextStepAt : null,
      route,
    }
  }
  return players
    .filter((player) => ids.has(player.position.sectorId) && isKnown(state, player.position))
    .map((player) => {
      const { movement: rawMovement, ...identity } = player
      const movement = projectMovement(rawMovement, player.position)
      const distance =
        Math.abs(player.position.x - state.position.x) +
        Math.abs(player.position.y - state.position.y)
      return {
        ...identity,
        ...(movement ? { movement } : {}),
        attackEligible: player.attackable,
        attackable:
          player.attackable &&
          player.position.sectorId === state.position.sectorId &&
          distance <= 1 &&
          !isSafe(sector, state.position) &&
          !isSafe(sector, player.position),
      }
    })
}

/** Shared private-filtered sector projection; movement receipts need only their origin. */
export function projectWorldSector(state: WorldState, sector: WorldSector): WorldSectorView {
  const { rows, roads, ...publicSector } = sector
  const cells = []
  for (let y = 0; y < GRID_HEIGHT; y++)
    for (let x = 0; x < GRID_WIDTH; x++)
      if (isKnown(state, { sectorId: sector.id, x, y }))
        cells.push({
          x,
          y,
          terrain: rows[y]![x]!,
          walkable: isWalkable(sector, { x, y }),
          safe: isSafe(sector, { x, y }),
        })
  const legacyTrail = /^trail:.*:(\d+)$/.exec(sector.id)
  return {
    ...publicSector,
    ...(legacyTrail ? { atlasColumn: Number(legacyTrail[1]), atlasRow: 0 } : {}),
    cells,
    landmarks: sector.landmarks.filter((p) => isKnown(state, { ...p, sectorId: sector.id })),
    exits: roads.filter((road) => isKnown(state, road.from) && isKnown(state, road.to)),
  }
}

export function projectWorld(
  state: WorldState,
  players: readonly WorldPlayer[],
  now: number,
  objectives: readonly WorldObjective[] = WORLD_OBJECTIVES,
  environment: WorldEnvironment = resolveWorldEnvironment(now),
): WorldView {
  const visible = visibleSectors(state)
  const currentSector = resolveSector(state.position.sectorId)!
  const currentAddress = atlasAddress(currentSector)
  const arrivingIds = new Set(state.route.slice(0, 8).map((step) => step.position.sectorId))
  const exitIds = new Set(currentSector.roads.map((road) => road.to.sectorId))
  const sceneSectors = visible
    .filter((sector) => {
      if (
        sector.id === state.position.sectorId ||
        arrivingIds.has(sector.id) ||
        (currentSector.id.startsWith('trail:') &&
          sector.id.startsWith('trail:') &&
          exitIds.has(sector.id))
      )
        return true
      const address = atlasAddress(sector)
      return Boolean(
        sector.charted === currentSector.charted &&
        address &&
        currentAddress &&
        wrappedColumnDistance(address.column, currentAddress.column) <= (sector.charted ? 4 : 2) &&
        Math.abs(address.row - currentAddress.row) <= (sector.charted ? 4 : 2),
      )
    })
    .sort((a, b) => {
      const priority = (sector: typeof a) =>
        sector.id === state.position.sectorId
          ? 0
          : arrivingIds.has(sector.id)
            ? 1
            : exitIds.has(sector.id)
              ? 2
              : 3
      const sceneDistance = (sector: typeof a) => {
        const address = atlasAddress(sector)
        if (!address || !currentAddress) return Infinity
        const currentX = currentAddress.column * GRID_WIDTH
        const dx =
          wrappedMapX(address.column * GRID_WIDTH, currentX) -
          currentX +
          GRID_WIDTH / 2 -
          state.position.x -
          0.5
        const dy =
          (address.row - currentAddress.row) * GRID_HEIGHT +
          GRID_HEIGHT / 2 -
          state.position.y -
          0.5
        return (((dx - dy) * 0.85) / 1.4) ** 2 + ((dx + dy) * 0.44) ** 2
      }
      return priority(a) - priority(b) || sceneDistance(a) - sceneDistance(b)
    })
    .slice(0, 25)
  const sectors = sceneSectors.map((sector) => projectWorldSector(state, sector))
  const visiblePlayers = projectWorldPlayers(
    state,
    players,
    sceneSectors.map((sector) => sector.id),
  )
  const effectiveObjectives = effectiveWorldObjectives(state, objectives)
  const discoveredAnchorIds = new Set(state.discoveredAnchors ?? [])
  const anchors = WORLD_SECTORS.flatMap((sector) =>
    sector.landmarks
      .filter((landmark) => landmark.kind === 'anchor' && discoveredAnchorIds.has(landmark.id))
      .map((landmark) => ({
        id: landmark.id,
        name: landmark.name,
        sectorId: sector.id,
      })),
  )
  return {
    characterId: '',
    version: state.version,
    serverNow: now,
    position: state.position,
    route: state.route.filter((s) => isKnown(state, s.position)),
    nextStepAt: state.nextStepAt,
    routeObjectiveId: state.route.length ? (state.routeObjectiveId ?? null) : null,
    routeDestination: state.route.length ? (state.routeDestination ?? null) : null,
    sectors,
    atlas: visible.flatMap((sector) => {
      const address = atlasAddress(sector)
      return address
        ? [
            {
              id: sector.id,
              name: sector.name,
              coordinate: sector.coordinate,
              regionId: sector.regionId,
              ...address,
              charted: sector.charted,
              ...publicAtlasSurface(sector),
            },
          ]
        : []
    }),
    players: visiblePlayers,
    objectives: effectiveObjectives.map((o) => ({
      ...o,
      destination:
        o.guidance === 'exact' && o.destination && isKnown(state, o.destination)
          ? o.destination
          : null,
      completed: o.completed || state.completedObjectives.includes(o.id),
    })),
    interactions: localWorldInteractions(state),
    anchors,
    archive: worldArchiveEntries(state),
    battleSessionId: null,
    movementBlocked: null,
    environment,
  }
}
export function assertEncounterRange(state: WorldState, target: WorldState) {
  const sector = resolveSector(state.position.sectorId)
  if (
    !sector ||
    state.position.sectorId !== target.position.sectorId ||
    !isKnown(state, target.position) ||
    isSafe(sector, state.position) ||
    isSafe(sector, target.position) ||
    Math.abs(state.position.x - target.position.x) +
      Math.abs(state.position.y - target.position.y) >
      1
  )
    invalid('That player is no longer within reach in open territory.')
}
export const WORLD_MINIMUM_STEP_MS = STEP_MS
