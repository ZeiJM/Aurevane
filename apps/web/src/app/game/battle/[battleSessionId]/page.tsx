import { isStarterCharacterPortraitRef } from '@aurevane/game-core/character/starter-options'
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
import {
  resolveBattleEssenceDefinition,
  resolveBattleResonanceDefinition,
} from '@/server/battle/battle-build-authority'
import { createBattleSessionService } from '@/server/battle/battle-session-service'
import { getPvpBattleMetadata } from '@/server/battle/pvp-lobby-service'
import { createSupabaseBattleSessionRepository } from '@/server/battle/supabase-battle-session-repository'
import { loadCharacterProfileDisplay } from '@/server/character/character-profile-display-service'
import { createSupabaseCharacterRepository } from '@/server/character/supabase-character-repository'

export const dynamic = 'force-dynamic'

function battleBuildExtensions(
  battle: Awaited<ReturnType<ReturnType<typeof createBattleSessionService>['getSession']>>,
  combatantId: string,
) {
  const authority = battle.snapshot.buildAuthority
  const resonanceDefinition = resolveBattleResonanceDefinition(authority, combatantId)
  const essenceDefinition = resolveBattleEssenceDefinition(authority, combatantId)
  const combatContext = authority?.combatContext
  const essenceOverride = combatContext
    ? essenceDefinition?.skill.overrides[combatContext]
    : undefined

  return {
    resonance: resonanceDefinition
      ? {
          id: resonanceDefinition.id,
          contentVersion: resonanceDefinition.contentVersion,
          name: resonanceDefinition.name,
          description: resonanceDefinition.description,
        }
      : null,
    essence: essenceDefinition
      ? {
          id: essenceDefinition.essenceId,
          contentVersion: essenceDefinition.contentVersion,
          name: essenceDefinition.name,
          description: essenceDefinition.description,
          apCost: essenceOverride?.apCost ?? essenceDefinition.skill.apCost,
          cooldownOwnerTurns:
            essenceOverride?.cooldownOwnerTurns ?? essenceDefinition.skill.cooldown.ownerTurns,
        }
      : null,
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
    const buildExtensions = battleBuildExtensions(battle, `character:${character.id}`)

    return (
      <BattleAudioGate>
        <BattleClientBoundary
          initialBattle={battle}
          runtime={{
            kind: 'pvp',
            playerName: character.name,
            resonance: buildExtensions.resonance,
            essence: buildExtensions.essence,
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

  const buildExtensions = battleBuildExtensions(battle, `character:${character.id}`)

  return (
    <BattleAudioGate>
      <BattleClientBoundary
        initialBattle={battle}
        runtime={{
          kind: 'pve',
          playerName: character.name,
          resonance: buildExtensions.resonance,
          essence: buildExtensions.essence,
          playerLevel: character.level,
          playerPortraitAssetId: getStarterPortraitImageAssetId(character.portraitRef),
          playerProfileImageUrl,
        }}
      />
    </BattleAudioGate>
  )
}
