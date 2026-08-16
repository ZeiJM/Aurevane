import 'server-only'

import type { PlayerProfileRepository } from '@aurevane/db/player-profile'
import { AurevaneError } from '@aurevane/game-core/errors'
import { parsePlayerProfilePersistenceRow } from '@aurevane/validation/player/profile'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export function createSupabasePlayerProfileRepository(): PlayerProfileRepository {
  return {
    async findByUserId(userId) {
      const supabase = await createSupabaseServerClient()
      const { data, error } = await supabase
        .from('player_profiles')
        .select('user_id, created_at')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Player profile is unavailable.')
      }

      if (!data) {
        return null
      }

      const profile = parsePlayerProfilePersistenceRow(data)

      if (!profile) {
        throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Player profile is unavailable.')
      }

      return {
        userId: profile.user_id,
        createdAt: profile.created_at,
      }
    },
  }
}
