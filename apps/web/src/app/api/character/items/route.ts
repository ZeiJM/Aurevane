import { AurevaneError } from '@aurevane/game-core/errors'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { createCharacterItemsHandler } from '@/server/character/character-items-handler'
import { createSupabaseCharacterItemsRepository } from '@/server/character/supabase-character-items-repository'
const handler = createCharacterItemsHandler({
  async selected() {
    const actor = await getAuthenticatedActor()
    const character = await loadSelectedCharacter(actor)
    if (!character)
      throw new AurevaneError('INVALID_REQUEST', 'Select a character before editing Items.')
    return { userId: actor.userId, characterId: character.id }
  },
  repository: createSupabaseCharacterItemsRepository,
})
export const GET = handler
export const POST = handler
