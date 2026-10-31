import { describe, expect, it } from 'vitest'
import { skillEffectDescription } from './skill-detail-presentation'

describe('Staged status-copy descriptions', () => {
  it.each([
    [
      'amplify',
      'Copies All Buffs from the target to you. Originals remain; remaining durations are preserved.',
    ],
    [
      'curse',
      'Copies All Debuffs from you to the target. Originals remain; remaining durations are preserved.',
    ],
  ] as const)('describes %s without implying theft or refreshed durations', (mode, expected) => {
    const effect = {
      type: 'copy-statuses',
      recipient: 'primary-unit',
      mode,
    } as unknown as Parameters<typeof skillEffectDescription>[0]
    expect(skillEffectDescription(effect)).toBe(expected)
  })
})
