import { describe, expect, it, vi } from 'vitest'
import { atlasSectors } from '@/world/atlas'
import { terrainWalkable } from '@/world/terrain'
import type { WorldSectorView } from '@/world/types'
import {
  buildWaterField,
  liquidMaterial,
  paintWaterfallMotion,
  paintWaterMotion,
  paintWaterGround,
  paintLavaGround,
  paintLavaMotion,
  waterfallHighlights,
  type WaterCell,
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
  it('gives Void water district colours while preserving ordinary water and lava', () => {
    const sample = (
      theme: Parameters<typeof liquidMaterial>[5],
      material: 'water' | 'lava' = 'water',
    ) => {
      const stops: string[] = []
      const ctx = {
        createLinearGradient: () => ({
          addColorStop: (_at: number, colour: string) => stops.push(colour),
        }),
      } as unknown as CanvasRenderingContext2D
      liquidMaterial(ctx, material, 64, 0, 0, theme)
      return stops
    }
    expect(sample('amber')).toEqual(['#793d27', '#d78545', '#572942'])
    expect(sample('amethyst')).toEqual(['#563786', '#8e61c5', '#4b3476'])
    expect(sample('ashen')).toEqual(['#736b91', '#c6bfd9', '#514b70'])
    expect(sample(false)).toEqual(['#245e67', '#3e7b82', '#244e60'])
    expect(sample('amber', 'lava')).toEqual(sample(false, 'lava'))
  })
  it.each([
    ['amber', [233, 164, 99], [104, 45, 62], '#fce0bd'],
    ['ashen', [223, 218, 238], [91, 80, 126], '#f4efff'],
    ['amethyst', [159, 128, 193], [56, 40, 94], '#e0c5f1'],
  ] as const)(
    'keeps %s water depth and moving reflections in the same colour family',
    (theme, shallow, deep, glint) => {
      const pixels: number[][] = []
      const raster = {
        getContext: () => ({
          createImageData: () => ({ data: new Uint8ClampedArray(16) }),
          putImageData: (image: { data: Uint8ClampedArray }) =>
            pixels.push([...image.data.slice(0, 3)]),
        }),
      }
      vi.stubGlobal('document', { createElement: () => raster })
      const colours: string[] = []
      const ctx = new Proxy(
        {
          strokeStyle: '',
          stroke() {
            colours.push(this.strokeStyle)
          },
          createLinearGradient: () => ({ addColorStop() {} }),
        },
        { get: (target, key) => (key in target ? target[key as keyof typeof target] : () => {}) },
      ) as unknown as CanvasRenderingContext2D
      const profile = buildWaterField([sector('private', 0, [[0, 0, '~']])])
        .get('private')!
        .cells.get('0:0')!
      const material = {
        complete: true,
        naturalWidth: 768,
        width: 768,
        height: 768,
      } as HTMLImageElement
      try {
        paintWaterGround(
          ctx,
          { ...profile, depth: 0, cornerDepths: [0, 0, 0, 0] },
          64,
          theme,
          material,
        )
        paintWaterGround(
          ctx,
          { ...profile, depth: 3, cornerDepths: [3, 3, 3, 3] },
          64,
          theme,
          material,
        )
        expect(pixels).toEqual([[...shallow], [...deep]])
        colours.length = 0
        paintWaterMotion(ctx, profile, 64, 1200, theme)
        expect(colours).toContain(glint)
      } finally {
        vi.unstubAllGlobals()
      }
    },
  )

  it('uses the clear sand-bottom texture only inside a supplied bank mask', () => {
    vi.stubGlobal('document', {
      createElement: () => ({
        getContext: () => ({
          createImageData: () => ({ data: new Uint8ClampedArray(16) }),
          putImageData() {},
        }),
      }),
    })
    const drawImage = vi.fn(),
      clip = vi.fn()
    const context = new Proxy(
      { drawImage, clip, createLinearGradient: () => ({ addColorStop() {} }) },
      { get: (target, key) => (key in target ? target[key as keyof typeof target] : () => {}) },
    ) as unknown as CanvasRenderingContext2D
    const material = {
      complete: true,
      naturalWidth: 768,
      width: 768,
      height: 768,
    } as HTMLImageElement
    const water = buildWaterField([
      sector('shore', 0, [
        [0, 0, '.'],
        [1, 0, '~'],
      ]),
    ])
      .get('shore')!
      .cells.get('1:0')!
    try {
      paintWaterGround(context, water, 64, false, material)
      expect(
        drawImage.mock.calls.some(([image, sx, sy]) => image === material && sx < 384 && sy < 384),
      ).toBe(true)
      expect(clip.mock.calls.length).toBeGreaterThanOrEqual(2)
      drawImage.mockClear()
      paintWaterGround(context, { ...water, banks: [] }, 64, false, material)
      expect(
        drawImage.mock.calls.some(([image, sx, sy]) => image === material && sx < 384 && sy < 384),
      ).toBe(false)
    } finally {
      vi.unstubAllGlobals()
    }
  })
  it('paints equal depth colours on a shared edge instead of diagonal per-tile steps', () => {
    const sample = (corners: readonly [number, number, number, number], px: number) => {
      let result: number[] = []
      const raster = {
        width: 2,
        height: 2,
        pixels: new Uint8ClampedArray(16),
        getContext: () => ({
          createImageData: () => ({ data: new Uint8ClampedArray(16) }),
          putImageData: (image: { data: Uint8ClampedArray }) => {
            raster.pixels = image.data.slice()
          },
        }),
      }
      vi.stubGlobal('document', { createElement: () => raster })
      const rgb = (s: string) => s.match(/[\d.]+/g)!.map(Number)
      const ctx = new Proxy(
        {
          fillStyle: '' as unknown,
          createLinearGradient: (...xy: number[]) => ({
            xy,
            stops: [] as [number, string][],
            addColorStop(at: number, c: string) {
              this.stops.push([at, c])
            },
          }),
          fillRect() {
            const g = this.fillStyle as { xy: number[]; stops: [number, string][] }
            if (!g?.stops?.[0]?.[1].startsWith('rgb(')) return
            const [x, y, x1, y1] = g.xy,
              dx = x1! - x!,
              dy = y1! - y!,
              t = ((px - x!) * dx + (32 - y!) * dy) / (dx * dx + dy * dy),
              a = rgb(g.stops[0]![1]),
              b = rgb(g.stops.at(-1)![1])
            result = a.map((v, i) => v + (b[i]! - v) * t)
          },
          drawImage(image: typeof raster, ...args: number[]) {
            if (image !== raster) return
            const [x, y, w, h] = args,
              u = Math.max(0, Math.min(1, ((px - x!) / w!) * 2 - 0.5)),
              v = Math.max(0, Math.min(1, ((32 - y!) / h!) * 2 - 0.5))
            result = [0, 1, 2].map(
              (channel) =>
                image.pixels[channel]! * (1 - u) * (1 - v) +
                image.pixels[4 + channel]! * u * (1 - v) +
                image.pixels[8 + channel]! * (1 - u) * v +
                image.pixels[12 + channel]! * u * v,
            )
          },
        },
        { get: (target, key) => (key in target ? target[key as keyof typeof target] : () => {}) },
      ) as unknown as CanvasRenderingContext2D
      const profile = buildWaterField([sector('sample', 0, [[0, 0, '~']])])
        .get('sample')!
        .cells.get('0:0')!
      paintWaterGround(ctx, { ...profile, cornerDepths: corners }, 64, false, {
        complete: true,
        naturalWidth: 768,
        width: 768,
        height: 768,
      } as HTMLImageElement)
      return result
    }
    try {
      expect(sample([0.5, 1.5, 1.5, 0.5], 64)).toEqual(sample([1.5, 2.5, 2.5, 1.5], 0))
    } finally {
      vi.unstubAllGlobals()
    }
  })
  it('derives increasing depth from supplied banks and shares corner depths across sector edges', () => {
    const a = sector(
      'a',
      0,
      Array.from(
        { length: 13 * 9 },
        (_, i) =>
          [i % 13, Math.floor(i / 13), i % 13 === 0 ? '.' : '~'] as [number, number, string],
      ),
    )
    const field = buildWaterField([a]).get('a')!.cells
    expect(field.get('1:4')!.depth).toBe(0)
    expect(field.get('2:4')!.depth).toBe(1)
    expect(field.get('4:4')!.depth).toBe(3)
    expect(field.get('1:4')!.cornerDepths![1]).toBe(field.get('2:4')!.cornerDepths![0])
    expect(field.get('1:4')!.cornerDepths![2]).toBe(field.get('2:4')!.cornerDepths![3])
    const isolated = buildWaterField([sector('private', 0, [[4, 4, '~']])])
      .get('private')!
      .cells.get('4:4')!
    expect(isolated.banks).toHaveLength(0)
    expect(isolated.depth).toBe(3)
  })
  it('continues bank depth across public longitude wrap without borrowing a private shoreline', () => {
    const west = {
      ...sector('west', 10, [
        [12, 4, '~'],
        [11, 4, '~'],
      ]),
      atlasColumn: 127,
    }
    const east = { ...sector('east', 10, [[0, 4, '.']]), atlasColumn: 0 }
    expect(buildWaterField([west, east]).get('west')!.cells.get('12:4')!.depth).toBe(0)
    expect(buildWaterField([west]).get('west')!.cells.get('12:4')!.depth).toBe(3)
    expect(
      buildWaterField([west, { ...east, charted: false }])
        .get('west')!
        .cells.get('12:4')!.depth,
    ).toBe(3)
  })
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

it('gives isolated inland and private pools visibly irregular banks without hiding a one-cell channel', () => {
  const pool = sector('pool', 0, [
    [5, 5, '~'],
    [5, 4, '.'],
    [6, 5, '.'],
    [5, 6, '.'],
    [4, 5, '.'],
  ])
  const privatePool = { ...pool, id: 'private-pool', charted: false }
  const publicBanks = buildWaterField([pool]).get(pool.id)!.cells.get('5:5')!.banks
  const privateBanks = buildWaterField([privatePool]).get(privatePool.id)!.cells.get('5:5')!.banks
  expect(privateBanks).not.toEqual(publicBanks)
  for (const bank of [...publicBanks, ...privateBanks]) {
    const inset = (p: readonly [number, number]) =>
      bank.side === 0 ? p[1] : bank.side === 1 ? 1 - p[0] : bank.side === 2 ? 1 - p[1] : p[0]
    const samples = bank.edge.flatMap((curve) =>
      Array.from({ length: 11 }, (_, i) => {
        const t = i / 10,
          u = 1 - t
        return inset([
          u ** 3 * curve[0][0] +
            3 * u * u * t * curve[1][0] +
            3 * u * t * t * curve[2][0] +
            t ** 3 * curve[3][0],
          u ** 3 * curve[0][1] +
            3 * u * u * t * curve[1][1] +
            3 * u * t * t * curve[2][1] +
            t ** 3 * curve[3][1],
        ])
      }),
    )
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.06)
    expect(samples.every((depth) => depth > 0 && depth < 0.2)).toBe(true)
    // Even opposed shallow contours leave the middle third of legal water clear.
    for (const curve of bank.shallow)
      for (const point of curve) expect(inset(point)).toBeLessThan(1 / 3)
  }
})

it('keeps horizontal bank positions and tangents coherent across loaded chunk joins', () => {
  const west = sector('west', 0, [
    [12, 5, '~'],
    [12, 4, '.'],
  ])
  const east = {
    ...sector('east', 0, [
      [0, 5, '~'],
      [0, 4, '.'],
    ]),
    atlasColumn: 1,
  }
  const field = buildWaterField([west, east])
  const a = field.get(west.id)!.cells.get('12:5')!.banks[0]!
  const b = field.get(east.id)!.cells.get('0:5')!.banks[0]!
  for (const material of ['edge', 'shallow'] as const) {
    const end = a[material].at(-1)!,
      start = b[material][0]!
    expect(end[3][1]).toBeCloseTo(start[0][1], 14)
    expect(end[3][1] - end[2][1]).toBeCloseTo(start[1][1] - start[0][1], 14)
  }
})

it('meanders over several supplied cells rather than resetting its bank wave every tile', () => {
  const cells = Array.from(
    { length: 9 },
    (_, y) =>
      [
        [5, y, '~'],
        [4, y, '.'],
      ] as [number, number, string][],
  ).flat()
  const field = buildWaterField([sector('meander', 0, cells)]).get('meander')!.cells
  const midpoints = Array.from(
    { length: 9 },
    (_, y) => field.get(`5:${y}`)!.banks[0]!.edge[2]![0][0],
  )
  expect(Math.max(...midpoints) - Math.min(...midpoints)).toBeGreaterThan(0.065)
  // Integrating each cubic removes small scallops; the bank still wanders over
  // multiple cells, so increasing a tile-period ripple cannot satisfy this guard.
  const means = Array.from(
    { length: 9 },
    (_, y) =>
      field
        .get(`5:${y}`)!
        .banks[0]!.edge.flat()
        .reduce((sum, [x]) => sum + x, 0) / 16,
  )
  expect(Math.max(...means) - Math.min(...means)).toBeGreaterThan(0.055)
  for (let y = 0; y < 8; y++) {
    for (const layer of ['edge', 'shallow'] as const) {
      const end = field.get(`5:${y}`)!.banks[0]![layer].at(-1)!
      const start = field.get(`5:${y + 1}`)!.banks[0]![layer][0]!
      expect(end[3][0]).toBeCloseTo(start[0][0], 13)
      expect(end[3][0] - end[2][0]).toBeCloseTo(start[1][0] - start[0][0], 13)
    }
  }
})

it('joins bank positions, tangents and flow across the public longitude wrap', () => {
  const west = {
    ...sector('wrap-west', 2, [
      [12, 5, '~'],
      [12, 4, '.'],
    ]),
    atlasColumn: 127,
  }
  const east = sector('wrap-east', 2, [
    [0, 5, '~'],
    [0, 4, '.'],
  ])
  const cells = buildWaterField([west, east])
  const a = cells.get(west.id)!.cells.get('12:5')!
  const b = cells.get(east.id)!.cells.get('0:5')!
  for (const layer of ['edge', 'shallow'] as const) {
    const end = a.banks[0]![layer].at(-1)!,
      start = b.banks[0]![layer][0]!
    expect(end[3][1]).toBeCloseTo(start[0][1], 12)
    expect(end[3][1] - end[2][1]).toBeCloseTo(start[1][1] - start[0][1], 12)
  }
  expect(a.flow[3][1]).toBeCloseTo(b.flow[0][1], 12)
  expect(a.flow[3][1] - a.flow[2][1]).toBeCloseTo(b.flow[1][1] - b.flow[0][1], 12)
})

it('builds lava-only known-cell profiles without joining private terrain or changing authority', () => {
  const source = sector('lava', 0, [
    [5, 4, 'l'],
    [5, 5, 'l'],
    [6, 5, 'l'],
    [4, 5, '~'],
    [5, 6, '.'],
  ])
  const privateView = { ...sector('private-lava', 1, [[5, 0, 'l']]), charted: false }
  const publicView = sector('public-dry', 0, [[5, 8, '.']])
  const before = JSON.stringify([source, privateView, publicView])
  const field = buildWaterField([source, privateView, publicView], 'lava')
  expect([...field.get(source.id)!.cells.keys()]).toEqual(['5:4', '5:5', '6:5'])
  expect([...buildWaterField([source]).get(source.id)!.cells.keys()]).toEqual(['4:5'])
  const bend = field.get(source.id)!.cells.get('5:5')!
  expect(bend.channel).toBe(true)
  expect(bend.flow[0][1]).toBe(0)
  expect(bend.flow[3][0]).toBe(1)
  expect(bend.banks.map(({ side }) => side)).toEqual([2, 3])
  const isolated = field.get(privateView.id)!
  expect(isolated.key).toBe(buildWaterField([privateView], 'lava').get(privateView.id)!.key)
  expect(isolated.cells.get('5:0')!.banks).toEqual([])
  expect(JSON.stringify([source, privateView, publicView])).toBe(before)
})

it('preserves proven bridge mouths independently for water and lava profiles', () => {
  const source = sector('lava-bridge', 0, [
    [5, 3, 'l'],
    [5, 4, '='],
    [5, 5, 'l'],
    [6, 3, '~'],
  ])
  const field = buildWaterField([source], 'lava').get(source.id)!.cells
  expect([...field.keys()]).toEqual(['5:3', '5:5'])
  expect(field.get('5:3')!.banks.map(({ side }) => side)).toEqual([1])
  source.cells[2]!.terrain = '~'
  expect(
    buildWaterField([source], 'lava')
      .get(source.id)!
      .cells.get('5:3')!
      .banks.map(({ side }) => side),
  ).toEqual([1, 2])
})

it('paints deterministic irregular cooling crust and hot seams only within its supplied lava cell', () => {
  const profile = buildWaterField(
    [
      sector('crust', 0, [
        [5, 4, 'l'],
        [5, 5, 'l'],
        [6, 5, 'l'],
        [4, 5, '.'],
      ]),
    ],
    'lava',
  )
    .get('crust')!
    .cells.get('5:5')!
  const canvas = () => ({
    ...waterCanvas(),
    translate: vi.fn(),
    closePath: vi.fn(),
    fillRect: vi.fn(),
  })
  const first = canvas(),
    second = canvas()
  paintLavaGround(first as unknown as CanvasRenderingContext2D, profile, 48)
  paintLavaGround(second as unknown as CanvasRenderingContext2D, profile, 48)
  expect(first.translate).toHaveBeenCalledWith(240, 240)
  expect(first.rect).toHaveBeenCalledWith(0, 0, 48, 48)
  expect(first.clip).toHaveBeenCalledOnce()
  expect(first.clip.mock.invocationCallOrder[0]).toBeLessThan(
    first.fill.mock.invocationCallOrder[0]!,
  )
  expect(first.bezierCurveTo.mock.calls.length).toBeGreaterThan(0)
  expect(first.fill.mock.calls.length).toBeGreaterThan(1)
  expect(first.lineTo.mock.calls).toEqual(second.lineTo.mock.calls)
  expect(first.bezierCurveTo.mock.calls).toEqual(second.bezierCurveTo.mock.calls)
  expect(first.stroke.mock.calls.length).toBeLessThanOrEqual(20)
})

it('moves three clipped lava filaments along the supplied curved profile and preserves the fallback', () => {
  const profile = buildWaterField(
    [
      sector('lava-flow', 0, [
        [5, 4, 'l'],
        [5, 5, 'l'],
        [6, 5, 'l'],
      ]),
    ],
    'lava',
  )
    .get('lava-flow')!
    .cells.get('5:5')!
  const canvas = () => ({ ...waterCanvas(), quadraticCurveTo: vi.fn() })
  const first = canvas(),
    second = canvas(),
    fixed = canvas(),
    fallback = canvas()
  paintLavaMotion(first as unknown as CanvasRenderingContext2D, 48, 1000, 5, 5, profile)
  paintLavaMotion(second as unknown as CanvasRenderingContext2D, 48, 1600, 5, 5, profile)
  paintLavaMotion(fixed as unknown as CanvasRenderingContext2D, 48, 1000, 5, 5, profile)
  paintLavaMotion(fallback as unknown as CanvasRenderingContext2D, 48, 1000, 5, 5)
  expect(first.rect).toHaveBeenCalledWith(0, 0, 48, 48)
  expect(first.clip).toHaveBeenCalledOnce()
  expect(first.clip.mock.invocationCallOrder[0]).toBeLessThan(
    first.stroke.mock.invocationCallOrder[0]!,
  )
  expect(first.bezierCurveTo).toHaveBeenCalledTimes(3)
  expect(first.quadraticCurveTo).not.toHaveBeenCalled()
  expect(first.bezierCurveTo.mock.calls).not.toEqual(second.bezierCurveTo.mock.calls)
  expect(first.bezierCurveTo.mock.calls).toEqual(fixed.bezierCurveTo.mock.calls)
  for (const coordinates of first.bezierCurveTo.mock.calls)
    expect(coordinates.every((n: number) => Number.isFinite(n))).toBe(true)
  expect(fallback.quadraticCurveTo).toHaveBeenCalledTimes(3)
  expect(fallback.bezierCurveTo).not.toHaveBeenCalled()
})

it.each(['grand', 'lava'] as const)(
  'anchors %s falling highlights to both standardized source channels',
  (style) => {
    for (const now of [0, 120, 9100]) {
      const highlights = waterfallHighlights(now, style)
      expect(highlights).toHaveLength(8)
      highlights.forEach((point, i) => {
        const lower = i >= 4
        expect(Math.abs(point.x - (lower ? 0.49 : 0.5))).toBeLessThanOrEqual(0.027)
        expect(point.y).toBeGreaterThanOrEqual(lower ? 0.5 : 0.2)
        expect(point.y + point.length).toBeLessThanOrEqual(lower ? 0.78 : 0.4)
      })
    }
    const first = waterfallHighlights(0, style),
      second = waterfallHighlights(120, style)
    expect(second[0]!.y).toBeGreaterThan(first[0]!.y)
  },
)

it.each(['grand', 'lava'] as const)(
  'keeps %s waterfall roots and receiving pool fixed while wind bends only airborne particles',
  (style) => {
    const west = waterCanvas(),
      east = waterCanvas(),
      fixed = waterCanvas(),
      low = waterCanvas()
    paintWaterfallMotion(
      west as unknown as CanvasRenderingContext2D,
      10,
      20,
      240,
      240,
      1000,
      -0.05,
      true,
      style,
    )
    paintWaterfallMotion(
      east as unknown as CanvasRenderingContext2D,
      10,
      20,
      240,
      240,
      1000,
      0.05,
      true,
      style,
    )
    paintWaterfallMotion(
      fixed as unknown as CanvasRenderingContext2D,
      10,
      20,
      240,
      240,
      1000,
      0.05,
      true,
      style,
    )
    paintWaterfallMotion(
      low as unknown as CanvasRenderingContext2D,
      10,
      20,
      240,
      240,
      1000,
      0.05,
      false,
      style,
    )
    expect(east.moveTo.mock.calls).toEqual(west.moveTo.mock.calls)
    expect(east.lineTo.mock.calls).toEqual(west.lineTo.mock.calls)
    expect(east.ellipse.mock.calls[0]!.slice(0, 2)).toEqual([10 + 240 * 0.49, 20 + 240 * 0.9])
    expect(east.ellipse.mock.calls[0]).toEqual(west.ellipse.mock.calls[0])
    expect(east.ellipse.mock.calls[1]![0]).toBeGreaterThan(west.ellipse.mock.calls[1]![0])
    expect(east.ellipse.mock.calls.length).toBeLessThanOrEqual(7)
    expect(east.ellipse.mock.calls).toEqual(fixed.ellipse.mock.calls)
    expect(low.ellipse).toHaveBeenCalledOnce()
    expect(east).toHaveProperty('fillStyle', style === 'lava' ? '#ffc36b' : '#d7efed')
    expect(east).toHaveProperty('strokeStyle', style === 'lava' ? '#ffe0a0' : '#e4f6f1')
  },
)

it('uses the supplied lava bend geometry rather than a fixed decorative curve', () => {
  const profile = buildWaterField(
    [
      sector('lava-bend', 0, [
        [5, 4, 'l'],
        [5, 5, 'l'],
        [6, 5, 'l'],
      ]),
    ],
    'lava',
  )
    .get('lava-bend')!
    .cells.get('5:5')!
  const turned: WaterCell = {
    ...profile,
    flow: profile.flow.map(([x, y]) => [1 - y, x]) as unknown as WaterCell['flow'],
  }
  const first = waterCanvas(),
    rotated = waterCanvas()
  paintLavaMotion(first as unknown as CanvasRenderingContext2D, 48, 1000, 5, 5, profile)
  paintLavaMotion(rotated as unknown as CanvasRenderingContext2D, 48, 1000, 5, 5, turned)
  for (const [i, coordinates] of first.bezierCurveTo.mock.calls.entries()) {
    const result = rotated.bezierCurveTo.mock.calls[i]!
    for (let point = 0; point < 6; point += 2) {
      expect(result[point]).toBeCloseTo(48 - coordinates[point + 1], 12)
      expect(result[point + 1]).toBeCloseTo(coordinates[point], 12)
    }
  }
})

it('gives lava falls small rising gold embers instead of broad water spray', () => {
  const water = waterCanvas(),
    lava = waterCanvas()
  paintWaterfallMotion(
    water as unknown as CanvasRenderingContext2D,
    0,
    0,
    240,
    240,
    1000,
    0,
    true,
    'grand',
  )
  paintWaterfallMotion(
    lava as unknown as CanvasRenderingContext2D,
    0,
    0,
    240,
    240,
    1000,
    0,
    true,
    'lava',
  )
  expect(lava.ellipse.mock.calls[0]).toEqual(water.ellipse.mock.calls[0])
  for (let i = 1; i <= 6; i++) {
    const ember = lava.ellipse.mock.calls[i]!,
      spray = water.ellipse.mock.calls[i]!
    expect(ember[2]).toBeLessThan(spray[2])
    expect(ember[1]).toBeLessThan(spray[1])
  }
})

it('joins supplied adjacent Void water cells without inventing banks or mixing other worlds', () => {
  const a = {
    ...sector('void:ivory-veil:0:0', 0, [[12, 4, '~']]),
    charted: false,
    atlasColumn: undefined,
    atlasRow: undefined,
    sceneColumn: 0,
    sceneRow: 0,
  }
  const b = {
    ...sector('void:ivory-veil:1:0', 0, [[0, 4, '~']]),
    charted: false,
    atlasColumn: undefined,
    atlasRow: undefined,
    sceneColumn: 1,
    sceneRow: 0,
  }
  const foreign = {
    ...b,
    id: 'void:cinder-choir:1:0',
    cells: [{ x: 0, y: 4, terrain: '.', walkable: true, safe: false }],
  }
  const alone = buildWaterField([a, foreign]).get(a.id)!.cells.get('12:4')!
  expect(alone.channel).toBe(false)
  expect(alone.banks).toEqual([])
  const joined = buildWaterField([a, b, foreign])
  expect(joined.get(a.id)!.cells.get('12:4')!.channel).toBe(true)
  expect(joined.get(b.id)!.cells.get('0:4')!.channel).toBe(true)
  expect(joined.get(a.id)!.cells.get('12:4')!.banks).toEqual([])
})
