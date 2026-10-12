import { expect, it } from 'vitest'
import { atlasSectors, ATLAS_COLUMNS, ATLAS_ROWS } from '@/world/atlas'
import { globeSectorCenter, globeSectorCoordinate } from '@/world/globe-math'
import { globeAtlasPixels, globeAtlasDetailPixels } from './globe-atlas'
it('gives charted land regional relief and coastal detail without leaking private cells', () => {
  const cell = {
    id: 'frostmere',
    name: 'Frostmere',
    coordinate: 'S02-02',
    regionId: 'frostmere',
    column: 1,
    row: 1,
    charted: true,
  }
  const image = globeAtlasDetailPixels([cell], 4, 4)
  expect(image.width).toBeGreaterThan(4)
  const colours = new Set<string>()
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4
      if (image.pixels[i + 3]) {
        expect(Math.floor(x / (image.width / 4))).toBe(1)
        expect(Math.floor(y / (image.height / 4))).toBe(1)
        colours.add([...image.pixels.slice(i, i + 3)].join(','))
      }
    }
  expect(colours.size).toBeGreaterThan(20)
  expect(
    globeAtlasDetailPixels([{ ...cell, charted: false }], 4, 4).pixels.every((p) => p === 0),
  ).toBe(true)
})
it('paints exactly the charted land cells used by movement, with no invented coastline', () => {
  const atlas = atlasSectors().map((s) => ({
    id: s.id,
    name: s.name,
    coordinate: s.coordinate,
    regionId: s.regionId,
    column: s.atlasColumn!,
    row: s.atlasRow!,
    charted: s.charted,
  }))
  const pixels = globeAtlasPixels(atlas, ATLAS_COLUMNS, ATLAS_ROWS)
  expect(pixels.length).toBe(ATLAS_COLUMNS * ATLAS_ROWS * 4)
  for (const cell of atlas) {
    expect(pixels[(cell.row * ATLAS_COLUMNS + cell.column) * 4 + 3]).toBe(255)
    expect(
      globeSectorCoordinate(
        globeSectorCenter(cell.coordinate, ATLAS_COLUMNS, ATLAS_ROWS)!,
        ATLAS_COLUMNS,
        ATLAS_ROWS,
      ),
    ).toBe(cell.coordinate)
  }
  expect(pixels[3]).toBe(0)
  expect(
    globeAtlasPixels([{ ...atlas[0]!, charted: false }], ATLAS_COLUMNS, ATLAS_ROWS).every(
      (p) => p === 0,
    ),
  ).toBe(true)
})
