import { describe, expect, it } from 'vitest'

import {
  isSkillNarrationVariantValid,
  skillNarrationVariantIssues,
  validateSkillNarrationTemplate,
} from './battle-narration'

describe('skill battle narration contract', () => {
  it('accepts short allow-listed combat narration', () => {
    expect(
      validateSkillNarrationTemplate({
        hit: "{actor} drives a sweeping cut through {target}'s guard",
        miss: "{actor}'s sweeping cut slips past {target}",
        critical: '{actor} tears through {target} with {ability}',
      }),
    ).toEqual([])
  })

  it('rejects unknown tokens so runtime presentation can safely fall back', () => {
    expect(isSkillNarrationVariantValid('{actor} strikes {target} with {secret_roll}')).toBe(false)
    expect(skillNarrationVariantIssues('{actor} strikes {target} with {secret_roll}')).toContain(
      'Unknown narration token: {secret_roll}.',
    )
  })

  it('rejects blank narration', () => {
    expect(isSkillNarrationVariantValid('   ')).toBe(false)
  })
})
