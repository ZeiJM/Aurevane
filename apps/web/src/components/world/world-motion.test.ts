import { describe, expect, it } from 'vitest'
import type { WorldView } from '@/world/types'
import { WorldMotion } from './world-motion'
const position = { sectorId: 'a', x: 1, y: 4 }
const sectors = [{ id: 'a', atlasColumn: 0, atlasRow: 0 }]
const view = { position, sectors, route: [] } as unknown as WorldView
const route = [2, 3, 4].map((x) => ({ position: { ...position, x }, durationMs: 200 }))
describe('world visual motion', () => {
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
