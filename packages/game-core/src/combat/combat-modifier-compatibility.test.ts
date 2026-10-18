import { expect, it } from 'vitest'
import { source } from './combat-behavior.test-utils'
import {
  combatModifierCompatibilityFacts,
  combatCanonicalModifierRootFacts,
  combatNativeModifierRootFacts,
  combatModifierFactsCompatible,
} from './combat-modifier-compatibility'

const root = source().definition.behaviors[0]!
const primary = combatModifierCompatibilityFacts({ ...root, mode: 'modifier', targeting: null })
const actor = combatModifierCompatibilityFacts({
  ...root,
  mode: 'modifier',
  targeting: null,
  effects: [
    {
      id: 'bonus',
      payload: { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 11000 },
    },
  ],
})

it.each([{ kind: 'line', length: 2 }, { kind: 'circle', radius: 2 }, { kind: 'all' }] as const)(
  'rejects explicit-unit modifiers for canonical $kind, while admitting actor effects',
  (shape) => {
    const facts = combatCanonicalModifierRootFacts({
      ...root,
      targeting: { ...root.targeting!, shape },
    })
    expect(combatModifierFactsCompatible(primary, facts)).toBe(false)
    expect(combatModifierFactsCompatible(actor, facts)).toBe(true)
  },
)
it('applies canonical default geometry while preserving legacy selected-center unit areas', () => {
  const targeting = { ...root.targeting!, shape: { kind: 'circle' as const, radius: 2 } }
  expect(
    combatModifierFactsCompatible(
      primary,
      combatCanonicalModifierRootFacts({ ...root, targeting }),
    ),
  ).toBe(false)
  expect(
    combatModifierFactsCompatible(primary, combatNativeModifierRootFacts(targeting, 'attack')),
  ).toBe(true)
  expect(
    combatModifierFactsCompatible(
      primary,
      combatNativeModifierRootFacts({ ...targeting, geometryVersion: 2 }, 'attack'),
    ),
  ).toBe(false)
})
it('rejects Ground-only Single primaries and supports explicit units in mixed Single selection', () => {
  const targeting = {
    ...root.targeting!,
    geometryVersion: 3 as const,
    categories: ['ground' as const],
  }
  expect(
    combatModifierFactsCompatible(
      primary,
      combatCanonicalModifierRootFacts({ ...root, targeting }),
    ),
  ).toBe(false)
  expect(
    combatModifierFactsCompatible(
      primary,
      combatCanonicalModifierRootFacts({
        ...root,
        targeting: { ...targeting, categories: ['enemy', 'ground'] },
      }),
    ),
  ).toBe(true)
})
it('does not admit unsupported payloads, utility roots or persistent Ground', () => {
  const unsupported = combatModifierCompatibilityFacts({
    ...root,
    effects: [{ id: 'walk', payload: { type: 'move', recipient: 'actor', maximumTiles: 1 } }],
  })
  const facts = combatCanonicalModifierRootFacts(root)
  expect(combatModifierFactsCompatible(unsupported, facts)).toBe(false)
  expect(combatModifierFactsCompatible(actor, { ...facts, classification: 'utility' })).toBe(false)
  expect(combatModifierFactsCompatible(actor, { ...facts, persistentGround: true })).toBe(false)
})
