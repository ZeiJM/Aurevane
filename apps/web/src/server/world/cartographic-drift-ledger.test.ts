import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { CartographicDriftDefinition } from './cartographic-drift'
import {
  CartographicDriftLedgerConflictError,
  resolveCartographicDriftCycle,
  type CartographicDriftLedgerEntry,
  type CartographicDriftLedgerStore,
} from './cartographic-drift-ledger'

const definition: CartographicDriftDefinition = {
  id: 'reach.near-threshold',
  contentVersion: 1,
  generationVersion: 1,
  variants: [
    { id: 'reach.near-threshold.route-a', contentVersion: 1 },
    { id: 'reach.near-threshold.route-b', contentVersion: 1 },
    { id: 'reach.near-threshold.route-c', contentVersion: 1 },
  ],
}

function memoryStore() {
  const entries = new Map<string, CartographicDriftLedgerEntry>()
  const store: CartographicDriftLedgerStore = {
    async insertIfAbsent(entry) {
      const key = `${entry.definitionId}:${entry.cycleKey}`
      const existing = entries.get(key)
      if (existing) return { entry: { ...existing }, inserted: false }
      entries.set(key, { ...entry })
      return { entry: { ...entry }, inserted: true }
    },
  }
  return { entries, store }
}

describe('Cartographic Drift resolved-cycle ledger contract', () => {
  it('records only the authored resolution identity and never persists the private seed', async () => {
    const { entries, store } = memoryStore()
    const result = await resolveCartographicDriftCycle({
      definition,
      cycleKey: 'cycle-2026-09-24-a',
      serverSeed: 'private-seed-one',
      store,
      resolvedAt: '2026-09-24T20:00:00.000Z',
    })

    expect(result.replayed).toBe(false)
    expect(result.entry).toMatchObject({
      definitionId: definition.id,
      definitionContentVersion: 1,
      generationVersion: 1,
      cycleKey: 'cycle-2026-09-24-a',
      variantContentVersion: 1,
      resolvedAt: '2026-09-24T20:00:00.000Z',
    })
    expect(definition.variants.map((variant) => variant.id)).toContain(result.entry.variantId)
    expect(result.entry.resolutionId).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(result.entry).not.toHaveProperty('serverSeed')
    expect(entries.values().next().value).not.toHaveProperty('serverSeed')
  })

  it('replays the immutable stored row for the same definition, cycle, and seed', async () => {
    const { store } = memoryStore()
    const first = await resolveCartographicDriftCycle({
      definition,
      cycleKey: 'cycle-a',
      serverSeed: 'private-seed-one',
      store,
      resolvedAt: '2026-09-24T20:00:00.000Z',
    })
    const replay = await resolveCartographicDriftCycle({
      definition,
      cycleKey: 'cycle-a',
      serverSeed: 'private-seed-one',
      store,
      resolvedAt: '2026-09-24T21:00:00.000Z',
    })

    expect(first.replayed).toBe(false)
    expect(replay.replayed).toBe(true)
    expect(replay.entry).toEqual(first.entry)
  })

  it('rejects a conflicting second resolution for the same definition and cycle', async () => {
    const { store } = memoryStore()
    await resolveCartographicDriftCycle({
      definition,
      cycleKey: 'cycle-a',
      serverSeed: 'private-seed-one',
      store,
    })

    await expect(
      resolveCartographicDriftCycle({
        definition,
        cycleKey: 'cycle-a',
        serverSeed: 'different-private-seed',
        store,
      }),
    ).rejects.toBeInstanceOf(CartographicDriftLedgerConflictError)
  })

  it('does not allow a resolved cycle to be silently reinterpreted by newer authored versions', async () => {
    const { store } = memoryStore()
    await resolveCartographicDriftCycle({
      definition,
      cycleKey: 'cycle-a',
      serverSeed: 'private-seed-one',
      store,
    })

    await expect(
      resolveCartographicDriftCycle({
        definition: { ...definition, contentVersion: 2 },
        cycleKey: 'cycle-a',
        serverSeed: 'private-seed-one',
        store,
      }),
    ).rejects.toBeInstanceOf(CartographicDriftLedgerConflictError)

    await expect(
      resolveCartographicDriftCycle({
        definition: { ...definition, generationVersion: 2 },
        cycleKey: 'cycle-a',
        serverSeed: 'private-seed-one',
        store,
      }),
    ).rejects.toBeInstanceOf(CartographicDriftLedgerConflictError)
  })

  it('allows different cadence cycles to resolve independently', async () => {
    const { entries, store } = memoryStore()
    const first = await resolveCartographicDriftCycle({
      definition,
      cycleKey: 'cycle-a',
      serverSeed: 'private-seed-one',
      store,
    })
    const second = await resolveCartographicDriftCycle({
      definition,
      cycleKey: 'cycle-b',
      serverSeed: 'private-seed-one',
      store,
    })

    expect(first.replayed).toBe(false)
    expect(second.replayed).toBe(false)
    expect(entries.size).toBe(2)
    expect(second.entry.cycleKey).toBe('cycle-b')
  })
})
