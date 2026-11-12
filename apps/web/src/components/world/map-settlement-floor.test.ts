import { expect, it, vi } from 'vitest'
import { projectWorld } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import { settlementFloorIndex } from './map-settlement-floor'
vi.mock('server-only', () => ({}))

it('gives eight major settlements and four hamlet families distinct floor patterns', () => {
  const base = projectWorld(newWorldState(), [], 1000).sectors[0]!
  const towns = [
    'aureth-crown',
    'verdant-expanse',
    'frostmere',
    'starfall-highlands',
    'emberreach',
    'glasswind-desert',
    'hollow-coast',
    'umbral-march',
  ]
  expect(
    towns.map((townId) => settlementFloorIndex({ ...base, townId, regionId: townId })),
  ).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  const names = ['Hayward Farmstead', "Millers' Rest", 'Thistledown Farm', 'Brookside Steading']
  expect(
    names.map((name) =>
      settlementFloorIndex({
        ...base,
        townId: undefined,
        landmarks: [{ id: 'hamlet', kind: 'hamlet', name, x: 6, y: 4 }],
      }),
    ),
  ).toEqual([8, 9, 10, 11])
  expect(settlementFloorIndex({ ...base, townId: undefined, landmarks: [] })).toBeUndefined()
  expect(settlementFloorIndex({ ...base, warpedTheme: 'ashen', charted: false })).toBeUndefined()
  expect(settlementFloorIndex({ ...base, id: 'ferry:test' })).toBeUndefined()
})
