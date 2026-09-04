import { isStarterCharacterPortraitRef } from '@aurevane/game-core/character/starter-options'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'
import { isAurevaneError } from '@aurevane/game-core/errors'
import { parseBattleSessionId } from '@aurevane/validation/combat/battle-session'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { BattleAudioGate } from '@/components/battle/battle-audio-gate'
import { BattleClientBoundary } from '@/components/battle/battle-client-boundary'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getStarterPortraitImageAssetId } from '@/media/character'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { createBattleSessionService } from '@/server/battle/battle-session-service'
import { getPvpBattleMetadata } from '@/server/battle/pvp-lobby-service'
import { createSupabaseBattleSessionRepository } from '@/server/battle/supabase-battle-session-repository'
import { loadCharacterCommittedBuildSnapshot } from '@/server/character/character-build-service'
import { loadCharacterProfileDisplay } from '@/server/character/character-profile-display-service'
import { createSupabaseCharacterBuildRepository } from '@/server/character/supabase-character-build-repository'
import { createSupabaseCharacterRepository } from '@/server/character/supabase-character-repository'

export const dynamic = 'force-dynamic'

async function loadBattleResonance(userId: string, characterId: string) {
  try {
    const snapshot = await loadCharacterCommittedBuildSnapshot(
      userId,
      characterId,
      createSupabaseCharacterBuildRepository(),
    )
    const reference = snapshot.extensions.resonance
    if (!reference) return null
    const definition = resolveResonanceForPair(
      snapshot.primary.disciplineId,
      snapshot.secondary?.disciplineId ?? null,
      reference.contentVersion,
    )
    if (!definition || definition.id !== reference.resonanceId) return null
    return {
      id: definition.id,
      contentVersion: definition.contentVersion,
      name: definition.name,
      description: definition.description,
    }
  } catch {
    return null
  }
}

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

  if (battle.snapshot.tactical.battle.lifecycle === 'abandoned') {
    redirect('/game/battle')
  }

  const pvpMetadata = await getPvpBattleMetadata(actor.userId, battleSessionId)
  if (pvpMetadata) {
    const character = characters.findByOwnerId
      ? await characters.findByOwnerId(actor.userId, pvpMetadata.localCharacterId)
      : null
    if (!character || !isStarterCharacterPortraitRef(character.portraitRef)) {
      redirect('/game/battle')
    }

    return (
      <BattleAudioGate>
        <BattleClientBoundary
          initialBattle={battle}
          runtime={{
            kind: 'pvp',
            playerName: character.name,
            resonance: await loadBattleResonance(actor.userId, character.id),
            metadata: pvpMetadata,
          }}
        />
      </BattleAudioGate>
    )
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

  let playerProfileImageUrl: string | null = null
  try {
    playerProfileImageUrl = (await loadCharacterProfileDisplay(actor.userId, character.id)).imageUrl
  } catch {
    // Cosmetic display failure falls back to the built-in portrait.
  }

  return (
    <BattleAudioGate>
      <BattleClientBoundary
        initialBattle={battle}
        runtime={{
          kind: 'pve',
          playerName: character.name,
          resonance: await loadBattleResonance(actor.userId, character.id),
          playerLevel: character.level,
          playerPortraitAssetId: getStarterPortraitImageAssetId(character.portraitRef),
          playerProfileImageUrl,
        }}
      />
    </BattleAudioGate>
  )
}
