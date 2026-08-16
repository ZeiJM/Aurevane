import { isAurevaneError } from '@aurevane/game-core/errors'
import { redirect } from 'next/navigation'

import { AuthenticatedGameShell } from '@/components/shell/authenticated-game-shell'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadPlayerProfile } from '@/server/player-profile/player-profile-service'
import { createSupabasePlayerProfileRepository } from '@/server/player-profile/supabase-player-profile-repository'

export const dynamic = 'force-dynamic'

export default async function GameEntryPage() {
  if (!getOptionalPublicSupabaseConfig()) {
    redirect('/')
  }

  let actor

  try {
    actor = await getAuthenticatedActor()
  } catch (error) {
    if (isAurevaneError(error) && error.code === 'UNAUTHENTICATED') {
      redirect('/')
    }

    throw error
  }

  const profile = await loadPlayerProfile(actor, createSupabasePlayerProfileRepository())

  return <AuthenticatedGameShell profile={profile} />
}
