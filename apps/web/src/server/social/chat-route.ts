import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadSelectedCharacter } from '@/server/character/selected-character'

export interface ChatContext {
  userId: string
  characterId: string
}

/** Chat speaks as the selected character; there is no chat without one. */
export async function chatContext(): Promise<ChatContext> {
  const actor = await getAuthenticatedActor()
  const character = await loadSelectedCharacter(actor)
  if (!character) throw new AurevaneError('FORBIDDEN', 'Choose a character to use chat.')
  return { userId: actor.userId, characterId: character.id }
}

export function chatJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let input: unknown
  try {
    input = await request.json()
  } catch {
    throw new AurevaneError('INVALID_REQUEST', 'That chat request was not valid.')
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AurevaneError('INVALID_REQUEST', 'That chat request was not valid.')
  }
  return input as Record<string, unknown>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export function requireUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new AurevaneError('INVALID_REQUEST', 'That chat request was not valid.')
  }
  return value
}

export function parseAfterId(value: string | null): number {
  const parsed = Number(value)
  return value && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0
}
