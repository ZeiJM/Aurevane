import { buildCharacterProfileReadModel } from '@aurevane/game-core/character/profile'
import { isAurevaneError } from '@aurevane/game-core/errors'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { CharacterProfileShell } from '@/components/character/character-profile-shell'
import { AuthenticatedGameRecovery } from '@/components/shell/authenticated-game-shell'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { loadPlayerProfile } from '@/server/player-profile/player-profile-service'
import { createSupabasePlayerProfileRepository } from '@/server/player-profile/supabase-player-profile-repository'
import { loadLevelProgressionCurve } from '@/server/progression/progression-service'
import { createSupabaseProgressionRepository } from '@/server/progression/supabase-progression-repository'

export const dynamic = 'force-dynamic'

export default async function CharacterProfilePage() {
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

  try {
    const [character, accountProfile] = await Promise.all([
      loadSelectedCharacter(actor),
      loadPlayerProfile(actor, createSupabasePlayerProfileRepository()),
    ])
    if (!character) redirect('/game')

    const levelCurve = await loadLevelProgressionCurve(
      character.progressionCycle.number,
      createSupabaseProgressionRepository(),
    )

    return (
      <CharacterProfileShell
        profile={buildCharacterProfileReadModel(character, levelCurve)}
        avatarUrl={accountProfile.avatarUrl}
        equippedTitle={accountProfile.equippedTitle}
      />
    )
  } catch (error) {
    if (isAurevaneError(error) && error.code === 'PERSISTENCE_UNAVAILABLE') {
      return <AuthenticatedGameRecovery />
    }
    throw error
  }
}
