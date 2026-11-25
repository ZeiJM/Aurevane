import { createHash } from 'node:crypto'
import historical from '../../../../docs/verification/unified-upgrade/map-baseline.json'
import baseline from '../../../../docs/verification/2026-11-12-map-correction-baseline.json'
import { expect, it, vi } from 'vitest'
import { isKnownCell, visibleSectors, WORLD_SECTORS } from '@/server/world/world-content'
import { isWarpedContinentSector } from '@/server/world/warped-continent'
import { atlasSectors } from './atlas'
import { GRID_HEIGHT, GRID_WIDTH, WORLD_REGIONS } from './catalog'
import {
  FERRY_ASTERWAKE_DOCK,
  FERRY_MAINLAND_DOCK,
  FERRY_NORTH_DOCK,
  FERRY_TERMINAL_LANDMARK,
  FERRY_TERMINAL_NAMES,
} from './ferry'
import { ATLAS_COLUMNS, ATLAS_ROWS } from './topology'
import { findWorldRoute, isSafe, isWalkable, newWorldState } from './travel'

vi.mock('server-only', () => ({}))

it('preserves world addresses and historic routes through the authorized map geometry successor', () => {
  // Keep the historical record immutable. Only authorized terrain/prop geometry changes.
  for (const key of [
    'atlas',
    'addressSpaceTiles',
    'atlasSectors',
    'resolvedServerSectors',
    'regions',
    'routes',
  ] as const)
    expect(baseline[key], key).toEqual(historical[key])
  const sectors = atlasSectors()
  const originalSectors = WORLD_SECTORS.filter(({ id }) => !isWarpedContinentSector(id))
  const terminals = originalSectors.flatMap(({ id: sectorId, landmarks }) =>
    landmarks
      .filter(({ id }) => id === FERRY_TERMINAL_LANDMARK)
      .map((landmark) => ({ ...landmark, sectorId })),
  )
  expect(terminals).toEqual([
    {
      ...FERRY_MAINLAND_DOCK,
      id: FERRY_TERMINAL_LANDMARK,
      name: FERRY_TERMINAL_NAMES.mainland,
      kind: 'waystone',
    },
  ])
  const landmarkRows = originalSectors.flatMap((sector) =>
    sector.landmarks
      .filter(({ id }) => id !== FERRY_TERMINAL_LANDMARK)
      .map(({ id, kind, x, y }) => [sector.id, id, kind, x, y]),
  )
  const terrainRows = originalSectors.map((sector) => [
    sector.id,
    sector.coordinate,
    sector.regionId,
    sector.atlasColumn,
    sector.atlasRow,
    sector.charted,
    sector.stepMs,
    sector.rows,
    sector.roads.map((road) => {
      if (road.to.sectorId === FERRY_NORTH_DOCK.sectorId) {
        expect(road.name).toBe(FERRY_TERMINAL_NAMES['north-shore'])
        return { ...road, name: 'North Shore Ferry Terminal' }
      }
      if (road.to.sectorId === FERRY_ASTERWAKE_DOCK.sectorId) {
        expect(road.name).toBe(FERRY_TERMINAL_NAMES.asterwake)
        return { ...road, name: 'Asterwake Ferry Terminal' }
      }
      if (road.to.sectorId !== FERRY_MAINLAND_DOCK.sectorId) return road
      expect(road.name).toBe(FERRY_TERMINAL_NAMES.mainland)
      // Keep comparing the same geometry and routing authority with the archived name.
      return { ...road, name: 'Umbral March Countryside' }
    }),
  ])
  const digest = (value: unknown) =>
    createHash('sha256').update(JSON.stringify(value)).digest('hex')
  const routes = baseline.routes.map(({ from, to }) => {
    const state = {
      ...newWorldState(),
      position: from,
      discoveries: { 'survey-01': [110] },
    }
    const route = findWorldRoute(from, to, visibleSectors(state), (position) =>
      isKnownCell(state, position),
    )
    if (!route) throw new Error(`Route from ${from.sectorId} to ${to.sectorId} is unreachable`)
    return {
      from,
      to,
      steps: route.length,
      milliseconds: route.reduce((sum, step) => sum + step.durationMs, 0),
    }
  })
  const counts = { walkable: 0, safe: 0, water: 0, lava: 0, roads: 0 }
  for (const sector of sectors) {
    counts.roads += sector.roads.length
    sector.rows.forEach((row, y) =>
      [...row].forEach((cell, x) => {
        counts.walkable += Number(isWalkable(sector, { x, y }))
        counts.safe += Number(isSafe(sector, { x, y }))
        counts.water += Number(cell === '~')
        counts.lava += Number(cell === 'l')
      }),
    )
  }
  expect({
    atlas: [ATLAS_COLUMNS, ATLAS_ROWS],
    addressSpaceTiles: [ATLAS_COLUMNS * GRID_WIDTH, ATLAS_ROWS * GRID_HEIGHT],
    atlasSectors: sectors.length,
    resolvedServerSectors: originalSectors.length,
    counts,
    regions: WORLD_REGIONS.map(({ id, name }) => ({
      id,
      name,
      sectors: sectors.filter((sector) => sector.regionId === id).length,
    })),
    landmarks: landmarkRows.length + terminals.length,
    authorityDigest: digest(terrainRows),
    landmarkDigest: digest(landmarkRows),
    routes,
  }).toEqual({
    ...baseline,
    // The older baseline and named long routes remain archived. The current
    // snapshot includes the island chain and dry scenery crossings at sector borders.
    atlasSectors: 2195,
    resolvedServerSectors: 2244,
    counts: {
      walkable: 254826,
      roads: 88504,
      safe: 7656,
      water: 1974,
      lava: 15,
    },
    regions: baseline.regions.map((region) => ({
      ...region,
      sectors:
        region.id === 'aureth-crown'
          ? 206
          : region.id === 'glasswind-desert'
            ? 341
            : region.id === 'umbral-march'
              ? 357
              : region.sectors +
                (region.id === 'starfall-highlands'
                  ? 39
                  : region.id === 'frostmere'
                    ? 11
                    : region.id === 'emberreach'
                      ? 5
                      : 0),
    })),
    landmarks: 669,
    authorityDigest: '31ca6775394b492498799aae4ff2cf7be820ce2c36d55efdcc915c9c9724cd08',
    landmarkDigest: '9f24713c4f53d0efb481d010c19a60908eee35da7af87c2e624294295f51a832',
  })
})
