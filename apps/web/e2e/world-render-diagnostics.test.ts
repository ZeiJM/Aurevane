import { describe, expect, it, vi } from 'vitest'
import { installWorldRenderTiming, installWorldPeerDrawCapture } from './world-render-diagnostics'

function observedDataset() {
  const observers: { callback: () => void; attributes: string[] }[] = []
  vi.stubGlobal(
    'MutationObserver',
    class {
      constructor(private callback: () => void) {}
      observe(_target: unknown, options: MutationObserverInit) {
        observers.push({ callback: this.callback, attributes: options.attributeFilter ?? [] })
      }
    },
  )
  const queued = new Set<() => void>()
  return new Proxy({} as Record<string, string>, {
    set(target, key: string, value: string) {
      target[key] = value
      const attribute = `data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`
      for (const observer of observers) {
        if (!observer.attributes.includes(attribute) || queued.has(observer.callback)) continue
        queued.add(observer.callback)
        queueMicrotask(() => {
          queued.delete(observer.callback)
          observer.callback()
        })
      }
      return true
    },
  })
}

function capture() {
  const draw = vi.fn()
  const context = { fillText: draw }
  const canvas = { dataset: observedDataset() } as HTMLCanvasElement
  vi.stubGlobal('document', { querySelector: () => ({ getContext: () => context }) })
  installWorldRenderTiming(canvas)
  return { canvas, context, draw }
}
const frame = (frameAt: number) => ({
  frameAt,
  rafAt: frameAt - 60,
  startedAt: frameAt + 60,
  callbackDelayMs: 60,
  completedAt: frameAt + 100,
  updates: 1,
  updateMs: 19,
  peerUpdateMs: 0,
  lastPeerUpdateAt: frameAt - 10,
  terrainIndexes: 1,
  terrainIndexMs: 19,
  groundBuilds: 1,
  groundBuildMs: 7,
  groundResamples: 0,
  groundResampleMs: 0,
  biomeRasterBuilds: 3,
  biomeRasters: 12,
  biomeRasterPixels: 600_000,
  prepareMs: 0,
  terrainMs: 7,
  sceneryMs: 22,
  atmosphereMs: 0,
  identityMs: 11,
})

describe('native renderer timing capture', () => {
  it('captures completed frames while the identity surface is retained without fillText', async () => {
    const { canvas } = capture()
    try {
      canvas.dataset.renderTiming = JSON.stringify(frame(10))
      await Promise.resolve()
      canvas.dataset.renderTiming = JSON.stringify(frame(20))
      await Promise.resolve()
      expect(JSON.parse(canvas.dataset.testRenderTimings ?? '[]')).toEqual([frame(10), frame(20)])
    } finally {
      vi.unstubAllGlobals()
    }
  })
  it('captures completed frame work after the original identity draw and omits raw fields', async () => {
    const { canvas, context, draw } = capture()
    try {
      expect(canvas.dataset.renderDiagnostics).toBe('timing')
      canvas.dataset.renderTiming = JSON.stringify(frame(10))
      context.fillText('private-name', 4, 5)
      context.fillText('private-name', 4, 5, 100)
      expect(draw.mock.calls).toEqual([
        ['private-name', 4, 5],
        ['private-name', 4, 5, 100],
      ])
      expect(canvas.dataset.testRenderTimings).toBeUndefined()
      // The renderer publishes its total only after all identity drawing returns.
      canvas.dataset.renderTiming = JSON.stringify({
        ...frame(20),
        id: 'private-id',
        url: 'secret-url',
      })
      await Promise.resolve()
      const raw = canvas.dataset.testRenderTimings!
      expect(JSON.parse(raw)).toEqual([frame(20)])
      for (const forbidden of ['private-name', 'private-id', 'secret-url'])
        expect(raw).not.toContain(forbidden)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('retains at most 1500 complete frames and drops invalid timing records', async () => {
    const { canvas, context } = capture()
    try {
      for (let i = 0; i < 1502; i++) {
        context.fillText('peer', 4, 5)
        canvas.dataset.renderTiming = JSON.stringify(frame(i))
        await Promise.resolve()
      }
      expect(canvas.dataset.testRenderTimings).toBeDefined()
      const rows = JSON.parse(canvas.dataset.testRenderTimings!)
      expect(rows).toHaveLength(1500)
      expect(rows[0]).toEqual(frame(2))
      expect(rows.at(-1)).toEqual(frame(1501))
      for (const invalid of [
        '{broken',
        '{}',
        JSON.stringify({ ...frame(1502), identityMs: null }),
      ]) {
        canvas.dataset.renderTiming = invalid
        context.fillText('peer', 4, 5)
        await Promise.resolve()
      }
      expect(JSON.parse(canvas.dataset.testRenderTimings!)).toEqual(rows)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('native peer draw capture', () => {
  it('samples a retained real nameplate as its moving camera advances, then drops cleared labels', async () => {
    const context = { fillText: vi.fn(), clearRect: vi.fn() }
    const identity = { clientWidth: 800, clientHeight: 600, width: 800, getContext: () => context }
    const canvas = { dataset: observedDataset() } as HTMLCanvasElement
    Object.assign(canvas.dataset, {
      tileSize: '64',
      frameNow: '100',
      frameStarted: '100',
      cameraX: '10',
      cameraY: '20',
    })
    vi.stubGlobal('document', { querySelector: () => identity })
    const clock = vi.spyOn(performance, 'now').mockReturnValue(110)
    try {
      installWorldPeerDrawCapture(canvas, { name: 'Peer', sampleKey: 'testRemoteDraws', limit: 20 })
      context.fillText('Peer', 454.4, 328.16)
      await Promise.resolve()
      // Identical relative positions retain the actual painted label. World x
      // still advances with the camera, even though fillText is never repeated.
      clock.mockReturnValue(130)
      canvas.dataset.cameraX = '10.1'
      canvas.dataset.frameNow = '120'
      await Promise.resolve()
      const samples = JSON.parse(canvas.dataset.testRemoteDraws ?? '[]')
      expect(samples).toHaveLength(2)
      expect(samples[1].x - samples[0].x).toBeCloseTo(0.1)
      expect(samples[1].screenX).toBe(samples[0].screenX)
      expect(samples.map((sample: { frameAt: number }) => sample.frameAt)).toEqual([100, 120])
      canvas.dataset.frameNow = '120'
      await Promise.resolve()
      expect(JSON.parse(canvas.dataset.testRemoteDraws!)).toEqual(samples)
      // A frame that removes or occludes the peer must not reuse its old label.
      context.clearRect(0, 0, 800, 600)
      canvas.dataset.frameNow = '140'
      await Promise.resolve()
      expect(JSON.parse(canvas.dataset.testRemoteDraws!)).toEqual(samples)
    } finally {
      clock.mockRestore()
      vi.unstubAllGlobals()
    }
  })
  it('removes camera settling from a stationary peer while retaining actual frame/paint clocks', () => {
    const draw = vi.fn()
    const context = { fillText: draw, clearRect: vi.fn() }
    const identity = { clientWidth: 800, clientHeight: 600, width: 800, getContext: () => context }
    const canvas = {
      dataset: Object.assign(observedDataset(), {
        tileSize: '64',
        frameNow: '100',
        frameStarted: '190',
        cameraX: '10',
        cameraY: '20',
      }),
    } as unknown as HTMLCanvasElement
    vi.stubGlobal('document', { querySelector: () => identity })
    const clock = vi.spyOn(performance, 'now').mockReturnValue(200)
    try {
      installWorldPeerDrawCapture(canvas, { name: 'Peer', sampleKey: 'testRemoteDraws', limit: 2 })
      context.fillText('Peer', 454.4, 328.16)
      canvas.dataset.frameNow = '116.7'
      canvas.dataset.cameraX = '10.5'
      clock.mockReturnValue(210)
      context.fillText('Peer', 427.2, 314.08, 100)
      const samples = JSON.parse(canvas.dataset.testRemoteDraws!)
      expect(samples).toHaveLength(2)
      for (const sample of samples) {
        expect(sample.x).toBeCloseTo(11)
        expect(sample.y).toBeCloseTo(20)
        expect(sample.tileSize).toBe(64)
        expect(sample.identityRatio).toBe(1)
      }
      expect(samples.map((sample: { frameAt: number }) => sample.frameAt)).toEqual([100, 116.7])
      expect(samples.map((sample: { at: number }) => sample.at)).toEqual([200, 210])
      expect(draw.mock.calls).toEqual([
        ['Peer', 454.4, 328.16],
        ['Peer', 427.2, 314.08, 100],
      ])
      context.fillText('Other', 1, 2)
      expect(JSON.parse(canvas.dataset.testRemoteDraws!)).toHaveLength(2)
      context.fillText('Peer', 427.2, 314.08)
      expect(JSON.parse(canvas.dataset.testRemoteDraws!)).toHaveLength(2)
      expect(canvas.dataset.testRemoteDraws).not.toContain('Peer')
    } finally {
      clock.mockRestore()
      vi.unstubAllGlobals()
    }
  })
})
