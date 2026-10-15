import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { projectWorld, resolveWorldIntent } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import { localRoute, WorldMotion } from './world-motion'

describe('confirmed distant-click routes', () => {
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
