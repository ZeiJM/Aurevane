import { AurevaneError } from '@aurevane/game-core/errors'

/** Only the named catalogue guard participates; unrelated SQL errors retain their caller mapping. */
export function throwCombatContentAdmissionError(error: {
  readonly message?: string | null
}): void {
  if (error.message?.includes('COMBAT_CONTENT_ADMISSION_RETRY'))
    throw new AurevaneError(
      'STALE_VERSION',
      'Game content is changing. Refresh and retry this request.',
    )
  if (error.message?.includes('COMBAT_CONTENT_ARCHIVED'))
    throw new AurevaneError(
      'INVALID_REQUEST',
      'This content is archived and cannot be added to a new build or grant.',
    )
}
