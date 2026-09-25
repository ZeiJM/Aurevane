import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

import type {
  CartographicDriftLedgerEntry,
  CartographicDriftLedgerStore,
} from './cartographic-drift-ledger'

interface DriftLedgerRpcRow {
  definition_id: string
  definition_content_version: number
  generation_version: number
  cycle_key: string
  variant_id: string
  variant_content_version: number
  resolution_id: string
  resolved_at: string
  inserted: boolean
}

function unavailable(): AurevaneError {
  return new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    'Cartographic Drift resolution history is unavailable right now.',
  )
}

function validText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function parseRow(value: unknown): DriftLedgerRpcRow | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Partial<DriftLedgerRpcRow>
  if (
    !validText(row.definition_id) ||
    !Number.isInteger(row.definition_content_version) ||
    (row.definition_content_version ?? 0) <= 0 ||
    !Number.isInteger(row.generation_version) ||
    (row.generation_version ?? 0) <= 0 ||
    !validText(row.cycle_key) ||
    !validText(row.variant_id) ||
    !Number.isInteger(row.variant_content_version) ||
    (row.variant_content_version ?? 0) <= 0 ||
    !validText(row.resolution_id) ||
    !validText(row.resolved_at) ||
    typeof row.inserted !== 'boolean'
  )
    return null

  return row as DriftLedgerRpcRow
}

function toEntry(row: DriftLedgerRpcRow): CartographicDriftLedgerEntry {
  return {
    definitionId: row.definition_id,
    definitionContentVersion: row.definition_content_version,
    generationVersion: row.generation_version,
    cycleKey: row.cycle_key,
    variantId: row.variant_id,
    variantContentVersion: row.variant_content_version,
    resolutionId: row.resolution_id,
    resolvedAt: row.resolved_at,
  }
}

export function createSupabaseCartographicDriftLedgerStore(): CartographicDriftLedgerStore {
  return {
    async insertIfAbsent(entry) {
      const { data, error } = await createSupabaseAdminClient().rpc(
        'record_cartographic_drift_cycle_resolution_v1',
        {
          p_definition_id: entry.definitionId,
          p_definition_content_version: entry.definitionContentVersion,
          p_generation_version: entry.generationVersion,
          p_cycle_key: entry.cycleKey,
          p_variant_id: entry.variantId,
          p_variant_content_version: entry.variantContentVersion,
          p_resolution_id: entry.resolutionId,
          p_resolved_at: entry.resolvedAt,
        },
      )

      if (error) throw unavailable()
      if (!Array.isArray(data) || data.length !== 1) throw unavailable()
      const row = parseRow(data[0])
      if (!row) throw unavailable()

      return {
        entry: toEntry(row),
        inserted: row.inserted,
      }
    },
  }
}
