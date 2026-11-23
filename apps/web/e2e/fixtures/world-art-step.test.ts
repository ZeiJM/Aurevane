import { expect, it } from 'vitest'
import { unoccupiedArtStep } from '../world-art-step'
const sector = {
  id: 'frostmere',
  cells: [
    { x: 1, y: 6, terrain: 't', walkable: true, safe: true },
    { x: 1, y: 7, terrain: '.', walkable: true, safe: true },
    { x: 2, y: 6, terrain: '.', walkable: true, safe: true },
    { x: 0, y: 6, terrain: '~', walkable: false, safe: false },
  ],
}
const from = { x: 1, y: 6 },
  preferred = { x: 1, y: 7 }
it('avoids the occupied preferred destination that would inspect a test player', () => {
  expect(
    unoccupiedArtStep(sector, from, preferred, [
      { position: { sectorId: 'frostmere', ...preferred } },
    ]),
  ).toEqual({ sectorId: 'frostmere', x: 2, y: 6 })
})
it('does not invent a step through water or an occupied adjacent cell', () => {
  expect(
    unoccupiedArtStep(sector, from, preferred, [
      { position: { sectorId: 'frostmere', ...preferred } },
      { position: { sectorId: 'frostmere', x: 2, y: 6 } },
    ]),
  ).toBeUndefined()
})
it('retains an empty preferred step and ignores occupants in another sector', () => {
  expect(
    unoccupiedArtStep(sector, from, preferred, [{ position: { sectorId: 'other', ...preferred } }]),
  ).toEqual({ sectorId: 'frostmere', ...preferred })
})
