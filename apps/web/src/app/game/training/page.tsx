import { isAurevaneError } from '@aurevane/game-core/errors'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { OfflineTrainingShell } from '@/components/wayfarers-practice/offline-training-shell'
import type { PracticePlanCardData } from '@/components/wayfarers-practice/practice-plan-card'
import type { TrainingReportCardData } from '@/components/wayfarers-practice/training-report-card'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { loadGameEntryWayfarersPracticeState } from '@/server/wayfarers-practice/game-entry-wayfarers-practice-state'
import { createSupabaseWayfarersPracticeRepository } from '@/server/wayfarers-practice/supabase-wayfarers-practice-repository'

export const dynamic = 'force-dynamic'

export default async function OfflineTrainingPage() {
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

  const character = await loadSelectedCharacter(actor)
  if (!character) redirect('/game')

  const practiceState = await loadGameEntryWayfarersPracticeState(
    actor,
    character.id,
    createSupabaseWayfarersPracticeRepository(),
  )
  if (practiceState.kind === 'persistence-unavailable') redirect('/game/character')

  const practicePlan: PracticePlanCardData = {
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

  let report: TrainingReportCardData | null = null
  if (practiceState.report?.status === 'pending') {
    report = {
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

  return (
    <OfflineTrainingShell
      characterName={character.name}
      practicePlan={practicePlan}
      trainingReport={report}
    />
  )
}
