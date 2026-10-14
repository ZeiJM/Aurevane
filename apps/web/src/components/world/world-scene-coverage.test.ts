import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { projectWorld, resolveWorldIntent } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import { mapPoint } from './world-motion'
import { worldSceneCoversViewport } from './world-scene-coverage'
const viewport = { width: 1296, height: 944, tile: 64 * 0.35 }
it.each([
  { x: 2, y: 4 },
  { x: 5, y: 7 },
  { x: 11, y: 4 },
])(
  'detects missing public background after movement to$x,$y despite supplied route ground',
  (position) => {
    const state = resolveWorldIntent(
      newWorldState(),
      {
        kind: 'walk',
        destination: { sectorId: 'verdant-expanse', x: 8, y: 4 },
      },
      1000,
    )
    const view = projectWorld(state, [], 1000)
    const destination = { sectorId: 'verdant-expanse', ...position }
    expect(
      view.sectors
        .find((sector) => sector.id === destination.sectorId)
        ?.cells.some(
          (cell) => cell.x === destination.x && cell.y === destination.y && cell.walkable,
        ),
    ).toBe(true)
    expect(worldSceneCoversViewport(view, [mapPoint(destination, view.sectors)], viewport)).toBe(
      false,
    )
    const fresh = projectWorld(
      { ...state, position: destination, route: [], nextStepAt: null },
      [],
      1000,
    )
    expect(worldSceneCoversViewport(fresh, [mapPoint(destination, fresh.sectors)], viewport)).toBe(
      true,
    )
  },
)
it('keeps unchanged covered scenery and requires complete supplied ground', () => {
  const view = projectWorld(newWorldState(), [], 1000),
    point = mapPoint(view.position, view.sectors)
  expect(worldSceneCoversViewport(view, [point], viewport)).toBe(true)
  expect(worldSceneCoversViewport({ ...view, scenery: [] }, [point], viewport)).toBe(false)
})
