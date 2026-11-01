import { expect, it } from 'vitest'
import { statusPotencyDescription } from './status-potency-presentation'

it('describes stacked current Drenched Initiative and the strongest captured Storm bonus', () => {
  const description = statusPotencyDescription('wet', 4250)
  expect(description).toContain('Each Drenched application reduces effective Initiative by 10%')
  expect(description).toContain('100% reduction (minimum 0 Initiative)')
  expect(description).toContain('42.5% Storm damage using the strongest active application')
  expect(description).not.toContain('Fire removes')
  expect(statusPotencyDescription('wet', 3500, { explicitElemental: false })).toContain('10% once')
  expect(statusPotencyDescription('wet', 3500, { explicitElemental: false })).not.toContain(
    'Fire removes',
  )
  expect(statusPotencyDescription('wet', undefined, { legacyElemental: true })).not.toContain(
    'Fire removes',
  )
})

it.each([{}, { explicitElemental: false }, { legacyElemental: true }])(
  'keeps Chilled text concise without movement or cleansing advice for %j',
  (options) => {
    const text = statusPotencyDescription('frozen', undefined, options)
    expect(text).not.toMatch(/movement|cleans|Fire removes/i)
    expect(text).toMatch(/Chilled/)
  },
)

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
