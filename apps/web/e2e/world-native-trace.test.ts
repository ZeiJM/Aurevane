import type { Browser, TestInfo } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { afterEach, expect, it, vi } from 'vitest'
import { captureNativeBrowserWork } from './world-multiplayer-load-case'

vi.mock('node:fs/promises', () => ({ writeFile: vi.fn() }))
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

function protocol() {
  const listeners = new Map<string, (event?: unknown) => void>()
  const client = {
    on: vi.fn((name: string, receive: (event?: unknown) => void) => listeners.set(name, receive)),
    once: vi.fn((name: string, receive: (event?: unknown) => void) => listeners.set(name, receive)),
    send: vi.fn(async (name: string) => {
      if (name === 'Tracing.end') listeners.get('Tracing.tracingComplete')?.()
    }),
    detach: vi.fn(),
  }
  const browser = { newBrowserCDPSession: vi.fn(async () => client) } as unknown as Browser
  const info = { outputPath: () => '/tmp/native-trace.json' } as unknown as TestInfo
  return { client, browser, info, listeners }
}

it('saves timing evidence with thread labels and strips arbitrary event arguments', async () => {
  vi.useFakeTimers()
  const { browser, info, client, listeners } = protocol()
  const pending = captureNativeBrowserWork(browser, info)
  await vi.advanceTimersByTimeAsync(0)
  listeners.get('Tracing.dataCollected')?.({
    value: [
      {
        name: 'Paint',
        cat: 'devtools.timeline',
        ph: 'X',
        ts: 1,
        dur: 2,
        pid: 3,
        tid: 4,
        args: { url: 'private-fixture-url', token: 'private-fixture-token' },
      },
      {
        name: 'thread_name',
        cat: '__metadata',
        ph: 'M',
        ts: 0,
        pid: 3,
        tid: 4,
        args: { name: 'CrRendererMain', token: 'private-fixture-token' },
      },
    ],
  })
  await vi.advanceTimersByTimeAsync(4000)
  await pending
  const output = vi.mocked(writeFile).mock.calls[0]![1] as string
  const data = JSON.parse(output)
  expect(data.traceEvents).toHaveLength(2)
  expect(data.traceEvents[0]).not.toHaveProperty('args')
  expect(data.traceEvents[1].args).toEqual({ name: 'CrRendererMain' })
  expect(output).not.toContain('private-fixture')
  expect(client.send).toHaveBeenCalledWith('Tracing.end')
  expect(client.detach).toHaveBeenCalledOnce()
})

it('detaches the diagnostic session if native tracing cannot start', async () => {
  const { browser, info, client } = protocol()
  client.send.mockRejectedValueOnce(new Error('Tracing unavailable'))
  await expect(captureNativeBrowserWork(browser, info)).rejects.toThrow('Tracing unavailable')
  expect(client.detach).toHaveBeenCalledOnce()
  expect(writeFile).not.toHaveBeenCalled()
})
