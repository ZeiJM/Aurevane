import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import type { WorldBuilding, WorldSectorView } from '@/world/types'
import { projectMapPoint } from './map-projection'
import {
  townArchitectureArt,
  crownWallArt,
  crownWallSegments,
  TOWN_ARCHITECTURE_REGIONS,
} from './map-town-architecture'
const sector = (regionId: string): WorldSectorView => ({
  id: regionId,
  name: 'Town',
  coordinate: '',
  regionId,
  townId: regionId,
  art: null,
  east: 0,
  north: 0,
  charted: true,
  cells: [],
  exits: [],
  landmarks: [],
})
const building: WorldBuilding = { id: 'building', x: 1, y: 1, width: 4, height: 2, artIndex: 0 }
describe('regional architectural art registration', () => {
  it('registers every regional civic building against its measured full-alpha floor pivot', async () => {
    const manifest = JSON.parse(
      await readFile(
        new URL(
          '../../../public/media/art/world/runtime/town-grand-architecture-v01.manifest.json',
          import.meta.url,
        ),
        'utf8',
      ),
    )
    for (const [regionIndex, region] of TOWN_ARCHITECTURE_REGIONS.entries()) {
      const art = townArchitectureArt(sector(region), { ...building, artIndex: 10 + regionIndex })!
      expect(art).toMatchObject({
        sheet: 'town-grand-architecture',
        index: regionIndex,
        columns: 4,
        rows: 2,
        anchorX: manifest.sprites[regionIndex].anchorX,
        anchorY: manifest.sprites[regionIndex].anchorY,
      })
      expect(art.anchorX).toBeGreaterThan(0.2)
      expect(art.anchorX).toBeLessThan(0.8)
    }
  })
  it('varies ordinary buildings deterministically and retains existing forms in every region', () => {
    for (const region of TOWN_ARCHITECTURE_REGIONS) {
      const shapes = Array.from({ length: 20 }, (_, i) =>
        townArchitectureArt(sector(region), { ...building, id: `building:${i}` }),
      )
      expect(shapes.some((art) => art?.sheet === 'town-ordinary-architecture')).toBe(true)
      expect(shapes.some((art) => art === undefined)).toBe(true)
    }
  })
  it('never applies town architecture to private, warped, non-town, props or wall records', () => {
    const base = sector('aureth-crown')
    for (const changed of [
      { ...base, charted: false },
      { ...base, warpedTheme: 'haven' as const },
      { ...base, townId: undefined },
    ])
      expect(townArchitectureArt(changed, building)).toBeUndefined()
    expect(townArchitectureArt(base, { ...building, propIndex: 1 })).toBeUndefined()
    expect(townArchitectureArt(base, { ...building, artIndex: 9 })).toBeUndefined()
  })
  it('registers both Crown wall axes and leaves open gates as intentional separate sprites', () => {
    expect(crownWallArt({ ...building, artIndex: 9, wallFacing: 'east' })).toMatchObject({
      sheet: 'crown-wall-kit',
      index: 0,
      columns: 2,
      rows: 2,
    })
    expect(crownWallArt({ ...building, artIndex: 9, wallFacing: 'south' })).toMatchObject({
      sheet: 'crown-wall-kit',
      index: 1,
      columns: 2,
      rows: 2,
    })
    expect(crownWallArt(building)).toBeUndefined()
  })
  it('joins bounded wall pieces on measured base contacts along both true world axes', () => {
    const origin = { x: 0, y: 0 }
    for (const wallFacing of ['east', 'south'] as const) {
      const wall = {
        ...building,
        width: wallFacing === 'east' ? 1 : 13,
        height: wallFacing === 'east' ? 9 : 1,
        artIndex: 9,
        wallFacing,
      }
      const art = crownWallArt(wall)!,
        pieces = crownWallSegments(wall)
      expect(pieces.length).toBe(wallFacing === 'east' ? 3 : 5)
      expect(pieces.reduce((total, piece) => total + piece.length, 0)).toBeCloseTo(
        wallFacing === 'east' ? 9 : 13,
      )
      expect(pieces.every((piece) => piece.length <= 3)).toBe(true)
      let offset = 0
      for (const piece of pieces) {
        const centre = projectMapPoint(piece, origin, origin, 1, 0, 0)
        for (const [i, contact] of art.baseContacts.entries()) {
          const end = offset + (i === 1 ? piece.length : 0)
          const expected = projectMapPoint(
            {
              x: wall.x + (wallFacing === 'east' ? wall.width : end),
              y: wall.y + (wallFacing === 'east' ? end : wall.height),
            },
            origin,
            origin,
            1,
            0,
            0,
          )
          expect(centre.x + (contact.x - art.anchorX) * piece.widthTiles).toBeCloseTo(expected.x, 8)
          expect(centre.y + (contact.y - art.anchorY) * piece.heightTiles).toBeCloseTo(
            expected.y,
            8,
          )
        }
        offset += piece.length
      }
    }
  })
})
