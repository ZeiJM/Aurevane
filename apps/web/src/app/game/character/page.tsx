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
import { loadCharacterBuildContext } from '@/server/character/character-build-service'
import { loadCharacterProfileDisplay } from '@/server/character/character-profile-display-service'
import { loadCharacterTitleState } from '@/server/character/character-title-service'
import { isPv2BuildcraftTestKitEnabled } from '@/server/character/pv2-buildcraft-test-kit'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { createSupabaseCharacterBuildRepository } from '@/server/character/supabase-character-build-repository'
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
  let disciplineBuild
  try {
    ;[levelCurve, disciplineBuild] = await Promise.all([
      loadLevelProgressionCurve(
        character.progressionCycle.number,
        createSupabaseProgressionRepository(),
      ),
      loadCharacterBuildContext(actor.userId, character, createSupabaseCharacterBuildRepository()),
    ])
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
  }

  const pv2TestKitEnabled = await isPv2BuildcraftTestKitEnabled(actor.userId)

  return (
    <CharacterProfileShell
      profile={buildCharacterProfileReadModel(character, levelCurve)}
      disciplineBuild={{
        buildVersion: disciplineBuild.build.buildVersion,
        current: disciplineBuild.current,
        currentSecondary: disciplineBuild.currentSecondary,
        availablePrimaries: disciplineBuild.availablePrimaries,
        availableSecondaries: disciplineBuild.availableSecondaries,
        attunement: disciplineBuild.attunement,
        disciplineSkills: {
          capacity: disciplineBuild.disciplineSkills.capacity,
          learnedSkills: disciplineBuild.disciplineSkills.learnedSkills,
          equippedSkills: disciplineBuild.disciplineSkills.equippedSkills,
          extensions: disciplineBuild.disciplineSkills.extensions,
        },
      }}
      personalTitle={personalTitle}
      imageUrl={imageUrl}
      pv2TestKitEnabled={pv2TestKitEnabled}
    />
  )
}
