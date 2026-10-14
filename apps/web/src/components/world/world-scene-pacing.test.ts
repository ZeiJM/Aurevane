import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { projectWorld, resolveWorldIntent } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import { WorldController } from './world-controller'

it('paces automatic full scenery reads while approved public terrain stays supplied, preserving explicit reads', async () => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(1000)
  const state = resolveWorldIntent(
    newWorldState(),
    {
      kind: 'walk',
      destination: { sectorId: 'verdant-expanse', x: 9, y: 4 },
    },
    1000,
  )
  const view = projectWorld(state, [], 1000)
  const refresh = vi.fn(async () => view)
  const controller = new WorldController(view, {
    command: vi.fn(async () => ({ ...view, route: [], nextStepAt: null })),
    refresh,
    accept: vi.fn(),
    busy: vi.fn(),
    presentation: vi.fn(),
    sceneCovered: vi.fn(() => true),
    error: vi.fn(),
  })
  try {
    await controller.hydrate({ movement: true })
    await controller.hydrate({ movement: true })
    clock.mockReturnValue(1500)
    await controller.hydrate({ movement: true })
    expect(refresh).toHaveBeenCalledTimes(1)
    await controller.hydrate()
    expect(refresh).toHaveBeenCalledTimes(2)
    clock.mockReturnValue(2250)
    await controller.hydrate({ movement: true })
    expect(refresh).toHaveBeenCalledTimes(3)
    await controller.send({ kind: 'stop' })
    await controller.hydrate({ movement: true })
    expect(refresh).toHaveBeenCalledTimes(4)
  } finally {
    controller.dispose()
    clock.mockRestore()
  }
})

it.each(['private discovery', 'missing route terrain', 'sector crossing'])(
  'refreshes %s immediately inside the automatic pacing window',
  async (reason) => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000)
    const state = resolveWorldIntent(
      newWorldState(),
      {
        kind: 'walk',
        destination: { sectorId: 'verdant-expanse', x: 9, y: 4 },
      },
      1000,
    )
    const view = projectWorld(state, [], 1000)
    const refresh = vi.fn(async () => view)
    const controller = new WorldController(view, {
      command: vi.fn(async () => view),
      refresh,
      accept: vi.fn(),
      busy: vi.fn(),
      presentation: vi.fn(),
      sceneCovered: vi.fn(() => true),
      error: vi.fn(),
    })
    try {
      await controller.hydrate({ movement: true })
      if (reason === 'private discovery') {
        const privateState = resolveWorldIntent(
          {
            ...newWorldState(),
            position: { sectorId: 'survey-01', x: 6, y: 8 },
            discoveries: { 'survey-01': [110] },
          },
          { kind: 'walk', destination: { sectorId: 'umbral-march', x: 6, y: 4 } },
          1000,
        )
        controller.view = projectWorld(privateState, [], 1000)
      } else if (reason === 'missing route terrain') {
        const next = view.route[0]!.position
        controller.view = {
          ...view,
          sectors: view.sectors.map((sector) => ({
            ...sector,
            cells: sector.cells.filter(
              (cell) => sector.id !== next.sectorId || cell.x !== next.x || cell.y !== next.y,
            ),
          })),
        }
      } else {
        controller.view = { ...view, position: { sectorId: 'hollow-coast', x: 0, y: 4 } }
      }
      clock.mockReturnValue(1010)
      await controller.hydrate({ movement: true })
      expect(refresh).toHaveBeenCalledTimes(2)
    } finally {
      controller.dispose()
      clock.mockRestore()
    }
  },
)

it('does not pace an automatic read when the moving public viewport is uncovered', async () => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(1000)
  const state = resolveWorldIntent(
    newWorldState(),
    {
      kind: 'walk',
      destination: { sectorId: 'verdant-expanse', x: 9, y: 4 },
    },
    1000,
  )
  const view = projectWorld(state, [], 1000)
  const refresh = vi.fn(async () => view),
    covered = vi.fn(() => true)
  const controller = new WorldController(view, {
    command: vi.fn(async () => view),
    refresh,
    accept: vi.fn(),
    busy: vi.fn(),
    presentation: vi.fn(),
    sceneCovered: covered,
    error: vi.fn(),
  })
  try {
    await controller.hydrate({ movement: true })
    covered.mockReturnValue(false)
    clock.mockReturnValue(1010)
    await controller.hydrate({ movement: true })
    expect(refresh).toHaveBeenCalledTimes(2)
  } finally {
    controller.dispose()
    clock.mockRestore()
  }
})
