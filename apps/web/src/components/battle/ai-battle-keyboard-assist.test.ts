import { describe, expect, it } from 'vitest'

import { currentFacingControlLabel, isCurrentFacingFinishKey } from './ai-battle-keyboard-assist'

describe('AI battle desktop current-facing finish shortcut', () => {
  it('recognizes a fresh unmodified Space press but not hold-repeat or modified keys', () => {
    const base = {
      code: 'Space',
      repeat: false,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
    }

    expect(isCurrentFacingFinishKey(base)).toBe(true)
    expect(isCurrentFacingFinishKey({ ...base, repeat: true })).toBe(false)
    expect(isCurrentFacingFinishKey({ ...base, shiftKey: true })).toBe(false)
    expect(isCurrentFacingFinishKey({ ...base, code: 'Enter' })).toBe(false)
  })

  it('resolves the existing player-facing glyph to the matching Final Facing control', () => {
    expect(currentFacingControlLabel(['unit', '↑'])).toBe('Face north')
    expect(currentFacingControlLabel(['unit', '→'])).toBe('Face east')
    expect(currentFacingControlLabel(['unit', '↓'])).toBe('Face south')
    expect(currentFacingControlLabel(['unit', '←'])).toBe('Face west')
    expect(currentFacingControlLabel(['unit'])).toBeNull()
  })
})
