import type { CharacterPortraitRef } from '@aurevane/game-core/character/creation'

import { getStarterPortraitImageAssetId } from '@/media/character'
import type { ImageAssetId } from '@/media/registry'
import type { PvpBattleMetadata } from '@/server/battle/pvp-lobby-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

export type BattleRuntime =
  | {
      kind: 'pve'
      playerName: string
      playerLevel: number
      playerPortraitAssetId: ImageAssetId
      playerProfileImageUrl: string | null
    }
  | {
      kind: 'pvp'
      playerName: string
      metadata: PvpBattleMetadata
    }

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
  const scenarioProfiles = profiles.filter((profile) => profile.provenance.kind === 'scenario')
  const participants: BattlePresentationParticipant[] = []

  if (localProfile) {
    const characterId = localProfile.provenance.sourceId.startsWith('character:')
      ? localProfile.provenance.sourceId.slice('character:'.length)
      : null
    participants.push({
      combatantId: localProfile.combatantId,
      characterId,
      name: runtime.playerName,
      level: runtime.playerLevel,
      teamIndex: 0,
      seatIndex: 0,
      profileImageUrl: runtime.playerProfileImageUrl,
      portraitAssetId: runtime.playerPortraitAssetId,
      local: true,
    })
  }

  scenarioProfiles.forEach((profile, index) => {
    participants.push({
      combatantId: profile.combatantId,
      characterId: null,
      name: scenarioProfiles.length === 1 ? 'Recruit' : `Recruit ${index + 1}`,
      level: 1,
      teamIndex: 1,
      seatIndex: index,
      profileImageUrl: null,
      portraitAssetId: null,
      local: false,
    })
  })

  return participants
}

function pvpParticipants(
  runtime: Extract<BattleRuntime, { kind: 'pvp' }>,
): BattlePresentationParticipant[] {
  return runtime.metadata.participants.map((participant) => ({
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
  }))
}

export function buildBattleViewModel(
  battle: BattleSessionView,
  runtime: BattleRuntime,
): BattleViewModel {
  const participants =
    runtime.kind === 'pvp' ? pvpParticipants(runtime) : pveParticipants(battle, runtime)
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
