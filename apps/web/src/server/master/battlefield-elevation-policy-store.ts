import 'server-only'
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
  reason: unknown
}): Promise<BattlefieldElevationPolicy> {
  let policy: BattlefieldElevationPolicy
  try {
    policy = parseBattlefieldElevationPolicy(input.policy)
  } catch {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Elevation chances must total exactly 100%, with at most two decimal places.',
    )
  }
  if (
    typeof input.reason !== 'string' ||
    input.reason.trim().length < 1 ||
    input.reason.trim().length > 240
  )
    throw new AurevaneError('INVALID_REQUEST', 'A reason from 1 to 240 characters is required.')
  const { version, ...chances } = policy
  const { data, error } = await createSupabaseAdminClient().rpc(
    'publish_battlefield_elevation_policy_v1',
    {
      p_actor_user_id: input.actorUserId,
      p_expected_version: version,
      p_chances: chances,
      p_reason: input.reason.trim(),
    },
  )
  if (error?.message?.includes('ELEVATION_POLICY_VERSION_CONFLICT'))
    throw new AurevaneError(
      'STALE_VERSION',
      'Refresh the elevation policy before publishing again.',
    )
  if (error?.code === '42501')
    throw new AurevaneError('FORBIDDEN', 'Only the Game Owner may publish elevation chances.')
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
