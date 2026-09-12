import { rekindlingCountFromCycleNumber } from '@aurevane/game-core/character/discipline-atlas'
import { AurevaneError } from '@aurevane/game-core/errors'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadDisciplineMastery } from '@/server/character/discipline-mastery-service'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { toServerErrorResponse } from '@/server/http/error-response'

export async function GET() {
  try {
    const actor = await getAuthenticatedActor()
    const character = await loadSelectedCharacter(actor)
    if (!character) throw new AurevaneError('FORBIDDEN', 'Select your character first.')

    const progress = await loadDisciplineMastery(actor.userId, character.id)
    return Response.json(
      {
        progress,
        atlas: {
          progressionCycleNumber: character.progressionCycle.number,
          rekindlingCount: rekindlingCountFromCycleNumber(character.progressionCycle.number),
          testingAccess: progress.some((row) => row.testingAccess),
        },
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
