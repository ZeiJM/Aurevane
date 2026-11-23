import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const insertIfAbsent = vi.fn()

vi.mock('./supabase-cartographic-drift-ledger-store', () => ({
  createSupabaseCartographicDriftLedgerStore: () => ({ insertIfAbsent }),
}))

import type { CartographicDriftDefinition } from './cartographic-drift'
import { CartographicDriftLedgerConflictError } from './cartographic-drift-ledger'
import { resolvePersistedCartographicDriftCycle } from './cartographic-drift-resolution-service'

const definition: CartographicDriftDefinition = {
  id: 'reach.near-threshold',
  contentVersion: 1,
  generationVersion: 1,
  variants: [
    { id: 'reach.near-threshold.route-a', contentVersion: 1 },
    { id: 'reach.near-threshold.route-b', contentVersion: 1 },
  ],
}

describe('persisted Cartographic Drift resolution service', () => {
  beforeEach(() => {
    insertIfAbsent.mockReset()
  })

  it('resolves and persists authored resolution metadata without exposing the private seed', async () => {
    insertIfAbsent.mockImplementation(async (entry) => ({ entry, inserted: true }))

    const result = await resolvePersistedCartographicDriftCycle({
      definition,
      cycleKey: 'cycle-2026-09-25-a',
      serverSeed: 'private-server-seed',
      resolvedAt: '2026-09-25T22:00:00.000Z',
    })

    expect(result.replayed).toBe(false)
    expect(result.entry.definitionId).toBe(definition.id)
    expect(result.entry.cycleKey).toBe('cycle-2026-09-25-a')
    expect(result.entry.resolutionId).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(result.entry.resolvedAt).toBe('2026-09-25T22:00:00.000Z')
    expect(definition.variants.map((variant) => variant.id)).toContain(result.entry.variantId)
    expect(result.entry).not.toHaveProperty('serverSeed')
    expect(JSON.stringify(insertIfAbsent.mock.calls)).not.toContain('private-server-seed')
  })

  it('reports replay when persistence returns the same immutable resolution', async () => {
    insertIfAbsent.mockImplementation(async (entry) => ({ entry, inserted: false }))

    const result = await resolvePersistedCartographicDriftCycle({
      definition,
      cycleKey: 'cycle-a',
      serverSeed: 'private-server-seed',
      resolvedAt: '2026-09-25T22:00:00.000Z',
    })

    expect(result.replayed).toBe(true)
  })

  it('fails closed when persistence returns a different resolution for the same definition and cycle', async () => {
    insertIfAbsent.mockImplementation(async (entry) => ({
      entry: { ...entry, resolutionId: `sha256:${'f'.repeat(64)}` },
      inserted: false,
    }))

    await expect(
      resolvePersistedCartographicDriftCycle({
        definition,
        cycleKey: 'cycle-a',
        serverSeed: 'private-server-seed',
      }),
    ).rejects.toBeInstanceOf(CartographicDriftLedgerConflictError)
  })
})
