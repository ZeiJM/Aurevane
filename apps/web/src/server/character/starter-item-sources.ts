import 'server-only'
import { starterItemDefinitions } from '@aurevane/game-core/content/starter-items'
import { throwItemRpcError, type ItemRpc } from './supabase-character-items-repository'
/** Full definitions enter the same immutable source index and version floor used by inventory admission. */
export async function seedStarterItemSources(rpc: ItemRpc): Promise<void> {
  const { error } = await rpc('seed_runtime_item_sources_v1', {
    p_definitions: starterItemDefinitions(),
  })
  if (error) throwItemRpcError(error)
}
