import { isStarterCharacterPortraitRef } from '@aurevane/game-core/character/starter-options'
import { isAurevaneError } from '@aurevane/game-core/errors'
import { parseBattleSessionId } from '@aurevane/validation/combat/battle-session'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { BattleAudioGate } from '@/components/battle/battle-audio-gate'
import { BattleExperienceV2 } from '@/components/battle/battle-experience-v2'
import { BattleKeyboardAssist } from '@/components/battle/battle-keyboard-assist'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getStarterPortraitImageAssetId } from '@/media/character'
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

  const characters = createSupabaseCharacterRepository()
  const service = createBattleSessionService({
    characters,
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

  const playerProfile = battle.snapshot.statBridge.combatants.find(
    (profile) => profile.provenance.kind === 'character-derived',
  )
  const characterId = playerProfile?.provenance.sourceId.startsWith('character:')
    ? playerProfile.provenance.sourceId.slice('character:'.length)
    : null
  const character =
    characterId && characters.findByOwnerId
      ? await characters.findByOwnerId(actor.userId, characterId)
      : null
  if (!character || !isStarterCharacterPortraitRef(character.portraitRef)) {
    redirect('/game/battle')
  }

  return (
    <BattleAudioGate>
      <BattleExperienceV2
        initialBattle={battle}
        playerName={character.name}
        playerPortraitAssetId={getStarterPortraitImageAssetId(character.portraitRef)}
      />
      <BattleKeyboardAssist />
    </BattleAudioGate>
  )
}
