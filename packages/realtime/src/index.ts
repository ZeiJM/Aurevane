export const AUTHORITATIVE_STATE_CHANGED = 'authoritative_state_changed' as const

export interface RealtimeInvalidationInput {
  topic: string
  resourceType: string
  resourceId: string
  version?: number
}

export interface RealtimeInvalidation extends RealtimeInvalidationInput {
  event: typeof AUTHORITATIVE_STATE_CHANGED
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
