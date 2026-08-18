import { AurevaneError } from '@aurevane/game-core/errors'
import { characterCreationRequestSchema } from '@aurevane/validation/player/character'
import { NextResponse } from 'next/server'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { createCharacterInSlot } from '@/server/character/character-slot-service'
import { SELECTED_CHARACTER_COOKIE } from '@/server/character/selected-character'
import { toServerErrorResponse } from '@/server/http/error-response'

function requestUsesHttps(request: Request): boolean {
  return new URL(request.url).protocol === 'https:'
}

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedActor()
    const parsed = characterCreationRequestSchema.safeParse(await request.json())
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const field = issue?.path.length ? issue.path.join('.') : 'request'
      throw new AurevaneError(
        'INVALID_REQUEST',
        issue ? `Check ${field}: ${issue.message}` : 'Review the character creation request.',
      )
    }

    const creation = parsed.data
    const outcome = await createCharacterInSlot({
      actor,
      slotIndex: creation.slotIndex,
      idempotencyKey: creation.idempotencyKey,
      intent: creation.intent,
    })

    const response = NextResponse.json(
      { character: outcome.character, replayed: outcome.replayed },
      { status: outcome.replayed ? 200 : 201, headers: { 'Cache-Control': 'private, no-store' } },
    )
    response.cookies.set(SELECTED_CHARACTER_COOKIE, outcome.character.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: requestUsesHttps(request),
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
    return response
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
