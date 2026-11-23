import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { projectWorld, resolveWorldIntent } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import { localRoute, WorldMotion } from './world-motion'

describe('confirmed distant-click routes', () => {
  it('keeps a partial turn on canonical public ground moving until timely approval', () => {
    const state = { ...newWorldState(), position: { sectorId: 'atlas:58:28', x: 6, y: 4 } }
    const view = projectWorld(state, [], 1000)
    const straight = localRoute(view, state.position, { ...state.position, x: 9 })!
    const destination = { ...state.position, y: 0 }
    const turn = localRoute(view, state.position, destination)!
    expect(turn).toHaveLength(4)
    const motion = new WorldMotion(view)
    motion.plan(straight, view.sectors, 0)
    motion.plan(turn, view.sectors, 100)
    expect(motion.sample(550).moving).toBe(true)
    const before = motion.sample(650)
    expect(before.moving).toBe(true)
    const confirmed = resolveWorldIntent(state, { kind: 'walk', destination }, 1100)
    expect(confirmed.route.at(-1)!.position).toEqual(destination)
    motion.reconcile(projectWorld(confirmed, [], 1100), 650)
    expect(motion.sample(650).point).toEqual(before.point)
    expect(motion.sample(666).point).not.toEqual(before.point)
    expect(motion.sample(2000).position).toEqual(destination)
  })
  it('does not return to the old origin when the server confirms a different equally legal path', () => {
    const state = {
      ...newWorldState(),
      position: { sectorId: 'verdant-expanse', x: 10, y: 4 },
      discoveries: { 'survey-01': [110] },
    }
    const view = projectWorld(state, [], 1000)
    const destination = { sectorId: 'verdant-expanse', x: 6, y: 0 }
    const confirmed = resolveWorldIntent(state, { kind: 'walk', destination }, 1000)
    const corner = confirmed.route[0]!.position
    // A preceding supplied scene blocks one corner that the fresh canonical
    // scene opens. Both real navigators must still reach the same destination,
    // using different legal paths independently of A*/Dijkstra tie-breaking.
    const earlier = {
      ...view,
      sectors: view.sectors.map((sector) => ({
        ...sector,
        cells: sector.cells.map((cell) =>
          sector.id === corner.sectorId && cell.x === corner.x && cell.y === corner.y
            ? { ...cell, terrain: '#', walkable: false }
            : cell,
        ),
      })),
    }
    const preview = localRoute(earlier, state.position, destination)!
    expect(preview).not.toEqual(confirmed.route)
    for (const step of preview)
      expect(
        view.sectors
          .find((sector) => sector.id === step.position.sectorId)
          ?.cells.some(
            (cell) => cell.x === step.position.x && cell.y === step.position.y && cell.walkable,
          ),
      ).toBe(true)
    expect(preview.at(-1)!.position).toEqual(destination)
    expect(confirmed.route.at(-1)!.position).toEqual(destination)
    const motion = new WorldMotion(view)
    motion.plan(preview, view.sectors, 0)
    const before = motion.sample(650).point
    motion.reconcile(projectWorld(confirmed, [], 1000), 650)
    expect(motion.sample(650).point).toEqual(before)
    expect(motion.sample(666).point.x).toBeLessThanOrEqual(before.x)
    expect(motion.sample(10000).position).toEqual(destination)
  })
})
