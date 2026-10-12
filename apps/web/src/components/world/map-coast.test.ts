import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { projectWorld } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import type { WorldView } from '@/world/types'
import { buildPublicCoasts, coastPoint } from './map-coast'

describe('public shoreline presentation', () => {
  const view = (): WorldView => projectWorld(newWorldState(), [], 1000)
  it('does not paint an ocean between loaded land and a mapped but unloaded neighbour', () => {
    const world = view(),
      root = world.sectors.find((s) => s.id === world.position.sectorId)!
    const coasts = buildPublicCoasts({ sectors: [root], atlas: world.atlas })
    expect(coasts.get(root.id)).toEqual([])
  })
  it('uses only known public land edges and keeps every shoreline point on the sea side', () => {
    const root = view().sectors[0]!
    const coasts = buildPublicCoasts({
      sectors: [root],
      atlas: [
        {
          id: root.id,
          column: root.atlasColumn!,
          row: root.atlasRow!,
          charted: true,
          name: root.name,
          coordinate: root.coordinate,
          regionId: root.regionId,
        },
      ],
    }).get(root.id)!
    expect(coasts.length).toBeGreaterThan(0)
    for (const edge of coasts)
      for (let i = 0; i <= 20; i++) {
        const p = coastPoint(edge, i / 20, 0.1)
        if (edge.side === 0) expect(p[1]).toBeLessThan(0)
        if (edge.side === 1) expect(p[0]).toBeGreaterThan(13)
        if (edge.side === 2) expect(p[1]).toBeGreaterThan(9)
        if (edge.side === 3) expect(p[0]).toBeLessThan(0)
      }
  })
  it('does not infer shorelines for private cells, missing overviews or already-water boundaries', () => {
    const world = view(),
      root = world.sectors[0]!
    expect(buildPublicCoasts({ sectors: [root] }).get(root.id)).toEqual([])
    expect(
      buildPublicCoasts({ sectors: [{ ...root, charted: false }], atlas: world.atlas }).get(
        root.id,
      ),
    ).toEqual([])
    const ocean = { ...root, cells: root.cells.map((c) => ({ ...c, terrain: '~' })) }
    expect(buildPublicCoasts({ sectors: [ocean], atlas: [] }).get(root.id)).toEqual([])
  })
})
