import { isStarterCharacterPortraitRef } from '@aurevane/game-core/character/starter-options'
import {
  copiedSkillApCost,
  copiedSkillCommandId,
} from '@aurevane/game-core/combat/combat-skill-copy'
import { isAurevaneError } from '@aurevane/game-core/errors'
import { parseBattleSessionId } from '@aurevane/validation/combat/battle-session'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { BattleAudioGate } from '@/components/battle/battle-audio-gate'
import { BattleClientBoundary } from '@/components/battle/battle-client-boundary'
import type { BattleTechniqueCategory } from '@/components/battle/battle-runtime'
import {
  skillEffectDescription,
  skillRequirementDescription,
  skillTargetTags,
} from '@/components/character/skill-detail-presentation'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getStarterPortraitImageAssetId } from '@/media/character'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'
import { getAuthenticatedActor } from '@/server/auth/actor'
import {
  battleBuildAuthorityForCombatant,
  resolveBattleDisciplineSkillDefinition,
  resolveBattleEssenceDefinition,
  resolveBattleResonanceDefinition,
  resolveBattleTemporarySkillDefinition,
} from '@/server/battle/battle-build-authority'
import { createBattleSessionService } from '@/server/battle/battle-session-service'
import { getPvpBattleMetadata } from '@/server/battle/pvp-lobby-service'
import { createSupabaseBattleSessionRepository } from '@/server/battle/supabase-battle-session-repository'
import { loadCharacterProfileDisplay } from '@/server/character/character-profile-display-service'
import { createSupabaseCharacterRepository } from '@/server/character/supabase-character-repository'
import { createServerCombatContentResolver } from '@/server/combat/combat-content-resolver'

export const dynamic = 'force-dynamic'

function titleCase(value: string): string {
  return value
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function techniqueCategory(tags: readonly string[]): BattleTechniqueCategory {
  if (tags.includes('cockpit:recovery')) return 'heal'
  if (tags.includes('cockpit:defense')) return 'defense'
  if (tags.includes('cockpit:attack')) return 'attack'
  if (tags.includes('cockpit:inspect') || tags.includes('cockpit:movement')) {
    throw new Error(
      'That Technique cockpit category is not executable in the current battle runtime.',
    )
  }

  // Legacy definitions remain readable, but new authored Techniques should carry one explicit
  // cockpit:* tag so mixed-purpose effect tags never decide presentation by accident.
  if (tags.includes('heal') || tags.includes('recovery')) return 'heal'
  if (tags.includes('defense') || tags.includes('guard')) return 'defense'
  return 'attack'
}

async function battleBuildExtensions(
  battle: Awaited<ReturnType<ReturnType<typeof createBattleSessionService>['getSession']>>,
  combatantId: string,
) {
  const authority = battle.snapshot.buildAuthority
  const build = battleBuildAuthorityForCombatant(authority, combatantId)
  const resonanceDefinition = resolveBattleResonanceDefinition(authority, combatantId)
  const essenceDefinition = resolveBattleEssenceDefinition(authority, combatantId)
  const combatContext = authority?.combatContext
  const resolver = createServerCombatContentResolver()
  const essenceOverride = combatContext
    ? essenceDefinition?.skill.overrides[combatContext]
    : undefined

  const techniques = (
    await Promise.all(
      (build?.disciplineSkills ?? []).map(async (reference) => {
        const definition = await resolveBattleDisciplineSkillDefinition(
          authority,
          combatantId,
          reference.skillId,
          resolver,
        )
        if (!definition || definition.sourceDisciplineId !== reference.sourceDisciplineId) return null
        const override = combatContext ? definition.overrides[combatContext] : undefined
        return {
          id: definition.id,
          contentVersion: definition.contentVersion,
          sourceDisciplineId: definition.sourceDisciplineId,
          name: titleCase(definition.id.includes('.') ? definition.id.slice(definition.id.indexOf('.') + 1) : definition.id),
          apCost: override?.apCost ?? definition.apCost,
          mpCost: definition.mpCost ?? 0,
          cooldownOwnerTurns: override?.cooldownOwnerTurns ?? definition.cooldown.ownerTurns,
          category: techniqueCategory(definition.tags),
          targetKind: definition.target.kind,
          targetTeamPolicy: definition.target.teamPolicy,
          minimumRange: definition.target.minimumRange,
          maximumRange: definition.target.maximumRange,
          tags: skillTargetTags(definition),
          effectDescriptions: definition.effects.map(skillEffectDescription),
          requirementDescriptions: definition.requirements.map(skillRequirementDescription),
        }
      }),
    )
  ).filter((entry): entry is NonNullable<typeof entry> => entry !== null)

  const copiedSkills = authority
    ? (
        await Promise.all(
          (battle.snapshot.effectState?.temporarySkills ?? [])
            .filter((grant) => grant.combatantId === combatantId)
            .map(async (grant) => {
              const definition = await resolveBattleTemporarySkillDefinition(
                authority,
                grant,
                resolver,
              )
              if (!definition) return null
              return {
                id: copiedSkillCommandId(definition.id, definition.contentVersion),
                sourceSkillId: definition.id,
                contentVersion: definition.contentVersion,
                sourceDisciplineId: definition.sourceDisciplineId,
                name: titleCase(
                  definition.id.includes('.')
                    ? definition.id.slice(definition.id.indexOf('.') + 1)
                    : definition.id,
                ),
                apCost: copiedSkillApCost(definition, authority.combatContext),
                mpCost: definition.mpCost ?? 0,
                category: techniqueCategory(definition.tags),
                targetKind: definition.target.kind,
                targetTeamPolicy: definition.target.teamPolicy,
                minimumRange: definition.target.minimumRange,
                maximumRange: definition.target.maximumRange,
                tags: [...skillTargetTags(definition), 'Copied'],
                effectDescriptions: definition.effects.map(skillEffectDescription),
                requirementDescriptions: definition.requirements.map(skillRequirementDescription),
              }
            }),
        )
      ).filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    : []

  return {
    techniques,
    copiedSkills,
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
          mpCost: essenceDefinition.skill.mpCost ?? 0,
          targetKind: essenceDefinition.skill.target.kind,
          targetTeamPolicy: essenceDefinition.skill.target.teamPolicy,
          minimumRange: essenceDefinition.skill.target.minimumRange,
          maximumRange: essenceDefinition.skill.target.maximumRange,
          cooldownOwnerTurns:
            essenceOverride?.cooldownOwnerTurns ?? essenceDefinition.skill.cooldown.ownerTurns,
          tags: skillTargetTags(essenceDefinition.skill),
          effectDescriptions: essenceDefinition.skill.effects.map(skillEffectDescription),
          requirementDescriptions: essenceDefinition.skill.requirements.map(
            skillRequirementDescription,
          ),
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
  let pvpMetadata: Awaited<ReturnType<typeof getPvpBattleMetadata>>
  try {
    ;[battle, pvpMetadata] = await Promise.all([
      service.getSession(actor.userId, battleSessionId),
      getPvpBattleMetadata(actor.userId, battleSessionId),
    ])
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

  if (pvpMetadata) {
    const localParticipant = pvpMetadata.participants.find(
      (participant) => participant.characterId === pvpMetadata.localCharacterId,
    )
    if (!localParticipant || !isStarterCharacterPortraitRef(localParticipant.portraitRef))
      redirect('/game/battle')
    const buildExtensions = await battleBuildExtensions(battle, localParticipant.combatantId)

    return (
      <BattleAudioGate>
        <BattleClientBoundary
          initialBattle={battle}
          runtime={{
            kind: 'pvp',
            playerName: localParticipant.characterName,
            techniques: buildExtensions.techniques,
            copiedSkills: buildExtensions.copiedSkills,
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
  const [character, playerProfileImageUrl] = characterId
    ? await Promise.all([
        characters.findByOwnerId
          ? characters.findByOwnerId(actor.userId, characterId)
          : Promise.resolve(null),
        loadCharacterProfileDisplay(actor.userId, characterId).then(
          (display) => display.imageUrl,
          // Cosmetic display failure falls back to the built-in portrait.
          () => null,
        ),
      ])
    : [null, null]
  if (!character || !isStarterCharacterPortraitRef(character.portraitRef)) redirect('/game/battle')

  const buildExtensions = await battleBuildExtensions(battle, `character:${character.id}`)

  return (
    <BattleAudioGate>
      <BattleClientBoundary
        initialBattle={battle}
        runtime={{
          kind: 'pve',
          playerName: character.name,
          techniques: buildExtensions.techniques,
          copiedSkills: buildExtensions.copiedSkills,
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
