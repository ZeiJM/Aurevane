import 'server-only'
import { createSelectedCharacterRpc } from './selected-character-rpc'
import {
  defaultBattlefieldElevationPolicy,
  parseBattlefieldElevationPolicy,
  type BattlefieldElevationPolicy,
} from '@aurevane/game-core/combat/standard-battlefield'
import { AurevaneError } from '@aurevane/game-core/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export async function readBattlefieldElevationPolicy(): Promise<BattlefieldElevationPolicy> {
  const { data, error } = await createSupabaseAdminClient().rpc(
    'read_battlefield_elevation_policy_v1',
  )
  if (error && ['PGRST202', '42883'].includes(error.code))
    return defaultBattlefieldElevationPolicy()
  if (error || !data)
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Elevation configuration is unavailable.')
  try {
    return parseBattlefieldElevationPolicy(data)
  } catch {
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Elevation configuration is invalid.')
  }
}
export async function publishBattlefieldElevationPolicy(input: {
  actorUserId: string
  policy: unknown
}): Promise<BattlefieldElevationPolicy> {
  let policy: BattlefieldElevationPolicy
  try {
    policy = parseBattlefieldElevationPolicy(input.policy)
  } catch {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Each elevation chance must be between 0 and 100%, with at most two decimal places.',
    )
  }
  const { version, ...chances } = policy
  const { data, error } = await createSelectedCharacterRpc((name, params) =>
    createSupabaseAdminClient().rpc(name, params),
  )(
    policy.model === 'independent-highest'
      ? 'publish_battlefield_elevation_policy_v3'
      : 'publish_battlefield_elevation_policy_v2',
    {
      p_actor_user_id: input.actorUserId,
      p_expected_version: version,
      p_chances: chances,
    },
  )
  if (error?.message?.includes('ELEVATION_POLICY_VERSION_CONFLICT'))
    throw new AurevaneError('STALE_VERSION', 'Refresh elevation settings before saving again.')
  if (error?.code === '42501')
    throw new AurevaneError('FORBIDDEN', 'Combat Rules page access is required.')
  if (error || !data)
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Elevation chances could not be published.')
  try {
    return parseBattlefieldElevationPolicy(data)
  } catch {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'Published elevation configuration is invalid.',
    )
  }
}
