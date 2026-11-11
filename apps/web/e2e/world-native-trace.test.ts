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

it('summarizes duration events and keeps late thread labels after the raw trace fills', async () => {
  vi.useFakeTimers()
  const { browser, info, listeners } = protocol()
  const pending = captureNativeBrowserWork(browser, info)
  await vi.advanceTimersByTimeAsync(0)
  const event = { name: 'UpdateLayer', cat: 'cc', ph: 'X', ts: 1, dur: 2, pid: 3, tid: 4 }
  listeners.get('Tracing.dataCollected')?.({ value: Array(100_001).fill(event) })
  listeners.get('Tracing.dataCollected')?.({
    value: [
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
  const data = JSON.parse(vi.mocked(writeFile).mock.calls[0]![1] as string)
  expect(data.traceEvents).toHaveLength(100_000)
  expect(data.droppedEvents).toBe(2)
  expect(data.durationSummaries).toEqual([
    {
      name: 'UpdateLayer',
      cat: 'cc',
      pid: 3,
      tid: 4,
      count: 100_001,
      durationUs: 200_002,
      maxDurationUs: 2,
      firstTs: 1,
      lastEndTs: 3,
    },
  ])
  expect(data.metadataEvents[0].args).toEqual({ name: 'CrRendererMain' })
  expect(data.summaryOverflowEvents).toBe(0)
  expect(data.metadataOverflowEvents).toBe(0)
})

it('reports bounded summary and metadata overflow while continuing existing duration groups', async () => {
  vi.useFakeTimers()
  const { browser, info, listeners } = protocol()
  const pending = captureNativeBrowserWork(browser, info)
  await vi.advanceTimersByTimeAsync(0)
  const events = Array.from({ length: 4097 }, (_, i) => ({
    name: `task-${i}`,
    cat: 'cc',
    ph: 'X',
    ts: 1,
    dur: 2,
    pid: 3,
    tid: 4,
  }))
  listeners.get('Tracing.dataCollected')?.({ value: [...events, events[0]] })
  listeners.get('Tracing.dataCollected')?.({
    value: Array(1025).fill({
      name: 'thread_name',
      cat: '__metadata',
      ph: 'M',
      ts: 0,
      pid: 3,
      tid: 4,
      args: { name: 'CrRendererMain' },
    }),
  })
  await vi.advanceTimersByTimeAsync(4000)
  await pending
  const data = JSON.parse(vi.mocked(writeFile).mock.calls[0]![1] as string)
  expect(data.durationSummaries).toHaveLength(4096)
  expect(data.durationSummaries[0].count).toBe(2)
  expect(data.summaryOverflowEvents).toBe(1)
  expect(data.metadataEvents).toHaveLength(1024)
  expect(data.metadataOverflowEvents).toBe(1)
})
