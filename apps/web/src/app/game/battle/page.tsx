import { isAurevaneError } from '@aurevane/game-core/errors'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { BattleLaunch } from '@/components/battle/battle-launch'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadGameEntryCharacterState } from '@/server/character/game-entry-character-state'
import { createSupabaseCharacterRepository } from '@/server/character/supabase-character-repository'

export const dynamic = 'force-dynamic'

export default async function BattleLaunchPage() {
  const publicConfig = getOptionalPublicSupabaseConfig()
  const requestHost = (await headers()).get('host')
  const readiness = getCurrentAccountServicesReadiness(publicConfig, requestHost)

  if (!readiness.available) redirect('/')

  let actor
  try {
    actor = await getAuthenticatedActor()
  } catch (error) {
    if (isAurevaneError(error) && error.code === 'UNAUTHENTICATED') redirect('/')
    throw error
  }

  const characterState = await loadGameEntryCharacterState(
    actor,
    createSupabaseCharacterRepository(),
  )
  if (characterState.kind === 'persistence-unavailable' || !characterState.character) {
    redirect('/game')
  }

  return (
    <BattleLaunch
      characterId={characterState.character.id}
      characterName={characterState.character.name}
    />
  )
}
