import { expect, it } from 'vitest'
import {
  abilityPresentationValues,
  abilityPresentationTextIssues,
  renderAbilityPresentationText,
} from './battle-narration'
import { defaultBasicSkills } from './combat-basic-actions'
import { projectPublicCombat } from './public-combat-presentation'
it('binds typed values to the actual independent support definition and rejects private references', () => {
  const skill = defaultBasicSkills().find((row) => row.id === 'basic.recover.mp')!
  expect(abilityPresentationValues(skill)).toEqual({ '0.percentage': 10 })
  expect(
    renderAbilityPresentationText(
      { ...skill, presentation: { public: 'Restore {value.0.percentage}% MP.' } },
      'public',
      { ability: skill.name },
    ),
  ).toBe('Restore 10% MP.')
  expect(
    abilityPresentationTextIssues({
      ...skill,
      presentation: { activation: '{outcome.healing}', public: '{value.0.accuracy}' },
    }),
  ).toHaveLength(2)
})
it('does not fabricate outcomes or use current definitions to repair unavailable historical facts', () => {
  const skill = {
    effects: [{ type: 'damage', amount: 12 }],
    presentation: {
      result: '{ability} deals {outcome.damage} damage.',
      compact: 'Power {value.0.power}',
    },
  }
  expect(renderAbilityPresentationText(skill, 'result', { ability: 'Cut' })).toBeNull()
  expect(
    renderAbilityPresentationText(skill, 'result', { ability: 'Cut', outcomes: { damage: 37 } }),
  ).toBe('Cut deals 37 damage.')
  expect(renderAbilityPresentationText(skill, 'compact', { ability: 'Cut' })).toBe('Power 12')
  expect(
    abilityPresentationTextIssues({ ...skill, presentation: { result: '{outcome.healing}' } }),
  ).toHaveLength(1)
})
it('keeps full text distinct from compact/use text and strips private fields recursively', () => {
  const skill = {
    effects: [{ type: 'damage', amount: 12 }],
    presentation: {
      public: 'A'.repeat(200),
      compact: 'Short',
      accuracyRule: { kind: 'fixed', chance: 9999 },
    },
  }
  expect(abilityPresentationTextIssues(skill)).toContain('presentation.accuracyRule')
  const publicValue = projectPublicCombat(skill)
  expect(publicValue.presentation).not.toHaveProperty('accuracyRule')
  expect(renderAbilityPresentationText(publicValue, 'public', { ability: 'Cut' })).toBe(
    'A'.repeat(200),
  )
  expect(
    abilityPresentationTextIssues({ ...skill, presentation: { public: '<script>bad</script>' } }),
  ).toContain('presentation.public')
})
