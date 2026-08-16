export type AurevaneErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'INVALID_REQUEST'
  | 'IDEMPOTENCY_CONFLICT'
  | 'CHARACTER_NAME_UNAVAILABLE'
  | 'CHARACTER_ALREADY_EXISTS'
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

export function isAurevaneError(value: unknown): value is AurevaneError {
  return value instanceof AurevaneError
}
