import { availableSupernaturalChoiceTransitions } from '@aurevane/game-core/character/supernatural-content'
import { buildCharacterProfileReadModel } from '@aurevane/game-core/character/profile'
import { isAurevaneError } from '@aurevane/game-core/errors'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { CharacterProfileShell } from '@/components/character/character-profile-shell'
import { AuthenticatedGameRecoveryContent } from '@/components/shell/authenticated-game-shell'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'
import {
  getActiveBattleForUser,
  getActiveSpectatingForUser,
} from '@/server/account/active-game-session'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadCharacterAttributeAllocation } from '@/server/character/character-attribute-service'
import { loadCharacterBuildContext } from '@/server/character/character-build-service'
import { loadCharacterProfileDisplay } from '@/server/character/character-profile-display-service'
import { loadCharacterTitleState } from '@/server/character/character-title-service'
import { resolveCurrentCharacterSkillDetails } from '@/server/character/current-skill-detail-loader'
import { findAuthoredSupernaturalStoryState } from '@/server/character/supernatural-story-state-service'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { createSupabaseCharacterAttributeRepository } from '@/server/character/supabase-character-attribute-repository'
import { createSupabaseCharacterBuildRepository } from '@/server/character/supabase-character-build-repository'
import { createSupabaseSupernaturalStoryStateRepository } from '@/server/character/supabase-supernatural-story-state-repository'
import { createServerCombatContentResolver } from '@/server/combat/combat-content-resolver'
import { serverLogger } from '@/server/logging'
import { loadLevelProgressionCurve } from '@/server/progression/progression-service'
import { createSupabaseProgressionRepository } from '@/server/progression/supabase-progression-repository'

export const dynamic = 'force-dynamic'

function isPersistenceUnavailable(error: unknown) {
  return isAurevaneError(error) && error.code === 'PERSISTENCE_UNAVAILABLE'
}

function renderPersistenceRecovery(
  stage: 'selected_character' | 'level_curve' | 'discipline_build' | 'attribute_allocation',
) {
  serverLogger.error('character_profile.persistence_unavailable', {
    route: '/game/character',
    stage,
    code: 'PERSISTENCE_UNAVAILABLE',
  })
  return <AuthenticatedGameRecoveryContent />
}

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

  const [activeBattleResult, activeSpectatingResult, characterResult] = await Promise.allSettled([
    getActiveBattleForUser(actor.userId),
    getActiveSpectatingForUser(actor.userId),
    loadSelectedCharacter(actor),
  ])

  if (activeBattleResult.status === 'rejected') throw activeBattleResult.reason
  if (activeSpectatingResult.status === 'rejected') throw activeSpectatingResult.reason
  if (activeBattleResult.value) {
    redirect(`/game/battle/${activeBattleResult.value.battleSessionId}`)
  }
  if (activeSpectatingResult.value) {
    redirect(`/game/battle/spectate/${activeSpectatingResult.value.battleKey}`)
  }

  if (characterResult.status === 'rejected') {
    if (isPersistenceUnavailable(characterResult.reason)) {
      return renderPersistenceRecovery('selected_character')
    }
    throw characterResult.reason
  }
  const character = characterResult.value
  if (!character) redirect('/game')

  const disciplineBuildPromise = loadCharacterBuildContext(
    actor.userId,
    character,
    createSupabaseCharacterBuildRepository(),
  )
  const currentDisciplineSkillsPromise = disciplineBuildPromise.then((disciplineBuild) =>
    resolveCurrentCharacterSkillDetails(
      disciplineBuild.disciplineSkills,
      createServerCombatContentResolver(),
    ),
  )

  const [
    levelCurveResult,
    disciplineBuildResult,
    currentDisciplineSkillsResult,
    attributeAllocationResult,
    titleStateResult,
    displayStateResult,
    supernaturalStateResult,
  ] = await Promise.allSettled([
    loadLevelProgressionCurve(
      character.progressionCycle.number,
      createSupabaseProgressionRepository(),
    ),
    disciplineBuildPromise,
    currentDisciplineSkillsPromise,
    loadCharacterAttributeAllocation(
      actor.userId,
      character,
      createSupabaseCharacterAttributeRepository(),
    ),
    loadCharacterTitleState(actor.userId, character.id),
    loadCharacterProfileDisplay(actor.userId, character.id),
    findAuthoredSupernaturalStoryState(
      actor.userId,
      character.id,
      createSupabaseSupernaturalStoryStateRepository(),
    ),
  ])

  if (levelCurveResult.status === 'rejected') {
    if (isPersistenceUnavailable(levelCurveResult.reason)) {
      return renderPersistenceRecovery('level_curve')
    }
    throw levelCurveResult.reason
  }
  if (disciplineBuildResult.status === 'rejected') {
    if (isPersistenceUnavailable(disciplineBuildResult.reason)) {
      return renderPersistenceRecovery('discipline_build')
    }
    throw disciplineBuildResult.reason
  }
  if (currentDisciplineSkillsResult.status === 'rejected') {
    if (isPersistenceUnavailable(currentDisciplineSkillsResult.reason)) {
      return renderPersistenceRecovery('discipline_build')
    }
    throw currentDisciplineSkillsResult.reason
  }
  if (attributeAllocationResult.status === 'rejected') {
    if (isPersistenceUnavailable(attributeAllocationResult.reason)) {
      return renderPersistenceRecovery('attribute_allocation')
    }
    throw attributeAllocationResult.reason
  }
  if (
    titleStateResult.status === 'rejected' &&
    !isPersistenceUnavailable(titleStateResult.reason)
  ) {
    throw titleStateResult.reason
  }
  if (
    displayStateResult.status === 'rejected' &&
    !isPersistenceUnavailable(displayStateResult.reason)
  ) {
    throw displayStateResult.reason
  }
  if (
    supernaturalStateResult.status === 'rejected' &&
    !isPersistenceUnavailable(supernaturalStateResult.reason)
  ) {
    throw supernaturalStateResult.reason
  }
  const levelCurve = levelCurveResult.value
  const disciplineBuild = disciplineBuildResult.value
  const currentDisciplineSkills = currentDisciplineSkillsResult.value
  const attributeAllocation = attributeAllocationResult.value
  const personalTitle =
    titleStateResult.status === 'fulfilled' ? titleStateResult.value.personalTitle : null
  const imageUrl =
    displayStateResult.status === 'fulfilled' ? displayStateResult.value.imageUrl : null
  const supernaturalState =
    supernaturalStateResult.status === 'fulfilled' ? supernaturalStateResult.value : null
  const supernaturalChoices = supernaturalState
    ? availableSupernaturalChoiceTransitions(supernaturalState).flatMap((transition) =>
        transition.result.path === 'ascended' || transition.result.path === 'severed'
          ? [
              {
                transitionId: transition.id,
                transitionContentVersion: transition.contentVersion,
                path: transition.result.path,
              },
            ]
          : [],
      )
    : []
  return (
    <CharacterProfileShell
      profile={buildCharacterProfileReadModel(character, levelCurve)}
      attributeAllocation={attributeAllocation}
      disciplineBuild={{
        buildVersion: disciplineBuild.build.buildVersion,
        current: disciplineBuild.current,
        currentSecondary: disciplineBuild.currentSecondary,
        availablePrimaries: disciplineBuild.availablePrimaries,
        availableSecondaries: disciplineBuild.availableSecondaries,
        attunement: disciplineBuild.attunement,
        disciplineSkills: {
          capacity: currentDisciplineSkills.capacity,
          learnedSkills: currentDisciplineSkills.learnedSkills,
          equippedSkills: currentDisciplineSkills.equippedSkills,
          extensions: currentDisciplineSkills.extensions,
        },
      }}
      personalTitle={personalTitle}
      imageUrl={imageUrl}
      supernatural={{ state: supernaturalState, choices: supernaturalChoices }}
    />
  )
}
