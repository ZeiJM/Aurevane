import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { projectWorld, resolveWorldIntent } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import { mapPoint } from './world-motion'
import { worldSceneCoversViewport } from './world-scene-coverage'
import { WorldController } from './world-controller'
const viewport = { width: 1296, height: 944, tile: 64 * 0.35 }
it.each([64, 64 * 0.35])('supplies the reported Emberreach viewport at tile size %d', (tile) => {
  const state = { ...newWorldState(), position: { sectorId: 'atlas:76:25', x: 9, y: 4 } }
  const size = { width: 1218, height: 803 }
  const view = projectWorld(state, [], 1000, undefined, undefined, size)
  expect(
    worldSceneCoversViewport(view, [mapPoint(view.position, view.sectors)], { ...size, tile }),
  ).toBe(true)
})
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
it.each(['camera movement', 'viewport expansion', 'same-version viewport expansion'] as const)(
  'does not withdraw covered public background after %s when an earlier scene arrives late',
  async (change) => {
    const state = newWorldState()
    const earlier = { ...projectWorld(state, [], 1000), characterId: 'owner' }
    const size = change !== 'camera movement' ? { width: 2560, height: 1440 } : viewport
    const current = {
      ...projectWorld(
        {
          ...state,
          version: change === 'same-version viewport expansion' ? state.version : state.version + 1,
          position: change === 'camera movement' ? { ...state.position, x: 11 } : state.position,
        },
        [],
        1600,
        undefined,
        undefined,
        size,
      ),
      characterId: 'owner',
    }
    const point = mapPoint(current.position, current.sectors)
    const sceneCovered = (scene: typeof current) =>
      worldSceneCoversViewport(scene, [point], { ...size, tile: viewport.tile })
    expect(sceneCovered(current)).toBe(true)
    expect(sceneCovered(earlier)).toBe(false)
    // Both snapshots supply the owned tile: the older route-cell guard alone
    // cannot detect the public ground lost around that tile.
    expect(
      earlier.sectors
        .find((sector) => sector.id === current.position.sectorId)
        ?.cells.some((cell) => cell.x === current.position.x && cell.y === current.position.y),
    ).toBe(true)
    let deliver!: (scene: typeof earlier) => void
    const delayed = new Promise<typeof earlier>((resolve) => (deliver = resolve))
    const presentation = vi.fn()
    const controller = new WorldController(earlier, {
      command: vi.fn(),
      refresh: vi
        .fn()
        .mockImplementationOnce(() => delayed)
        .mockResolvedValue(current),
      accept: vi.fn(),
      presentation,
      sceneCovered,
      error: vi.fn(),
      busy: vi.fn(),
    })
    const hydrating = controller.hydrate()
    await controller.refresh()
    deliver(earlier)
    await hydrating
    expect(sceneCovered(controller.view)).toBe(true)
    expect(controller.view).toBe(current)
    expect(presentation).not.toHaveBeenCalled()
    controller.dispose()
  },
)
it('accepts useful older public ground when the current viewport is already incomplete', async () => {
  const complete = { ...projectWorld(newWorldState(), [], 1000), characterId: 'owner' }
  const current = { ...complete, version: complete.version + 1, scenery: [] }
  const point = mapPoint(current.position, current.sectors)
  const sceneCovered = (scene: typeof complete) =>
    worldSceneCoversViewport(scene, [point], viewport)
  expect(sceneCovered(current)).toBe(false)
  const presentation = vi.fn()
  const controller = new WorldController(current, {
    command: vi.fn(),
    refresh: async () => complete,
    accept: vi.fn(),
    presentation,
    sceneCovered,
    error: vi.fn(),
    busy: vi.fn(),
  })
  await controller.hydrate()
  expect(sceneCovered(controller.view)).toBe(true)
  expect(controller.view.version).toBe(current.version)
  expect(presentation).toHaveBeenCalledOnce()
  controller.dispose()
})
