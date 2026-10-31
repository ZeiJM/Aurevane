import { expect, it } from 'vitest'
import { statusPotencyDescription } from './status-potency-presentation'

it('describes stacked current Drenched Initiative and the strongest captured Storm bonus', () => {
  const description = statusPotencyDescription('wet', 4250)
  expect(description).toContain('Each Drenched application reduces effective Initiative by 10%')
  expect(description).toContain('100% reduction (minimum 0 Initiative)')
  expect(description).toContain('42.5% Storm damage using the strongest active application')
  expect(description).not.toContain('Fire removes')
  expect(statusPotencyDescription('wet', 3500, { explicitElemental: false })).toContain('10% once')
  expect(statusPotencyDescription('wet', 3500, { explicitElemental: false })).toContain(
    'Fire removes Drenched',
  )
  expect(statusPotencyDescription('wet', undefined, { legacyElemental: true })).toContain(
    'Fire removes Wet',
  )
})

it('keeps current Fire cleanse on the caster and the saved historical recipient behavior', () => {
  expect(statusPotencyDescription('frozen')).toContain('Cleanse Chilled removes it')
  expect(statusPotencyDescription('frozen')).not.toContain('cleanses its recipient')
  expect(statusPotencyDescription('frozen', undefined, { explicitElemental: false })).toContain(
    'cleanses its recipient',
  )
})

it('describes the saved status tuning without substituting historical constants', () => {
  expect(statusPotencyDescription('wet', 3500, { initiativeReductionBasisPoints: 2500 })).toContain(
    'Initiative by 25%',
  )
  expect(
    statusPotencyDescription('fortified', undefined, { defenseIncreaseBasisPoints: 4000 }),
  ).toBe('Increase Physical and Mystic Defense by 40% and deal 40% less damage.')
  expect(statusPotencyDescription('slow', undefined, { movementApAdjustment: 27 })).toContain(
    '27 extra AP',
  )
  expect(statusPotencyDescription('haste', undefined, { movementApAdjustment: 15 })).toContain(
    '15 less AP',
  )
  expect(
    statusPotencyDescription('lowered-guard', undefined, {
      damageTakenMultiplierBasisPoints: 15000,
    }),
  ).toContain('150% of normal damage')
  expect(
    statusPotencyDescription('revealed', undefined, { increasedDamageTakenBasisPoints: 5000 }),
  ).toContain('50% more damage')
  expect(
    statusPotencyDescription('revealed', undefined, { increasedDamageTakenBasisPoints: 5000 }),
  ).toContain('100% Accuracy')
})
