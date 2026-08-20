import 'server-only'

import { randomInt, randomUUID } from 'node:crypto'

import type { CharacterRecord } from '@aurevane/db/character'
import { calculateDerivedStats } from '@aurevane/game-core/character/derived-stats'
import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import { createPendingBattle, startBattle, type BattleFacing } from '@aurevane/game-core/combat/battle-state'
import {
  P2_2_ORDINARY_GROUND_PROFILE,
  P2_2_VERTICAL_SLICE_TERRAINS,
  createTacticalBattleState,
  type GridPosition,
} from '@aurevane/game-core/combat/board'
import {
  calculatePv1fBasicAttackDamage,
  createPv1fTemporaryResources,
  preparePv1fTurnEconomy,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  createCharacterDerivedCombatProfile,
  createStatDrivenCombatEncounterState,
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { getTacticalHallArena } from '@aurevane/game-core/combat/tactical-hall-arenas'
import { AurevaneError } from '@aurevane/game-core/errors'
import type { PvpMode } from '@aurevane/validation/combat/pvp'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { loadPublicCharacterProfileImageMap } from '@/server/character/character-profile-display-service'
import { createSupabaseCharacterRepository } from '@/server/character/supabase-character-repository'

import type { BattleSessionProjection, BattleSessionView } from './battle-session-service'

const PVP_RULES_VERSION = 2
const PVP_CONTENT_VERSION = 2
const PVP_BASE_MOVEMENT_UNITS = 10

export interface PvpLobbyMemberView {
  userId: string
  characterId: string
  characterName: string
  characterLevel: number
  portraitRef: string
  profileImageUrl: string | null
  teamIndex: number
  seatIndex: number
  ready: boolean
  isHost: boolean
}

export interface PvpLobbyView {
  lobbyId: string
  lobbyKey: string
  mode: PvpMode
  ownerUserId: string
  teamSizes: readonly [number, number, number]
  status: 'waiting' | 'active' | 'completed' | 'cancelled'
  battleSessionId: string | null
  battleKey: string | null
  readyToStart: boolean
  members: readonly PvpLobbyMemberView[]
}

export interface PvpBattleParticipantView {
  combatantId: string
  characterId: string
  characterName: string
  characterLevel: number
  portraitRef: string
  profileImageUrl: string | null
  teamIndex: number
  seatIndex: number
}

export interface PvpBattleMetadata {
  lobbyId: string
  mode: PvpMode
  battleKey: string
  localCharacterId: string
  participants: readonly PvpBattleParticipantView[]
}

export interface PvpSpectatorView {
  battle: BattleSessionView
  mode: PvpMode
  battleKey: string
  participants: readonly PvpBattleParticipantView[]
}

interface CreateLobbyInput {
  userId: string
  characterId: string
  mode: PvpMode
  teamASize?: number
  teamBSize?: number
}

interface JoinLobbyInput {
  userId: string
  characterId: string
  lobbyKey: string
}

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function readInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) ? (value as number) : null
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function isPvpMode(value: unknown): value is PvpMode {
  return (
    value === '1v1' ||
    value === '2v2' ||
    value === '3v3' ||
    value === '1v1v1' ||
    value === 'flex-teams'
  )
}

function unavailable(message = 'PvP services are unavailable right now.'): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', message)
}

function mapRpcError(error: { code?: string; message?: string }): never {
  const message = error.message ?? ''
  if (error.code === '42501') {
    throw new AurevaneError('FORBIDDEN', 'That PvP lobby or battle is not available to this account.')
  }
  if (message.includes('PVP_LOBBY_FULL')) {
    throw new AurevaneError('INVALID_REQUEST', 'That lobby is already full.')
  }
  if (message.includes('PVP_LOBBY_NOT_READY')) {
    throw new AurevaneError('INVALID_REQUEST', 'Every required seat must be filled and ready first.')
  }
  if (message.includes('PVP_ALREADY_IN_LOBBY')) {
    throw new AurevaneError('INVALID_REQUEST', 'This account is already seated in that lobby.')
  }
  if (message.includes('PVP_LOBBY_NOT_AVAILABLE') || message.includes('PVP_LOBBY_NOT_WAITING')) {
    throw new AurevaneError('INVALID_REQUEST', 'That lobby is no longer available to join.')
  }
  if (message.includes('PVP_CHARACTER_NOT_OWNED')) {
    throw new AurevaneError('FORBIDDEN', 'That character is not available to this account.')
  }
  throw unavailable()
}

async function decorateLobbyMembers(
  members: Omit<PvpLobbyMemberView, 'profileImageUrl'>[],
): Promise<PvpLobbyMemberView[]> {
  let images: ReadonlyMap<string, string> = new Map()
  try {
    images = await loadPublicCharacterProfileImageMap(members.map((member) => member.characterId))
  } catch {
    // Cosmetic image failure falls back to the character's built-in presentation.
  }
  return members.map((member) => ({
    ...member,
    profileImageUrl: images.get(member.characterId) ?? null,
  }))
}

async function decorateBattleParticipants(
  participants: Omit<PvpBattleParticipantView, 'profileImageUrl'>[],
): Promise<PvpBattleParticipantView[]> {
  let images: ReadonlyMap<string, string> = new Map()
  try {
    images = await loadPublicCharacterProfileImageMap(
      participants.map((participant) => participant.characterId),
    )
  } catch {
    // Cosmetic image failure falls back to initials in the PvP surfaces.
  }
  return participants.map((participant) => ({
    ...participant,
    profileImageUrl: images.get(participant.characterId) ?? null,
  }))
}

async function parseLobbyPayload(input: unknown): Promise<PvpLobbyView> {
  if (!isObject(input) || !Array.isArray(input.members) || !isPvpMode(input.mode)) {
    throw unavailable('The server returned an invalid PvP lobby.')
  }
  const lobbyId = readString(input.lobby_id)
  const lobbyKey = readString(input.lobby_key)
  const ownerUserId = readString(input.owner_user_id)
  const teamA = readInteger(input.team_a_size)
  const teamB = readInteger(input.team_b_size)
  const teamC = readInteger(input.team_c_size)
  const status = input.status
  const readyToStart = readBoolean(input.ready_to_start)
  if (
    !lobbyId ||
    !lobbyKey ||
    !ownerUserId ||
    teamA === null ||
    teamB === null ||
    teamC === null ||
    readyToStart === null ||
    (status !== 'waiting' && status !== 'active' && status !== 'completed' && status !== 'cancelled')
  ) {
    throw unavailable('The server returned an invalid PvP lobby.')
  }

  const members: Omit<PvpLobbyMemberView, 'profileImageUrl'>[] = []
  for (const candidate of input.members) {
    if (!isObject(candidate)) throw unavailable('The server returned an invalid PvP lobby seat.')
    const userId = readString(candidate.user_id)
    const characterId = readString(candidate.character_id)
    const characterName = readString(candidate.character_name)
    const characterLevel = readInteger(candidate.character_level)
    const portraitRef = readString(candidate.portrait_ref)
    const teamIndex = readInteger(candidate.team_index)
    const seatIndex = readInteger(candidate.seat_index)
    const ready = readBoolean(candidate.ready)
    const isHost = readBoolean(candidate.is_host)
    if (
      !userId ||
      !characterId ||
      !characterName ||
      characterLevel === null ||
      !portraitRef ||
      teamIndex === null ||
      seatIndex === null ||
      ready === null ||
      isHost === null
    ) {
      throw unavailable('The server returned an invalid PvP lobby seat.')
    }
    members.push({
      userId,
      characterId,
      characterName,
      characterLevel,
      portraitRef,
      teamIndex,
      seatIndex,
      ready,
      isHost,
    })
  }

  return {
    lobbyId,
    lobbyKey,
    mode: input.mode,
    ownerUserId,
    teamSizes: [teamA, teamB, teamC],
    status,
    battleSessionId: readString(input.battle_session_id),
    battleKey: readString(input.battle_key),
    readyToStart,
    members: await decorateLobbyMembers(members),
  }
}

function parseParticipantRows(input: unknown): Omit<PvpBattleParticipantView, 'profileImageUrl'>[] {
  if (!Array.isArray(input)) throw unavailable('The server returned invalid PvP participants.')
  return input.map((candidate) => {
    if (!isObject(candidate)) throw unavailable('The server returned an invalid PvP participant.')
    const combatantId = readString(candidate.combatant_id)
    const characterId = readString(candidate.character_id)
    const characterName = readString(candidate.character_name)
    const characterLevel = readInteger(candidate.character_level)
    const portraitRef = readString(candidate.portrait_ref)
    const teamIndex = readInteger(candidate.team_index)
    const seatIndex = readInteger(candidate.seat_index)
    if (
      !combatantId ||
      !characterId ||
      !characterName ||
      characterLevel === null ||
      !portraitRef ||
      teamIndex === null ||
      seatIndex === null
    ) {
      throw unavailable('The server returned an invalid PvP participant.')
    }
    return { combatantId, characterId, characterName, characterLevel, portraitRef, teamIndex, seatIndex }
  })
}

function spreadCoordinate(index: number, count: number, maximum: number): number {
  return Math.max(0, Math.min(maximum, Math.round(((index + 1) * maximum) / (count + 1))))
}

function spawnFor(
  teamIndex: number,
  seatIndex: number,
  teamSize: number,
  width: number,
  height: number,
): { position: GridPosition; facing: BattleFacing } {
  if (teamIndex === 0) {
    return {
      position: { x: 1, y: spreadCoordinate(seatIndex, teamSize, height - 1) },
      facing: 'east',
    }
  }
  if (teamIndex === 1) {
    return {
      position: { x: width - 2, y: spreadCoordinate(seatIndex, teamSize, height - 1) },
      facing: 'west',
    }
  }
  return { position: { x: Math.floor(width / 2), y: 0 }, facing: 'south' }
}

function createPvpEncounter(
  roster: readonly { member: PvpLobbyMemberView; character: CharacterRecord }[],
  teamSizes: readonly [number, number, number],
): StatDrivenCombatEncounterState {
  const arena = getTacticalHallArena('duel-yard')
  const profiles = []
  const movementProfiles = []
  const placements = []
  const combatants = []

  for (const { member, character } of roster) {
    const combatantId = `character:${character.id}`
    const derived = calculateDerivedStats({
      attributes: {
        might: character.might,
        finesse: character.finesse,
        vitality: character.vitality,
        agility: character.agility,
        intellect: character.intellect,
        resolve: character.resolve,
      },
      level: character.level,
    })
    const movementProfile = {
      ...P2_2_ORDINARY_GROUND_PROFILE,
      id: `character-ground:${character.id}`,
      maxElevationStep: derived.stats.jump.value,
    }
    const basicDamage = calculatePv1fBasicAttackDamage({
      level: character.level,
      might: character.might,
      finesse: character.finesse,
    })
    const spawn = spawnFor(
      member.teamIndex,
      member.seatIndex,
      teamSizes[member.teamIndex] ?? 1,
      arena.width,
      arena.height,
    )

    profiles.push(createCharacterDerivedCombatProfile(combatantId, character.id, derived))
    movementProfiles.push(movementProfile)
    placements.push({
      combatantId,
      position: spawn.position,
      facing: spawn.facing,
      movementProfileId: movementProfile.id,
    })
    combatants.push({
      id: combatantId,
      teamId: `team:${member.teamIndex}`,
      initiative: derived.stats.initiative.value,
      baseMovementBudget: PVP_BASE_MOVEMENT_UNITS,
      hp: derived.stats.maxHp.value,
      maxHp: derived.stats.maxHp.value,
      mp: derived.stats.maxMp.value,
      maxMp: derived.stats.maxMp.value,
      temporaryResources: createPv1fTemporaryResources(basicDamage),
    })
  }

  const battle = startBattle(
    createPendingBattle({
      battleId: `battle:pvp:${randomUUID()}`,
      rulesVersion: PVP_RULES_VERSION,
      contentVersion: PVP_CONTENT_VERSION,
      rngSeed: randomInt(1, 0x1_0000_0000),
      combatants,
    }),
  ).state

  return preparePv1fTurnEconomy(
    createStatDrivenCombatEncounterState(
      createCombatEncounterState(
        createTacticalBattleState({
          battle,
          width: arena.width,
          height: arena.height,
          terrains: P2_2_VERTICAL_SLICE_TERRAINS,
          tiles: arena.tiles,
          movementProfiles,
          placements,
        }),
      ),
      profiles,
    ),
  )
}

function projectSnapshot(input: unknown): BattleSessionProjection {
  if (!isObject(input)) throw unavailable('The stored PvP battle is invalid.')
  const candidate = input as unknown as StatDrivenCombatEncounterState
  const issues = validateStatDrivenCombatEncounterState(candidate)
  if (issues.length > 0) throw unavailable('The stored PvP battle is invalid.')
  const battle = candidate.tactical.battle
  return {
    ...candidate,
    tactical: {
      ...candidate.tactical,
      battle: {
        schemaVersion: battle.schemaVersion,
        battleId: battle.battleId,
        rulesVersion: battle.rulesVersion,
        contentVersion: battle.contentVersion,
        lifecycle: battle.lifecycle,
        combatants: battle.combatants,
        initiativeOrder: battle.initiativeOrder,
        round: battle.round,
        turnNumber: battle.turnNumber,
        currentTurn: battle.currentTurn,
      },
    },
  }
}

export async function getPvpLobby(userId: string, lobbyId: string): Promise<PvpLobbyView> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('get_pvp_lobby_v1', {
    p_user_id: userId,
    p_lobby_id: lobbyId,
  })
  if (error) mapRpcError(error)
  if (!data) throw new AurevaneError('FORBIDDEN', 'That PvP lobby is not available to this account.')
  return parseLobbyPayload(data)
}

export async function createPvpLobby(input: CreateLobbyInput): Promise<PvpLobbyView> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('create_pvp_lobby_v1', {
    p_user_id: input.userId,
    p_character_id: input.characterId,
    p_mode: input.mode,
    p_team_a_size: input.teamASize ?? null,
    p_team_b_size: input.teamBSize ?? null,
  })
  if (error) mapRpcError(error)
  const lobbyId = readString(data)
  if (!lobbyId) throw unavailable('The server did not return the new PvP lobby.')
  return getPvpLobby(input.userId, lobbyId)
}

export async function joinPvpLobby(input: JoinLobbyInput): Promise<PvpLobbyView> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('join_pvp_lobby_v1', {
    p_user_id: input.userId,
    p_character_id: input.characterId,
    p_lobby_key: input.lobbyKey,
  })
  if (error) mapRpcError(error)
  const lobbyId = readString(data)
  if (!lobbyId) throw unavailable('The server did not return the joined PvP lobby.')
  return getPvpLobby(input.userId, lobbyId)
}

export async function setPvpLobbyReady(
  userId: string,
  lobbyId: string,
  ready: boolean,
): Promise<PvpLobbyView> {
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.rpc('set_pvp_lobby_ready_v1', {
    p_user_id: userId,
    p_lobby_id: lobbyId,
    p_ready: ready,
  })
  if (error) mapRpcError(error)
  return getPvpLobby(userId, lobbyId)
}

export async function leavePvpLobby(userId: string, lobbyId: string): Promise<void> {
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.rpc('leave_pvp_lobby_v1', {
    p_user_id: userId,
    p_lobby_id: lobbyId,
  })
  if (error) mapRpcError(error)
}

export async function startPvpLobby(
  userId: string,
  lobbyId: string,
): Promise<{ battleSessionId: string; battleKey: string }> {
  const lobby = await getPvpLobby(userId, lobbyId)
  if (lobby.status === 'active' && lobby.battleSessionId && lobby.battleKey) {
    return { battleSessionId: lobby.battleSessionId, battleKey: lobby.battleKey }
  }
  if (!lobby.readyToStart) {
    throw new AurevaneError('INVALID_REQUEST', 'Every required seat must be filled and ready first.')
  }

  const characters = createSupabaseCharacterRepository()
  const roster: Array<{ member: PvpLobbyMemberView; character: CharacterRecord }> = []
  for (const member of lobby.members) {
    const character = characters.findByOwnerId
      ? await characters.findByOwnerId(member.userId, member.characterId)
      : null
    if (!character) {
      throw new AurevaneError('INVALID_REQUEST', 'A lobby character is no longer available.')
    }
    roster.push({ member, character })
  }

  const encounter = createPvpEncounter(roster, lobby.teamSizes)
  const battle = encounter.tactical.battle
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('create_pvp_battle_session_v1', {
    p_actor_user_id: userId,
    p_lobby_id: lobbyId,
    p_battle_id: battle.battleId,
    p_rules_version: battle.rulesVersion,
    p_content_version: battle.contentVersion,
    p_initial_snapshot: encounter,
    p_participants: roster.map(({ member, character }) => ({
      combatant_id: `character:${character.id}`,
      user_id: member.userId,
      character_id: character.id,
      team_index: member.teamIndex,
    })),
  })
  if (error) mapRpcError(error)
  const row = Array.isArray(data) && data.length === 1 && isObject(data[0]) ? data[0] : null
  const battleSessionId = row ? readString(row.battle_session_id) : null
  const battleKey = row ? readString(row.battle_key) : null
  if (!battleSessionId || !battleKey) throw unavailable('The PvP battle could not be created.')
  return { battleSessionId, battleKey }
}

export async function getPvpBattleMetadata(
  userId: string,
  battleSessionId: string,
): Promise<PvpBattleMetadata | null> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('get_pvp_battle_metadata_v1', {
    p_user_id: userId,
    p_battle_session_id: battleSessionId,
  })
  if (error) mapRpcError(error)
  if (!data) return null
  if (!isObject(data) || !isPvpMode(data.mode)) throw unavailable('The PvP battle metadata is invalid.')
  const lobbyId = readString(data.lobby_id)
  const battleKey = readString(data.battle_key)
  const localCharacterId = readString(data.local_character_id)
  if (!lobbyId || !battleKey || !localCharacterId) throw unavailable('The PvP battle metadata is invalid.')
  const participants = await decorateBattleParticipants(parseParticipantRows(data.participants))
  return { lobbyId, mode: data.mode, battleKey, localCharacterId, participants }
}

export async function getPvpSpectatorView(battleKey: string): Promise<PvpSpectatorView | null> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('get_pvp_spectator_view_v1', {
    p_battle_key: battleKey,
  })
  if (error) mapRpcError(error)
  if (!data) return null
  if (!isObject(data) || !isPvpMode(data.mode)) throw unavailable('The spectator view is invalid.')
  const battleSessionId = readString(data.battle_session_id)
  const battleVersion = readInteger(data.battle_version)
  const resolvedBattleKey = readString(data.battle_key)
  if (!battleSessionId || battleVersion === null || !resolvedBattleKey) {
    throw unavailable('The spectator view is invalid.')
  }
  const participants = await decorateBattleParticipants(parseParticipantRows(data.participants))
  return {
    battle: {
      battleSessionId,
      battleVersion,
      snapshot: projectSnapshot(data.snapshot),
      replayed: false,
      invalidation: null,
    },
    mode: data.mode,
    battleKey: resolvedBattleKey,
    participants,
  }
}
