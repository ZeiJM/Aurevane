import 'server-only'
import { directionalWalk } from '@/world/directional-walk'
import { MAP_X, MAP_Y } from '@/components/world/map-projection'
import { WORLD_MIN_ZOOM } from '@/components/world/world-zoom'
import { encodeTerrainRows, worldSurfaceRows } from '@/world/terrain'
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
  validCell,
  revealNearby,
  samePosition,
  MAX_PERSISTED_ROUTE_STEPS,
} from '@/world/travel'
import type {
  TravelStep,
  WorldIntent,
  WorldImpactSite,
  WorldObjective,
  WorldPlayer,
  WorldPosition,
  WorldSector,
  WorldSectorView,
  WorldScenerySector,
  WorldSceneViewport,
  WorldState,
  WorldView,
} from '@/world/types'
import {
  SURVEY_SECTOR,
  WORLD_OBJECTIVES,
  WORLD_SECTORS,
  approvedVoidSteps,
  isKnownCell,
  resolveSector,
  visibleSectors,
} from './world-content'
import { worldArchiveEntries } from './world-archive'
import { projectWorldFerry, worldFerryDock } from './world-ferry'
import { atlasAddress, atlasSectors } from '@/world/atlas'
import { GRAND_DISCOVERY_SITES, type GrandDiscoveryId } from '@/world/discovery-sites'
import { grandDiscoveryPlacements } from '@/components/world/map-grand-discoveries'
import { wrappedColumnDistance, wrappedMapX } from '@/world/topology'
import {
  parseVoidSectorId,
  isVoidRealmSectorId,
  isLocalVoidWalk,
  localVoidSectorIds,
} from '@/world/void-realms'
import { voidRealmScenery } from './void-realms'
import { projectUnchartedTerrain } from './uncharted-terrain'
import {
  applyWarpedContinentPhase,
  isWarpedContinentSector,
  recordWarpedFieldObservation,
  warpedDistrictScenery,
} from './warped-continent'
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
const impactSites: Readonly<Record<string, WorldImpactSite>> = {
  'atlas:45:9': { x: 9.5, y: 6.5, index: 0, size: 3 },
  'atlas:65:21': { x: 2.5, y: 2.5, index: 1, size: 3 },
  'void:starfall-basin:16:10': { x: 6.5, y: 4.5, index: 2, size: 3 },
  'uncharted-pale': { x: 3.5, y: 3.5, index: 2, size: 3 },
}
const isKnown = isKnownCell
// Public sector terrain is immutable. Avoid scanning every charted cell on each
// 200ms walking confirmation just to build the small globe water overlay.
const atlasSurfaceCache = new WeakMap<
  object,
  { townId?: string; settlementOutskirtsOf?: string; waterTiles?: string }
>()
let provedPublicGrandDiscoveries: readonly GrandDiscoveryId[] | undefined
function publicGrandDiscoveryProof(): readonly GrandDiscoveryId[] {
  if (provedPublicGrandDiscoveries) return provedPublicGrandDiscoveries
  // Immutable canonical public sites can exceed a loaded camera. Prove their
  // whole ground/approach once; never substitute client or private geography.
  const neighborhoods = atlasSectors()
    .filter((sector) => {
      const address = atlasAddress(sector)
      return (
        sector.charted &&
        address &&
        GRAND_DISCOVERY_SITES.some(
          (site) =>
            address.column * GRID_WIDTH < site.left + site.width &&
            address.column * GRID_WIDTH + GRID_WIDTH > site.left &&
            address.row * GRID_HEIGHT < site.top + site.height + 2 &&
            address.row * GRID_HEIGHT + GRID_HEIGHT > site.top,
        )
      )
    })
    .map((sector): WorldSectorView => {
      const { rows, roads: _roads, ...publicSector } = sector
      void _roads
      return {
        ...publicSector,
        cells: Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, (_, index) => {
          const position = { x: index % GRID_WIDTH, y: Math.floor(index / GRID_WIDTH) }
          return {
            ...position,
            terrain: rows[position.y]![position.x]!,
            walkable: isWalkable(sector, position),
            safe: isSafe(sector, position),
          }
        }),
        exits: [],
      }
    })
  provedPublicGrandDiscoveries = Object.freeze(
    grandDiscoveryPlacements(neighborhoods).map((site) => site.id),
  )
  return provedPublicGrandDiscoveries
}
function publicAtlasSurface(sector: ReturnType<typeof visibleSectors>[number]) {
  if (!sector.charted) return {}
  let surface = atlasSurfaceCache.get(sector)
  if (!surface) {
    const rows = worldSurfaceRows(sector)
    surface = {
      ...(sector.townId ? { townId: sector.townId } : {}),
      ...(sector.settlementOutskirtsOf
        ? { settlementOutskirtsOf: sector.settlementOutskirtsOf }
        : {}),
      ...(rows.some((row) => /[~lw]/.test(row))
        ? { waterTiles: rows.join('').replace(/[^~lw]/g, '.') }
        : {}),
    }
    atlasSurfaceCache.set(sector, surface)
  }
  return surface
}
function routeTo(state: WorldState, destination: WorldPosition, explore: boolean) {
  if (state.ferry && state.position.sectorId.startsWith('ferry:')) {
    const deck = resolveSector(state.position.sectorId)
    return deck && destination.sectorId === deck.id
      ? findWorldRoute(state.position, destination, [deck])
      : null
  }

  const local =
    explore &&
    validCell(destination) &&
    isLocalVoidWalk(state.position.sectorId, destination.sectorId)
  if (local) {
    if (destination.sectorId === state.position.sectorId) {
      const sector = resolveSector(destination.sectorId)
      if (!sector || !isWalkable(sector, destination)) return null
      const direct = findWorldRoute(state.position, destination, [sector])
      if (
        direct &&
        direct.length ===
          Math.abs(destination.x - state.position.x) + Math.abs(destination.y - state.position.y)
      )
        return direct
    }
    const sectors = localVoidSectorIds(parseVoidSectorId(state.position.sectorId)!)
      .map(resolveSector)
      .filter((sector) => sector !== null)
    const route = findWorldRoute(state.position, destination, sectors)
    if (route) return route
  }
  if (!isKnown(state, destination)) return null
  return findWorldRoute(state.position, destination, visibleSectors(state), (p) =>
    isKnown(state, p),
  )
}

export function resolveWorldIntent(
  state: WorldState,
  intent: Exclude<
    WorldIntent,
    { kind: 'attack' | 'buy-ferry-boarding' | 'board-ferry' | 'leave-ferry' }
  >,
  now: number,
  objectives: readonly WorldObjective[] = WORLD_OBJECTIVES,
): WorldState {
  const validRoute =
    !state.route.length ||
    (isVoidRealmSectorId(state.position.sectorId) && !state.routeObjectiveId
      ? approvedVoidSteps(state).length === state.route.length
      : isCurrentWorldRoute(state.position, state.route, visibleSectors(state), (p) =>
          isKnown(state, p),
        ))
  if (!validRoute)
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
      state.routeObjectiveId && (!objective || !canAutoPath(objective))
        ? { ...state, route: [], routeObjectiveId: null, routeDestination: null, nextStepAt: null }
        : advanceWorldRoute(state, now)
    if (state.route.length && !next.route.length && next.routeDestination) {
      // A saved window can end before the browser asks to extend it. Resume
      // from the last approved tile and charge the next step its full duration.
      const route = routeTo(next, next.routeDestination, !next.routeObjectiveId)
      next = {
        ...next,
        route: route?.slice(0, MAX_PERSISTED_ROUTE_STEPS) ?? [],
        routeObjectiveId: route?.length ? next.routeObjectiveId : null,
        routeDestination:
          route && route.length > MAX_PERSISTED_ROUTE_STEPS ? next.routeDestination : null,
        nextStepAt: route?.length ? now + route[0]!.durationMs : null,
      }
    }
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
      resolveWorldInteraction(state, intent.interactionId, intent.actionId) ??
      invalid('That interaction is not available here.')
  } else {
    let destination: WorldPosition
    if (intent.kind === 'autopath') {
      const objective = effectiveObjectives.find((o) => o.id === intent.objectiveId)
      if (!objective || !canAutoPath(objective) || !objective.destination)
        invalid('Auto-path is unavailable for this objective.')
      destination = objective!.destination!
    } else destination = intent.destination
    // Plan from where the character really is: steps that came due since the last tick are
    // applied first, so a new click never pulls a walking character back to a stale tile.
    const walking = advanceWorldRoute(state, now)
    if (
      !(
        intent.kind === 'walk' &&
        validCell(destination) &&
        isLocalVoidWalk(walking.position.sectorId, destination.sectorId)
      ) &&
      !isKnown(walking, destination)
    )
      invalid('Survey this ground before plotting a route.')
    const underway =
      walking.route[0] &&
      walking.nextStepAt !== null &&
      walking.nextStepAt - now < walking.route[0].durationMs
        ? walking.route[0]
        : undefined
    let route =
      intent.kind === 'walk' && intent.direction
        ? directionalWalk(
            walking.position,
            destination,
            intent.direction,
            resolveSector,
            (p) => isLocalVoidWalk(walking.position.sectorId, p.sectorId) || isKnown(walking, p),
            underway,
          )
        : routeTo(walking, destination, intent.kind === 'walk')
    if (!route) invalid('There is no known walkable route to that location.')
    if (
      intent.kind === 'walk' &&
      !intent.direction &&
      underway &&
      route!.length &&
      !samePosition(route![0]!.position, underway.position)
    ) {
      // Finish the ongoing edge before turning. Use the original legal path if
      // the landing would strand this particular destination.
      const onward = routeTo({ ...walking, position: underway.position }, destination, true)
      if (onward) route = [underway, ...onward]
    }
    // Replanning never accelerates movement: a step already under way keeps its schedule,
    // otherwise the first new step waits a full interval.
    const hasScheduledStep =
      walking.route.length > 0 && walking.nextStepAt !== null && walking.nextStepAt > now
    // A step under way keeps its deadline. Every new authoritative step costs its full
    // interval; the immediate client preview does not grant an instant server step.
    next = {
      ...walking,
      route: route!.slice(0, MAX_PERSISTED_ROUTE_STEPS),
      routeDestination: route!.length > MAX_PERSISTED_ROUTE_STEPS ? destination : null,
      routeObjectiveId: intent.kind === 'autopath' ? intent.objectiveId : null,
      nextStepAt: route!.length
        ? hasScheduledStep
          ? Math.min(walking.nextStepAt!, now + route![0]!.durationMs)
          : now + route![0]!.durationMs
        : null,
    }
  }
  next = advanceWorldObjectiveProgress(next.ferry ? next : revealNearby(next))
  const discoveredAnchors = new Set(next.discoveredAnchors ?? [])
  const currentSector = resolveSector(next.position.sectorId)
  if (currentSector)
    next = recordWarpedFieldObservation(next, applyWarpedContinentPhase(next, currentSector))
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
      objective.kind !== 'event' &&
      objective.authority !== 'personal-quest' &&
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
    ? visibleSectors(state, { sceneOnly: true }).filter((sector) => ids.has(sector.id))
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
export function projectWorldSector(
  state: WorldState,
  sector: WorldSector,
  approvedRoute = approvedVoidSteps(state),
): WorldSectorView {
  sector = applyWarpedContinentPhase(state, sector)
  const { rows: _rows, roads, ...publicSector } = sector
  void _rows
  const rows = worldSurfaceRows(sector)
  const cells: WorldSectorView['cells'] = []
  const routeCells = new Set(
    approvedRoute
      .filter((step) => step.position.sectorId === sector.id)
      .map(({ position }) => position.y * GRID_WIDTH + position.x),
  )
  const routeExits = new Set<WorldSector['roads'][number]>()
  let previous = state.position
  for (const step of approvedRoute) {
    if (previous.sectorId === sector.id && step.position.sectorId !== sector.id) {
      const road = roads.find(
        ({ from, to }) => samePosition(from, previous) && samePosition(to, step.position),
      )
      if (road) routeExits.add(road)
    }
    previous = step.position
  }
  for (let y = 0; y < GRID_HEIGHT; y++)
    for (let x = 0; x < GRID_WIDTH; x++)
      if (routeCells.has(y * GRID_WIDTH + x) || isKnown(state, { sectorId: sector.id, x, y }))
        cells.push({
          x,
          y,
          terrain: rows[y]![x]!,
          walkable: isWalkable(sector, { x, y }),
          safe: isSafe(sector, { x, y }),
        })
  const warpedScenery = isVoidRealmSectorId(sector.id)
    ? voidRealmScenery(sector.id)
    : sector.warpedTheme
      ? warpedDistrictScenery(sector.id)
      : undefined
  const revealedScenery =
    warpedScenery &&
    isKnown(state, { sectorId: sector.id, x: warpedScenery.x, y: warpedScenery.y }) &&
    isWalkable(sector, warpedScenery)
  const impactSite = impactSites[sector.id]
  const impactLeft = impactSite ? impactSite.x - impactSite.size / 2 : 0
  const impactTop = impactSite ? impactSite.y - impactSite.size / 2 : 0
  const impactRight = impactSite ? impactLeft + impactSite.size : 0
  const impactBottom = impactSite ? impactTop + impactSite.size : 0
  const overlapsImpact = (x: number, y: number, width = 1, height = 1) =>
    x < impactRight && x + width > impactLeft && y < impactBottom && y + height > impactTop
  const projectedImpact =
    impactSite &&
    !sector.townId &&
    (sector.charted || sector.warpedTheme) &&
    !sector.buildings?.some((building) =>
      overlapsImpact(building.x, building.y, building.width, building.height),
    ) &&
    !sector.landmarks.some((landmark) => overlapsImpact(landmark.x - 1, landmark.y - 1, 3, 3)) &&
    !(warpedScenery && overlapsImpact(warpedScenery.x - 1, warpedScenery.y - 1, 3, 3)) &&
    Array.from({ length: impactSite.size * impactSite.size }, (_, index) => ({
      x: impactLeft + (index % impactSite.size),
      y: impactTop + Math.floor(index / impactSite.size),
    })).every(({ x, y }) => {
      const cell = cells.find((candidate) => candidate.x === x && candidate.y === y)
      return cell && !cell.safe && cell.walkable && (cell.terrain === '.' || cell.terrain === 't')
    })
  const legacyTrail = /^trail:.*:(\d+)$/.exec(sector.id)
  const ferryDock = worldFerryDock(sector.id)
  return {
    ...publicSector,
    ...(projectedImpact ? { impactSite } : {}),
    ...(revealedScenery ? { warpedScenery } : {}),
    ...(legacyTrail ? { atlasColumn: Number(legacyTrail[1]), atlasRow: 0 } : {}),
    ...(ferryDock && isKnown(state, ferryDock)
      ? { ferryDock: { x: ferryDock.x, y: ferryDock.y, shoreSide: ferryDock.shoreSide } }
      : {}),
    cells,
    landmarks: sector.landmarks.filter((p) => isKnown(state, { ...p, sectorId: sector.id })),
    exits: roads.filter(
      (road) => routeExits.has(road) || (isKnown(state, road.from) && isKnown(state, road.to)),
    ),
  }
}

export function projectWorld(
  state: WorldState,
  players: readonly WorldPlayer[],
  now: number,
  objectives: readonly WorldObjective[] = WORLD_OBJECTIVES,
  environment: WorldEnvironment = resolveWorldEnvironment(now),
  viewport?: WorldSceneViewport,
): WorldView {
  const visible = visibleSectors(state, { sceneOnly: true })
  const currentSector = resolveSector(state.position.sectorId)!
  const onWarpedContinent = isWarpedContinentSector(currentSector.id)
  const currentVoidAddress = parseVoidSectorId(currentSector.id)
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
      if (onWarpedContinent) {
        return Boolean(
          isWarpedContinentSector(sector.id) &&
          currentSector.sceneColumn !== undefined &&
          currentSector.sceneRow !== undefined &&
          sector.sceneColumn !== undefined &&
          sector.sceneRow !== undefined &&
          Math.abs(sector.sceneColumn - currentSector.sceneColumn) <= 2 &&
          Math.abs(sector.sceneRow - currentSector.sceneRow) <= 2,
        )
      }
      if (currentVoidAddress) {
        const address = parseVoidSectorId(sector.id)
        return Boolean(
          address &&
          address.realmId === currentVoidAddress.realmId &&
          Math.abs(address.column - currentVoidAddress.column) <= 2 &&
          Math.abs(address.row - currentVoidAddress.row) <= 2,
        )
      }
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
        if (onWarpedContinent) {
          return sector.sceneColumn !== undefined &&
            sector.sceneRow !== undefined &&
            currentSector.sceneColumn !== undefined &&
            currentSector.sceneRow !== undefined
            ? (sector.sceneColumn - currentSector.sceneColumn) ** 2 +
                (sector.sceneRow - currentSector.sceneRow) ** 2
            : Infinity
        }
        if (currentVoidAddress) {
          const address = parseVoidSectorId(sector.id)
          return address
            ? (address.column - currentVoidAddress.column) ** 2 +
                (address.row - currentVoidAddress.row) ** 2
            : Infinity
        }
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
  const approvedRoute = approvedVoidSteps(state)
  const sectors = sceneSectors.map((sector) => projectWorldSector(state, sector, approvedRoute))
  const sceneIds = new Set(sceneSectors.map((sector) => sector.id))
  // The smallest allowed zoom needs more public ground than the25-sector peer
  // registration can hold. Send compact canonical rows ahead and beside the
  // camera, independently of private discovery and presence authorization.
  // Cover the supported smallest-zoom desktop/portrait viewport, plus the
  // first2.8s of approved travel. Corner ground must not wait for hydration.
  const sceneryAnchors = [
    state.position,
    ...state.route.slice(0, 14).map((step) => step.position),
  ].flatMap((position) => {
    const sector = resolveSector(position.sectorId)
    const address = sector && atlasAddress(sector)
    return address
      ? [
          {
            x: address.column * GRID_WIDTH + position.x + 0.5,
            y: address.row * GRID_HEIGHT + position.y + 0.5,
          },
        ]
      : []
  })
  const sceneWidth = viewport?.width ?? 1296
  const sceneHeight = viewport?.height ?? 944
  const sceneTile = (sceneWidth < 600 ? 48 : 64) * WORLD_MIN_ZOOM
  // An input reversal can precede the next full scene by several movement
  // receipts. Eight tiles of public ground in every direction cover that turn.
  const sceneryHalfWidth = sceneWidth / sceneTile / 2 + 8 * MAP_X
  const sceneryHalfHeight = sceneHeight / sceneTile / 2 + 8 * MAP_Y
  const scenery: WorldScenerySector[] =
    currentSector.charted && currentAddress
      ? visible
          .filter((sector) => {
            const address = atlasAddress(sector)
            return (
              sector.charted &&
              !sceneIds.has(sector.id) &&
              address &&
              sceneryAnchors.some((anchor) => {
                const dx = wrappedMapX(address.column * GRID_WIDTH, anchor.x) - anchor.x,
                  dy = address.row * GRID_HEIGHT - anchor.y,
                  x = (dx - dy) * MAP_X,
                  y = (dx + dy) * MAP_Y
                return (
                  x - GRID_HEIGHT * MAP_X <= sceneryHalfWidth &&
                  x + GRID_WIDTH * MAP_X >= -sceneryHalfWidth &&
                  y <= sceneryHalfHeight &&
                  y + (GRID_WIDTH + GRID_HEIGHT) * MAP_Y >= -sceneryHalfHeight
                )
              })
            )
          })
          .slice(0, 512)
          .map((sector): WorldScenerySector => [
            sector.id,
            encodeTerrainRows(worldSurfaceRows(sector)),
            sector.landscape ?? null,
            sector.buildings ?? [],
            sector.landmarks,
          ])
      : []

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
  const ferry = projectWorldFerry(state, now)
  const route = currentVoidAddress
    ? approvedRoute
    : state.route.filter((step) => isKnown(state, step.position))
  return {
    characterId: '',
    ...(ferry ? { ferry } : {}),
    version: state.version,
    serverNow: now,
    position: state.position,
    route,
    nextStepAt: route.length ? state.nextStepAt : null,
    routeObjectiveId: route.length ? (state.routeObjectiveId ?? null) : null,
    routeDestination:
      route.length &&
      state.routeDestination &&
      (isKnown(state, state.routeDestination) ||
        (currentVoidAddress &&
          !state.routeObjectiveId &&
          validCell(state.routeDestination) &&
          isLocalVoidWalk(state.position.sectorId, state.routeDestination.sectorId)))
        ? state.routeDestination
        : null,
    sectors,
    scenery,
    ...(currentSector.warpedTheme
      ? { unchartedTerrain: projectUnchartedTerrain(state, viewport) }
      : {}),
    ...(currentSector.charted ? { publicGrandDiscoveries: publicGrandDiscoveryProof() } : {}),
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
      completed:
        o.kind === 'event' || o.authority === 'personal-quest'
          ? o.completed
          : o.completed || state.completedObjectives.includes(o.id),
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
