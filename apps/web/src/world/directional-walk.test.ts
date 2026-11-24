import type { MapDirection } from './wild-ids'
import { expect, it } from 'vitest'
import { directionalWalk, walkOffset } from './directional-walk'
import { GRID_HEIGHT, GRID_WIDTH } from './catalog'
import { findWorldRoute } from './travel'
import type { WorldSector, WorldSectorView, WorldView } from './types'
import { projectMapPoint } from '@/components/world/map-projection'
import { WorldMotion } from '@/components/world/world-motion'

const origin = { sectorId: 'plain', x: 5, y: 4 }
const plain: WorldSector = {
  id: origin.sectorId,
  name: 'Plain',
  coordinate: '',
  regionId: '',
  art: null,
  east: 0,
  north: 0,
  charted: true,
  atlasColumn: 127,
  atlasRow: 1,
  rows: Array(GRID_HEIGHT).fill('.'.repeat(GRID_WIDTH)),
  landmarks: [],
  roads: [],
}
function visibleSector(sector: WorldSector): WorldSectorView {
  const { rows, roads, ...rest } = sector
  return {
    ...rest,
    exits: [...roads],
    cells: rows.flatMap((row, y) =>
      [...row].map((terrain, x) => ({
        x,
        y,
        terrain,
        walkable: terrain === '.',
        safe: true,
      })),
    ),
  }
}
it('stops at a river even when a click can find a path around it', () => {
  const rows = [...plain.rows]
  rows[origin.y - 1] = '.....~.......'
  const sector = { ...plain, rows }
  const destination = { ...origin, y: origin.y - 2 }
  expect(findWorldRoute(origin, destination, [sector])?.length).toBeGreaterThan(2)
  expect(directionalWalk(origin, destination, 'north', () => sector)).toEqual([])
})
it('uses only an aligned approved seam and stops at the first withheld cell', () => {
  const start = { ...origin, x: GRID_WIDTH - 1 }
  const arrival = { sectorId: 'beyond', x: 0, y: start.y }
  const west = {
    ...plain,
    roads: [
      { from: start, to: { ...arrival, y: start.y - 1 }, name: 'Offset gate', durationMs: 200 },
      { from: start, to: arrival, name: 'Seam', durationMs: 400 },
    ],
  }
  const east = { ...plain, id: arrival.sectorId, atlasColumn: 0 }
  const lookup = (id: string) => (id === west.id ? west : east)
  expect(directionalWalk(start, { ...arrival, x: 2 }, 'east', lookup, (p) => p.x !== 1)).toEqual([
    { position: arrival, road: 'Seam', durationMs: 400 },
  ])
  expect(
    directionalWalk(start, { ...arrival, x: 2 }, 'east', (id) =>
      id === west.id ? { ...west, roads: west.roads.slice(0, 1) } : east,
    ),
  ).toEqual([])
})
it.each(Object.entries(walkOffset) as [MapDirection, { x: number; y: number }][])(
  'keeps %s on a single screen-space heading and bounds predictions through repeated delayed writes',
  (direction, offset) => {
    const sectors = [visibleSector(plain)]
    const view = {
      position: origin,
      sectors,
      route: [],
      serverNow: 0,
      nextStepAt: null,
    } as unknown as WorldView
    const motion = new WorldMotion(view, 0)
    const destination = { ...origin, x: origin.x + 4 * offset.x, y: origin.y + 4 * offset.y }
    const anchor = motion.sample(0).point
    const zero = { x: 0, y: 0 }
    const screen = (p: typeof zero) => projectMapPoint(p, anchor, zero, 1, 0, 0)
    const heading = screen({ x: anchor.x + offset.x, y: anchor.y + offset.y })
    let progress = 0
    for (let t = 0; t <= 2000; t += 25) {
      if (t % 200 === 0) motion.planDirectional(destination, direction, sectors, t)
      const point = screen(motion.sample(t).point)
      expect(point.x * heading.y - point.y * heading.x).toBeCloseTo(0, 8)
      const projected =
        (point.x * heading.x + point.y * heading.y) / (heading.x ** 2 + heading.y ** 2)
      expect(projected).toBeGreaterThanOrEqual(progress - 1e-8)
      progress = projected
    }
    expect(progress).toBeCloseTo(3)
  },
)

it.each([true, false])(
  'finishes outstanding east travel before exposing a north turn (click still pending: %s)',
  (pending) => {
    const sectors = [visibleSector(plain)]
    const view = {
      position: origin,
      sectors,
      route: [],
      serverNow: 0,
      nextStepAt: null,
    } as unknown as WorldView
    const motion = new WorldMotion(view, 0)
    const click = { ...origin, x: origin.x + 5 }
    const guessed = { ...origin, x: origin.x + 2, y: origin.y - 3 }
    const east = findWorldRoute(origin, click, [plain])!
    motion.plan(east, sectors, 0, 'destination')
    if (!pending) motion.approveReceipt({ ...view, route: east, serverNow: 0, nextStepAt: 200 }, 0)
    const turn = motion.planDirectional(guessed, 'north', sectors, 390, pending)!
    expect(turn).toBeDefined()
    expect(motion.planDirectional(guessed, 'north', sectors, 600, true)).toBe(turn)
    expect(motion.sample(1200).position).toEqual({ ...origin, x: origin.x + 2 })
    const actualCorner = { ...origin, x: origin.x + 4 }
    const arrival = { ...actualCorner, y: guessed.y }
    const approved = {
      ...view,
      position: actualCorner,
      nextStepAt: 1200,
      serverNow: 1000,
      route: findWorldRoute(actualCorner, arrival, [plain])!,
    }
    motion.approveReceipt(approved, 1400)
    motion.confirmDirectional(approved, turn, 1400)
    expect(motion.planDirectional(guessed, 'north', sectors, 1500, true)).toBe(turn)
    const base = motion.sample(1400).point
    for (let t = 1400; t <= 2400; t += 25) {
      const point = motion.sample(t).point
      expect(point.x).toBeCloseTo(base.x + Math.min(2, (t - 1400) / 200))
      expect(point.y).toBeCloseTo(base.y - Math.max(0, (t - 1800) / 200))
    }
    expect(motion.sample(2400).position).toEqual(arrival)
    motion.confirmDirectional(approved, turn, 2400)
    expect(motion.sample(2700).position).toEqual(arrival)
  },
)
