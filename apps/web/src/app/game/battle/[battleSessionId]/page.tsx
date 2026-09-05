import { isStarterCharacterPortraitRef } from '@aurevane/game-core/character/starter-options'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { isAurevaneError } from '@aurevane/game-core/errors'
import { parseBattleSessionId } from '@aurevane/validation/combat/battle-session'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { BattleAudioGate } from '@/components/battle/battle-audio-gate'
import { BattleClientBoundary } from '@/components/battle/battle-client-boundary'
import type { BattleTechniqueCategory } from '@/components/battle/battle-runtime'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getStarterPortraitImageAssetId } from '@/media/character'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'
import { getAuthenticatedActor } from '@/server/auth/actor'
import {
  battleBuildAuthorityForCombatant,
  resolveBattleEssenceDefinition,
  resolveBattleResonanceDefinition,
} from '@/server/battle/battle-build-authority'
import { createBattleSessionService } from '@/server/battle/battle-session-service'
import { getPvpBattleMetadata } from '@/server/battle/pvp-lobby-service'
import { createSupabaseBattleSessionRepository } from '@/server/battle/supabase-battle-session-repository'
import { loadCharacterProfileDisplay } from '@/server/character/character-profile-display-service'
import { createSupabaseCharacterRepository } from '@/server/character/supabase-character-repository'

export const dynamic = 'force-dynamic'

function titleCase(value: string): string {
  return value
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function techniqueCategory(tags: readonly string[]): BattleTechniqueCategory {
  if (tags.includes('heal') || tags.includes('recovery')) return 'heal'
  if (tags.includes('defense') || tags.includes('guard')) return 'defense'
  return 'attack'
}

function battleBuildExtensions(
  battle: Awaited<ReturnType<ReturnType<typeof createBattleSessionService>['getSession']>>,
  combatantId: string,
) {
  const authority = battle.snapshot.buildAuthority
  const build = battleBuildAuthorityForCombatant(authority, combatantId)
  const resonanceDefinition = resolveBattleResonanceDefinition(authority, combatantId)
  const essenceDefinition = resolveBattleEssenceDefinition(authority, combatantId)
  const combatContext = authority?.combatContext
  const essenceOverride = combatContext
    ? essenceDefinition?.skill.overrides[combatContext]
    : undefined
  const techniques = (build?.disciplineSkills ?? []).flatMap((reference) => {
    const definition = resolveMatureSkillVersion(reference.skillId, reference.contentVersion)
    if (!definition || definition.sourceDisciplineId !== reference.sourceDisciplineId) return []
    const override = combatContext ? definition.overrides[combatContext] : undefined
    const tail = definition.id.includes('.')
      ? definition.id.slice(definition.id.indexOf('.') + 1)
      : definition.id
    return [
      {
        id: definition.id,
        contentVersion: definition.contentVersion,
        sourceDisciplineId: definition.sourceDisciplineId,
        name: titleCase(tail),
        apCost: override?.apCost ?? definition.apCost,
        cooldownOwnerTurns: override?.cooldownOwnerTurns ?? definition.cooldown.ownerTurns,
        category: techniqueCategory(definition.tags),
        targetKind: definition.target.kind,
        minimumRange: definition.target.minimumRange,
        maximumRange: definition.target.maximumRange,
      },
    ]
  })

  return {
    techniques,
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
          id: essenceDefinition.skill.id,
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

  if (battle.snapshot.tactical.battle.lifecycle === 'abandoned') redirect('/game/battle')

  const pvpMetadata = await getPvpBattleMetadata(actor.userId, battleSessionId)
  if (pvpMetadata) {
    const character = characters.findByOwnerId
      ? await characters.findByOwnerId(actor.userId, pvpMetadata.localCharacterId)
      : null
    if (!character || !isStarterCharacterPortraitRef(character.portraitRef))
      redirect('/game/battle')
    const buildExtensions = battleBuildExtensions(battle, `character:${character.id}`)

    return (
      <BattleAudioGate>
        <BattleClientBoundary
          initialBattle={battle}
          runtime={{
            kind: 'pvp',
            playerName: character.name,
            techniques: buildExtensions.techniques,
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
  if (!character || !isStarterCharacterPortraitRef(character.portraitRef)) redirect('/game/battle')

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
          techniques: buildExtensions.techniques,
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
