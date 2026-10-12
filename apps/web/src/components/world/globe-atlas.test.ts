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
  expect(image.pixels[(16 * image.width + 16) * 4 + 3]).toBe(255)
  expect(image.pixels[(24 * image.width + 24) * 4 + 3]).toBe(255)
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

it('uses painting light without letting teal or blue illustration colors turn dry ground into water', () => {
  const cell = {
    id: 'dry',
    name: 'Dry ground',
    coordinate: 'S02-02',
    regionId: 'verdant-expanse',
    column: 1,
    row: 1,
    charted: true,
  }
  const image = globeAtlasDetailPixels([cell], 4, 4, {
    width: 1,
    height: 1,
    pixels: new Uint8Array([40, 150, 125, 255]),
  })
  for (let y = 16; y < 32; y++)
    for (let x = 16; x < 32; x++) {
      const i = (y * image.width + x) * 4
      if (!image.pixels[i + 3]) continue
      const [r, g, b] = image.pixels.slice(i, i + 3)
      expect(Math.abs(r! / 83 - b! / 75)).toBeLessThan(0.03)
      expect(Math.abs(g! / 121 - b! / 75)).toBeLessThan(0.03)
    }
})

it('renders authoritative water and lava while leaving a bridge as dry ground', () => {
  const tiles = Array.from({ length: 117 }, () => '.')
  tiles[3 * 13 + 10] = '~'
  tiles[2 * 13 + 2] = 'l'
  const cell = {
    id: 'terrain',
    name: 'Terrain',
    coordinate: 'S02-02',
    regionId: 'verdant-expanse',
    column: 1,
    row: 1,
    charted: true,
    waterTiles: tiles.join(''),
  }
  const image = globeAtlasDetailPixels([cell], 4, 4)
  const pixel = (x: number, y: number) => {
    const sx = 16 + Math.floor(((x + 0.5) * 16) / 13),
      sy = 16 + Math.floor(((y + 0.5) * 16) / 9)
    return image.pixels.slice((sy * image.width + sx) * 4, (sy * image.width + sx) * 4 + 4)
  }
  const river = pixel(10, 3),
    bridge = pixel(10, 4),
    lava = pixel(2, 2)
  expect(river[2]).toBeGreaterThan(river[0]! * 1.6)
  expect(bridge[1]).toBeGreaterThan(bridge[2]! * 1.4)
  expect(lava[0]).toBeGreaterThan(lava[2]! * 2)
  expect(
    globeAtlasDetailPixels([{ ...cell, charted: false }], 4, 4).pixels.every((p) => p === 0),
  ).toBe(true)
})

it('projects only canonical charted towns and their actual nine-sector footprints', async () => {
  const { globeTowns, projectGlobeTowns } = await import('./globe-atlas')
  const atlas = atlasSectors().map((s) => ({
    id: s.id,
    name: s.name,
    coordinate: s.coordinate,
    regionId: s.regionId,
    column: s.atlasColumn!,
    row: s.atlasRow!,
    charted: s.charted,
    townId: s.townId,
  }))
  const towns = globeTowns(atlas)
  expect(towns).toHaveLength(8)
  expect(towns.every((t) => t.districts.length === 9 && t.sector.id === t.sector.townId)).toBe(true)
  const town = towns.find((t) => t.sector.id === 'verdant-expanse')!
  const camera = globeSectorCenter(town.sector.coordinate, ATLAS_COLUMNS, ATLAS_ROWS)!
  const projected = projectGlobeTowns(atlas, camera, 1)
  expect(projected.find((t) => t.sector.id === town.sector.id)).toMatchObject({ left: 50, top: 50 })
  expect(
    projectGlobeTowns(
      atlas.map((c) => ({ ...c, charted: false })),
      camera,
      1,
    ),
  ).toEqual([])
  expect(
    projectGlobeTowns(atlas, camera, 1.4).every(
      (t) => Math.hypot((t.left - 50) / 50, (t.top - 50) / 50) < 0.95,
    ),
  ).toBe(true)
})
