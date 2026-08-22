import { buildCharacterProfileReadModel } from '@aurevane/game-core/character/profile'
import { isAurevaneError } from '@aurevane/game-core/errors'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { CharacterProfileShell } from '@/components/character/character-profile-shell'
import { AuthenticatedGameRecovery } from '@/components/shell/authenticated-game-shell'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'
import {
  getActiveBattleForUser,
  getActiveSpectatingForUser,
} from '@/server/account/active-game-session'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadCharacterProfileDisplay } from '@/server/character/character-profile-display-service'
import { loadCharacterTitleState } from '@/server/character/character-title-service'
import { loadSelectedCharacter } from '@/server/character/selected-character'
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

  const [activeBattle, activeSpectating] = await Promise.all([
    getActiveBattleForUser(actor.userId),
    getActiveSpectatingForUser(actor.userId),
  ])
  if (activeBattle) redirect(`/game/battle/${activeBattle.battleSessionId}`)
  if (activeSpectating) redirect(`/game/battle/spectate/${activeSpectating.battleKey}`)

  let character
  try {
    character = await loadSelectedCharacter(actor)
  } catch (error) {
    if (isAurevaneError(error) && error.code === 'PERSISTENCE_UNAVAILABLE') {
      return <AuthenticatedGameRecovery />
    }
    throw error
  }
  if (!character) redirect('/game')

  let levelCurve
  try {
    levelCurve = await loadLevelProgressionCurve(
      character.progressionCycle.number,
      createSupabaseProgressionRepository(),
    )
  } catch (error) {
    if (isAurevaneError(error) && error.code === 'PERSISTENCE_UNAVAILABLE') {
      return <AuthenticatedGameRecovery />
    }
    throw error
  }

  let personalTitle: string | null = null
  let imageUrl: string | null = null
  try {
    const [titleState, displayState] = await Promise.all([
      loadCharacterTitleState(actor.userId, character.id),
      loadCharacterProfileDisplay(actor.userId, character.id),
    ])
    personalTitle = titleState.personalTitle
    imageUrl = displayState.imageUrl
  } catch (error) {
    if (!(isAurevaneError(error) && error.code === 'PERSISTENCE_UNAVAILABLE')) {
      throw error
    }
    // Cosmetic identity reads must not make the authoritative character profile unavailable.
  }

  return (
    <CharacterProfileShell
      profile={buildCharacterProfileReadModel(character, levelCurve)}
      personalTitle={personalTitle}
      imageUrl={imageUrl}
    />
  )
}
