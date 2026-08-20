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
  type CombatTile,
  type GridPosition,
} from '@aurevane/game-core/combat/board'
import {
  calculatePv1fBasicAttackDamage,
  createPv1fTemporaryResources,
  preparePv1fTurnEconomy,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { createPvpQualityResources } from '@aurevane/game-core/combat/pvp-quality'
import {
  createCharacterDerivedCombatProfile,
  createStatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { AurevaneError } from '@aurevane/game-core/errors'
import type { PvpMapBias, PvpMapSize } from '@aurevane/validation/combat/pvp'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseCharacterRepository } from '@/server/character/supabase-character-repository'

import { getPvpLobby, type PvpLobbyMemberView } from './pvp-lobby-service'

const PVP_RULES_VERSION = 2
const PVP_CONTENT_VERSION = 2
const PVP_BASE_MOVEMENT_UNITS = 10

export interface PvpLobbyMapSettings {
  mapSize: PvpMapSize
  elevationBias: PvpMapBias
  terrainBias: PvpMapBias
}

function unavailable(message = 'PvP staging services are unavailable right now.'): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', message)
}

function mapRpcError(error: { code?: string; message?: string }): never {
  const message = error.message ?? ''
  if (error.code === '42501') {
    throw new AurevaneError('FORBIDDEN', 'That PvP lobby is not available to this account.')
  }
  if (message.includes('PVP_INVALID_SEAT')) {
    throw new AurevaneError('INVALID_REQUEST', 'That PvP seat is not available in this format.')
  }
  if (message.includes('PVP_LOBBY_NOT_WAITING')) {
    throw new AurevaneError('INVALID_REQUEST', 'Team composition is locked after battle begins.')
  }
  if (message.includes('PVP_INVALID_MAP_SETTINGS')) {
    throw new AurevaneError('INVALID_REQUEST', 'Choose supported PvP battlefield settings.')
  }
  throw unavailable()
}

export async function getPvpLobbyMapSettings(
  userId: string,
  lobbyId: string,
): Promise<PvpLobbyMapSettings> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('get_pvp_lobby_settings_v1', {
    p_user_id: userId,
    p_lobby_id: lobbyId,
  })
  if (error) mapRpcError(error)
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new AurevaneError('FORBIDDEN', 'That PvP lobby is not available to this account.')
  }
  const row = data as Record<string, unknown>
  const mapSize = row.map_size
  const elevationBias = row.elevation_bias
  const terrainBias = row.terrain_bias
  if (
    (mapSize !== 'medium' && mapSize !== 'large') ||
    (elevationBias !== 'less' && elevationBias !== 'neutral' && elevationBias !== 'more') ||
    (terrainBias !== 'less' && terrainBias !== 'neutral' && terrainBias !== 'more')
  ) {
    throw unavailable('The PvP battlefield settings returned invalid state.')
  }
  return { mapSize, elevationBias, terrainBias }
}

export async function setPvpLobbyMapSettings(
  userId: string,
  lobbyId: string,
  settings: PvpLobbyMapSettings,
): Promise<PvpLobbyMapSettings> {
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.rpc('set_pvp_lobby_settings_v1', {
    p_user_id: userId,
    p_lobby_id: lobbyId,
    p_map_size: settings.mapSize,
    p_elevation_bias: settings.elevationBias,
    p_terrain_bias: settings.terrainBias,
  })
  if (error) mapRpcError(error)
  return getPvpLobbyMapSettings(userId, lobbyId)
}

export async function movePvpLobbySeat(
  userId: string,
  lobbyId: string,
  targetTeamIndex: number,
  targetSeatIndex: number,
) {
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.rpc('move_pvp_lobby_seat_v1', {
    p_user_id: userId,
    p_lobby_id: lobbyId,
    p_target_team_index: targetTeamIndex,
    p_target_seat_index: targetSeatIndex,
  })
  if (error) mapRpcError(error)
  return getPvpLobby(userId, lobbyId)
}

function spreadCoordinate(index: number, count: number, maximum: number): number {
  return Math.max(1, Math.min(maximum - 1, Math.round(((index + 1) * maximum) / (count + 1))))
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
  return { position: { x: Math.floor(width / 2), y: 1 }, facing: 'south' }
}

function chance(bias: PvpMapBias, kind: 'terrain' | 'elevation'): number {
  if (kind === 'terrain') return bias === 'less' ? 70 : bias === 'more' ? 270 : 150
  return bias === 'less' ? 45 : bias === 'more' ? 220 : 115
}

function nearbyKeys(position: GridPosition): string[] {
  return [
    `${position.x}:${position.y}`,
    `${position.x + 1}:${position.y}`,
    `${position.x - 1}:${position.y}`,
    `${position.x}:${position.y + 1}`,
    `${position.x}:${position.y - 1}`,
  ]
}

function createRandomPvpTiles(
  width: number,
  height: number,
  spawns: readonly GridPosition[],
  elevationBias: PvpMapBias,
  terrainBias: PvpMapBias,
): readonly CombatTile[] {
  const protectedTiles = new Set(spawns.flatMap(nearbyKeys))
  const roughChance = chance(terrainBias, 'terrain')
  const raisedChance = chance(elevationBias, 'elevation')
  const tiles: CombatTile[] = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const key = `${x}:${y}`
      const protectedSpawn = protectedTiles.has(key)
      tiles.push({
        position: { x, y },
        elevation: !protectedSpawn && randomInt(0, 1000) < raisedChance ? 1 : 0,
        terrainId:
          !protectedSpawn && randomInt(0, 1000) < roughChance ? 'rough-ground' : 'open-ground',
      })
    }
  }
  return tiles
}

function createPvpEncounter(
  roster: readonly { member: PvpLobbyMemberView; character: CharacterRecord }[],
  teamSizes: readonly [number, number, number],
  settings: PvpLobbyMapSettings,
) {
  const width = settings.mapSize === 'large' ? 13 : 9
  const height = settings.mapSize === 'large' ? 9 : 7
  const spawnRows = roster.map(({ member }) => ({
    member,
    spawn: spawnFor(
      member.teamIndex,
      member.seatIndex,
      teamSizes[member.teamIndex] ?? 1,
      width,
      height,
    ),
  }))
  const tiles = createRandomPvpTiles(
    width,
    height,
    spawnRows.map((row) => row.spawn.position),
    settings.elevationBias,
    settings.terrainBias,
  )
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
    const spawn = spawnRows.find((row) => row.member.characterId === member.characterId)?.spawn
    if (!spawn) throw unavailable('A PvP combatant spawn could not be resolved.')

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
      temporaryResources: [...createPv1fTemporaryResources(basicDamage), ...createPvpQualityResources()].sort(
        (left, right) => left.key.localeCompare(right.key),
      ),
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
          width,
          height,
          terrains: P2_2_VERTICAL_SLICE_TERRAINS,
          tiles,
          movementProfiles,
          placements,
        }),
      ),
      profiles,
    ),
  )
}

export async function startPvpLobbyWithQuality(
  userId: string,
  lobbyId: string,
): Promise<{ battleSessionId: string; battleKey: string }> {
  const lobby = await getPvpLobby(userId, lobbyId)
  if (lobby.status === 'active' && lobby.battleSessionId && lobby.battleKey) {
    return { battleSessionId: lobby.battleSessionId, battleKey: lobby.battleKey }
  }
  if (!lobby.readyToStart) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Every required seat must be filled and ready first.',
    )
  }

  const settings = await getPvpLobbyMapSettings(userId, lobbyId)
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

  const encounter = createPvpEncounter(roster, lobby.teamSizes, settings)
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
  const row = Array.isArray(data) && data.length === 1 && data[0] && typeof data[0] === 'object'
    ? (data[0] as Record<string, unknown>)
    : null
  const battleSessionId = row && typeof row.battle_session_id === 'string' ? row.battle_session_id : null
  const battleKey = row && typeof row.battle_key === 'string' ? row.battle_key : null
  if (!battleSessionId || !battleKey) throw unavailable('The PvP battle could not be created.')
  return { battleSessionId, battleKey }
}
