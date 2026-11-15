import type { CDPSession } from '@playwright/test'

/** Native rendering work is absent from V8 CPU stacks. Retain timings, never event arguments. */
export async function traceWorldBrowserTasks(
  session: CDPSession,
  save: (trace: unknown) => Promise<void>,
  movement: () => Promise<void>,
) {
  const events: Record<string, string | number>[] = []
  let droppedEvents = 0
  const collect = ({ value }: { value: Record<string, unknown>[] }) => {
    for (const event of value) {
      if (events.length >= 100_000) {
        droppedEvents++
        continue
      }
      const row: Record<string, string | number> = {}
      for (const field of ['name', 'cat', 'ph'])
        if (typeof event[field] === 'string') row[field] = event[field]
      for (const field of ['pid', 'tid', 'ts', 'dur', 'tts', 'tdur'])
        if (typeof event[field] === 'number' && Number.isFinite(event[field]))
          row[field] = event[field]
      events.push(row)
    }
  }
  let failed = false
  let failure: unknown
  let started = false
  session.on('Tracing.dataCollected', collect)
  try {
    try {
      await session.send('Tracing.start', {
        categories: 'devtools.timeline,toplevel,blink,cc',
        options: 'record-continuously',
        transferMode: 'ReportEvents',
      })
      started = true
      await movement()
    } catch (error) {
      failed = true
      failure = error
    }
    if (started) {
      let timeout: ReturnType<typeof setTimeout> | undefined
      let complete!: () => void
      const done = new Promise<void>((resolve, reject) => {
        complete = resolve
        timeout = setTimeout(() => reject(new Error('Native task trace did not complete.')), 5000)
        session.once('Tracing.tracingComplete', complete)
      })
      try {
        await Promise.all([session.send('Tracing.end'), done])
        await save({ traceEvents: events, droppedEvents })
        if (droppedEvents) throw new Error('Native task trace exceeded its bounded event capture.')
      } finally {
        clearTimeout(timeout)
        session.off('Tracing.tracingComplete', complete)
      }
    }
  } catch (error) {
    if (!failed) {
      failed = true
      failure = error
    }
  } finally {
    session.off('Tracing.dataCollected', collect)
    try {
      await session.detach()
    } catch (error) {
      if (!failed) {
        failed = true
        failure = error
      }
    }
  }
  if (failed) throw failure
}
