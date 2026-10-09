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
