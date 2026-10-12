import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import { FRONTIER_APPROACH, STEP_MS } from '@/world/catalog'
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
  WorldIntent,
  WorldObjective,
  WorldPlayer,
  WorldPosition,
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
        Math.abs(address.column - currentAddress.column) <= 2 &&
        Math.abs(address.row - currentAddress.row) <= 2,
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
      return priority(a) - priority(b)
    })
    .slice(0, 25)
  const sectors = sceneSectors.map((sector) => {
    const { rows, roads, ...publicSector } = sector
    const cells = []
    for (let y = 0; y < 9; y++)
      for (let x = 0; x < 13; x++)
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
  })
  const visiblePlayers = players
    .filter(
      (p) =>
        sceneSectors.some((sector) => sector.id === p.position.sectorId) &&
        isKnown(state, p.position),
    )
    .map((player) => {
      const sector = resolveSector(state.position.sectorId)!
      const distance =
        Math.abs(player.position.x - state.position.x) +
        Math.abs(player.position.y - state.position.y)
      return {
        ...player,
        attackable:
          player.attackable &&
          player.position.sectorId === state.position.sectorId &&
          distance <= 1 &&
          !isSafe(sector, state.position) &&
          !isSafe(sector, player.position),
      }
    })
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
