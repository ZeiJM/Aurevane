import { AurevaneError } from '@aurevane/game-core/errors'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createMasterTargetItemGrantHandler } from '@/server/master/master-target-item-grant-handler'

export const POST = createMasterTargetItemGrantHandler({
  async selected() {
    const actor = await getAuthenticatedActor()
    const character = await loadSelectedCharacter(actor)
    if (!character)
      throw new AurevaneError('INVALID_REQUEST', 'Select your character before granting an Item.')
    return { userId: actor.userId, characterId: character.id }
  },
  rpc: (name, parameters) => createSupabaseAdminClient().rpc(name, parameters),
})
