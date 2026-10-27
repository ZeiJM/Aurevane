import 'server-only'
import { createSelectedCharacterRpc } from './selected-character-rpc'
import {
  parseCombatEffectTimingPolicy,
  parseStoredCombatEffectTimingPolicy,
  defaultCombatEffectTimingPolicy,
  type CombatEffectTimingPolicy,
} from '@aurevane/game-core/combat/combat-effect-timing'
import { AurevaneError } from '@aurevane/game-core/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  RpcPublishedCombatContentSource,
  resolveCombatContentCatalogueSnapshot,
} from '@/server/combat/combat-content-resolver'
import {
  combatTimingUsedBy,
  assertCombatCatalogueTimingCompatible,
} from '@/server/combat/combat-catalogue-timing-compatibility'

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
    return parseStoredCombatEffectTimingPolicy(data)
  } catch {
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Combat timing configuration is invalid.')
  }
}
export async function publishCombatEffectTimingPolicy(input: {
  actorUserId: string
  policy: unknown
  reason?: unknown
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
  const client = createSupabaseAdminClient()
  const snapshot = await new RpcPublishedCombatContentSource((name, parameters) =>
    client.rpc(name, parameters),
  ).readCatalogueSnapshot()
  if (
    snapshot.policy.version !== policy.version ||
    snapshot.policy.tagAuthority !== policy.tagAuthority
  )
    throw new AurevaneError('STALE_VERSION', 'Refresh the timing policy before publishing again.')
  assertCombatCatalogueTimingCompatible(
    resolveCombatContentCatalogueSnapshot({ ...snapshot, policy }),
  )
  const { data, error } = await createSelectedCharacterRpc((name, params) =>
    client.rpc(name, params),
  )('publish_combat_effect_timing_policy_v2', {
    p_actor_user_id: input.actorUserId,
    p_expected_version: policy.version,
    p_modes: policy.modes,
    p_expected_catalogue_token: snapshot.token,
  })
  if (error?.message?.includes('COMBAT_CONTENT_CATALOGUE_CONFLICT'))
    throw new AurevaneError(
      'STALE_VERSION',
      'Combat content or timing changed. Refresh before publishing again.',
    )
  if (error?.message?.includes('TIMING_POLICY_VERSION_CONFLICT'))
    throw new AurevaneError('STALE_VERSION', 'Refresh the timing policy before publishing again.')
  if (error?.code === '42501')
    throw new AurevaneError('FORBIDDEN', 'Combat Rules page access is required.')
  if (error || !data)
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'Combat timing changes could not be published.',
    )
  return parseStoredCombatEffectTimingPolicy(data)
}

export async function readCombatTimingWorkspace() {
  const client = createSupabaseAdminClient()
  const snapshot = await new RpcPublishedCombatContentSource((name, parameters) =>
    client.rpc(name, parameters),
  ).readCatalogueSnapshot()
  const catalogue = resolveCombatContentCatalogueSnapshot(snapshot)
  return {
    policy: catalogue.policy,
    usedBy: combatTimingUsedBy(catalogue),
    tagPresentations: catalogue.tagPresentations ?? [],
  }
}
