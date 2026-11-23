import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export interface BattleUsageProvenance {
  version: 1
  source: 'pvp' | 'pve-recruit'
  eligible: boolean
}
async function isTester(userId: string): Promise<boolean> {
  const { data, error } = await createSupabaseAdminClient().rpc('is_pv2_buildcraft_tester_v1', {
    p_user_id: userId,
  })
  if (error || typeof data !== 'boolean') throw new Error('Reporting admission unavailable')
  return data
}
/** Server-only admission. Older, preview, local and tester battles stay uncounted. */
export async function createBattleUsageProvenance(
  source: BattleUsageProvenance['source'],
  userIds: readonly string[],
  tester: (userId: string) => Promise<boolean> = isTester,
): Promise<BattleUsageProvenance> {
  const excluded = { version: 1 as const, source, eligible: false }
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.VERCEL_ENV !== 'production' ||
    process.env.AUREVANE_PV2_TEST_MODE === '1' ||
    process.env.CI === 'true' ||
    process.env.CI === '1' ||
    process.env.VITEST === 'true' ||
    userIds.length === 0 ||
    userIds.length > 24
  )
    return excluded
  try {
    return {
      ...excluded,
      eligible: !(await Promise.all([...new Set(userIds)].map(tester))).some(Boolean),
    }
  } catch {
    // Reporting must never block a battle when its own admission lookup fails.
    return excluded
  }
}
