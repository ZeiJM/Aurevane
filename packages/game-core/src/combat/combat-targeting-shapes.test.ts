import { describe, expect, it } from 'vitest'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { resolveTargetShapeTiles, type CombatTargetSpec } from './actions'
import {
  enumerateCombatTargetSelections,
  resolveCombatTargetFootprint,
  validateVersionedCombatTargetSpec,
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

// Long authored lanes retain the existing footprint and spatial policies.
describe('Line lengths through fifteen', () => {
  it.each([2, 3] as const)(
    'accepts every length 1–15 and rejects invalid geometry%s reach',
    (geometryVersion) => {
      for (let length = 1; length <= 15; length++) {
        expect(() =>
          validateVersionedCombatTargetSpec({ ...spec({ kind: 'line', length }), geometryVersion }),
        ).not.toThrow()
      }
      for (const length of [0, 16, 1.5, Number.NaN]) {
        const invalid = { ...spec({ kind: 'line', length }), geometryVersion }
        expect(() => validateVersionedCombatTargetSpec(invalid)).toThrow()
        expect(() =>
          resolveCombatTargetFootprint(tactical, origin, invalid, {
            kind: 'direction',
            direction: 'east',
          }),
        ).toThrow()
      }
      expect(() =>
        validateVersionedCombatTargetSpec({
          ...spec({ kind: 'circle', radius: 6 }),
          geometryVersion,
        }),
      ).toThrow()
    },
  )
  for (const geometryVersion of [2, 3] as const) {
    for (const length of [6, 15]) {
      it.each([
        { direction: 'north', origin: { x: 2, y: 1 }, expected: [{ x: 2, y: 0 }] },
        {
          direction: 'east',
          origin: { x: 2, y: 1 },
          expected: [
            { x: 3, y: 1 },
            { x: 4, y: 1 },
            { x: 5, y: 1 },
            { x: 6, y: 1 },
          ],
        },
        { direction: 'south', origin: { x: 2, y: 1 }, expected: [{ x: 2, y: 2 }] },
        {
          direction: 'west',
          origin: { x: 2, y: 1 },
          expected: [
            { x: 1, y: 1 },
            { x: 0, y: 1 },
          ],
        },
        { direction: 'north', origin: { x: 0, y: 0 }, expected: [] },
        { direction: 'east', origin: { x: 6, y: 2 }, expected: [] },
        { direction: 'south', origin: { x: 6, y: 2 }, expected: [] },
        { direction: 'west', origin: { x: 0, y: 0 }, expected: [] },
      ] as const)(
        `clips geometry${geometryVersion} Line[${length}] $direction at a 7×3 board edge`,
        ({ direction, origin, expected }) => {
          const board = {
            width: 7,
            height: 3,
            tiles: Array.from({ length: 21 }, (_, i) => ({
              position: { x: i % 7, y: Math.floor(i / 7) },
              elevation: 0,
              terrainId: 'open',
            })),
          }
          expect(
            resolveCombatTargetFootprint(
              board,
              origin,
              { ...spec({ kind: 'line', length }), geometryVersion },
              { kind: 'direction', direction },
            ),
          ).toEqual(expected)
        },
      )
    }
  }
  it.each([6, 15])('reaches exactly %i tiles when the actual board is long enough', (length) => {
    const board = {
      width: 18,
      height: 1,
      tiles: Array.from({ length: 18 }, (_, x) => ({
        position: { x, y: 0 },
        elevation: 0,
        terrainId: 'open',
      })),
    }
    const positions = resolveCombatTargetFootprint(
      board,
      { x: 1, y: 0 },
      spec({ kind: 'line', length }),
      { kind: 'direction', direction: 'east' },
    )
    expect(positions).toHaveLength(length)
    expect(positions.at(-1)).toEqual({ x: 1 + length, y: 0 })
  })
})
