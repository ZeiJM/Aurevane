import { describe, expect, it } from 'vitest'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { resolveTargetShapeTiles, type CombatTargetSpec } from './actions'
import {
  enumerateCombatTargetSelections,
  resolveCombatTargetFootprint,
} from './combat-targeting-shapes'
const state = percentageDotEncounter()
const tactical = {
  ...state.tactical,
  width: 9,
  height: 9,
  tiles: Array.from({ length: 81 }, (_, i) => ({
    position: { x: i % 9, y: Math.floor(i / 9) },
    elevation: 0,
    terrainId: 'open',
  })),
}
const origin = { x: 4, y: 4 }
const spec = (shape: CombatTargetSpec['shape']): CombatTargetSpec => ({
  geometryVersion: 2,
  kind: 'unit',
  teamPolicy: 'enemy',
  friendlyFire: 'enemies-only',
  shape,
  minimumRange: 0,
  maximumRange: shape.kind === 'line' ? shape.length : shape.kind === 'circle' ? shape.radius : 0,
  maximumElevationDifference: null,
  requiresLineOfSight: false,
})
describe('versioned targeting geometry', () => {
  it('selects exactly one Single tile', () =>
    expect(
      resolveCombatTargetFootprint(
        tactical,
        origin,
        { ...spec({ kind: 'single' }), maximumRange: 5 },
        { kind: 'tile', position: { x: 2, y: 3 } },
      ),
    ).toEqual([{ x: 2, y: 3 }]))
  it.each(['north', 'east', 'south', 'west'] as const)(
    'includes four complete %s lane tiles despite occupants',
    (direction) => {
      const tiles = resolveCombatTargetFootprint(
        tactical,
        origin,
        spec({ kind: 'line', length: 4 }),
        { kind: 'direction', direction },
      )
      expect(tiles).toHaveLength(4)
      expect(tiles[3]).toEqual(
        direction === 'north'
          ? { x: 4, y: 0 }
          : direction === 'south'
            ? { x: 4, y: 8 }
            : direction === 'east'
              ? { x: 8, y: 4 }
              : { x: 0, y: 4 },
      )
    },
  )
  it('uses nested 8 and 24 tile caster rings excluding the caster', () => {
    const one = resolveCombatTargetFootprint(
      tactical,
      origin,
      spec({ kind: 'circle', radius: 1 }),
      { kind: 'activate' },
    )
    const two = resolveCombatTargetFootprint(
      tactical,
      origin,
      spec({ kind: 'circle', radius: 2 }),
      { kind: 'activate' },
    )
    expect(one).toHaveLength(8)
    expect(two).toHaveLength(24)
    expect(two).toEqual(expect.arrayContaining([...one]))
    expect(two).not.toContainEqual(origin)
  })
  it('clips corner rings and lines', () => {
    expect(
      resolveCombatTargetFootprint(tactical, { x: 0, y: 0 }, spec({ kind: 'circle', radius: 2 }), {
        kind: 'activate',
      }),
    ).toHaveLength(8)
    expect(
      resolveCombatTargetFootprint(tactical, { x: 0, y: 0 }, spec({ kind: 'line', length: 4 }), {
        kind: 'direction',
        direction: 'west',
      }),
    ).toEqual([])
  })
  it('includes every battlefield tile for All', () =>
    expect(
      resolveCombatTargetFootprint(tactical, origin, spec({ kind: 'all' }), { kind: 'activate' }),
    ).toHaveLength(81))
  it('rejects mismatched and malformed decisions rather than choosing a target', () => {
    expect(() =>
      resolveCombatTargetFootprint(tactical, origin, spec({ kind: 'line', length: 4 }), {
        kind: 'unit',
        combatantId: 'enemy',
      }),
    ).toThrow()
    expect(() =>
      resolveCombatTargetFootprint(tactical, origin, spec({ kind: 'line', length: 4 }), {
        kind: 'direction',
        direction: 'diagonal',
      } as never),
    ).toThrow()
    expect(() =>
      resolveCombatTargetFootprint(
        tactical,
        origin,
        { ...spec({ kind: 'all' }), geometryVersion: undefined },
        { kind: 'activate' },
      ),
    ).toThrow()
  })
  it('enumerates four directions and one activation without mutating state', () => {
    const before = JSON.stringify(state)
    expect(
      enumerateCombatTargetSelections(state, 'actor', spec({ kind: 'line', length: 4 })),
    ).toEqual(
      ['north', 'east', 'south', 'west'].map((direction) => ({ kind: 'direction', direction })),
    )
    expect(
      enumerateCombatTargetSelections(state, 'actor', spec({ kind: 'circle', radius: 2 })),
    ).toEqual([{ kind: 'activate' }])
    expect(JSON.stringify(state)).toBe(before)
  })
  it('retains remote Euclidean Circle and selected endpoint Line for unversioned definitions', () => {
    const selected = { x: 6, y: 4 }
    const old = {
      ...spec({ kind: 'circle', radius: 2 }),
      geometryVersion: undefined,
      maximumRange: 5,
    }
    expect(
      resolveCombatTargetFootprint(tactical, origin, JSON.parse(JSON.stringify(old)), {
        kind: 'tile',
        position: selected,
      }),
    ).toEqual(resolveTargetShapeTiles(tactical, origin, selected, old.shape))
    expect(
      resolveCombatTargetFootprint(
        tactical,
        origin,
        { ...old, shape: { kind: 'line', length: 4 } },
        { kind: 'tile', position: selected },
      ),
    ).toEqual([
      { x: 5, y: 4 },
      { x: 6, y: 4 },
    ])
  })
})

import { validateCombatActionDefinition } from './combat-authoring-validation'
import { P2_3_GUARD_ACTION } from './actions'
it('validates explicit All and rejects unversioned All or malformed geometry versions', () => {
  const action = {
    ...P2_3_GUARD_ACTION,
    target: { ...spec({ kind: 'all' }), kind: 'ground-tile' as const },
  }
  expect(() => validateCombatActionDefinition(action)).not.toThrow()
  expect(() =>
    validateCombatActionDefinition({
      ...action,
      target: { ...action.target, geometryVersion: undefined },
    }),
  ).toThrow()
  expect(() =>
    validateCombatActionDefinition({
      ...action,
      target: { ...action.target, geometryVersion: 4 as never },
    }),
  ).toThrow()
})
