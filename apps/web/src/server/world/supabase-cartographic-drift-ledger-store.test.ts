import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const rpc = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({ rpc }),
}))

import { createSupabaseCartographicDriftLedgerStore } from './supabase-cartographic-drift-ledger-store'

const entry = {
  definitionId: 'reach.near-threshold',
  definitionContentVersion: 2,
  generationVersion: 3,
  cycleKey: 'cycle-2026-09-25-a',
  variantId: 'reach.near-threshold.route-b',
  variantContentVersion: 4,
  resolutionId: `sha256:${'a'.repeat(64)}`,
  resolvedAt: '2026-09-25T18:00:00.000Z',
}

function row(inserted: boolean) {
  return {
    definition_id: entry.definitionId,
    definition_content_version: entry.definitionContentVersion,
    generation_version: entry.generationVersion,
    cycle_key: entry.cycleKey,
    variant_id: entry.variantId,
    variant_content_version: entry.variantContentVersion,
    resolution_id: entry.resolutionId,
    resolved_at: entry.resolvedAt,
    inserted,
  }
}

describe('Supabase Cartographic Drift cycle ledger store', () => {
  beforeEach(() => {
    rpc.mockReset()
  })

  it('writes only the immutable authored-resolution identity through the bounded RPC', async () => {
    rpc.mockResolvedValue({ data: [row(true)], error: null })

    const result = await createSupabaseCartographicDriftLedgerStore().insertIfAbsent(entry)

    expect(rpc).toHaveBeenCalledWith('record_cartographic_drift_cycle_resolution_v1', {
      p_definition_id: entry.definitionId,
      p_definition_content_version: entry.definitionContentVersion,
      p_generation_version: entry.generationVersion,
      p_cycle_key: entry.cycleKey,
      p_variant_id: entry.variantId,
      p_variant_content_version: entry.variantContentVersion,
      p_resolution_id: entry.resolutionId,
      p_resolved_at: entry.resolvedAt,
    })
    expect(JSON.stringify(rpc.mock.calls[0])).not.toContain('seed')
    expect(result).toEqual({ entry, inserted: true })
  })

  it('returns the stored immutable row as a replay when the RPC reports an existing cycle', async () => {
    rpc.mockResolvedValue({ data: [row(false)], error: null })

    await expect(
      createSupabaseCartographicDriftLedgerStore().insertIfAbsent(entry),
    ).resolves.toEqual({ entry, inserted: false })
  })

  it('fails closed when persistence returns an error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'database unavailable' } })

    await expect(
      createSupabaseCartographicDriftLedgerStore().insertIfAbsent(entry),
    ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
  })

  it.each([
    null,
    [],
    [{ ...row(true), inserted: 'yes' }],
    [{ ...row(true), definition_content_version: 0 }],
    [{ ...row(true), resolution_id: null }],
  ])('fails closed on malformed RPC data %#', async (data) => {
    rpc.mockResolvedValue({ data, error: null })

    await expect(
      createSupabaseCartographicDriftLedgerStore().insertIfAbsent(entry),
    ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
  })
})
