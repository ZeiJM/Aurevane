import { describe, expect, it, vi } from 'vitest'
import { installWorldRenderTiming, installWorldPeerDrawCapture } from './world-render-diagnostics'

function capture() {
  const draw = vi.fn()
  const context = { fillText: draw }
  const canvas = { dataset: {} as Record<string, string> } as HTMLCanvasElement
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
  prepareMs: 0,
  terrainMs: 7,
  sceneryMs: 22,
  atmosphereMs: 0,
  identityMs: 11,
})

describe('native renderer timing capture', () => {
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
  it('removes camera settling from a stationary peer while retaining actual frame/paint clocks', () => {
    const draw = vi.fn()
    const context = { fillText: draw }
    const identity = { clientWidth: 800, clientHeight: 600, width: 800, getContext: () => context }
    const canvas = {
      dataset: {
        tileSize: '64',
        frameNow: '100',
        frameStarted: '190',
        cameraX: '10',
        cameraY: '20',
      },
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
