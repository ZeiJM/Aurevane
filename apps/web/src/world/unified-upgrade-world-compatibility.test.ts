import { createHash } from 'node:crypto'
import historical from '../../../../docs/verification/unified-upgrade/map-baseline.json'
import baseline from '../../../../docs/verification/2026-11-12-map-correction-baseline.json'
import { expect, it, vi } from 'vitest'
import { isKnownCell, visibleSectors, WORLD_SECTORS } from '@/server/world/world-content'
import { isWarpedContinentSector } from '@/server/world/warped-continent'
import { atlasSectors } from './atlas'
import { GRID_HEIGHT, GRID_WIDTH, WORLD_REGIONS } from './catalog'
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
  const landmarkRows = originalSectors.flatMap((sector) =>
    sector.landmarks.map(({ id, kind, x, y }) => [sector.id, id, kind, x, y]),
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
    sector.roads,
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
    landmarks: landmarkRows.length,
    authorityDigest: digest(terrainRows),
    landmarkDigest: digest(landmarkRows),
    routes,
  }).toEqual(baseline)
})
