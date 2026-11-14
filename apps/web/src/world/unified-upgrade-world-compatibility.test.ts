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
  }).toEqual({
    ...baseline,
    // Keep the original, archived PR1039 baseline immutable. PR1040 adds
    // exactly 55 charted mainland sectors: 39 Starfall alpine frontier cells
    // and 16 traversable Frostmere/Emberreach corridor cells. The prior
    // routes, dimensions, safe zones, water and lava stay identical.
    atlasSectors: baseline.atlasSectors + 55,
    resolvedServerSectors: baseline.resolvedServerSectors + 55,
    counts: {
      ...baseline.counts,
      walkable: baseline.counts.walkable + 2316,
      roads: baseline.counts.roads + 624,
    },
    regions: baseline.regions.map((region) => ({
      ...region,
      sectors:
        region.sectors +
        (region.id === 'starfall-highlands'
          ? 39
          : region.id === 'frostmere'
            ? 11
            : region.id === 'emberreach'
              ? 5
              : 0),
    })),
    landmarks: baseline.landmarks + 3,
    // These are exact digests of PR1040 terrain and landmark authority,
    // including original saved identities, collision and legal entrances.
    authorityDigest: '6bbdd6a94ac81b5c8a0d83e18fd92b98ae8396af3d26bddc17cfb0021cf2f4e9',
    landmarkDigest: '375de635dd3948c664452cfe6a945a71a0a76f38b74d08ceb4ebb9588159be40',
  })
})
