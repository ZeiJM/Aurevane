import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'
import { listCharacterPresenceDirectory } from '@/server/presence/character-presence-service'

export async function GET() {
  try {
    await getAuthenticatedActor()
    const characters = await listCharacterPresenceDirectory()
    return Response.json(
      {
        characters,
        count: characters.length,
        onlineCount: characters.filter((character) => character.isOnline).length,
      },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
