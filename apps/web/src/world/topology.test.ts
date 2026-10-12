import { describe, expect, it } from 'vitest'
import {
  atlasNeighbor,
  sectorMapOrigin,
  WORLD_MAP_WIDTH,
  wrappedColumnDistance,
  wrappedMapDistance,
  wrappedMapX,
} from './topology'

describe('longitude-only world topology', () => {
  it('wraps longitude neighbours while bounding both poles', () => {
    expect(atlasNeighbor(127, 32, 1, 0)).toEqual({ column: 0, row: 32 })
    expect(atlasNeighbor(0, 32, -1, 0)).toEqual({ column: 127, row: 32 })
    expect(atlasNeighbor(12, 0, 0, -1)).toBeNull()
    expect(atlasNeighbor(12, 63, 0, 1)).toBeNull()
    expect(wrappedColumnDistance(127, 0)).toBe(1)
  })
  it('uses a one-tile seam lower bound and an unchanged north/south lower bound', () => {
    expect(WORLD_MAP_WIDTH).toBe(1664)
    expect(wrappedMapDistance(1663, 292, 0, 292)).toBe(1)
    expect(wrappedMapDistance(0, 292, 1663, 293)).toBe(2)
    expect(wrappedMapDistance(0, 0, 0, 575)).toBe(575)
    expect(wrappedMapX(0.5, 1663.5)).toBe(1664.5)
    expect(wrappedMapX(1663.5, 0.5)).toBe(-0.5)
  })
  it('shares the camera copy for public origins but keeps private and legacy coordinates unchanged', () => {
    expect(sectorMapOrigin({ atlasColumn: 0, atlasRow: 32, charted: true }, 1663.5)).toEqual({
      x: 1664,
      y: 288,
    })
    expect(sectorMapOrigin({ atlasColumn: 127, atlasRow: 32, charted: true }, 0.5)).toEqual({
      x: -13,
      y: 288,
    })
    expect(sectorMapOrigin({ atlasColumn: 0, atlasRow: 32, charted: false }, 1663.5)).toEqual({
      x: 0,
      y: 288,
    })
    expect(sectorMapOrigin({ charted: true }, 1663.5)).toEqual({ x: 0, y: 0 })
  })
})
