import { expect, it } from 'vitest'
import { FOUNDATION_DISCIPLINE_ATTRIBUTE_POLICIES } from '@aurevane/game-core/character/attribute-allocation'
import { playerProgressionProposal, xpForPlayerLevel } from './player-correction-progression'

const policy = FOUNDATION_DISCIPLINE_ATTRIBUTE_POLICIES[0]!
const curve = {
  version: 17,
  maxLevel: 100,
  cumulativeXpByLevel: Array.from({ length: 100 }, (_, i) => i * 237),
}
const attributes = {
  ...policy.baseAttributes,
  might: policy.baseAttributes.might + 7,
  finesse: policy.baseAttributes.finesse + 3,
}
it('uses the pinned curve for Level and XP and finds the lowest funded Level', () => {
  expect(xpForPlayerLevel(6, curve)).toBe(1185)
  const proposal = playerProgressionProposal(attributes, 237, curve, policy)
  expect(proposal).toMatchObject({
    level: 2,
    personalSpent: 10,
    personalPool: 6,
    excess: 4,
    fitLevel: 6,
    fitXp: 1185,
  })
  expect(playerProgressionProposal(attributes, 1185, curve, policy).issues).toEqual([])
})
it('offers deterministic proportional redistribution without mutating the proposed stats', () => {
  const before = structuredClone(attributes)
  const result = playerProgressionProposal(attributes, 0, curve, policy)
  expect(result.redistribution).toEqual({
    ...policy.baseAttributes,
    might: policy.baseAttributes.might + 4,
    finesse: policy.baseAttributes.finesse + 1,
  })
  expect(attributes).toEqual(before)
  expect(playerProgressionProposal(result.redistribution!, 0, curve, policy)).toMatchObject({
    excess: 0,
    unspent: 0,
    issues: [],
  })
})
it('keeps unspent points and refuses cap/base overflow or a nonexistent funded Level', () => {
  expect(playerProgressionProposal(policy.baseAttributes, 237, curve, policy)).toMatchObject({
    unspent: 6,
    redistribution: null,
  })
  const capped = playerProgressionProposal({ ...attributes, might: 61 }, 0, curve, policy)
  expect(capped.fitLevel).toBeNull()
  expect(capped.redistribution).toBeNull()
  expect(capped.issues.length).toBeGreaterThan(0)
  expect(
    playerProgressionProposal(
      attributes,
      0,
      { ...curve, maxLevel: 3, cumulativeXpByLevel: [0, 237, 474] },
      policy,
    ).fitLevel,
  ).toBeNull()
})
it.each([-1, 1.5, 0, 101, NaN])('rejects invalid Level %s', (level) => {
  expect(() => xpForPlayerLevel(level, curve)).toThrow()
})
it('rejects XP beyond the actual cycle cap instead of showing a saveable preview', () => {
  expect(() => playerProgressionProposal(attributes, 237 * 100, curve, policy)).toThrow()
})

it.each([
  [5, 1, 0],
  [7, 3, 474],
  [2, 1, 0],
])(
  'offers an explicit lower Level for %i allocated points while preserving starter points',
  (spent, fitLevel, fitXp) => {
    const reduced = { ...policy.baseAttributes, might: policy.baseAttributes.might + spent }
    const current = playerProgressionProposal(reduced, 948, curve, policy)
    expect(current).toMatchObject({ level: 5, unspent: 9 - spent, fitLevel, fitXp })
    const lowered = playerProgressionProposal(reduced, fitXp, curve, policy)
    expect(lowered).toMatchObject({ level: fitLevel, unspent: Math.max(0, 5 - spent), issues: [] })
    expect(reduced.might).toBe(policy.baseAttributes.might + spent)
  },
)
