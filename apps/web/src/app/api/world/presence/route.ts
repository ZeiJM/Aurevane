import { AurevaneError } from '@aurevane/game-core/errors'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { toServerErrorResponse } from '@/server/http/error-response'
import { readLiveWorldPlayers } from '@/server/world/world-live-presence-repository'

export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  try {
    const actor = await getAuthenticatedActor()
    const character = await loadSelectedCharacter(actor)
    if (!character) throw new AurevaneError('FORBIDDEN', 'Select a character to enter the world.')
    const rawVersion = new URL(request.url).searchParams.get('version')
    const version = Number(rawVersion)
    if (
      !rawVersion ||
      !/^\d{1,16}$/.test(rawVersion) ||
      !Number.isSafeInteger(version) ||
      version < 1
    )
      throw new AurevaneError('INVALID_REQUEST', 'The World receipt is invalid.')
    const receipt = await readLiveWorldPlayers(actor.userId, character.id, version)
    return Response.json(receipt, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
