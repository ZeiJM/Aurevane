import { expect, it } from 'vitest'
import {
  parseItemEquipRequirements,
  evaluateItemEquipRequirements,
} from './item-equip-requirements'
const context = {
  level: 4,
  disciplineIds: ['vanguard', 'custom.flame'],
  baseCoreStats: { might: 12, finesse: 4, vitality: 7, agility: 4, intellect: 3, resolve: 6 },
}
it('requires any current discipline and every configured base stat, with inclusive thresholds', () => {
  const requirements = parseItemEquipRequirements({
    minimumLevel: 4,
    disciplineIds: ['custom.flame', 'mystic'],
    minimumCoreStats: { might: 12, resolve: 6 },
  })
  expect(evaluateItemEquipRequirements(requirements, context)).toEqual([])
  expect(
    evaluateItemEquipRequirements(requirements, {
      ...context,
      level: 3,
      disciplineIds: ['other'],
      baseCoreStats: { ...context.baseCoreStats, might: 11 },
    }),
  ).toHaveLength(3)
})
it('keeps absent requirements unrestricted and fails closed without authoritative character facts', () => {
  expect(evaluateItemEquipRequirements(undefined)).toEqual([])
  expect(evaluateItemEquipRequirements({ minimumLevel: 2 })).toHaveLength(1)
  expect(evaluateItemEquipRequirements({ minimumCoreStats: { might: 15 } }, context)).toEqual([
    'Base Might 15 required (current 12).',
  ])
})
it.each([
  null,
  [],
  { extra: 1 },
  { minimumLevel: 0 },
  { minimumLevel: 1.5 },
  { disciplineIds: [] },
  { disciplineIds: ['x', 'x'] },
  { disciplineIds: [' bad'] },
  { minimumCoreStats: { power: 2 } },
  { minimumCoreStats: { might: -1 } },
])('rejects malformed optional requirements %j', (value) => {
  expect(() => parseItemEquipRequirements(value)).toThrow()
})
