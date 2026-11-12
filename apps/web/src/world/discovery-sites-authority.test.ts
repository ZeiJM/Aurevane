import { expect, it } from 'vitest'
import { atlasSectors } from './atlas'
import { GRAND_DISCOVERY_SITES } from './discovery-sites'
import { isWalkable } from './travel'
it('authors the valley water mask as traversable shallows while preserving the avenue and saved dry positions', () => {
  const site = GRAND_DISCOVERY_SITES.find((s) => s.id === 'elemental-valley')!,
    sectors = atlasSectors()
  for (const cell of site.water) {
    const gx = site.left + cell.x,
      gy = site.top + cell.y
    const sector = sectors.find(
      (s) => s.atlasColumn === Math.floor(gx / 13) && s.atlasRow === Math.floor(gy / 9),
    )!
    const p = { x: gx % 13, y: gy % 9 }
    expect(sector.rows[p.y]![p.x], `${gx}:${gy}`).toBe('w')
    expect(isWalkable(sector, p)).toBe(true)
  }
  for (let x = site.left; x < site.left + site.width; x++) {
    const y = site.top + 3,
      s = sectors.find(
        (s) => s.atlasColumn === Math.floor(x / 13) && s.atlasRow === Math.floor(y / 9),
      )!
    expect(s.rows[y % 9]![x % 13]).toBe('=')
  }
})
it('reserves the entire discovery grounds and southern approach without dense trees or generated POI overlaps', () => {
  const sectors = atlasSectors()
  for (const site of GRAND_DISCOVERY_SITES) {
    const overlaps: string[] = []
    for (let gy = site.top; gy < site.top + site.height + 2; gy++)
      for (let gx = site.left; gx < site.left + site.width; gx++) {
        const s = sectors.find(
          (s) => s.atlasColumn === Math.floor(gx / 13) && s.atlasRow === Math.floor(gy / 9),
        )
        expect(s, `${site.id} ${gx}:${gy}`).toBeDefined()
        if (site.id === 'remote-colosseum')
          expect(isWalkable(s!, { x: gx % 13, y: gy % 9 })).toBe(true)
        if (s!.rows[gy % 9]![gx % 13] === 't') overlaps.push(`${gx}:${gy}:tree`)
        for (const l of s!.landmarks)
          if (s!.atlasColumn! * 13 + l.x === gx && s!.atlasRow! * 9 + l.y === gy)
            overlaps.push(`${gx}:${gy}:${l.id}`)
      }
    expect(overlaps, site.id).toEqual([])
  }
})

it('keeps both major grounds larger than a town while retaining the original deep river collision', () => {
  const valley = GRAND_DISCOVERY_SITES.find((s) => s.id === 'elemental-valley')!,
    arena = GRAND_DISCOVERY_SITES.find((s) => s.id === 'remote-colosseum')!
  expect(valley.width * valley.height).toBeGreaterThan(39 * 27)
  expect(arena.width * arena.height).toBeGreaterThan(39 * 27)
  for (const cell of valley.deepWater) {
    const x = valley.left + cell.x,
      y = valley.top + cell.y,
      s = atlasSectors().find(
        (s) => s.atlasColumn === Math.floor(x / 13) && s.atlasRow === Math.floor(y / 9),
      )!
    expect(s.rows[y % 9]![x % 13]).toBe('~')
    expect(isWalkable(s, { x: x % 13, y: y % 9 })).toBe(false)
  }
})
