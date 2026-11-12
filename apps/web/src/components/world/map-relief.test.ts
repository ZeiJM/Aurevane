import { expect, it, vi } from 'vitest'
import type { WorldSectorView } from '@/world/types'
import { paintTerrainRelief } from './map-relief'

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
    [3, 4, '.'],
  ])
  paintTerrainRelief(ctx, { ...source, regionId: 'frostmere' }, 64)
  const winter = [...stops]
  stops.length = 0
  expect(paintTerrainRelief(ctx, { ...source, charted: false, warpedTheme: 'ashen' }, 64)).toBe(1)
  expect(stops).not.toEqual(winter)
  expect(paintTerrainRelief(ctx, { ...source, charted: false }, 64)).toBe(0)
})
