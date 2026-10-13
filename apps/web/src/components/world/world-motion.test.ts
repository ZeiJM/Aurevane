import { describe, expect, it } from 'vitest'
import type { WorldView } from '@/world/types'
import { localRoute, WorldMotion } from './world-motion'
const position = { sectorId: 'a', x: 1, y: 4 }
const sectors = [
  {
    id: 'a',
    atlasColumn: 0,
    atlasRow: 0,
    exits: [],
    cells: Array.from({ length: 117 }, (_, i) => ({
      x: i % 13,
      y: Math.floor(i / 13),
      terrain: '.',
      walkable: true,
    })),
  },
]
const view = { position, sectors, route: [] } as unknown as WorldView
const route = [2, 3, 4].map((x) => ({ position: { ...position, x }, durationMs: 200 }))
describe('world visual motion', () => {
  it('does not interpolate an omitted source sector through overlapping public ground', () => {
    const motion = new WorldMotion(view)
    motion.plan(route, view.sectors, 0)
    const replacement = { ...view.sectors[0]!, id: 'public-overlay', charted: true }
    const confirmed = [
      [2, 4],
      [2, 3],
      [3, 3],
      [3, 2],
      [3, 1],
      [4, 1],
    ].map(([x, y]) => ({
      position: { sectorId: replacement.id, x: x!, y: y! },
      durationMs: 200,
    }))
    motion.reconcile(
      {
        ...view,
        position: { ...position, sectorId: replacement.id },
        sectors: [replacement],
        route: confirmed,
      },
      650,
    )
    expect(motion.sample(650).point).toEqual({ x: 1.5, y: 4.5 })
  })
  it('does not borrow overlapping public ground when the private preview source is withheld', () => {
    const motion = new WorldMotion(view)
    motion.plan(route, view.sectors, 0)
    const privateSector = {
      ...view.sectors[0]!,
      charted: false,
      cells: view.sectors[0]!.cells.filter((cell) => cell.x !== 4 || cell.y !== 4),
    }
    const overlay = {
      ...view.sectors[0]!,
      id: 'public-overlay',
      charted: true,
      exits: [
        {
          from: { sectorId: 'public-overlay', x: 4, y: 4 },
          to: { ...position, x: 4, y: 3 },
          durationMs: 200,
          name: 'Overlap',
        },
      ],
    }
    const confirmed = [
      [2, 4],
      [2, 3],
      [3, 3],
      [3, 2],
      [3, 1],
      [4, 1],
    ].map(([x, y]) => ({ position: { ...position, x: x!, y: y! }, durationMs: 200 }))
    motion.reconcile({ ...view, sectors: [privateSector, overlay], route: confirmed }, 650)
    expect(motion.sample(650).point).toEqual({ x: 1.5, y: 4.5 })
  })
  it('continues toward a distant click when a delayed receipt confirms a different legal path', () => {
    const motion = new WorldMotion(view)
    const preview = [
      [2, 4],
      [3, 4],
      [4, 4],
      [4, 3],
      [4, 2],
      [4, 1],
    ].map(([x, y]) => ({ position: { ...position, x: x!, y: y! }, durationMs: 200 }))
    const confirmed = [
      [2, 4],
      [2, 3],
      [3, 3],
      [3, 2],
      [3, 1],
      [4, 1],
    ].map(([x, y]) => ({ position: { ...position, x: x!, y: y! }, durationMs: 200 }))
    motion.plan(preview, view.sectors, 0)
    const before = motion.sample(650).point
    motion.reconcile({ ...view, route: confirmed }, 650)
    expect(motion.sample(650).point).toEqual(before)
    expect(motion.sample(666).point.x).toBeCloseTo(before.x)
    expect(motion.sample(666).point.y).toBeLessThan(before.y)
    expect(motion.sample(1250)).toEqual({
      point: { x: 4.5, y: 1.5 },
      position: preview.at(-1)!.position,
      moving: false,
    })
  })
  it('settles an already reached destination without revisiting the preceding tile', () => {
    const motion = new WorldMotion(view)
    motion.plan(route, view.sectors, 0)
    const before = motion.sample(425).point
    motion.plan(route.slice(0, 2), view.sectors, 425)
    expect(motion.sample(425).point).toEqual(before)
    expect(motion.sample(525)).toEqual({
      point: { x: 3.5, y: 4.5 },
      position: route[1]!.position,
      moving: false,
    })
  })
  it('settles a click on the current tile centre instead of freezing between tiles', () => {
    const motion = new WorldMotion(view)
    motion.plan(route, view.sectors, 0)
    const before = motion.sample(100).point
    // A click on the tile currently occupied yields a valid zero-step route.
    motion.plan([], view.sectors, 100)
    expect(motion.sample(100).point).toEqual(before)
    expect(motion.sample(116).point.x).toBeCloseTo(before.x - 16 / 200)
    expect(motion.sample(250)).toEqual({
      point: { x: 1.5, y: 4.5 },
      position,
      moving: false,
    })
  })
  it('uses the remaining preview time to keep a slow-terrain click moving to its full destination', () => {
    const motion = new WorldMotion(view)
    const slow = route.map((step) => ({ ...step, durationMs: 400 }))
    motion.plan(slow, view.sectors, 0)
    const before = motion.sample(350).point
    motion.plan(slow, view.sectors, 350)
    expect(motion.sample(350).point).toEqual(before)
    expect(motion.sample(800).point.x).toBeCloseTo(3.5)
    motion.reconcile({ ...view, position: slow[1]!.position, route: slow.slice(2) }, 900)
    expect(motion.sample(1400)).toEqual({
      point: { x: 4.5, y: 4.5 },
      position: slow.at(-1)!.position,
      moving: false,
    })
  })
  it.each([
    { durationMs: 200, nextArrival: 400 },
    { durationMs: 400, nextArrival: 815 },
  ])(
    'does not backtrack when a route calculation crosses a $durationMs ms tile deadline',
    ({ durationMs, nextArrival }) => {
      const motion = new WorldMotion(view)
      const forward = [2, 3, 4, 5, 6].map((x) => ({
        position: { ...position, x },
        durationMs,
      }))
      motion.plan(forward, view.sectors, 0)
      // The route was calculated just before landing on x=2, but is applied
      // after that boundary. Its first tile has already been traversed.
      const now = durationMs + 15
      const before = motion.sample(now).point
      motion.plan(forward, view.sectors, now)
      expect(motion.sample(now).point).toEqual(before)
      expect(motion.sample(now + 16).point.x).toBeGreaterThan(before.x)
      expect(motion.sample(nextArrival).point.x).toBeCloseTo(3.5)
      motion.reconcile({ ...view, route: forward }, now + 40)
      let previous = motion.sample(now + 40).point.x
      const finalArrival = nextArrival + durationMs * 3
      for (let time = now + 56; time <= finalArrival; time += 16) {
        const point = motion.sample(time).point.x
        expect(point - previous).toBeGreaterThanOrEqual(0)
        expect(point - previous).toBeLessThanOrEqual(16 / durationMs + 0.0001)
        previous = point
      }
      expect(motion.sample(finalArrival).position).toEqual(forward.at(-1)!.position)
    },
  )
  it('keeps cached routes isolated when a later terrain snapshot withholds a connecting cell', () => {
    const corridor = {
      ...view,
      sectors: view.sectors.map((sector) => ({
        ...sector,
        cells: sector.cells.filter((cell) => cell.y === 4 && cell.x >= 1 && cell.x <= 3),
      })),
    }
    const destination = { ...position, x: 3 }
    expect(localRoute(corridor, position, destination)?.map((step) => step.position.x)).toEqual([
      2, 3,
    ])
    const restricted = {
      ...corridor,
      sectors: corridor.sectors.map((sector) => ({
        ...sector,
        cells: sector.cells.filter((cell) => cell.x !== 2),
      })),
    }
    expect(localRoute(restricted, position, destination)).toBeNull()
    expect(localRoute(corridor, position, destination)).toHaveLength(2)
  })
  it('preserves the authored arrival deadline when a forward preview is replanned mid-step', () => {
    const motion = new WorldMotion(view)
    motion.plan(route, view.sectors, 0)
    const before = motion.sample(100).point
    motion.plan(route, view.sectors, 100)
    expect(motion.sample(100).point).toEqual(before)
    expect(motion.sample(150).point.x).toBeCloseTo(2.25)
    expect(motion.sample(200).point.x).toBeCloseTo(2.5)
    expect(motion.sample(400).point.x).toBeCloseTo(3.5)
  })
  it('keeps slow authored pace through repeated plans and delayed forward receipts', () => {
    const motion = new WorldMotion(view)
    const slow = [2, 3].map((x) => ({ position: { ...position, x }, durationMs: 400 }))
    motion.plan(slow, view.sectors, 0)
    motion.plan(slow, view.sectors, 100)
    expect(motion.sample(400).point.x).toBeCloseTo(2.5)
    motion.reconcile({ ...view, route: slow }, 250)
    let previous = motion.sample(250).point.x
    for (let now = 266; now <= 800; now += 16) {
      const point = motion.sample(now).point.x
      expect(point - previous).toBeGreaterThanOrEqual(0)
      expect(point - previous).toBeLessThanOrEqual(16 / 400 + 0.0001)
      previous = point
    }
    expect(motion.sample(800).point.x).toBeCloseTo(3.5)
  })
  it('settles a final authoritative arrival without jumping from a slower preview', () => {
    const motion = new WorldMotion(view)
    motion.plan(route, view.sectors, 0)
    const before = motion.sample(500).point
    motion.reconcile({ ...view, position: route[2]!.position }, 500)
    expect(motion.sample(500).point).toEqual(before)
    expect(motion.sample(516).point.x - before.x).toBeLessThan(0.1)
    expect(motion.sample(800)).toEqual({
      point: { x: 4.5, y: 4.5 },
      position: route[2]!.position,
      moving: false,
    })
  })
  it('keeps a drained preview continuous when a later confirmation has advanced beyond it', () => {
    const motion = new WorldMotion(view)
    motion.plan(route, view.sectors, 0)
    const before = motion.sample(1600).point
    motion.reconcile(
      {
        ...view,
        position: { ...position, x: 7 },
        route: [{ position: { ...position, x: 8 }, durationMs: 200 }],
      },
      1600,
    )
    expect(motion.sample(1600).point).toEqual(before)
    expect(motion.sample(1616).point.x - before.x).toBeCloseTo(0.08)
    expect(motion.sample(3000).point.x).toBe(8.5)
  })
  it('keeps confirmed terrain step durations after a mid-step receipt', () => {
    const motion = new WorldMotion(view)
    const slow = route.map((step) => ({ ...step, durationMs: 400 }))
    motion.reconcile({ ...view, route: slow }, 0)
    motion.reconcile({ ...view, route: slow }, 100)
    expect(motion.sample(400).point.x).toBeCloseTo(2.5)
    expect(motion.sample(800).point.x).toBeCloseTo(3.5)
  })
  it('settles a delayed receipt along known walkable terrain around a water tile', () => {
    const waterView = {
      ...view,
      sectors: view.sectors.map((sector) => ({
        ...sector,
        cells: sector.cells.map((cell) =>
          cell.x === 5 && cell.y === 4 ? { ...cell, terrain: '~', walkable: false } : cell,
        ),
      })),
    }
    const motion = new WorldMotion(waterView)
    motion.plan(route, waterView.sectors, 0)
    const before = motion.sample(1600).point
    motion.reconcile({ ...waterView, position: { ...position, x: 7 } }, 1600)
    expect(motion.sample(1600).point).toEqual(before)
    for (let now = 1600; now <= 3200; now += 20) {
      const sample = motion.sample(now)
      expect(Math.floor(sample.point.x) === 5 && Math.floor(sample.point.y) === 4).toBe(false)
    }
    expect(motion.sample(3200).position).toEqual({ ...position, x: 7 })
  })
  it('previews and reconciles an eastbound longitude crossing as one tile without a visual rewind', () => {
    const seamView = {
      ...view,
      position: { sectorId: 'west', x: 12, y: 4 },
      sectors: [
        { id: 'west', atlasColumn: 127, atlasRow: 32, charted: true },
        { id: 'east', atlasColumn: 0, atlasRow: 32, charted: true },
      ],
    } as unknown as WorldView
    const crossing = [{ position: { sectorId: 'east', x: 0, y: 4 }, durationMs: 200 }]
    const motion = new WorldMotion(seamView)
    motion.plan(crossing, seamView.sectors, 0)
    const start = motion.sample(0).point
    expect(motion.sample(100).point.x - start.x).toBeCloseTo(0.5)
    motion.reconcile({ ...seamView, route: crossing }, 100)
    expect(motion.sample(110).point.x - start.x).toBeGreaterThanOrEqual(0.5)
    motion.reconcile({ ...seamView, position: crossing[0]!.position }, 200)
    expect(motion.sample(200).point.x - start.x).toBeCloseTo(1)
    expect(motion.sample(200).position).toEqual(crossing[0]!.position)
  })
  it('keeps westbound and repeated seam crossings continuous while preserving canonical positions', () => {
    const seamView = {
      ...view,
      position: { sectorId: 'east', x: 0, y: 4 },
      sectors: [
        { id: 'west', atlasColumn: 127, atlasRow: 32, charted: true },
        { id: 'east', atlasColumn: 0, atlasRow: 32, charted: true },
      ],
    } as unknown as WorldView
    const west = { sectorId: 'west', x: 12, y: 4 }
    const motion = new WorldMotion(seamView)
    motion.plan([{ position: west, durationMs: 200 }], seamView.sectors, 0)
    expect(motion.sample(100).point.x).toBeCloseTo(0)
    motion.reconcile({ ...seamView, position: west }, 200)
    expect(motion.sample(200).point.x).toBeCloseTo(-0.5)
    motion.plan([{ position: seamView.position, durationMs: 200 }], seamView.sectors, 200)
    expect(motion.sample(300).point.x).toBeCloseTo(0)
    motion.reconcile(seamView, 400)
    expect(motion.sample(400).point.x).toBeCloseTo(0.5)
  })
  it.each(
    [200, 400].flatMap((durationMs) =>
      ['straight', 'turn', 'seam'].map((path) => ({ durationMs, path })),
    ),
  )(
    'keeps confirmed $durationMs ms $path steps on phase through repeated near-boundary receipts',
    ({ durationMs, path }) => {
      const initial =
        path === 'seam'
          ? ({
              ...view,
              position: { sectorId: 'west', x: 12, y: 4 },
              sectors: [
                { id: 'west', atlasColumn: 127, atlasRow: 32, charted: true },
                { id: 'east', atlasColumn: 0, atlasRow: 32, charted: true },
              ],
            } as unknown as WorldView)
          : view
      const destinations =
        path === 'seam'
          ? [0, 1, 2].map((x) => ({ sectorId: 'east', x, y: 4 }))
          : (path === 'turn'
              ? [
                  [2, 4],
                  [2, 3],
                  [3, 3],
                ]
              : [
                  [2, 4],
                  [3, 4],
                  [4, 4],
                ]
            ).map(([x, y]) => ({ ...position, x: x!, y: y! }))
      const confirmed = {
        ...initial,
        route: destinations.map((position) => ({ position, durationMs })),
      }
      const reference = new WorldMotion(initial)
      const motion = new WorldMotion(initial)
      reference.reconcile(confirmed, 0)
      motion.reconcile(confirmed, 0)
      const receipts = new Set([
        durationMs - 10,
        durationMs,
        2 * durationMs - 10,
        2 * durationMs,
        3 * durationMs - 10,
      ])
      for (let now = 0; now <= 3 * durationMs; now++) {
        if (receipts.has(now)) motion.reconcile(confirmed, now)
        for (const axis of ['x', 'y'] as const)
          expect(motion.sample(now).point[axis], `at ${now}ms ${axis}`).toBeCloseTo(
            reference.sample(now).point[axis],
            8,
          )
      }
      expect(motion.sample(3 * durationMs)).toEqual(reference.sample(3 * durationMs))
      motion.reconcile(confirmed, 3 * durationMs)
      expect(motion.sample(3 * durationMs).moving).toBe(false)
    },
  )
  it('bounds an unconfirmed preview and never interpolates into an unloaded sector', () => {
    const motion = new WorldMotion(view)
    motion.plan(
      Array.from({ length: 10 }, (_, i) => ({
        position: { ...position, x: 2 + i },
        durationMs: 200,
      })),
      view.sectors,
      0,
    )
    expect(motion.sample(3000).point.x).toBeLessThanOrEqual(4.5)
    motion.reconcile(
      {
        ...view,
        route: [...route, { position: { sectorId: 'unloaded', x: 0, y: 4 }, durationMs: 200 }],
      },
      0,
    )
    expect(motion.sample(5000).point.x).toBe(4.5)
  })
  it('starts interpolation immediately and never rewinds on a late confirmation', () => {
    const motion = new WorldMotion(view)
    motion.plan(route, view.sectors, 0)
    expect(motion.sample(40).point.x).toBeGreaterThan(1.5)
    const before = motion.sample(250).point.x
    motion.reconcile({ ...view, route }, 250)
    expect(motion.sample(270).point.x).toBeGreaterThanOrEqual(before)
  })
  it('replans from the interpolated position instead of the old tile', () => {
    const motion = new WorldMotion(view)
    motion.plan(route, view.sectors, 0)
    const before = motion.sample(250).point
    motion.plan([{ position: { ...position, x: 3, y: 5 }, durationMs: 200 }], view.sectors, 250)
    expect(motion.sample(250).point).toEqual(before)
    expect(motion.sample(300).point.y).toBeGreaterThan(before.y)
  })
})
