import { isAurevaneError } from '@aurevane/game-core/errors'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import {
  AuthenticatedGameRecovery,
  AuthenticatedGameShell,
} from '@/components/shell/authenticated-game-shell'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadGameEntryCharacterState } from '@/server/character/game-entry-character-state'
import { createSupabaseCharacterRepository } from '@/server/character/supabase-character-repository'
import { loadGameEntryProfileState } from '@/server/player-profile/game-entry-profile-state'
import { createSupabasePlayerProfileRepository } from '@/server/player-profile/supabase-player-profile-repository'

export const dynamic = 'force-dynamic'

export default async function GameEntryPage() {
  const publicConfig = getOptionalPublicSupabaseConfig()
  const requestHost = (await headers()).get('host')
  const readiness = getCurrentAccountServicesReadiness(publicConfig, requestHost)

  if (!readiness.available) {
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

  const profileState = await loadGameEntryProfileState(
    actor,
    createSupabasePlayerProfileRepository(),
  )

  if (profileState.kind === 'persistence-unavailable') {
    return <AuthenticatedGameRecovery />
  }

  const characterState = await loadGameEntryCharacterState(
    actor,
    createSupabaseCharacterRepository(),
  )

  if (characterState.kind === 'persistence-unavailable') {
    return <AuthenticatedGameRecovery />
  }

  return (
    <AuthenticatedGameShell profile={profileState.profile} character={characterState.character} />
  )
}
