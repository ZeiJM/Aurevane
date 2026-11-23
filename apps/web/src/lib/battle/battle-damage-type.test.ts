import { expect, it } from 'vitest'
import { battleDamageLabel } from './battle-damage-type'
it('labels explicit piercing packets without guessing from missing historical metadata', () => {
  expect(battleDamageLabel(undefined, 'piercing')).toBe('piercing damage')
  expect(battleDamageLabel('water', 'piercing')).toBe('piercing damage')
  expect(battleDamageLabel('water')).toBe('water damage')
  expect(battleDamageLabel(undefined)).toBe('damage')
})
