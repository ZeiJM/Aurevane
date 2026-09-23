import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import { FRONTIER_APPROACH, GRID_WIDTH, STEP_MS } from '@/world/catalog'
import {
  advanceWorldRoute,
  canAutoPath,
  findWorldRoute,
  isSafe,
  isCurrentWorldRoute,
  isWalkable,
  revealNearby,
  samePosition,
} from '@/world/travel'
import type {
  WorldIntent,
  WorldObjective,
  WorldPlayer,
  WorldPosition,
  WorldState,
  WorldView,
} from '@/world/types'
import { SURVEY_SECTOR, WORLD_OBJECTIVES, WORLD_SECTORS } from './world-content'
import {
  EASTERN_WATCH_OBJECTIVE_ID,
  advanceWorldObjectiveProgress,
  effectiveWorldObjectives,
  localWorldInteractions,
  resolveWorldInteraction,
} from './world-objectives'

const invalid = (message: string): never => {
  throw new AurevaneError('INVALID_REQUEST', message)
}
function isKnown(state: WorldState, p: WorldPosition) {
  const sector = WORLD_SECTORS.find((s) => s.id === p.sectorId)
  return Boolean(sector?.charted || state.discoveries[p.sectorId]?.includes(p.y * GRID_WIDTH + p.x))
}
export function resolveWorldIntent(
  state: WorldState,
  intent: Exclude<WorldIntent, { kind: 'attack' }>,
  now: number,
  objectives: readonly WorldObjective[] = WORLD_OBJECTIVES,
): WorldState {
  const effectiveObjectives = effectiveWorldObjectives(state, objectives)
  let next: WorldState = { ...state }
  if (intent.kind === 'stop')
    next = { ...state, route: [], routeObjectiveId: null, nextStepAt: null }
  else if (intent.kind === 'tick') {
    const objective = state.routeObjectiveId
      ? effectiveObjectives.find((o) => o.id === state.routeObjectiveId)
      : null
    next =
      (state.routeObjectiveId && (!objective || !canAutoPath(objective))) ||
      !isCurrentWorldRoute(state.position, state.route, WORLD_SECTORS, (p) => isKnown(state, p))
        ? { ...state, route: [], routeObjectiveId: null, nextStepAt: null }
        : advanceWorldRoute(state, now)
  } else if (intent.kind === 'cross') {
    if (!samePosition(state.position, FRONTIER_APPROACH) || state.route.length)
      invalid('Walk to the last reliable survey and stop before crossing.')
    next = {
      ...state,
      position: { sectorId: SURVEY_SECTOR.id, x: 6, y: 8 },
      route: [],
      nextStepAt: null,
    }
  } else if (intent.kind === 'interact') {
    const interaction = resolveWorldInteraction(state, intent.interactionId)
    if (!interaction) invalid('That interaction is not available here.')
    next = interaction
  } else {
    let destination: WorldPosition
    if (intent.kind === 'autopath') {
      const objective = effectiveObjectives.find((o) => o.id === intent.objectiveId)
      if (!objective || !canAutoPath(objective) || !objective.destination)
        invalid('Auto-path is unavailable for this objective.')
      destination = objective!.destination!
    } else destination = intent.destination
    if (!isKnown(state, destination)) invalid('Survey this ground before plotting a route.')
    const sectors = WORLD_SECTORS.filter((s) => s.charted || state.discoveries[s.id])
    const route = findWorldRoute(state.position, destination, sectors, (p) => isKnown(state, p))
    if (!route) invalid('There is no known walkable route to that location.')
    // Replanning never accelerates a due movement step; all new steps wait a full interval.
    next = {
      ...state,
      route: route!,
      routeObjectiveId: intent.kind === 'autopath' ? intent.objectiveId : null,
      nextStepAt: route!.length ? now + route![0]!.durationMs : null,
    }
  }
  next = advanceWorldObjectiveProgress(revealNearby(next))
  const completed = new Set(next.completedObjectives)
  for (const objective of effectiveWorldObjectives(next, objectives))
    if (
      objective.id !== EASTERN_WATCH_OBJECTIVE_ID &&
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
  return { ...next, completedObjectives: [...completed] }
}
export function projectWorld(
  state: WorldState,
  players: readonly WorldPlayer[],
  now: number,
  objectives: readonly WorldObjective[] = WORLD_OBJECTIVES,
): WorldView {
  const sectors = WORLD_SECTORS.filter((s) => s.charted || state.discoveries[s.id]).map(
    (sector) => {
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
      return {
        ...publicSector,
        cells,
        landmarks: sector.landmarks.filter((p) => isKnown(state, { ...p, sectorId: sector.id })),
        exits: roads.filter((road) => isKnown(state, road.from) && isKnown(state, road.to)),
      }
    },
  )
  const visiblePlayers = players
    .filter((p) => p.position.sectorId === state.position.sectorId && isKnown(state, p.position))
    .map((player) => {
      const sector = WORLD_SECTORS.find((s) => s.id === state.position.sectorId)!
      const distance =
        Math.abs(player.position.x - state.position.x) +
        Math.abs(player.position.y - state.position.y)
      return {
        ...player,
        attackable:
          player.attackable &&
          distance <= 1 &&
          !isSafe(sector, state.position) &&
          !isSafe(sector, player.position),
      }
    })
  const effectiveObjectives = effectiveWorldObjectives(state, objectives)
  return {
    characterId: '',
    version: state.version,
    serverNow: now,
    position: state.position,
    route: state.route.filter((s) => isKnown(state, s.position)),
    nextStepAt: state.nextStepAt,
    routeObjectiveId: state.route.length ? (state.routeObjectiveId ?? null) : null,
    sectors,
    players: visiblePlayers,
    objectives: effectiveObjectives.map((o) => ({
      ...o,
      destination:
        o.guidance === 'exact' && o.destination && isKnown(state, o.destination)
          ? o.destination
          : null,
      completed: state.completedObjectives.includes(o.id),
    })),
    interactions: localWorldInteractions(state),
    battleSessionId: null,
    movementBlocked: null,
  }
}
export function assertEncounterRange(state: WorldState, target: WorldState) {
  const sector = WORLD_SECTORS.find((s) => s.id === state.position.sectorId)
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
