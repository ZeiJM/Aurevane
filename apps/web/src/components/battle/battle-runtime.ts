import type { CharacterPortraitRef } from '@aurevane/game-core/character/creation'
import type { CombatTargetKind, CombatTargetTeamPolicy } from '@aurevane/game-core/combat/actions'
import type { SupportActionId } from '@aurevane/game-core/combat/support-actions'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import type { AnyResonanceDefinition } from '@aurevane/game-core/combat/resonance'
import { normalizeCombatEffectState } from '@aurevane/game-core/combat/combat-effect-state'

import { getStarterPortraitImageAssetId } from '@/media/character'
import type { ImageAssetId } from '@/media/registry'
import type { PvpBattleMetadata } from '@/server/battle/pvp-lobby-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

export type BattleTechniqueCategory = 'attack' | 'defense' | 'heal'

export interface BattleSkillForecastPresentation {
  cooldownOwnerTurns?: number | null
  definition?: MatureSkillDefinition
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
  definition?: AnyResonanceDefinition
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
  supportActionId?: SupportActionId
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

/** Original AI team sizes, excluding combat summons, for a like-for-like Sparring rematch. */
export function battleSparringTeamCounts(battle: BattleSessionView): {
  allyCount: number
  enemyCount: number
} {
  const localId = battle.snapshot.statBridge.combatants.find(
    (profile) => profile.provenance.kind === 'character-derived',
  )?.combatantId
  const localTeam = battle.snapshot.tactical.battle.combatants.find(
    (combatant) => combatant.id === localId,
  )?.teamId
  const summons = new Set(
    (normalizeCombatEffectState(battle.snapshot.effectState).summons ?? []).map(
      (summon) => summon.combatantId,
    ),
  )
  const profiles = battle.snapshot.statBridge.combatants.filter(
    (profile) => profile.provenance.kind === 'scenario' && !summons.has(profile.combatantId),
  )
  const allyCount = profiles.filter(
    (profile) =>
      battle.snapshot.tactical.battle.combatants.find(
        (combatant) => combatant.id === profile.combatantId,
      )?.teamId === localTeam,
  ).length
  return { allyCount, enemyCount: profiles.length - allyCount }
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

  const localTeamId = battle.snapshot.tactical.battle.combatants.find(
    (c) => c.id === localProfile?.combatantId,
  )?.teamId
  const seats = [1, 0]
  const allies = scenarioProfiles.filter(
    (p) =>
      battle.snapshot.tactical.battle.combatants.find((c) => c.id === p.combatantId)?.teamId ===
      localTeamId,
  )
  const enemies = scenarioProfiles.filter((p) => !allies.includes(p))
  scenarioProfiles.forEach((profile) => {
    const allied = allies.includes(profile),
      teamIndex = allied ? 0 : 1
    const index = (allied ? allies : enemies).indexOf(profile)
    participants.push({
      combatantId: profile.combatantId,
      characterId: null,
      name: allied
        ? `Ally ${index + 1}`
        : enemies.length === 1
          ? 'Recruit'
          : `Recruit ${index + 1}`,
      level: profile.level ?? 1,
      teamIndex,
      seatIndex: seats[teamIndex]++,
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
  const activeSummons = normalizeCombatEffectState(battle.snapshot.effectState).summons ?? []
  for (const summon of activeSummons) {
    const owner = participantByCombatant.get(summon.ownerCombatantId)
    if (!owner) continue
    participantByCombatant.set(summon.combatantId, {
      combatantId: summon.combatantId,
      characterId: null,
      name: summon.profile.name,
      level: null,
      teamIndex: owner.teamIndex,
      seatIndex: owner.seatIndex,
      profileImageUrl: null,
      portraitAssetId: null,
      local: false,
    })
  }
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
      runtime.kind === 'pvp' ? 'Defeat every opposing combatant' : 'Defeat every opposing Recruit',
  }
}

export function battleParticipantName(
  viewModel: BattleViewModel,
  combatantId: string | null | undefined,
): string {
  if (!combatantId) return '—'
  return viewModel.participantByCombatant.get(combatantId)?.name ?? combatantId
}
