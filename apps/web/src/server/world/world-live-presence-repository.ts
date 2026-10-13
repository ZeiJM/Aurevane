import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { WorldLivePlayers } from '@/world/live-presence'
import type { WorldState } from '@/world/types'
import { projectWorldPlayers } from './world-service'
import { resolveWorldPlayerImages, worldRpcError } from './world-repository'

export async function readLiveWorldPlayers(
  userId: string,
  characterId: string,
  expectedVersion: number,
): Promise<WorldLivePlayers> {
  const unavailable: WorldLivePlayers = {
    characterId,
    version: expectedVersion,
    serverNow: 0,
    sceneSectorIds: [],
    players: [],
    registered: false,
  }
  const { data, error } = await createSupabaseAdminClient().rpc('read_world_live_players_v1', {
    p_user_id: userId,
    p_character_id: characterId,
    p_expected_version: expectedVersion,
  })
  if (error?.code === '42883' || error?.code === 'PGRST202') return unavailable
  if (error) worldRpcError(error)
  if (
    !data ||
    !Number.isSafeInteger(data.version) ||
    !Number.isFinite(data.serverNow) ||
    typeof data.registered !== 'boolean' ||
    !Array.isArray(data.sceneSectorIds) ||
    data.sceneSectorIds.length > 25 ||
    data.sceneSectorIds.some(
      (id: unknown) => typeof id !== 'string' || id.length < 1 || id.length > 200,
    ) ||
    !Array.isArray(data.players) ||
    data.players.length > 200 ||
    !data.state ||
    data.state.version !== data.version
  )
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'World presence could not be loaded.')
  if (!data.registered || data.version !== expectedVersion)
    return { ...unavailable, version: data.version, serverNow: data.serverNow }
  const players = projectWorldPlayers(data.state as WorldState, data.players, data.sceneSectorIds)
  return {
    characterId,
    version: data.version,
    serverNow: data.serverNow,
    sceneSectorIds: data.sceneSectorIds,
    players: await resolveWorldPlayerImages(players),
    registered: true,
  }
}
