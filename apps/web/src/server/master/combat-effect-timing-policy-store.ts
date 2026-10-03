import 'server-only'
import {
  parseCombatEffectTimingPolicy,
  defaultCombatEffectTimingPolicy,
  type CombatEffectTimingPolicy,
} from '@aurevane/game-core/combat/combat-effect-timing'
import { AurevaneError } from '@aurevane/game-core/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export async function readCombatEffectTimingPolicy(): Promise<CombatEffectTimingPolicy> {
  const { data, error } = await createSupabaseAdminClient().rpc(
    'read_combat_effect_timing_policy_v1',
  )
  // Deploy-order compatibility: the approved default works before this dedicated migration.
  if (error && ['PGRST202', '42883'].includes(error.code)) return defaultCombatEffectTimingPolicy()
  if (error || !data)
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'Combat timing configuration is unavailable.',
    )
  try {
    return parseCombatEffectTimingPolicy(data)
  } catch {
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Combat timing configuration is invalid.')
  }
}
export async function publishCombatEffectTimingPolicy(input: {
  actorUserId: string
  policy: unknown
  reason: unknown
}): Promise<CombatEffectTimingPolicy> {
  let policy: CombatEffectTimingPolicy
  try {
    policy = parseCombatEffectTimingPolicy(input.policy)
  } catch {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Choose registered effect tags and valid timing modes.',
    )
  }
  if (
    typeof input.reason !== 'string' ||
    input.reason.trim().length < 1 ||
    input.reason.trim().length > 240
  )
    throw new AurevaneError('INVALID_REQUEST', 'A reason from 1 to 240 characters is required.')
  const { data, error } = await createSupabaseAdminClient().rpc(
    'publish_combat_effect_timing_policy_v1',
    {
      p_actor_user_id: input.actorUserId,
      p_expected_version: policy.version,
      p_modes: policy.modes,
      p_reason: input.reason.trim(),
    },
  )
  if (error?.message?.includes('TIMING_POLICY_VERSION_CONFLICT'))
    throw new AurevaneError('STALE_VERSION', 'Refresh the timing policy before publishing again.')
  if (error?.code === '42501')
    throw new AurevaneError('FORBIDDEN', 'Only the Game Owner may publish combat timing.')
  if (error || !data)
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'Combat timing changes could not be published.',
    )
  return parseCombatEffectTimingPolicy(data)
}
