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
  it.each([0, 1, 2, 3] as const)(
    'breaks the straight dry shoreline on side %s without moving its endpoints or legal ground',
    (side) => {
      const edge = { side, from: 2, to: 7, seed: 53, openStart: false, openEnd: false }
      const outward = ([x, y]: readonly [number, number]) =>
        side === 0 ? -y : side === 1 ? x - 13 : side === 2 ? y - 9 : -x
      const points = Array.from({ length: 21 }, (_, i) => coastPoint(edge, i / 20, 0))
      const offsets = points.map(outward)
      expect(Math.max(...offsets) - Math.min(...offsets)).toBeGreaterThan(0.06)
      expect(offsets.every((offset) => offset >= 0 && offset <= 0.25)).toBe(true)
      expect(offsets[0]).toBeCloseTo(0, 12)
      expect(offsets.at(-1)).toBeCloseTo(0, 12)
      expect(points.map((point) => point[side % 2 ? 1 : 0])).toEqual(
        Array.from({ length: 21 }, (_, i) => 2 + i / 4),
      )
      expect(outward(coastPoint(edge, 0.5, -0.4))).toBeLessThan(0)
    },
  )

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

it('fades the deep shelf edge before its outline so neighboring shallows stay visible', () => {
  const vertices: number[] = []
  const paths: number[][] = []
  const addColorStop = vi.fn()
  const gradient = vi.fn(() => ({ addColorStop }))
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    createLinearGradient: gradient,
    beginPath: vi.fn(),
    moveTo: (x: number) => vertices.push(x),
    lineTo: (x: number) => vertices.push(x),
    closePath: vi.fn(),
    fill: () => paths.push(vertices.splice(0)),
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
  // The first path returns along the outer shelf. The near bank now also
  // extends into sea, so a simple x > 13 filter would mix both contours.
  const outline = paths[0]!.slice(paths[0]!.length / 2)
  expect(outline.length).toBeGreaterThan(1)
  expect(gradientEnd).toBeLessThanOrEqual(Math.min(...outline))
  expect(addColorStop).toHaveBeenCalledWith(1, 'rgba(40,75,87,0)')
  const apron = paths[1]!
  expect(Math.min(...apron)).toBeLessThan(13)
  expect(Math.max(...apron)).toBeGreaterThan(13.06)
  const lip = paths[0]!.slice(0, outline.length).reverse()
  apron.slice(apron.length / 2).forEach((point, i) => expect(point).toBeCloseTo(lip[i]!, 12))
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
