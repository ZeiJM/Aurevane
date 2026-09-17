'use client'

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export class CombatContentAuthoringClientError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'CombatContentAuthoringClientError'
    this.code = code
  }
}

export async function postCombatContentAuthoring<T extends JsonObject>(
  body: JsonObject,
): Promise<T> {
  const response = await fetch('/api/master/combat-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new CombatContentAuthoringClientError(
      'INVALID_RESPONSE',
      'The Master Panel returned an unreadable response.',
    )
  }

  if (!response.ok) {
    const error = isObject(payload) && isObject(payload.error) ? payload.error : null
    const code = error && typeof error.code === 'string' ? error.code : 'REQUEST_FAILED'
    const message =
      error && typeof error.message === 'string'
        ? error.message
        : 'The Master Panel could not complete that operation.'
    throw new CombatContentAuthoringClientError(code, message)
  }

  if (!isObject(payload)) {
    throw new CombatContentAuthoringClientError(
      'INVALID_RESPONSE',
      'The Master Panel returned an invalid response.',
    )
  }
  return payload as T
}
