import { describe, expect, it } from 'vitest'
import { battleInfoPopoverPosition } from './battle-info-popover-position'

describe('reading-panel viewport placement', () => {
  const viewport = { width: 1366, height: 768 }
  it('places a compact report above a low trigger without clipping its content', () => {
    expect(
      battleInfoPopoverPosition(
        { right: 1300, top: 700, bottom: 728 },
        { width: 360, height: 460 },
        viewport,
      ),
    ).toEqual({ left: 940, top: 232 })
  })
  it('keeps mobile reports within the viewport when their source leaves the visible layout', () => {
    expect(
      battleInfoPopoverPosition(
        { right: 900, top: -200, bottom: -172 },
        { width: 304, height: 480 },
        { width: 320, height: 568 },
      ),
    ).toEqual({ left: 8, top: 8 })
  })
  it('starts exceptional long reports at the readable document margin and keeps horizontal bounds', () => {
    expect(
      battleInfoPopoverPosition(
        { right: 200, top: 500, bottom: 528 },
        { width: 304, height: 1000 },
        { width: 320, height: 568 },
        { x: 0, y: 320 },
      ),
    ).toEqual({ left: 8, top: 328 })
  })
  it('keeps ordinary short reports beside their trigger, without document scroll offsets', () => {
    expect(
      battleInfoPopoverPosition(
        { right: 390, top: 50, bottom: 78 },
        { width: 360, height: 130 },
        { width: 390, height: 844 },
      ),
    ).toEqual({ left: 22, top: 86 })
  })
})

describe('footer placement preference', () => {
  it('opens above a mid-viewport footer trigger even when there is room below', () => {
    const result = battleInfoPopoverPosition(
      { right: 300, top: 300, bottom: 330 },
      { width: 280, height: 180 },
      { width: 390, height: 844 },
      undefined,
      'above',
    )
    expect(result.top).toBe(112)
  })
  it('keeps its safe placement when the complete reader cannot fit above', () => {
    const result = battleInfoPopoverPosition(
      { right: 300, top: 70, bottom: 100 },
      { width: 280, height: 180 },
      { width: 390, height: 844 },
      undefined,
      'above',
    )
    expect(result.top).toBe(108)
  })
})

describe('nested inspect reader placement', () => {
  it('keeps a tall desktop reader to the left of its trigger so hover cannot intercept the click', () => {
    const anchor = { left: 892, right: 910, top: 383, bottom: 401 }
    const result = battleInfoPopoverPosition(
      anchor,
      { width: 320, height: 460 },
      { width: 1366, height: 768 },
      undefined,
      'beside',
    )
    expect(result.left + 320).toBeLessThan(anchor.left)
    expect(result.top).toBeGreaterThanOrEqual(8)
  })
  it('keeps a touch reader within narrow viewport bounds without clipping', () => {
    expect(
      battleInfoPopoverPosition(
        { left: 342, right: 360, top: 383, bottom: 401 },
        { width: 320, height: 460 },
        { width: 390, height: 844 },
        undefined,
        'beside',
      ).left,
    ).toBe(14)
  })
})
