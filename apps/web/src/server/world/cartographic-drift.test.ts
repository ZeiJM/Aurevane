import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  assertCartographicDriftDefinition,
  resolveCartographicDrift,
  type CartographicDriftDefinition,
} from './cartographic-drift'

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

describe('server-owned Cartographic Drift foundation', () => {
  it('resolves the same authored variant and resolution id for the same cycle and seed', () => {
    const first = resolveCartographicDrift({
      definition,
      cycleKey: 'cycle-2026-09-24-a',
      serverSeed: 'private-seed-one',
    })
    const replay = resolveCartographicDrift({
      definition,
      cycleKey: 'cycle-2026-09-24-a',
      serverSeed: 'private-seed-one',
    })

    expect(replay).toEqual(first)
    expect(definition.variants).toContainEqual(first.variant)
    expect(first.resolutionId).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  it('changes the reproducible resolution identity when cadence or authored generation changes', () => {
    const first = resolveCartographicDrift({
      definition,
      cycleKey: 'cycle-a',
      serverSeed: 'private-seed-one',
    })
    const nextCycle = resolveCartographicDrift({
      definition,
      cycleKey: 'cycle-b',
      serverSeed: 'private-seed-one',
    })
    const nextGeneration = resolveCartographicDrift({
      definition: { ...definition, generationVersion: 2 },
      cycleKey: 'cycle-a',
      serverSeed: 'private-seed-one',
    })

    expect(nextCycle.resolutionId).not.toBe(first.resolutionId)
    expect(nextGeneration.resolutionId).not.toBe(first.resolutionId)
  })

  it('never invents a variant outside the versioned authored definition', () => {
    for (let index = 0; index < 24; index++) {
      const result = resolveCartographicDrift({
        definition,
        cycleKey: `cycle-${index}`,
        serverSeed: `private-seed-${index}`,
      })
      expect(definition.variants).toContainEqual(result.variant)
    }
  })

  it('rejects invalid or ambiguous authored definitions', () => {
    expect(() =>
      assertCartographicDriftDefinition({
        ...definition,
        id: 'Reach Invalid',
      }),
    ).toThrow(/stable lowercase content id/)

    expect(() =>
      assertCartographicDriftDefinition({
        ...definition,
        contentVersion: 0,
      }),
    ).toThrow(/content version/)

    expect(() =>
      assertCartographicDriftDefinition({
        ...definition,
        generationVersion: 0,
      }),
    ).toThrow(/generation version/)

    expect(() =>
      assertCartographicDriftDefinition({
        ...definition,
        variants: [],
      }),
    ).toThrow(/at least one authored variant/)

    expect(() =>
      assertCartographicDriftDefinition({
        ...definition,
        variants: [definition.variants[0]!, definition.variants[0]!],
      }),
    ).toThrow(/unique/)
  })

  it('requires both a cadence key and a private server seed', () => {
    expect(() =>
      resolveCartographicDrift({
        definition,
        cycleKey: '',
        serverSeed: 'private-seed',
      }),
    ).toThrow(/cadence cycle key/)

    expect(() =>
      resolveCartographicDrift({
        definition,
        cycleKey: 'cycle-a',
        serverSeed: '',
      }),
    ).toThrow(/server-owned seed/)
  })
})
