import 'server-only'
import { throwCombatContentAdmissionError } from '../combat/combat-content-admission-error'
import { AurevaneError } from '@aurevane/game-core/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSelectedCharacterRpc } from './selected-character-rpc'
import { createServerMasterPanelStaffAccessService } from './staff-access-server'
import { createMasterPlayersService, playerRecord, type PlayersRpc } from './players-service'
import { readPlayerContentNames } from './player-content-names'
import { masterTeleportGeometry, MASTER_TELEPORT_GEOMETRY_VERSION } from './player-teleport'
import { resolveSector } from '../world/world-content'
import { sectorLabel } from '@/world/coordinate-label'
import { createServerCombatContentResolver } from '../combat/combat-content-resolver'

export function createServerMasterPlayersService() {
  const client = createSupabaseAdminClient()
  const rpc = createSelectedCharacterRpc((name, parameters) => client.rpc(name, parameters))
  const execute: PlayersRpc = async (name, parameters) => {
    const { data, error } = await rpc(name, parameters)
    if (error) {
      throwCombatContentAdmissionError(error)
      if (error.code === '42501')
        throw new AurevaneError(
          'FORBIDDEN',
          'Your selected character does not have access to Players.',
        )
      if (error.code === '40001' || error.code === 'PT409' || error.code === '55P03')
        throw new AurevaneError(
          'STALE_VERSION',
          'The player or encounter changed or is busy. Refresh and review again.',
        )
      if (error.message?.includes('PLAYER_BATTLE_ACTIVE'))
        throw new AurevaneError(
          'INVALID_REQUEST',
          'This character is in a battle. End the encounter safely before making this change.',
        )
      if (error.message?.includes('PLAYER_TELEPORT_FERRY'))
        throw new AurevaneError(
          'INVALID_REQUEST',
          'This character is aboard a ferry. Wait for arrival or leave the ferry before teleporting.',
        )
      if (error.message?.includes('PLAYER_TELEPORT_DESTINATION'))
        throw new AurevaneError(
          'INVALID_REQUEST',
          'That destination is unavailable or blocked. Choose an existing land sector and a walkable cell.',
        )
      const sourceRejections: Record<string, string> = {
        CHARACTER_ATTRIBUTE_POINT_POOL_EXCEEDED:
          'This allocation exceeds the personal point pool for the Level provided by the entered XP. Move points between Core Stats or correct XP first.',
        CHARACTER_ATTRIBUTE_BELOW_PRIMARY_BASE:
          'A Core Stat is below the fixed Primary Discipline base. Only personal points can be redistributed.',
        CHARACTER_ATTRIBUTE_DISCIPLINE_CAP_EXCEEDED:
          'A Core Stat exceeds a Primary focus or nonfocus cap. Use the caps shown beside each field.',
        PLAYER_XP_RANGE_INVALID:
          'The entered XP exceeds the current progression cycle’s Level cap.',
      }
      const sourceReason = sourceRejections[error.message ?? '']
      if (sourceReason) throw new AurevaneError('INVALID_REQUEST', sourceReason)
      if (
        error.code === '22023' ||
        /LOCKED|VERSION_CONFLICT|MASTERY_REQUIRED/u.test(error.message ?? '')
      )
        throw new AurevaneError(
          'INVALID_REQUEST',
          'The correction is not legal for the current character. Check earned Skills, Discipline eligibility, Core limits and progression.',
        )
      throw new AurevaneError(
        'PERSISTENCE_UNAVAILABLE',
        'Player support could not complete this request.',
      )
    }
    if (name === 'read_master_player_v1' && playerRecord(data) && playerRecord(data.world)) {
      const position = data.world.position
      const locationLabel =
        playerRecord(position) &&
        typeof position.sectorId === 'string' &&
        typeof position.x === 'number' &&
        typeof position.y === 'number'
          ? `${sectorLabel(resolveSector(position.sectorId) ?? undefined)} · X:${position.x} · Y:${position.y}`
          : undefined
      return { ...data, world: { ...data.world, locationLabel } }
    }
    return data
  }
  return createMasterPlayersService(
    createServerMasterPanelStaffAccessService(),
    execute,
    (player) => readPlayerContentNames(player, createServerCombatContentResolver()),
    async (userId, destination) => {
      await execute('install_master_teleport_geometry_v1', {
        p_actor_user_id: userId,
        p_geometry_version: MASTER_TELEPORT_GEOMETRY_VERSION,
        p_geometry: masterTeleportGeometry(destination, resolveSector),
      })
    },
  )
}
