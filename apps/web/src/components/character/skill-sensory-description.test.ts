import { describe, expect, it } from 'vitest'

import { skillEffectDescription } from './skill-detail-presentation'

describe('CSR-1 Sensory Skill details', () => {
  it('describes the typed conditional effect without inspecting hidden target state', () => {
    expect(
      skillEffectDescription({
        type: 'sensory',
        recipient: 'primary-unit',
        revealedDurationOwnerTurnStarts: 2,
      }),
    ).toBe(
      'Attempt Sensory on the selected unit. On a successful hit against Covert, remove eligible positive statuses and Covert, then apply Revealed for 2 owner-turn starts. Otherwise the Sensory block has no effect.',
    )
  })
})
