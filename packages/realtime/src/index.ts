export const AUTHORITATIVE_STATE_CHANGED = 'authoritative_state_changed' as const

export interface RealtimeInvalidationInput {
  topic: string
  resourceType: string
  resourceId: string
  version?: number
  occurredAt?: string
}

export interface RealtimeInvalidation extends RealtimeInvalidationInput {
  event: typeof AUTHORITATIVE_STATE_CHANGED
}

export interface CharacterLevelChangedInvalidation extends RealtimeInvalidation {
  topic: `character:${string}`
  resourceType: 'character_profile'
  version: number
  occurredAt: string
  reason: 'level_changed'
}

export interface RealtimePublisher {
  publish(notification: RealtimeInvalidation): Promise<void>
}

export function createRealtimeInvalidation(input: RealtimeInvalidationInput): RealtimeInvalidation {
  return {
    event: AUTHORITATIVE_STATE_CHANGED,
    ...input,
  }
}

export function createCharacterLevelChangedInvalidation(input: {
  characterId: string
  level: number
  occurredAt: string
}): CharacterLevelChangedInvalidation {
  return {
    ...createRealtimeInvalidation({
      topic: `character:${input.characterId}`,
      resourceType: 'character_profile',
      resourceId: input.characterId,
      version: input.level,
      occurredAt: input.occurredAt,
    }),
    topic: `character:${input.characterId}`,
    resourceType: 'character_profile',
    version: input.level,
    occurredAt: input.occurredAt,
    reason: 'level_changed',
  }
}
