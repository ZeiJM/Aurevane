import { AurevaneError } from '@aurevane/game-core/errors'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { loadDisciplineMastery } from '@/server/character/discipline-mastery-service'
import { toServerErrorResponse } from '@/server/http/error-response'
export async function GET() {
  try {
    const actor = await getAuthenticatedActor()
    const character = await loadSelectedCharacter(actor)
    if (!character) throw new AurevaneError('FORBIDDEN', 'Select your character first.')
    return Response.json(
      { progress: await loadDisciplineMastery(actor.userId, character.id) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
