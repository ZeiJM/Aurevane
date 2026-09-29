import type { CharacterPortraitRef } from '@aurevane/game-core/character/creation'
import type { CombatTargetKind, CombatTargetTeamPolicy } from '@aurevane/game-core/combat/actions'

import { getStarterPortraitImageAssetId } from '@/media/character'
import type { ImageAssetId } from '@/media/registry'
import type { PvpBattleMetadata } from '@/server/battle/pvp-lobby-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

export type BattleTechniqueCategory = 'attack' | 'defense' | 'heal'

export interface BattleSkillForecastPresentation {
  id: string
  name: string
  iconKey?: string | null
  apCost: number
  mpCost: number
  targetKind: CombatTargetKind
  targetTeamPolicy: CombatTargetTeamPolicy
  minimumRange: number
  maximumRange: number
  tags: readonly string[]
  effectDescriptions: readonly string[]
  requirementDescriptions: readonly string[]
}

export interface BattleTechniquePresentation extends BattleSkillForecastPresentation {
  contentVersion: number
  sourceDisciplineId: string
  cooldownOwnerTurns: number | null
  category: BattleTechniqueCategory
}

export interface BattleCopiedSkillPresentation extends BattleSkillForecastPresentation {
  contentVersion: number
  sourceSkillId: string
  sourceDisciplineId: string
  category: BattleTechniqueCategory
}

export interface BattleResonancePresentation {
  id: string
  contentVersion: number
  name: string
  description: string
}

export interface BattleEssencePresentation extends BattleSkillForecastPresentation {
  contentVersion: number
  description: string
  cooldownOwnerTurns: number | null
}

interface BattleBuildPresentation {
  techniques?: readonly BattleTechniquePresentation[]
  copiedSkills?: readonly BattleCopiedSkillPresentation[]
  resonance?: BattleResonancePresentation | null
  essence?: BattleEssencePresentation | null
}

export type BattleRuntime =
  | (BattleBuildPresentation & {
      kind: 'pve'
      playerName: string
      playerLevel: number
      playerPortraitAssetId: ImageAssetId
      playerProfileImageUrl: string | null
    })
  | (BattleBuildPresentation & {
      kind: 'pvp'
      playerName: string
      metadata: PvpBattleMetadata
    })

export interface BattleCapabilities {
  chat: boolean
  spectate: boolean
  battleLink: boolean
  aiOpponent: boolean
  opponentPolling: boolean
  lessonCoach: boolean
}

export interface BattlePresentationParticipant {
  combatantId: string
  characterId: string | null
  name: string
  level: number | null
  teamIndex: number
  seatIndex: number
  profileImageUrl: string | null
  portraitAssetId: ImageAssetId | null
  local: boolean
  kind: 'character' | 'scenario' | 'summon'
}

export interface BattleViewModel {
  participants: readonly BattlePresentationParticipant[]
  participantByCombatant: ReadonlyMap<string, BattlePresentationParticipant>
  localParticipant: BattlePresentationParticipant | null
  localCombatantId: string | null
  localTeamIndex: number | null
  teamCount: number
  battleKey: string | null
  modeLabel: string
  objectiveEyebrow: string
  objective: string
}

export function deriveBattleCapabilities(runtime: BattleRuntime): BattleCapabilities {
  const pvp = runtime.kind === 'pvp'
  return {
    chat: pvp,
    spectate: pvp,
    battleLink: pvp,
    aiOpponent: !pvp,
    opponentPolling: pvp,
    lessonCoach: !pvp,
  }
}

function pveParticipants(
  battle: BattleSessionView,
  runtime: Extract<BattleRuntime, { kind: 'pve' }>,
): BattlePresentationParticipant[] {
  const profiles = battle.snapshot.statBridge.combatants
  const localProfile = profiles.find((profile) => profile.provenance.kind === 'character-derived')
  const summons = battle.snapshot.effectState?.summons ?? []
  const summonIds = new Set(summons.map((summon) => summon.combatantId))
  const scenarioProfiles = profiles.filter(
    (profile) => profile.provenance.kind === 'scenario' && !summonIds.has(profile.combatantId),
  )
  const participants: BattlePresentationParticipant[] = []
  const battleCombatants = battle.snapshot.tactical.battle.combatants
  const localCombatant = localProfile
    ? (battleCombatants.find((combatant) => combatant.id === localProfile.combatantId) ?? null)
    : null
  const orderedTeamIds = [
    ...(localCombatant ? [localCombatant.teamId] : []),
    ...battleCombatants
      .map((combatant) => combatant.teamId)
      .filter(
        (teamId, index, teamIds) =>
          teamId !== localCombatant?.teamId && teamIds.indexOf(teamId) === index,
      ),
  ]

  const teamIndexForCombatant = (combatantId: string): number => {
    const teamId = battleCombatants.find((combatant) => combatant.id === combatantId)?.teamId
    if (!teamId) return 0
    const index = orderedTeamIds.indexOf(teamId)
    return index < 0 ? 0 : index
  }

  if (localProfile) {
    const characterId = localProfile.provenance.sourceId.startsWith('character:')
      ? localProfile.provenance.sourceId.slice('character:'.length)
      : null
    participants.push({
      combatantId: localProfile.combatantId,
      characterId,
      name: runtime.playerName,
      level: runtime.playerLevel,
      teamIndex: teamIndexForCombatant(localProfile.combatantId),
      seatIndex: 0,
      profileImageUrl: runtime.playerProfileImageUrl,
      portraitAssetId: runtime.playerPortraitAssetId,
      local: true,
      kind: 'character',
    })
  }

  scenarioProfiles.forEach((profile, index) => {
    participants.push({
      combatantId: profile.combatantId,
      characterId: null,
      name: scenarioProfiles.length === 1 ? 'Recruit' : `Recruit ${index + 1}`,
      level: 1,
      teamIndex: teamIndexForCombatant(profile.combatantId),
      seatIndex: index,
      profileImageUrl: null,
      portraitAssetId: null,
      local: false,
      kind: 'scenario',
    })
  })

  summons
    .slice()
    .sort((left, right) => left.combatantId.localeCompare(right.combatantId))
    .forEach((summon, index) => {
      if (!battleCombatants.some((combatant) => combatant.id === summon.combatantId)) return
      participants.push({
        combatantId: summon.combatantId,
        characterId: null,
        name: summon.profile.name,
        level: 1,
        teamIndex: teamIndexForCombatant(summon.combatantId),
        seatIndex: scenarioProfiles.length + index + 1,
        profileImageUrl: null,
        portraitAssetId: null,
        local: false,
        kind: 'summon',
      })
    })

  return participants
}

function pvpParticipants(
  battle: BattleSessionView,
  runtime: Extract<BattleRuntime, { kind: 'pvp' }>,
): BattlePresentationParticipant[] {
  const participants: BattlePresentationParticipant[] = runtime.metadata.participants.map(
    (participant) => ({
      combatantId: participant.combatantId,
      characterId: participant.characterId,
      name: participant.characterName,
      level: participant.characterLevel,
      teamIndex: participant.teamIndex,
      seatIndex: participant.seatIndex,
      profileImageUrl: participant.profileImageUrl,
      portraitAssetId: getStarterPortraitImageAssetId(
        participant.portraitRef as CharacterPortraitRef,
      ),
      local: participant.characterId === runtime.metadata.localCharacterId,
      kind: 'character' as const,
    }),
  )

  ;(battle.snapshot.effectState?.summons ?? [])
    .slice()
    .sort((left, right) => left.combatantId.localeCompare(right.combatantId))
    .forEach((summon, index) => {
      const owner = participants.find(
        (participant) => participant.combatantId === summon.ownerCombatantId,
      )
      if (!owner) return
      if (
        !battle.snapshot.tactical.battle.combatants.some(
          (combatant) => combatant.id === summon.combatantId,
        )
      ) {
        return
      }
      participants.push({
        combatantId: summon.combatantId,
        characterId: null,
        name: summon.profile.name,
        level: 1,
        teamIndex: owner.teamIndex,
        seatIndex: runtime.metadata.participants.length + index,
        profileImageUrl: null,
        portraitAssetId: null,
        local: false,
        kind: 'summon',
      })
    })

  return participants
}

export function buildBattleViewModel(
  battle: BattleSessionView,
  runtime: BattleRuntime,
): BattleViewModel {
  const participants =
    runtime.kind === 'pvp' ? pvpParticipants(battle, runtime) : pveParticipants(battle, runtime)
  const participantByCombatant = new Map(
    participants.map((participant) => [participant.combatantId, participant] as const),
  )
  const localParticipant = participants.find((participant) => participant.local) ?? null
  const highestTeam = participants.reduce(
    (highest, participant) => Math.max(highest, participant.teamIndex),
    -1,
  )

  return {
    participants,
    participantByCombatant,
    localParticipant,
    localCombatantId: localParticipant?.combatantId ?? null,
    localTeamIndex: localParticipant?.teamIndex ?? null,
    teamCount: Math.max(1, highestTeam + 1),
    battleKey: runtime.kind === 'pvp' ? runtime.metadata.battleKey : null,
    modeLabel: runtime.kind === 'pvp' ? runtime.metadata.mode.toUpperCase() : 'AI BATTLE',
    objectiveEyebrow:
      runtime.kind === 'pvp'
        ? `Battle Hall · Player vs Player · ${runtime.metadata.mode.toUpperCase()}`
        : 'Battle Hall · Controlled Exercise',
    objective:
      runtime.kind === 'pvp' ? 'Defeat every opposing combatant' : 'Defeat the opposing Recruit',
  }
}

export function battleParticipantName(
  viewModel: BattleViewModel,
  combatantId: string | null | undefined,
): string {
  if (!combatantId) return '—'
  return viewModel.participantByCombatant.get(combatantId)?.name ?? combatantId
}
