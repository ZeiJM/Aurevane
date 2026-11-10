import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { projectWorld } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import type { WorldView } from '@/world/types'
import { buildPublicCoasts, coastPoint, paintCoastSea } from './map-coast'

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

describe('shoreline material and corners', () => {
  it('joins two exposed edges through open sea while keeping the dry band inland', () => {
    const root = projectWorld(newWorldState(), [], 1000).sectors[0]!
    const sector = {
      ...root,
      cells: root.cells.map((cell) => ({ ...cell, terrain: '.' as const })),
    }
    const edges = buildPublicCoasts({ sectors: [sector], atlas: [] }).get(sector.id)!
    const north = edges.find((edge) => edge.side === 0)!
    expect(north.openStart).toBe(true)
    expect(north.openEnd).toBe(true)
    expect(coastPoint(north, 0.5, -0.4)[1]).toBeGreaterThan(0)
    expect(coastPoint(north, 0.5, 0.4)[1]).toBeLessThan(0)
  })

  it('does not round off a corner occupied by another public sector', () => {
    const world = projectWorld(newWorldState(), [], 1000)
    const root = world.sectors[0]!
    const sector = {
      ...root,
      cells: root.cells.map((cell) => ({ ...cell, terrain: '.' as const })),
    }
    const diagonal = {
      id: 'public-diagonal',
      column: root.atlasColumn! + 1,
      row: root.atlasRow! - 1,
      charted: true,
      name: 'Public diagonal',
      coordinate: root.coordinate,
      regionId: root.regionId,
    }
    const edges = buildPublicCoasts({ sectors: [sector], atlas: [diagonal] }).get(sector.id)!
    expect(edges.find((edge) => edge.side === 0)?.openEnd).toBe(false)
  })
})

it('reaches the deep sea colour before every point on the irregular shelf outline', () => {
  const vertices: number[] = []
  const gradient = vi.fn(() => ({ addColorStop: vi.fn() }))
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    createLinearGradient: gradient,
    beginPath: vi.fn(),
    moveTo: (x: number) => vertices.push(x),
    lineTo: (x: number) => vertices.push(x),
    closePath: vi.fn(),
    fill: vi.fn(),
  } as unknown as CanvasRenderingContext2D
  paintCoastSea(
    context,
    [{ side: 1, from: 0, to: 9, seed: 53, openStart: false, openEnd: false }],
    1,
    0,
    false,
    1,
    'frostmere',
    0,
  )
  const gradientEnd = (gradient.mock.calls[0] as unknown as [number, number, number, number])[2]
  const outline = vertices.filter((x) => x > 13)
  expect(outline.length).toBeGreaterThan(1)
  expect(gradientEnd).toBeLessThanOrEqual(Math.min(...outline))
})

it('brings out longer, brighter wave crests in strong wind within the same surf budget', () => {
  const sample = (speed: number) => {
    const lineWidths: number[] = []
    const drawing = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
      lineWidth: 0,
      stroke() {
        lineWidths.push(this.lineWidth)
      },
    }
    paintCoastSea(
      drawing as unknown as CanvasRenderingContext2D,
      [{ side: 1, from: 0, to: 9, seed: 53, openStart: false, openEnd: false }],
      48,
      1500,
      true,
      1,
      'hollow-coast',
      3,
      speed,
    )
    return lineWidths
  }
  const calm = sample(0.007)
  const storm = sample(-0.054)
  expect(calm).toHaveLength(3)
  expect(storm).toHaveLength(3)
  expect(storm[0]!).toBeGreaterThan(calm[0]!)
})
