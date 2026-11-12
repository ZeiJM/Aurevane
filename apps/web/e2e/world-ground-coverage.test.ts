import { expect, it } from 'vitest'
import type { WorldSectorView } from '../src/world/types'
import { missingPublicGround, type GroundCoverageFrame } from './world-ground-coverage'

it('detects withdrawn supplied ground from the actual isometric body and excludes unknown/private cells', () => {
  const sector = {
    id: 'public',
    charted: true,
    atlasColumn: 0,
    atlasRow: 0,
    cells: Array.from({ length: 117 }, (_, i) => ({ x: i % 13, y: Math.floor(i / 13) })),
  } as WorldSectorView
  const frame: GroundCoverageFrame = {
    at: 100,
    x: 6.5,
    y: 4.5,
    width: 375,
    height: 667,
    tile: 48,
    painted: [],
  }
  expect(missingPublicGround([sector], frame)).toEqual(['public'])
  expect(missingPublicGround([sector], { ...frame, painted: ['public'] })).toEqual([])
  expect(missingPublicGround([{ ...sector, charted: false }], frame)).toEqual([])
  expect(missingPublicGround([{ ...sector, cells: sector.cells.slice(0, 3) }], frame)).toEqual([])
  expect(missingPublicGround([sector], { ...frame, x: 50, y: 50 })).toEqual([])
})
