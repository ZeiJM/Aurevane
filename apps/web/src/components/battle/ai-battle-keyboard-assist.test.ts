import { describe, expect, it } from 'vitest'

import { endTurnControlLabel } from './battle-keyboard-assist'

describe('AI battle current-facing end-turn shortcut', () => {
  it('uses the normal Finish Turn path before Final Facing is active', () => {
    expect(endTurnControlLabel(false, ['unit', '↑'])).toBeNull()
  })

  it('resolves the current facing once Final Facing is active', () => {
    expect(endTurnControlLabel(true, ['unit', '↑'])).toBe('Face north')
    expect(endTurnControlLabel(true, ['unit', '→'])).toBe('Face east')
    expect(endTurnControlLabel(true, ['unit', '↓'])).toBe('Face south')
    expect(endTurnControlLabel(true, ['unit', '←'])).toBe('Face west')
    expect(endTurnControlLabel(true, ['unit'])).toBeNull()
  })
})
