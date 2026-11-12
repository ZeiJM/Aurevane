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
  expect(image.pixels[(16 * image.width + 16) * 4 + 3]).toBeLessThan(30)
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

it('normalizes material exposure without letting arbitrary blue imagery recolor dry ground', () => {
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
  const other = globeAtlasDetailPixels([cell], 4, 4, {
    width: 1,
    height: 1,
    pixels: new Uint8Array([0, 0, 255, 255]),
  })
  expect(image.pixels).toEqual(other.pixels)
  const center = (24 * image.width + 24) * 4
  expect(image.pixels[center + 1]).toBeGreaterThan(image.pixels[center + 2]!)
})

it('renders authoritative water and lava while leaving a bridge as dry ground', () => {
  const tiles = Array.from({ length: 117 }, () => '.')
  tiles[3 * 13 + 10] = '~'
  tiles[2 * 13 + 2] = 'l'
  tiles[5 * 13 + 6] = 'w'
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
    lava = pixel(2, 2),
    shallow = pixel(6, 5)
  expect(river[2]).toBeGreaterThan(river[0]! * 1.6)
  expect(bridge[2]).toBeLessThan(Math.max(bridge[0]!, bridge[1]!))
  expect(lava[0]).toBeGreaterThan(lava[2]! * 2)
  expect(shallow[2]).toBeGreaterThan(shallow[0]! * 1.6)
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

it('rounds exposed charted corners inward without painting unknown ground', () => {
  const cell = {
    id: 'coast',
    name: 'Coast',
    coordinate: 'S02-02',
    regionId: 'verdant-expanse',
    column: 1,
    row: 1,
    charted: true,
  }
  const image = globeAtlasDetailPixels([cell], 4, 4)
  const alpha = (x: number, y: number) => image.pixels[(y * image.width + x) * 4 + 3]!
  expect(alpha(16, 16)).toBeLessThan(30)
  expect(alpha(24, 24)).toBe(255)
  const fractional = Array.from({ length: 256 }, (_, n) =>
    alpha(16 + (n % 16), 16 + Math.floor(n / 16)),
  ).filter((a) => a > 0 && a < 255)
  expect(fractional.length).toBeGreaterThan(20)
  expect(alpha(15, 24)).toBe(0)
  expect(alpha(32, 24)).toBe(0)
})

it('blends neighbouring public biomes continuously without rectangular district borders', () => {
  const cell = {
    id: 'woods',
    name: 'Woods',
    coordinate: 'S02-02',
    regionId: 'verdant-expanse',
    column: 1,
    row: 1,
    charted: true,
  }
  const image = globeAtlasDetailPixels(
    [cell, { ...cell, id: 'dunes', regionId: 'glasswind-desert', column: 2 }],
    4,
    4,
  )
  const left = (24 * image.width + 31) * 4,
    right = left + 4
  expect(Math.abs(image.pixels[left]! - image.pixels[right]!)).toBeLessThan(25)
  expect(image.pixels[left + 3]).toBe(255)
  expect(image.pixels[right + 3]).toBe(255)
})

it('reuses unchanged public surface across server confirmations and invalidates genuine terrain changes', () => {
  const cell = {
    id: 'stable',
    name: 'Stable',
    coordinate: 'S02-02',
    regionId: 'verdant-expanse',
    column: 1,
    row: 1,
    charted: true,
  }
  const first = globeAtlasDetailPixels([cell], 4, 4)
  expect(globeAtlasDetailPixels([{ ...cell }], 4, 4)).toBe(first)
  expect(globeAtlasDetailPixels([{ ...cell, waterTiles: '~'.repeat(117) }], 4, 4)).not.toBe(first)
})

it('rounds a broad rectangular inlet over several known coastal pixels while withholding its unknown interior', () => {
  const atlas = Array.from({ length: 100 }, (_, n) => ({
    id: `land-${n}`,
    name: 'Land',
    coordinate: '',
    regionId: 'verdant-expanse',
    column: n % 10,
    row: Math.floor(n / 10),
    charted: true,
  })).filter((c) => !(c.column >= 5 && c.row >= 3 && c.row <= 6))
  const image = globeAtlasDetailPixels(atlas, 10, 10)
  const alpha = (x: number, y: number) => image.pixels[(y * image.width + x) * 4 + 3]!
  let removed = 0
  for (let y = 50; y < 110; y++) for (let x = 74; x < 80; x++) if (alpha(x, y) < 128) removed++
  // Six-pixel-wide known coastal strip: most becomes a curved inset shore,
  // rather than retaining a straight rectangular wall with one-pixel corners.
  expect(removed).toBeGreaterThan(280)
  expect(alpha(80, 70)).toBe(0)
  expect(alpha(88, 70)).toBe(0)
  expect(alpha(40, 70)).toBe(255)
})

it('forms coherent mountain ranges with stronger relief across the range than along it', () => {
  const atlas = Array.from({ length: 400 }, (_, n) => ({
    id: n === 210 ? 'frostmere' : `mountain-${n}`,
    name: 'Highlands',
    coordinate: '',
    regionId: 'frostmere',
    column: n % 20,
    row: Math.floor(n / 20),
    charted: true,
  }))
  const image = globeAtlasDetailPixels(atlas, 20, 20)
  const light = (x: number, y: number) => image.pixels[(y * image.width + x) * 4]!
  let across = 0,
    along = 0
  for (let y = 40; y < 280; y++)
    for (let x = 40; x < 280; x++) {
      across += Math.abs(light(x + 2, y + 3) - light(x - 2, y - 3))
      along += Math.abs(light(x + 3, y - 2) - light(x - 3, y + 2))
    }
  expect(across / along).toBeGreaterThan(1.35)
})
