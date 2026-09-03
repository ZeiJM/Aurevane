export type AurevaneErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'INVALID_REQUEST'
  | 'IDEMPOTENCY_CONFLICT'
  | 'STALE_VERSION'
  | 'CHARACTER_NAME_UNAVAILABLE'
  | 'CHARACTER_ALREADY_EXISTS'
  | 'CHARACTER_RESELECT_COOLDOWN'
  | 'TITLE_UNAVAILABLE'
  | 'TITLE_ALREADY_SET'
  | 'BUILD_ATTUNEMENT_COOLDOWN'
  | 'PERSISTENCE_UNAVAILABLE'

export class AurevaneError extends Error {
  constructor(
    readonly code: AurevaneErrorCode,
    readonly publicMessage: string,
    options?: ErrorOptions,
  ) {
    super(publicMessage, options)
    this.name = 'AurevaneError'
  }
}

export class StaleBattleVersionError extends AurevaneError {
  constructor(readonly currentVersion: number) {
    super('STALE_VERSION', 'The battle changed. Refresh the authoritative battle state and retry.')
    this.name = 'StaleBattleVersionError'
  }
}

export function isAurevaneError(value: unknown): value is AurevaneError {
  return value instanceof AurevaneError
}

export function isStaleBattleVersionError(value: unknown): value is StaleBattleVersionError {
  return value instanceof StaleBattleVersionError
}
