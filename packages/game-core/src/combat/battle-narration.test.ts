import { describe, expect, it } from 'vitest'
import { validateCombatTagPayload } from './combat-tag-registry'

import {
  isSkillNarrationVariantValid,
  skillNarrationVariantIssues,
  validateSkillNarrationTemplate,
  defaultSkillBattleText,
  abilityPresentationValues,
  abilityPresentationContext,
  battleTextReferenceChoices,
  abilityPresentationTextIssues,
  renderAbilityPresentationText,
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

it.each([
  ['maximum-hp-percent', 75, 'percentage', 'power'],
  [undefined, 8, 'power', 'percentage'],
] as const)(
  'Barrier basis %s offers only its actual value type',
  (basis, amount, unit, wrongUnit) => {
    const payload = {
      type: 'barrier-change',
      recipient: 'actor',
      amount,
      ...(basis ? { basis } : {}),
    }
    expect(validateCombatTagPayload(payload)).toEqual([])
    const definition = { ability: { schemaVersion: 1, behaviors: [{ effects: [{ payload }] }] } }
    expect(abilityPresentationValues(definition)).toEqual({ [`0.${unit}`]: amount })
    const choices = battleTextReferenceChoices(abilityPresentationContext(definition, 'compact'))
    expect(choices.some((choice) => choice.token === `value.0.${unit}`)).toBe(true)
    expect(choices.some((choice) => choice.token === `value.0.${wrongUnit}`)).toBe(false)
    const valid = { ...definition, presentation: { compact: `Barrier {value.0.${unit}}` } }
    expect(abilityPresentationTextIssues(valid)).toEqual([])
    expect(renderAbilityPresentationText(valid, 'compact', { ability: 'Shield' })).toBe(
      `Barrier ${amount}`,
    )
    const invalid = { ...definition, presentation: { compact: `Barrier {value.0.${wrongUnit}}` } }
    expect(abilityPresentationTextIssues(invalid)).toEqual(['presentation.compact'])
    expect(renderAbilityPresentationText(invalid, 'compact', { ability: 'Shield' })).toBeNull()
  },
)
