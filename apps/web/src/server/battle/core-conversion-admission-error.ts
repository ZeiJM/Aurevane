import { AurevaneError } from '@aurevane/game-core/errors'

/** Translate only the named admission guard; authorization and other failures stay with the caller. */
export function throwCoreConversionAdmissionError(error: {
  readonly code?: string
  readonly message?: string
}): void {
  if (error.code === '22023' && error.message === 'CHARACTER_CORE_CONVERSION_REQUIRED')
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Complete the required Core Stat conversion before starting a new battle.',
    )
}
