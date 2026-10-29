import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

/** Names-only projection: never expose authored definitions, grants, unlocks or stats. */
export async function loadCurrentDisciplineNames(
  ids: readonly string[],
): Promise<Readonly<Record<string, string>>> {
  if (!ids.length) return {}
  const requested = new Set(ids)
  try {
    const { data, error } = await createSupabaseAdminClient().rpc(
      'get_current_discipline_catalog_v1',
    )
    if (error || !Array.isArray(data)) return {}
    return Object.fromEntries(
      data.flatMap((row: unknown) => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) return []
        const value = row as Record<string, unknown>
        return typeof value.discipline_id === 'string' &&
          requested.has(value.discipline_id) &&
          typeof value.name === 'string' &&
          value.name.trim() &&
          value.name.length <= 160
          ? [[value.discipline_id, value.name.trim()]]
          : []
      }),
    )
  } catch {
    return {}
  }
}
