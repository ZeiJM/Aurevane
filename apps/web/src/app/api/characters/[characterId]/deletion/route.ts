import { AurevaneError } from '@aurevane/game-core/errors'
import { NextResponse } from 'next/server'

import { getAuthenticatedActor } from '@/server/auth/actor'
import {
  cancelCharacterDeletion,
  requestCharacterDeletion,
} from '@/server/character/character-slot-service'
import { SELECTED_CHARACTER_COOKIE } from '@/server/character/selected-character'
import { toServerErrorResponse } from '@/server/http/error-response'

interface RouteContext {
  params: Promise<{ characterId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getAuthenticatedActor()
    const { characterId } = await context.params
    const body = await request.json()
    const phrase =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>).confirmationPhrase
        : null
    if (typeof phrase !== 'string' || phrase.length > 120) {
      throw new AurevaneError('INVALID_REQUEST', 'Type the exact deletion phrase to continue.')
    }

    const pending = await requestCharacterDeletion(actor.userId, characterId, phrase)
    const response = NextResponse.json(
      { pending },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
    response.cookies.set(SELECTED_CHARACTER_COOKIE, '', { path: '/', maxAge: 0 })
    return response
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actor = await getAuthenticatedActor()
    const { characterId } = await context.params
    const cancelled = await cancelCharacterDeletion(actor.userId, characterId)
    return Response.json({ cancelled }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
