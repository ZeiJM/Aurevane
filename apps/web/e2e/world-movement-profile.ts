interface ProfileSession {
  send(method: string, params?: { interval: number }): Promise<unknown>
  detach(): Promise<void>
}

export async function profileWorldMovement(
  sessions: ProfileSession[],
  save: (index: number, profile: unknown) => Promise<void>,
  movement: () => Promise<void>,
) {
  const started = new Set<ProfileSession>()
  let failed = false
  let failure: unknown
  try {
    for (const session of sessions) {
      await session.send('Profiler.enable')
      // Coarse stack sampling bounds diagnostic overhead. This records neither
      // heap contents nor network bodies; native acceptance stays unchanged.
      await session.send('Profiler.setSamplingInterval', { interval: 10_000 })
      await session.send('Profiler.start')
      started.add(session)
    }
    await movement()
  } catch (error) {
    failed = true
    failure = error
  }
  const results = await Promise.allSettled(
    sessions.map(async (session, index) => {
      try {
        if (started.has(session)) {
          const result = (await session.send('Profiler.stop')) as { profile: unknown }
          await save(index, result.profile)
        }
      } finally {
        await session.detach()
      }
    }),
  )
  if (failed) throw failure
  const rejected = results.find((result) => result.status === 'rejected')
  if (rejected?.status === 'rejected') throw rejected.reason
}
