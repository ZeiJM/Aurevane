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

it('explains the captured Invisible donor exception without granting it to accompanying effects', () => {
  const description = skillEffectDescription({
    type: 'copy-statuses',
    recipient: 'primary-unit',
    mode: 'amplify',
    statusIds: ['invisible', 'covert'],
    invisibleDonorPolicyVersion: 1,
  })
  expect(description).toContain('Can select an Invisible donor.')
  expect(description).toContain('Other direct effects still require Reveal.')
})

it.each(['amplify', 'curse'] as const)(
  'describes full source-Skill durations for current %s copies',
  (mode) => {
    const description = skillEffectDescription({
      type: 'copy-statuses',
      recipient: 'primary-unit',
      mode,
      durationPolicyVersion: 1,
    })
    expect(description).toContain(
      'each copied status receives its source Skill’s full recorded duration',
    )
    expect(description).not.toContain('remaining durations are preserved')
  },
)
