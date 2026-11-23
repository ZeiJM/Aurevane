import { expect, it } from 'vitest'
import { battleEffectStrengthInformation } from './battle-effect-strength-information'
it('keeps numeric Damage Up strength scoped to its captured application', () => {
  const info = battleEffectStrengthInformation({
    statusId: 'inspired',
    statusVersion: 1,
    stacks: 2,
    remainingOwnerTurnStarts: 3,
    sourceCombatantId: 'actor',
    effectStackingPolicyVersion: 1,
    applicationModifiers: [
      { stacks: 1, sourceCombatantId: 'actor', potencyBasisPoints: 2000, damageTypes: ['fire'] },
      { stacks: 1, sourceCombatantId: 'actor', potencyBasisPoints: 5000, damageTypes: ['pierce'] },
    ],
  })
  expect(info.rows).toHaveLength(2)
  expect(info.rows[0]).toMatchObject({ label: expect.stringContaining('Fire'), magnitude: '120%' })
  expect(info.rows[1]).toMatchObject({
    label: expect.stringContaining('Pierce'),
    magnitude: '150%',
  })
  expect(info.rows.some((row) => row.magnitude === '180%')).toBe(false)
})
it('retains the historical unqualified aggregate for entirely unrestricted Damage Up', () => {
  expect(
    battleEffectStrengthInformation({
      statusId: 'inspired',
      statusVersion: 1,
      stacks: 1,
      remainingOwnerTurnStarts: 3,
      sourceCombatantId: 'actor',
      potencyBasisPoints: 2000,
    }).rows,
  ).toEqual([{ label: 'Outgoing damage from this effect', magnitude: '120%' }])
})
