export const EVENT_REWARD_PACKAGE_SCHEMA_VERSION = 1 as const

export const EVENT_REWARD_OPERATION_TYPES = ['character-xp'] as const

export type EventRewardOperationType = (typeof EVENT_REWARD_OPERATION_TYPES)[number]

export interface EventCharacterXpReward {
  readonly type: 'character-xp'
  readonly amount: number
}

export type EventRewardOperation = EventCharacterXpReward

export interface EventRewardPackageDefinition {
  readonly schemaVersion: typeof EVENT_REWARD_PACKAGE_SCHEMA_VERSION
  readonly rewardPackageRef: string
  readonly packageVersion: number
  readonly budgetRef: string
  readonly rewards: readonly EventRewardOperation[]
}

type JsonObject = Record<string, unknown>

function object(value: unknown, label: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`)
  }
  return value as JsonObject
}

function identity(value: unknown, label: string): string {
  if (
    typeof value !== 'string' ||
    !/^[a-z0-9][a-z0-9._:-]{1,159}$/.test(value)
  ) {
    throw new TypeError(`${label} must be a stable lowercase identity.`)
  }
  return value
}

function positiveSafeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new RangeError(`${label} must be a positive safe integer.`)
  }
  return value as number
}

export function validateEventRewardPackageDefinition(
  value: unknown,
): EventRewardPackageDefinition {
  const definition = object(value, 'Event Reward Package')

  if (definition.schemaVersion !== EVENT_REWARD_PACKAGE_SCHEMA_VERSION) {
    throw new TypeError('Unsupported Event Reward Package schema version.')
  }

  const rewardPackageRef = identity(definition.rewardPackageRef, 'Reward Package reference')
  const packageVersion = positiveSafeInteger(definition.packageVersion, 'Reward Package version')
  const budgetRef = identity(definition.budgetRef, 'Reward budget reference')

  if (!Array.isArray(definition.rewards) || definition.rewards.length !== 1) {
    throw new TypeError(
      'Event Reward Package schema v1 requires exactly one approved reward operation.',
    )
  }

  const reward = object(definition.rewards[0], 'Event reward operation')
  if (reward.type !== 'character-xp') {
    throw new TypeError('Unsupported Event reward operation type.')
  }

  const amount = positiveSafeInteger(reward.amount, 'Character XP reward amount')

  return {
    schemaVersion: EVENT_REWARD_PACKAGE_SCHEMA_VERSION,
    rewardPackageRef,
    packageVersion,
    budgetRef,
    rewards: [{ type: 'character-xp', amount }],
  }
}
