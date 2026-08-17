import { isAurevaneError } from '@aurevane/game-core/errors'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import type { PracticePlanCardData } from '@/components/wayfarers-practice/practice-plan-card'
import type { TrainingReportCardData } from '@/components/wayfarers-practice/training-report-card'
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
import { loadGameEntryWayfarersPracticeState } from '@/server/wayfarers-practice/game-entry-wayfarers-practice-state'
import { createSupabaseWayfarersPracticeRepository } from '@/server/wayfarers-practice/supabase-wayfarers-practice-repository'

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

  let trainingReport: TrainingReportCardData | null = null
  let practicePlan: PracticePlanCardData | null = null

  if (characterState.character) {
    const practiceState = await loadGameEntryWayfarersPracticeState(
      actor,
      characterState.character.id,
      createSupabaseWayfarersPracticeRepository(),
    )

    if (practiceState.kind === 'persistence-unavailable') {
      return <AuthenticatedGameRecovery />
    }

    practicePlan = {
      characterId: practiceState.status.characterId,
      minimumOfflineSeconds: practiceState.status.minimumOfflineSeconds,
      restedMomentumBalance: practiceState.status.restedMomentumBalance,
      plannedWindow: practiceState.status.plannedWindow,
      plannedWindowSeconds: practiceState.status.plannedWindowSeconds,
      planSetAt: practiceState.status.planSetAt,
      shortWindowSeconds: practiceState.status.shortWindowSeconds,
      overnightWindowSeconds: practiceState.status.overnightWindowSeconds,
      extendedWindowSeconds: practiceState.status.extendedWindowSeconds,
      serverNow: practiceState.status.serverNow,
    }

    if (practiceState.report?.status === 'pending') {
      trainingReport = {
        reportId: practiceState.report.reportId,
        characterId: practiceState.report.characterId,
        practiceSource: practiceState.report.practiceSource,
        plannedWindow: practiceState.report.plannedWindow,
        plannedWindowSeconds: practiceState.report.plannedWindowSeconds,
        plannedElapsedSeconds: practiceState.report.plannedElapsedSeconds,
        balancedFallbackSeconds: practiceState.report.balancedFallbackSeconds,
        elapsedSeconds: practiceState.report.elapsedSeconds,
        creditedPracticeSeconds:
          practiceState.report.creditedDirectSeconds + practiceState.report.restedMomentumSeconds,
        requestedCharacterXp: practiceState.report.requestedCharacterXp,
        restedMomentumGain: practiceState.report.restedMomentumGain,
        directXpCapReached: practiceState.report.directXpCapReached,
        restedMomentumCapReached: practiceState.report.restedMomentumCapReached,
      }
    }
  }

  return (
    <AuthenticatedGameShell
      profile={profileState.profile}
      character={characterState.character}
      trainingReport={trainingReport}
      practicePlan={practicePlan}
    />
  )
}
