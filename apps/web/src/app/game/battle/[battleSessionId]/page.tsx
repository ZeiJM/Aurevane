import { isAurevaneError } from '@aurevane/game-core/errors'
import { parseBattleSessionId } from '@aurevane/validation/combat/battle-session'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { BattleAbortControls } from '@/components/battle/battle-abort-controls'
import { BattleAudioGate } from '@/components/battle/battle-audio-gate'
import { BattleExperience } from '@/components/battle/battle-experience'
import { BattleFacingContext } from '@/components/battle/battle-facing-context'
import { BattleKeyboardAssist } from '@/components/battle/battle-keyboard-assist'
import { BattleLessonCoach } from '@/components/battle/battle-lesson-coach'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { createBattleSessionService } from '@/server/battle/battle-session-service'
import { createSupabaseBattleSessionRepository } from '@/server/battle/supabase-battle-session-repository'
import { createSupabaseCharacterRepository } from '@/server/character/supabase-character-repository'

export const dynamic = 'force-dynamic'

export default async function BattleSessionPage({
  params,
}: {
  params: Promise<{ battleSessionId: string }>
}) {
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

  const { battleSessionId: rawBattleSessionId } = await params
  const battleSessionId = parseBattleSessionId(rawBattleSessionId)
  if (!battleSessionId) redirect('/game/battle')

  const service = createBattleSessionService({
    characters: createSupabaseCharacterRepository(),
    battles: createSupabaseBattleSessionRepository(),
  })

  let battle: Awaited<ReturnType<typeof service.getSession>>
  try {
    battle = await service.getSession(actor.userId, battleSessionId)
  } catch (error) {
    if (
      isAurevaneError(error) &&
      (error.code === 'FORBIDDEN' || error.code === 'PERSISTENCE_UNAVAILABLE')
    ) {
      redirect('/game/battle')
    }
    throw error
  }

  return (
    <BattleAudioGate>
      <BattleExperience initialBattle={battle} />
      <BattleFacingContext initialBattle={battle} />
      <BattleKeyboardAssist />
      <BattleLessonCoach battleSessionId={battle.battleSessionId} />
      <BattleAbortControls
        battleSessionId={battle.battleSessionId}
        initialLifecycle={battle.snapshot.tactical.battle.lifecycle}
      />
    </BattleAudioGate>
  )
}
