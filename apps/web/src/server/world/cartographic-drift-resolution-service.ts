import 'server-only'

import type { CartographicDriftDefinition } from './cartographic-drift'
import {
  resolveCartographicDriftCycle,
  type CartographicDriftLedgerEntry,
} from './cartographic-drift-ledger'
import { createSupabaseCartographicDriftLedgerStore } from './supabase-cartographic-drift-ledger-store'

export interface ResolvePersistedCartographicDriftCycleInput {
  definition: CartographicDriftDefinition
  cycleKey: string
  serverSeed: string
  resolvedAt?: string
}

export interface PersistedCartographicDriftResolution {
  entry: CartographicDriftLedgerEntry
  replayed: boolean
}

export async function resolvePersistedCartographicDriftCycle(
  input: ResolvePersistedCartographicDriftCycleInput,
): Promise<PersistedCartographicDriftResolution> {
  return resolveCartographicDriftCycle({
    ...input,
    store: createSupabaseCartographicDriftLedgerStore(),
  })
}
