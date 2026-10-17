import { describe, expect, it } from 'vitest'

import { measurePeerMotionStep } from './world-timing-metrics'

describe('World peer sample timing', () => {
  it('retains the original 0.75-tile budget at a nominal frame', () => {
    const step = measurePeerMotionStep({ at: 0, x: 0 }, { at: 16, x: 0.8 })
    expect(step.maximumDeltaX).toBe(0.75)
    expect(step.deltaX).toBeGreaterThanOrEqual(step.maximumDeltaX)
  })

  it('measures progress against elapsed time on delayed samples', () => {
    const step = measurePeerMotionStep({ at: 0, x: 0 }, { at: 24, x: 0.88 })
    expect(step.deltaX).toBeLessThan(step.maximumDeltaX)
  })

  it('rejects a one-tile snap, even after a long render gap', () => {
    const step = measurePeerMotionStep({ at: 0, x: 0 }, { at: 200, x: 1 })
    expect(step.maximumDeltaX).toBe(0.95)
    expect(step.deltaX).toBeGreaterThanOrEqual(step.maximumDeltaX)
  })

  it('does not grant extra movement for non-increasing timestamps', () => {
    expect(measurePeerMotionStep({ at: 10, x: 0 }, { at: 10, x: 0.5 }).maximumDeltaX).toBe(
      0.75,
    )
  })
})
