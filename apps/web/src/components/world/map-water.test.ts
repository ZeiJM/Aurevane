import { describe, expect, it } from 'vitest'
import type { WorldSectorView } from '@/world/types'
import { buildWaterField, waterfallHighlights } from './map-water'

function sector(id: string, atlasRow = 0, cells: [number, number, string][] = []): WorldSectorView {
  return {
    id,
    name: id,
    coordinate: '',
    regionId: 'verdant-expanse',
    art: null,
    east: 0,
    north: 0,
    atlasColumn: 0,
    atlasRow,
    charted: true,
    landmarks: [],
    exits: [],
    cells: cells.map(([x, y, terrain]) => ({
      x,
      y,
      terrain,
      walkable: terrain !== '~',
      safe: false,
    })),
  }
}

describe('world-connected water presentation', () => {
  it('moves waterfall highlights down its fixed painted channels without moving the rocks', () => {
    const first = waterfallHighlights(0),
      second = waterfallHighlights(120)
    expect(first[0]!.x).toBe(second[0]!.x)
    expect(second[0]!.y).toBeGreaterThan(first[0]!.y)
    for (const point of waterfallHighlights(9100)) {
      expect(point.x).toBeGreaterThan(0.3)
      expect(point.x).toBeLessThan(0.6)
      expect(point.y).toBeGreaterThan(0.3)
      expect(point.y + point.length).toBeLessThan(0.73)
    }
  })
  it('joins current ports and curved wet banks across a sector boundary without a cross-river shore', () => {
    const north = sector('north', 0, [
      [10, 7, '~'],
      [10, 8, '~'],
      [9, 8, '.'],
    ])
    const south = sector('south', 1, [
      [10, 0, '~'],
      [10, 1, '~'],
      [9, 0, '.'],
    ])
    const field = buildWaterField([north, south])
    const a = field.get('north')!.cells.get('10:8')!,
      b = field.get('south')!.cells.get('10:0')!
    expect(a.banks.map((bank) => bank.side)).toEqual([3])
    expect(b.banks.map((bank) => bank.side)).toEqual([3])
    expect(a.flow[3][0]).toBe(b.flow[0][0])
    expect(a.flow[3][1]).toBe(1)
    expect(b.flow[0][1]).toBe(0)
    expect(a.banks[0]!.edge.at(-1)![3][0]).toBeCloseTo(b.banks[0]!.edge[0]![0][0], 14)
    expect(a.banks[0]!.shallow.at(-1)![3][0]).toBeCloseTo(b.banks[0]!.shallow[0]![0][0], 14)
    expect(a.banks[0]!.edge[0]![0][0]).not.toBe(a.banks[0]!.edge.at(-1)![3][0])
    expect(buildWaterField([south, north]).get('north')!.key).toBe(field.get('north')!.key)
  })

  it('turns the current through connected water instead of painting one global horizontal ripple', () => {
    const field = buildWaterField([
      sector('bend', 0, [
        [5, 4, '~'],
        [5, 5, '~'],
        [6, 5, '~'],
      ]),
    ])
    const flow = field.get('bend')!.cells.get('5:5')!.flow
    expect(flow[0][1]).toBe(0)
    expect(flow[3][0]).toBe(1)
    expect(flow[1][0]).toBe(flow[0][0])
    expect(flow[1][1]).toBeGreaterThan(flow[0][1])
    expect(flow[2][1]).toBe(flow[3][1])
    expect(flow[2][0]).toBeLessThan(flow[3][0])
  })

  it('leaves broad connected water free of repeated narrow river channels', () => {
    const field = buildWaterField([
      sector('open-water', 0, [
        [5, 4, '~'],
        [5, 5, '~'],
        [6, 5, '~'],
        [4, 5, '~'],
        [5, 6, '~'],
      ]),
    ])
    expect(field.get('open-water')!.cells.get('5:5')).toMatchObject({ channel: false })
    expect(field.get('open-water')!.cells.get('5:4')).toMatchObject({ channel: true })
  })

  it('keeps legal bridge gaps out of the water field while leaving proven river mouths open', () => {
    const field = buildWaterField([
      sector('bridge', 0, [
        [10, 2, '~'],
        [10, 3, '='],
        [10, 4, '='],
        [10, 5, '='],
        [10, 6, '~'],
      ]),
    ])
    const water = field.get('bridge')!.cells
    expect([...water.keys()]).toEqual(['10:2', '10:6'])
    expect(water.get('10:2')!.banks.map((bank) => bank.side)).toEqual([])
    expect(water.get('10:6')!.banks.map((bank) => bank.side)).toEqual([])
  })

  it('does not infer hidden cells or join a private survey to public terrain at the same atlas address', () => {
    const privateSector = {
      ...sector('private', 0, [
        [10, 8, '~'],
        [9, 8, '.'],
      ]),
      charted: false,
    }
    const publicSector = sector('public', 1, [[10, 0, '.']])
    const alone = buildWaterField([privateSector]).get('private')!
    const withPublic = buildWaterField([privateSector, publicSector]).get('private')!
    expect(withPublic.key).toBe(alone.key)
    expect([...withPublic.cells.keys()]).toEqual(['10:8'])
    expect(withPublic.cells.get('10:8')!.banks.map((bank) => bank.side)).toEqual([3])
  })
  it('keeps a shore where a road has no supplied water endpoint or is not legal ground', () => {
    const crossing = sector('unknown-mouth', 0, [
      [10, 2, '~'],
      [10, 3, '='],
      [10, 4, '='],
    ])
    const incomplete = buildWaterField([crossing]).get(crossing.id)!.cells.get('10:2')!
    expect(incomplete.banks.map((bank) => bank.side)).toEqual([2])
    crossing.cells.push({ x: 10, y: 5, terrain: '~', walkable: false, safe: false })
    crossing.cells[1]!.walkable = false
    const blocked = buildWaterField([crossing]).get(crossing.id)!.cells.get('10:2')!
    expect(blocked.banks.map((bank) => bank.side)).toEqual([2])
    expect(buildWaterField([crossing]).get(crossing.id)!.cells.has('10:3')).toBe(false)
  })
})
