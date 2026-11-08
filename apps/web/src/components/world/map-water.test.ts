import { describe, expect, it, vi } from 'vitest'
import { atlasSectors } from '@/world/atlas'
import { terrainWalkable } from '@/world/terrain'
import type { WorldSectorView } from '@/world/types'
import {
  buildWaterField,
  paintWaterfallMotion,
  paintWaterMotion,
  waterfallHighlights,
} from './map-water'

function waterCanvas() {
  return {
    ellipse: vi.fn(),
    bezierCurveTo: vi.fn(),
    rect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    clip: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
  }
}

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
  it('adds localized rain impact rings inside the same clipped surface as the current', () => {
    const stream = sector('stream', 0, [
      [5, 4, '~'],
      [5, 5, '~'],
      [5, 6, '~'],
    ])
    const cell = buildWaterField([stream]).get(stream.id)!.cells.get('5:5')!
    expect(cell.channel).toBe(true)
    const clear = waterCanvas(),
      rain = waterCanvas()
    for (let now = 0; now < 2200; now += 100) {
      paintWaterMotion(clear as unknown as CanvasRenderingContext2D, cell, 48, now, false, {
        rain: 0,
        windSpeed: 0.04,
      })
      paintWaterMotion(rain as unknown as CanvasRenderingContext2D, cell, 48, now, false, {
        rain: 1,
        windSpeed: 0.04,
      })
    }
    expect(clear.ellipse).not.toHaveBeenCalled()
    expect(rain.ellipse.mock.calls.length).toBeGreaterThan(0)
    expect(rain.bezierCurveTo.mock.calls).toEqual(clear.bezierCurveTo.mock.calls)
    expect(rain.rect).toHaveBeenCalledWith(0, 0, 48, 48)
    for (const [x, y, radiusX, radiusY] of rain.ellipse.mock.calls) {
      expect(x - radiusX).toBeGreaterThan(0)
      expect(x + radiusX).toBeLessThan(48)
      expect(y - radiusY).toBeGreaterThan(0)
      expect(y + radiusY).toBeLessThan(48)
    }
  })

  it('bends only fine waterfall spray downwind and leaves gravity and the impact pool fixed', () => {
    const west = waterCanvas(),
      east = waterCanvas(),
      low = waterCanvas()
    paintWaterfallMotion(west as unknown as CanvasRenderingContext2D, 0, 0, 240, 240, 1000, -0.05)
    paintWaterfallMotion(east as unknown as CanvasRenderingContext2D, 0, 0, 240, 240, 1000, 0.05)
    paintWaterfallMotion(
      low as unknown as CanvasRenderingContext2D,
      0,
      0,
      240,
      240,
      1000,
      0.05,
      false,
    )
    expect(east.moveTo.mock.calls).toEqual(west.moveTo.mock.calls)
    expect(east.lineTo.mock.calls).toEqual(west.lineTo.mock.calls)
    expect(east.ellipse.mock.calls[0]).toEqual(west.ellipse.mock.calls[0])
    expect(east.ellipse.mock.calls.length).toBeGreaterThan(1)
    expect(east.ellipse.mock.calls[1]![0]).toBeGreaterThan(west.ellipse.mock.calls[1]![0])
    expect(east.ellipse.mock.calls[1]![1]).toBe(west.ellipse.mock.calls[1]![1])
    expect(low.ellipse.mock.calls).toEqual(east.ellipse.mock.calls.slice(0, 1))
  })

  it('keeps Willow Cascades’ closed receiving pool free of channel glints', () => {
    const { rows, roads, landmarks, ...willow } = atlasSectors().find(
      ({ id }) => id === 'atlas:69:36',
    )!
    const view: WorldSectorView = {
      ...willow,
      exits: [...roads],
      landmarks: [...landmarks],
      cells: rows.flatMap((row, y) =>
        [...row].map((terrain, x) => ({
          x,
          y,
          terrain,
          walkable: terrainWalkable(terrain),
          safe: false,
        })),
      ),
    }
    const receivingPool = buildWaterField([view]).get(view.id)!.cells.get('9:2')!
    expect(view.cells.find(({ x, y }) => x === 9 && y === 2)).toMatchObject({
      terrain: '~',
      walkable: false,
    })
    expect(receivingPool.banks.map(({ side }) => side)).toEqual([0, 1, 2, 3])
    expect(receivingPool.channel).toBe(false)

    const ellipse = vi.fn(),
      bezierCurveTo = vi.fn(),
      rect = vi.fn()
    const canvas = {
      ellipse,
      bezierCurveTo,
      rect,
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      clip: vi.fn(),
      moveTo: vi.fn(),
      stroke: vi.fn(),
    }
    paintWaterMotion(canvas as unknown as CanvasRenderingContext2D, receivingPool, 48, 1200)
    expect(rect).toHaveBeenCalledWith(0, 0, 48, 48)
    expect(ellipse).toHaveBeenCalledOnce()
    expect(bezierCurveTo).not.toHaveBeenCalled()
  })

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
