import { describe, expect, it } from 'vitest'
import { skillEffectDescription } from './skill-detail-presentation'

describe('Staged status-copy descriptions', () => {
  it.each([
    [
      'amplify',
      'Copy eligible positive active statuses from the selected unit onto yourself. The selected unit keeps its statuses; copied stacks respect caps and remaining durations are not restarted.',
    ],
    [
      'curse',
      'Copy eligible negative active statuses from yourself onto the selected unit. You keep the original statuses; copied stacks respect caps and remaining durations are not restarted.',
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
