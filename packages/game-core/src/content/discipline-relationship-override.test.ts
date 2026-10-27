import { expect, it } from 'vitest'
import { parseNoncombatContentDefinition } from './authored-content'
const d = {
  schemaVersion: 1,
  id: 'custom',
  contentVersion: 1,
  name: 'Custom',
  description: 'Custom discipline.',
  sortOrder: 0,
  enabled: true,
  media: {},
  core: { might: 6, finesse: 5, vitality: 5, agility: 5, intellect: 5, resolve: 5 },
  focus: ['might', 'vitality'],
  enabledForPrimary: true,
  enabledForSecondary: true,
  linkedSkills: [],
  unlock: { kind: 'unavailable' },
  atlas: {
    family: 'martial',
    band: 'first-journey',
    disclosure: 'open',
    power: { reliability: 1, flexibility: 1, setup: 1, ruleAccess: 1, execution: 1 },
  },
  skillStages: [],
  essenceId: 'essence.custom',
  resonanceSelections: [{ withDisciplineId: 'vanguard', resonanceId: 'resonance.custom' }],
}
it.each([null, { withDisciplineId: null }, { withDisciplineId: 'vanguard' }])(
  'accepts explicit relationship override %j',
  (relationshipOverride) => {
    expect(
      parseNoncombatContentDefinition('discipline', { ...d, relationshipOverride }),
    ).toMatchObject({ relationshipOverride })
  },
)
it.each([
  { withDisciplineId: 'missing' },
  { withDisciplineId: 'custom' },
  { withDisciplineId: null, enabled: true },
  {},
  true,
])('rejects malformed or unmapped override %j', (relationshipOverride) => {
  expect(() =>
    parseNoncombatContentDefinition('discipline', { ...d, relationshipOverride }),
  ).toThrow()
})
it('does not choose a missing Essence', () =>
  expect(() =>
    parseNoncombatContentDefinition('discipline', {
      ...d,
      essenceId: null,
      relationshipOverride: { withDisciplineId: null },
    }),
  ).toThrow())
it('retains old bodies without an override', () =>
  expect(parseNoncombatContentDefinition('discipline', d)).toEqual(d))
