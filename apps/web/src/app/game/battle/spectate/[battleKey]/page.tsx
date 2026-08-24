import { isAurevaneError } from '@aurevane/game-core/errors'
import { parsePvpBattleKey } from '@aurevane/validation/combat/pvp'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { BattleAudioGate } from '@/components/battle/battle-audio-gate'
import { BattleStatusEffectAssist } from '@/components/battle/battle-status-effect-assist'
import { PvpSpectatorExperience } from '@/components/battle/pvp-spectator-experience'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { joinPvpSpectation } from '@/server/battle/pvp-battle-communication-service'
import { loadPvpParticipantTitles } from '@/server/battle/pvp-battle-profile-service'
import { getPvpSpectatorView } from '@/server/battle/pvp-lobby-service'

export const dynamic = 'force-dynamic'

async function loadSpectatorPageData(userId: string, battleKey: string) {
  try {
    const spectator = await getPvpSpectatorView(battleKey)
    if (!spectator) redirect('/game/battle')

    const battleSessionId = await joinPvpSpectation(userId, battleKey)
    if (!battleSessionId || battleSessionId !== spectator.battle.battleSessionId) {
      redirect('/game/battle')
    }

    const participantTitles = await loadPvpParticipantTitles(
      spectator.participants.map((participant) => participant.characterId),
    )
    return { spectator, participantTitles }
  } catch (error) {
    if (
      isAurevaneError(error) &&
      (error.code === 'FORBIDDEN' ||
        error.code === 'INVALID_REQUEST' ||
        error.code === 'PERSISTENCE_UNAVAILABLE')
    ) {
      redirect('/game/battle')
    }
    throw error
  }
}

export default async function PvpSpectatorPage({
  params,
}: {
  params: Promise<{ battleKey: string }>
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

  const { battleKey: rawBattleKey } = await params
  const battleKey = parsePvpBattleKey(rawBattleKey)
  if (!battleKey) redirect('/game/battle')

  const { spectator, participantTitles } = await loadSpectatorPageData(actor.userId, battleKey)

  return (
    <BattleAudioGate>
      <PvpSpectatorExperience
        initialSpectator={spectator}
        initialParticipantTitles={participantTitles}
      />
      <BattleStatusEffectAssist />
    </BattleAudioGate>
  )
}
