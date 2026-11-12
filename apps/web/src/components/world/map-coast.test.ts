import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { projectWorld } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import type { WorldView } from '@/world/types'
import {
  buildPublicCoasts,
  coastPoint,
  paintCoastLand,
  paintCoastSea,
  paintOpenSea,
} from './map-coast'

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

it.each([0, 1, 2, 3] as const)(
  'breaks the dark inland face into bounded wrack patches on side %s',
  (side) => {
    const paths: { points: number[][]; stops: string[] }[] = []
    let points: number[][] = []
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: () => {
        points = []
      },
      moveTo: (x: number, y: number) => points.push([x, y]),
      lineTo: (x: number, y: number) => points.push([x, y]),
      closePath: vi.fn(),
      fillRect: (x: number, y: number, width: number, height: number) =>
        paths.push({
          points: [
            [x, y],
            [x + width, y + height],
          ],
          stops: [],
        }),
      createLinearGradient: () => ({
        stops: [] as string[],
        addColorStop(_at: number, colour: string) {
          this.stops.push(colour)
        },
      }),
      fillStyle: null as unknown,
      fill() {
        paths.push({ points, stops: (this.fillStyle as { stops: string[] }).stops })
      },
    }
    const edge = { side, from: 2, to: 7, seed: 53, openStart: false, openEnd: false }
    paintCoastLand(context as unknown as CanvasRenderingContext2D, [edge], 1, 'glasswind-desert')
    const dark = paths.filter(({ stops }) => stops.some((colour) => colour.includes('48,49,44')))
    expect(dark.length).toBeGreaterThan(3)
    for (const path of dark) {
      const along = path.points.map((p) => p[side % 2 ? 1 : 0]!)
      expect(Math.max(...along) - Math.min(...along)).toBeLessThan(1.4)
    }
    // Sediment and wrack are ground texture, never an invented land apron.
    for (const { points: vertices } of paths)
      for (const [x, y] of vertices) {
        const inward = side === 0 ? y! : side === 1 ? 13 - x! : side === 2 ? 9 - y! : x!
        expect(inward).toBeGreaterThanOrEqual(-1e-12)
        expect(inward).toBeLessThan(1.3)
        const along = side % 2 ? y! : x!
        expect(along).toBeGreaterThanOrEqual(2)
        expect(along).toBeLessThanOrEqual(7)
      }
  },
)

it.each([0, 1, 2, 3] as const)(
  'interrupts the straight bank on side %s with bounded wet-sediment tongues',
  (side) => {
    const paths: { points: number[][]; stops: string[] }[] = []
    let points: number[][] = []
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: () => {
        points = []
      },
      moveTo: (x: number, y: number) => points.push([x, y]),
      lineTo: (x: number, y: number) => points.push([x, y]),
      closePath: vi.fn(),
      fillRect: vi.fn(),
      createLinearGradient: () => ({
        stops: [] as string[],
        addColorStop(_at: number, colour: string) {
          this.stops.push(colour)
        },
      }),
      fillStyle: null as unknown,
      fill() {
        paths.push({ points, stops: (this.fillStyle as { stops: string[] }).stops })
      },
    }
    const edge = { side, from: 1, to: 8, seed: 91, openStart: false, openEnd: false }
    paintCoastLand(context as unknown as CanvasRenderingContext2D, [edge], 1, 'frostmere')
    const wash = paths.filter(({ stops }) => stops.includes('#575b54'))
    expect(wash.length).toBeGreaterThanOrEqual(3)
    for (const { points: vertices } of wash) {
      const along = vertices.map((point) => point[side % 2 ? 1 : 0]!)
      expect(Math.max(...along) - Math.min(...along)).toBeLessThan(1.8)
      for (const [x, y] of vertices) {
        const inward = side === 0 ? y! : side === 1 ? 13 - x! : side === 2 ? 9 - y! : x!
        expect(inward).toBeGreaterThanOrEqual(-1e-12)
        expect(inward).toBeLessThanOrEqual(0.72)
      }
    }
  },
)

it('retains the global sixteen-edge and three-crest surf budget', () => {
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
  }
  const edges = Array.from({ length: 24 }, (_, seed) => ({
    side: 1 as const,
    from: 0,
    to: 9,
    seed,
    openStart: false,
    openEnd: false,
  }))
  expect(
    paintCoastSea(context as unknown as CanvasRenderingContext2D, edges, 48, 1000, true, 24),
  ).toBe(16)
  expect(context.stroke).toHaveBeenCalledTimes(48)
  expect(
    paintCoastSea(context as unknown as CanvasRenderingContext2D, edges, 48, 1000, true, 0),
  ).toBe(0)
  expect(context.stroke).toHaveBeenCalledTimes(48)
})

it('carries regional dry sediment across the curved wet lip instead of a constant dark border', () => {
  const fills: unknown[] = [],
    stops: string[][] = []
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillStyle: null as unknown,
    createLinearGradient() {
      const colours: string[] = []
      stops.push(colours)
      return {
        colours,
        addColorStop(_n: number, s: string) {
          colours.push(s)
        },
      }
    },
    fill() {
      fills.push(this.fillStyle)
    },
  }
  paintCoastSea(
    ctx as unknown as CanvasRenderingContext2D,
    [{ side: 1, from: 1, to: 7, seed: 53, openStart: false, openEnd: false }],
    64,
    1000,
    false,
    1,
    'frostmere',
    0,
  )
  expect(typeof fills[1]).toBe('object')
  expect(stops.some((s) => s[0]?.includes('165,150,125') && s.at(-1) === '#575b54')).toBe(true)
})

it('rolls occasional shoreward breakers through gentle surf, stronger in storms and frozen when motion is off', () => {
  const sample = (time: number, wind: number, animate = true) => {
    const strokes: { width: number; alpha: number; points: number[][] }[] = []
    let points: number[][] = []
    const ctx = {
      lineWidth: 0,
      globalAlpha: 1,
      save() {},
      restore() {},
      beginPath() {
        points = []
      },
      closePath() {},
      fill() {},
      moveTo(x: number, y: number) {
        points.push([x, y])
      },
      lineTo(x: number, y: number) {
        points.push([x, y])
      },
      createLinearGradient: () => ({ addColorStop() {} }),
      stroke() {
        strokes.push({ width: this.lineWidth, alpha: this.globalAlpha, points: [...points] })
      },
    }
    paintCoastSea(
      ctx as unknown as CanvasRenderingContext2D,
      [{ side: 0, from: 1, to: 8, seed: 53, openStart: false, openEnd: false }],
      48,
      time,
      animate,
      1,
      'hollow-coast',
      3,
      wind,
    )
    return strokes
  }
  const samples = Array.from({ length: 60 }, (_, i) => sample(i * 500, 0.007))
  const widths = samples.map((s) => s[0]!.width)
  expect(Math.max(...widths)).toBeGreaterThan(Math.min(...widths) * 1.5)
  expect(samples.every((s) => s.length === 3)).toBe(true)
  expect(Math.max(...sample(9000, 0.055).map((s) => s.width))).toBeGreaterThan(
    Math.max(...sample(9000, 0.007).map((s) => s.width)),
  )
  expect(sample(100, 0.055, false)).toEqual(sample(20000, 0.055, false))
  const start = sample(1000, 0)[0]!.points[7]![1]!
  const later = sample(1500, 0)[0]!.points[7]![1]!
  expect(later).toBeGreaterThan(start)
})

it('treats shallow water and explicit unknown cells as non-land at a public sea edge', () => {
  const root = projectWorld(newWorldState(), [], 1000).sectors[0]!
  for (const terrain of ['w', '?']) {
    const wet = { ...root, cells: root.cells.map((c) => ({ ...c, terrain })) }
    expect(buildPublicCoasts({ sectors: [wet], atlas: [] }).get(root.id)).toEqual([])
  }
})
it('does not let a private neighbour change a public coastline', () => {
  const root = projectWorld(newWorldState(), [], 1000).sectors[0]!,
    publicLand = { ...root, cells: root.cells.map((c) => ({ ...c, terrain: '.' })) }
  const foreign = {
    ...publicLand,
    id: 'private-overlap',
    charted: false,
    atlasColumn: root.atlasColumn! + 1,
  }
  expect(buildPublicCoasts({ sectors: [publicLand, foreign], atlas: [] }).get(root.id)).toEqual(
    buildPublicCoasts({ sectors: [publicLand], atlas: [] }).get(root.id),
  )
})

function oceanCanvas() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    ellipse: vi.fn(),
    stroke: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  }
}
it('paints a bounded ocean field beyond coastal aprons without requiring any geography', () => {
  const context = oceanCanvas()
  const count = paintOpenSea(
    context as unknown as CanvasRenderingContext2D,
    900,
    600,
    48,
    { x: 70, y: 30 },
    1200,
    true,
    { rain: 0.8, windSpeed: 0.05 },
    24,
  )
  expect(context.fillRect).toHaveBeenCalledWith(0, 0, 900, 600)
  expect(context.createLinearGradient).toHaveBeenCalled()
  expect(count).toBeGreaterThan(0)
  expect(count).toBeLessThanOrEqual(24)
  expect(context.stroke).toHaveBeenCalledTimes(count)
  expect(context.bezierCurveTo).toHaveBeenCalledTimes(count)
  expect(context.bezierCurveTo.mock.calls.flat().every(Number.isFinite)).toBe(true)
})
it('keeps ocean detail world anchored through camera translation and freezes ambient motion', () => {
  const a = oceanCanvas(),
    b = oceanCanvas(),
    later = oceanCanvas()
  paintOpenSea(
    a as unknown as CanvasRenderingContext2D,
    900,
    600,
    48,
    { x: 70, y: 30 },
    1000,
    false,
    { rain: 0, windSpeed: 0 },
    24,
  )
  paintOpenSea(
    b as unknown as CanvasRenderingContext2D,
    900,
    600,
    48,
    { x: 70.1, y: 30 },
    1000,
    false,
    { rain: 0, windSpeed: 0 },
    24,
  )
  paintOpenSea(
    later as unknown as CanvasRenderingContext2D,
    900,
    600,
    48,
    { x: 70, y: 30 },
    9000,
    false,
    { rain: 1, windSpeed: 0.06 },
    24,
  )
  expect(a.moveTo.mock.calls.length).toBeGreaterThan(0)
  expect(a.moveTo.mock.calls.length).toBe(b.moveTo.mock.calls.length)
  for (let i = 0; i < a.moveTo.mock.calls.length; i++) {
    expect(b.moveTo.mock.calls[i]![0] - a.moveTo.mock.calls[i]![0]).toBeCloseTo(-0.1 * 48 * 0.85, 9)
    expect(b.moveTo.mock.calls[i]![1] - a.moveTo.mock.calls[i]![1]).toBeCloseTo(-0.1 * 48 * 0.44, 9)
  }
  expect(a.bezierCurveTo.mock.calls).toEqual(later.bezierCurveTo.mock.calls)
  expect(a.ellipse.mock.calls).toEqual(later.ellipse.mock.calls)
  expect(a.stroke.mock.calls.length).toBe(later.stroke.mock.calls.length)
})
it('keeps ocean work bounded at extreme zoom and never increases crest count with wind or rain', () => {
  for (const tile of [2, 12, 128]) {
    const calm = oceanCanvas(),
      storm = oceanCanvas()
    const a = paintOpenSea(
      calm as unknown as CanvasRenderingContext2D,
      1600,
      1000,
      tile,
      { x: 70, y: 30 },
      1000,
      true,
      { rain: 0, windSpeed: 0 },
      16,
    )
    const b = paintOpenSea(
      storm as unknown as CanvasRenderingContext2D,
      1600,
      1000,
      tile,
      { x: 70, y: 30 },
      1000,
      true,
      { rain: 1, windSpeed: 0.06 },
      16,
    )
    expect(a).toBeGreaterThan(0)
    expect(a).toBeLessThanOrEqual(16)
    expect(b).toBe(a)
  }
})
