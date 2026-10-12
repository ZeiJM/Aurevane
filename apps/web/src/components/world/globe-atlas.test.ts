import { expect, it } from 'vitest'
import { atlasSectors, ATLAS_COLUMNS, ATLAS_ROWS } from '@/world/atlas'
import { globeSectorCenter, globeSectorCoordinate } from '@/world/globe-math'
import { globeAtlasPixels } from './globe-atlas'
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
    expect(globeSectorCoordinate(globeSectorCenter(cell.coordinate, 64, 32)!, 64, 32)).toBe(
      cell.coordinate,
    )
  }
  expect(pixels[3]).toBe(0)
  expect(globeAtlasPixels([{ ...atlas[0]!, charted: false }], 64, 32).every((p) => p === 0)).toBe(
    true,
  )
})
