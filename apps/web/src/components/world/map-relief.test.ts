import { afterEach, expect, it, vi } from 'vitest'
import type { WorldSectorView } from '@/world/types'
import { paintTerrainContours, paintTerrainRelief } from './map-relief'

const sector = (cells: [number, number, string][]): WorldSectorView => ({
  id: 'relief',
  name: 'Relief',
  coordinate: '',
  regionId: 'starfall-highlands',
  art: null,
  east: 0,
  north: 0,
  charted: true,
  landmarks: [],
  exits: [],
  cells: cells.map(([x, y, terrain]) => ({
    x,
    y,
    terrain,
    safe: false,
    walkable: terrain === '.' || terrain === 't',
  })),
})

it('does not turn an isolated rock into a square raised plateau on open ground', () => {
  const ctx = new Proxy(
    { createLinearGradient: () => ({ addColorStop: vi.fn() }) },
    { get: (target, key) => (key in target ? target[key as keyof typeof target] : vi.fn()) },
  ) as unknown as CanvasRenderingContext2D
  expect(
    paintTerrainRelief(
      ctx,
      sector([
        [3, 3, '#'],
        [2, 3, '.'],
        [4, 3, '.'],
        [3, 2, '.'],
        [3, 4, '.'],
      ]),
      64,
    ),
  ).toBe(0)
})

it('paints layered cliff faces toward known natural valley ground, never unknown cells or roads', () => {
  const lines: number[][] = []
  const colours: string[] = []
  const ctx = new Proxy(
    {
      moveTo: (x: number, y: number) => lines.push([x, y]),
      lineTo: (x: number, y: number) => lines.push([x, y]),
      createLinearGradient: () => ({
        addColorStop: (_at: number, colour: string) => colours.push(colour),
      }),
    },
    { get: (t, key) => (key in t ? t[key as keyof typeof t] : vi.fn()) },
  ) as unknown as CanvasRenderingContext2D
  const source = sector([
    [3, 3, '#'],
    [3, 2, '#'],
    [4, 3, '.'],
  ])
  const before = JSON.stringify(source)
  expect(paintTerrainRelief(ctx, source, 64)).toBe(1)
  expect(JSON.stringify(source)).toBe(before)
  expect(lines.length).toBeGreaterThan(6)
  expect(
    lines.every(([x, y]) => x! >= 3 * 64 && x! <= 4 * 64 && y! >= 3 * 64 && y! <= 4 * 64),
  ).toBe(true)
  expect(colours.some((c) => c.includes('.4'))).toBe(true)
  for (const terrain of ['~', 'l', '=', 's', '#'])
    expect(
      paintTerrainRelief(
        ctx,
        sector([
          [3, 3, '#'],
          [4, 3, terrain],
        ]),
        64,
      ),
    ).toBe(0)
  expect(paintTerrainRelief(ctx, sector([[3, 3, '#']]), 64)).toBe(0)
  expect(paintTerrainRelief(ctx, { ...source, townId: 'town' }, 64)).toBe(0)
  expect(
    paintTerrainRelief(
      ctx,
      { ...source, landmarks: [{ id: 'ruin', name: 'Ruin', kind: 'ruin', x: 3, y: 3 }] },
      64,
    ),
  ).toBe(0)
})

it('limits private relief to supplied adjacent cells and keeps cold and Void rock distinct', () => {
  const stops: string[] = []
  const ctx = new Proxy(
    {
      createLinearGradient: () => ({
        addColorStop: (_at: number, colour: string) => stops.push(colour),
      }),
    },
    { get: (t, key) => (key in t ? t[key as keyof typeof t] : vi.fn()) },
  ) as unknown as CanvasRenderingContext2D
  const source = sector([
    [3, 3, '#'],
    [2, 3, '#'],
    [3, 4, '.'],
  ])
  paintTerrainRelief(ctx, { ...source, regionId: 'frostmere' }, 64)
  const winter = [...stops]
  stops.length = 0
  expect(paintTerrainRelief(ctx, { ...source, charted: false, warpedTheme: 'ashen' }, 64)).toBe(1)
  expect(stops).not.toEqual(winter)
  expect(paintTerrainRelief(ctx, { ...source, charted: false }, 64)).toBe(0)
})

afterEach(() => vi.unstubAllGlobals())

function contourContext() {
  const rasters: Uint8ClampedArray[] = []
  const scratch = {
    createImageData: vi.fn((w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    })),
    putImageData: vi.fn((pixels: ImageData) => rasters.push(pixels.data.slice())),
  }
  const canvas = { width: 0, height: 0, getContext: () => scratch }
  const createElement = vi.fn(() => canvas)
  vi.stubGlobal('document', { createElement })
  const ctx = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D
  return { ctx, rasters, scratch, createElement }
}

it('paints cached broad contours only inside supplied natural cells without altering authority', () => {
  const { ctx, createElement, scratch } = contourContext()
  const source = sector([
    [0, 0, '.'],
    [1, 0, 't'],
    [2, 0, '#'],
    [3, 0, '~'],
    [4, 0, 'l'],
    [5, 0, '='],
    [6, 0, 's'],
    [7, 0, '?'],
  ])
  const before = JSON.stringify(source)
  expect(paintTerrainContours(ctx, source, 64)).toBe(3)
  expect(ctx.drawImage).toHaveBeenCalledTimes(3)
  for (const [i, call] of vi.mocked(ctx.drawImage).mock.calls.entries())
    expect(call.slice(-4)).toEqual([i * 64, 0, 64, 64])
  expect(JSON.stringify(source)).toBe(before)
  expect(paintTerrainContours(ctx, { ...source, charted: false, warpedTheme: 'ashen' }, 64)).toBe(3)
  expect(createElement).toHaveBeenCalledOnce()
  expect(scratch.createImageData).toHaveBeenCalledOnce()
  expect(
    paintTerrainContours(
      ctx,
      {
        ...source,
        cells: source.cells.map((cell) => (cell.x === 0 ? { ...cell, safe: true } : cell)),
      },
      64,
    ),
  ).toBe(2)
  expect(paintTerrainContours(ctx, { ...source, charted: false }, 64)).toBe(0)
  expect(paintTerrainContours(ctx, { ...source, townId: 'town' }, 64)).toBe(0)
  expect(paintTerrainContours(ctx, { ...source, id: 'ferry:deck' }, 64)).toBe(0)
  expect(
    paintTerrainContours(
      ctx,
      { ...source, buildings: [{ id: 'block', x: 0, y: 0, width: 3, height: 1, artIndex: 0 }] },
      64,
    ),
  ).toBe(0)
})

it('keeps broad field pixels stationary, continuous at tile/sector corners and periodic across public wrap', () => {
  const { ctx, rasters } = contourContext()
  const source = { ...sector([[0, 0, '.']]), atlasColumn: 0, atlasRow: 12 }
  for (const column of [0, 1, 128, 0])
    paintTerrainContours(ctx, { ...source, atlasColumn: column }, 64)
  expect(rasters[0]).toEqual(rasters[2])
  expect(rasters[0]).toEqual(rasters[3])
  const width = 13 * 16,
    height = 9 * 16
  const alpha = (raster: Uint8ClampedArray, x: number, y: number) =>
    raster[(y * width + x) * 4 + 3]!
  // Compare premultiplied colour too: RGB changes sign at a crest but alpha
  // fades through zero, so the actual composited light must remain continuous.
  const sample = (raster: Uint8ClampedArray, x: number, y: number, channel: number) =>
    (raster[(y * width + x) * 4 + channel]! * alpha(raster, x, y)) / 255
  const edgeDifference = (
    a: Uint8ClampedArray,
    ax: number,
    ay: number,
    b: Uint8ClampedArray,
    bx: number,
    by: number,
  ) =>
    Math.max(
      Math.abs(alpha(a, ax, ay) - alpha(b, bx, by)),
      ...[0, 1, 2].map((channel) =>
        Math.abs(sample(a, ax, ay, channel) - sample(b, bx, by, channel)),
      ),
    )
  paintTerrainContours(ctx, { ...source, atlasRow: 13 }, 64)
  paintTerrainContours(ctx, { ...source, atlasColumn: 1, atlasRow: 13 }, 64)
  let maxEdgeDifference = 0,
    maxTileDifference = 0
  for (let y = 0; y < height; y++)
    maxEdgeDifference = Math.max(
      maxEdgeDifference,
      edgeDifference(rasters[0]!, width - 1, y, rasters[1]!, 0, y),
    )
  for (let x = 0; x < width; x++)
    maxEdgeDifference = Math.max(
      maxEdgeDifference,
      edgeDifference(rasters[0]!, x, height - 1, rasters[4]!, x, 0),
    )
  maxEdgeDifference = Math.max(
    maxEdgeDifference,
    edgeDifference(rasters[0]!, width - 1, height - 1, rasters[5]!, 0, 0),
  )
  for (let y = 1; y < height; y++)
    for (let x = 1; x < width; x++)
      maxTileDifference = Math.max(
        maxTileDifference,
        edgeDifference(rasters[0]!, x, y, rasters[0]!, x - 1, y - 1),
      )
  expect(maxEdgeDifference).toBeLessThanOrEqual(3)
  expect(maxTileDifference).toBeLessThanOrEqual(3)
  const alphas = Array.from(rasters[0]!).filter((_, i) => i % 4 === 3)
  expect(Math.max(...alphas) - Math.min(...alphas)).toBeGreaterThan(25)
  paintTerrainContours(
    ctx,
    {
      ...source,
      atlasColumn: undefined,
      atlasRow: undefined,
      sceneColumn: 0,
      sceneRow: 12,
      charted: false,
      warpedTheme: 'ashen',
    },
    32,
  )
  expect(Array.from(rasters[6]!).filter((_, i) => i % 4 === 3)).toEqual(alphas)
  expect(rasters[6]).not.toEqual(rasters[0])
})

it('gives broad ridges and basins enough light-and-shadow range to read above detailed ground', () => {
  const { ctx, rasters } = contourContext()
  const shadowAlpha: number[] = []
  const lightAlpha: number[] = []
  for (const atlasColumn of [0, 32, 64, 96])
    for (const atlasRow of [8, 24, 40, 56]) {
      paintTerrainContours(ctx, { ...sector([[0, 0, '.']]), atlasColumn, atlasRow }, 64)
      const pixels = rasters.at(-1)!
      for (let i = 0; i < pixels.length; i += 4)
        (pixels[i]! < 100 ? shadowAlpha : lightAlpha).push(pixels[i + 3]!)
    }
  expect(shadowAlpha.reduce((max, value) => Math.max(max, value), 0)).toBeGreaterThan(90)
  expect(lightAlpha.reduce((max, value) => Math.max(max, value), 0)).toBeGreaterThan(45)
})
