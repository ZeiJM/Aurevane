import { describe, expect, it } from 'vitest'

import { validateEventRewardPackageDefinition } from './event-reward'

describe('Event Reward Package definition', () => {
  it('accepts the bounded v1 character XP package', () => {
    expect(
      validateEventRewardPackageDefinition({
        schemaVersion: 1,
        rewardPackageRef: 'reward.world-crisis.participation.v1',
        packageVersion: 1,
        budgetRef: 'budget.event-xp.standard',
        rewards: [{ type: 'character-xp', amount: 75 }],
      }),
    ).toEqual({
      schemaVersion: 1,
      rewardPackageRef: 'reward.world-crisis.participation.v1',
      packageVersion: 1,
      budgetRef: 'budget.event-xp.standard',
      rewards: [{ type: 'character-xp', amount: 75 }],
    })
  })

  it('fails closed for reward types without an authoritative service', () => {
    expect(() =>
      validateEventRewardPackageDefinition({
        schemaVersion: 1,
        rewardPackageRef: 'reward.world-crisis.items.v1',
        packageVersion: 1,
        budgetRef: 'budget.event-item.standard',
        rewards: [{ type: 'item', itemKey: 'item.example', quantity: 1 }],
      }),
    ).toThrow(/unsupported event reward operation type/i)
  })

  it('rejects zero, fractional and unsafe XP amounts', () => {
    for (const amount of [0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() =>
        validateEventRewardPackageDefinition({
          schemaVersion: 1,
          rewardPackageRef: 'reward.world-crisis.participation.v1',
          packageVersion: 1,
          budgetRef: 'budget.event-xp.standard',
          rewards: [{ type: 'character-xp', amount }],
        }),
      ).toThrow(/positive safe integer/i)
    }
  })

  it('keeps schema v1 deliberately single-operation', () => {
    expect(() =>
      validateEventRewardPackageDefinition({
        schemaVersion: 1,
        rewardPackageRef: 'reward.world-crisis.participation.v1',
        packageVersion: 1,
        budgetRef: 'budget.event-xp.standard',
        rewards: [
          { type: 'character-xp', amount: 25 },
          { type: 'character-xp', amount: 25 },
        ],
      }),
    ).toThrow(/exactly one/i)
  })
})
