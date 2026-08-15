import { describe, expect, it } from 'vitest'

import { resolveWorkerMode, runWorker } from './runtime.js'

describe('worker runtime', () => {
  it('uses continuous mode by default', () => {
    expect(resolveWorkerMode([])).toBe('continuous')
  })

  it('boots once and exits cleanly for CI verification', async () => {
    const lines: string[] = []

    await runWorker({ args: ['--once'], writer: (line) => lines.push(line) })

    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0])).toMatchObject({
      level: 'info',
      event: 'worker.ready',
      mode: 'once',
    })
  })
})
