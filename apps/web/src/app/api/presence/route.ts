import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { toServerErrorResponse } from '@/server/http/error-response'
import {
  countOnlineCharacters,
  listOnlineCharacters,
  touchCharacterPresence,
} from '@/server/presence/character-presence-service'

export async function GET() {
  try {
    await getAuthenticatedActor()
    const online = await listOnlineCharacters()
    return Response.json(
      { online, count: online.length },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function POST() {
  try {
    const actor = await getAuthenticatedActor()
    const character = await loadSelectedCharacter(actor)
    if (character) await touchCharacterPresence(actor.userId, character.id)
    const count = await countOnlineCharacters()
    return Response.json(
      { count },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
