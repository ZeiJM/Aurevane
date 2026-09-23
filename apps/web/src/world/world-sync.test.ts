import { describe, expect, it } from 'vitest'
import {
  planWorldSync,
  WORLD_IDLE_REFRESH_MS,
  WORLD_MIN_SCHEDULE_MS,
} from './world-sync'

const route = [
  {
    position: { sectorId: 'verdant-expanse', x: 6, y: 4 },
    durationMs: 1100,
  },
]

describe('world sync scheduling', () => {
  it('refreshes idle world state on a slower cadence', () => {
    expect(
      planWorldSync(
        {
          route: [],
          nextStepAt: null,
          serverNow: 1000,
          movementBlocked: null,
        },
        0,
      ),
    ).toEqual({ kind: 'refresh', delayMs: WORLD_IDLE_REFRESH_MS })
  })

  it('refreshes instead of ticking while movement is blocked', () => {
    expect(
      planWorldSync(
        {
          route,
          nextStepAt: 2100,
          serverNow: 1000,
          movementBlocked: 'Stop Passive Training to travel.',
        },
        0,
      ),
    ).toEqual({ kind: 'refresh', delayMs: WORLD_IDLE_REFRESH_MS })
  })

  it('schedules travel ticks for the authoritative next-step time', () => {
    expect(
      planWorldSync(
        {
          route,
          nextStepAt: 2100,
          serverNow: 1000,
          movementBlocked: null,
        },
        0,
      ),
    ).toEqual({ kind: 'tick', delayMs: 1175 })

    expect(
      planWorldSync(
        {
          route,
          nextStepAt: 2100,
          serverNow: 1000,
          movementBlocked: null,
        },
        700,
      ),
    ).toEqual({ kind: 'tick', delayMs: 475 })
  })

  it('uses a short bounded retry when a step is already due', () => {
    expect(
      planWorldSync(
        {
          route,
          nextStepAt: 2100,
          serverNow: 2200,
          movementBlocked: null,
        },
        0,
      ),
    ).toEqual({ kind: 'tick', delayMs: WORLD_MIN_SCHEDULE_MS })
  })
})
