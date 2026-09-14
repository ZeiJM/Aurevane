import { describe, expect, it } from 'vitest'

import { normalizeCombatEffectState, type CombatEffectState } from './combat-effect-state'

describe('combat effect-state compatibility', () => {
  it('normalizes historical snapshots without current effect collections', () => {
    expect(normalizeCombatEffectState({})).toEqual({
      ongoingRecovery: [],
      poison: [],
      bleed: [],
      burn: [],
      temporarySkills: [],
      damageHistory: [],
    } satisfies CombatEffectState)
  })
})
