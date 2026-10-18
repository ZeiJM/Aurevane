import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { projectWorld, resolveWorldIntent } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import { mapPoint } from './world-motion'
import { worldSceneCoversViewport } from './world-scene-coverage'
const viewport = { width: 1296, height: 944, tile: 64 * 0.35 }
it.each([
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 3840, height: 2160 },
  { width: 412, height: 915 },
])('supplies the requested larger public viewport at $width by $height', (size) => {
  const state = { ...newWorldState(), position: { sectorId: 'atlas:62:28', x: 6, y: 4 } }
  const view = projectWorld(state, [], 1000, undefined, undefined, size)
  expect(
    worldSceneCoversViewport(view, [mapPoint(view.position, view.sectors)], {
      ...size,
      tile: (size.width < 600 ? 48 : 64) * 0.35,
    }),
  ).toBe(true)
  expect(view.sectors.length).toBeLessThanOrEqual(25)
  expect(view.scenery!.length).toBeLessThanOrEqual(512)
  expect(
    view.scenery!.every(([id]) => view.atlas!.find((sector) => sector.id === id)?.charted),
  ).toBe(true)
})
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
