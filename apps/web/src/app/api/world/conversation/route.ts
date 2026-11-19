import { AurevaneError } from '@aurevane/game-core/errors'
import { parseNpcDialogueRequest } from '@aurevane/validation/combat/npc-design'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { toServerErrorResponse } from '@/server/http/error-response'
import { readWorldDialogue } from '@/server/world/world-repository'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedActor()
    const character = await loadSelectedCharacter(actor)
    if (!character) throw new AurevaneError('FORBIDDEN', 'Select a character to enter the world.')
    const body = await request.text()
    const invalid = new AurevaneError('INVALID_REQUEST', 'That conversation reply is invalid.')
    if (!request.headers.get('content-type')?.includes('application/json') || body.length > 1024)
      throw invalid
    let raw: unknown
    try {
      raw = JSON.parse(body)
    } catch {
      throw invalid
    }
    const reply = parseNpcDialogueRequest(raw)
    if (!reply) throw invalid
    if (reply.characterId !== character.id)
      throw new AurevaneError('STALE_VERSION', 'Your selected character changed. Refresh the map.')
    return Response.json(await readWorldDialogue(actor.userId, reply), {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
