import { describe, expect, it } from 'vitest'

import {
  isSkillNarrationVariantValid,
  skillNarrationVariantIssues,
  validateSkillNarrationTemplate,
  defaultSkillBattleText,
} from './battle-narration'

describe('skill battle narration contract', () => {
  it('uses neutral canonical action prose when its legacy summon/effects fields are stale', () => {
    const value = {
      ability: { schemaVersion: 1, behaviors: [] },
      effects: [{ type: 'damage' }],
      summonProfile: { name: 'Stale companion' },
      sourceDisciplineId: 'vanguard',
    }
    expect(defaultSkillBattleText(value)).toBe('{actor} uses {ability}.')
    expect(
      defaultSkillBattleText({ effects: [{ type: 'damage' }], sourceDisciplineId: 'vanguard' }),
    ).toBe('{actor} channels vanguard power into {ability}.')
  })
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
