import { describe, expect, it } from 'vitest'
import type { WorldView } from '@/world/types'
import { WorldMotion } from './world-motion'
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
