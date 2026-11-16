import { expect, it } from 'vitest'
import { profileWorldMovement } from './world-movement-profile'

it.each([false, true])(
  'collects both CPU profiles and detaches when movement fails=%s',
  async (fails) => {
    const events: string[] = []
    const profiles: unknown[] = []
    const sessions = [0, 1].map((index) => ({
      async send(method: string) {
        events.push(`${index}:${method}`)
        return { profile: { nodes: [{ id: index }], samples: [index] } }
      },
      async detach() {
        events.push(`${index}:detach`)
      },
    }))
    const failure = new Error('native threshold failed')
    const run = profileWorldMovement(
      sessions,
      async (index, profile) => {
        profiles[index] = profile
      },
      async () => {
        expect(events).toContain('0:Profiler.start')
        expect(events).toContain('1:Profiler.start')
        if (fails) throw failure
      },
    )
    if (fails) await expect(run).rejects.toBe(failure)
    else await run
    expect(profiles).toEqual(sessions.map((_, id) => ({ nodes: [{ id }], samples: [id] })))
    for (const index of [0, 1]) {
      expect(events).toContain(`${index}:Profiler.stop`)
      expect(events).toContain(`${index}:detach`)
    }
  },
)

it('detaches every session if profiler setup fails and does not start movement', async () => {
  const events: number[] = []
  const failure = new Error('profiler unavailable')
  const sessions = [0, 1].map((index) => ({
    async send(method: string) {
      if (index === 1 && method === 'Profiler.start') throw failure
      return { profile: {} }
    },
    async detach() {
      events.push(index)
    },
  }))
  await expect(
    profileWorldMovement(
      sessions,
      async () => {},
      async () => {
        throw new Error('must not exercise movement without diagnostic setup')
      },
    ),
  ).rejects.toBe(failure)
  expect(events.sort()).toEqual([0, 1])
})

it('preserves the native failure even if saving diagnostics fails, and detaches both sessions', async () => {
  const detached: number[] = []
  const native = new Error('unchanged native threshold')
  const sessions = [0, 1].map((index) => ({
    async send() {
      return { profile: {} }
    },
    async detach() {
      detached.push(index)
    },
  }))
  await expect(
    profileWorldMovement(
      sessions,
      async () => {
        throw new Error('artifact unavailable')
      },
      async () => {
        throw native
      },
    ),
  ).rejects.toBe(native)
  expect(detached.sort()).toEqual([0, 1])
})
