import { expect, test } from 'vitest'
import { atlasSectors } from '../src/world/atlas'
import { terrainWalkable } from '../src/world/terrain'
import { waterReviewCandidate } from './world-art-water'
import { isWaterTerrain } from '../src/components/world/map-water'

for (const region of ['verdant-expanse', 'hollow-coast', 'frostmere']) {
  test(`selects real bank-adjacent legal ground for ${region}`, () => {
    const candidate = waterReviewCandidate(atlasSectors(), region)
    expect(candidate).toBeDefined()
    expect(candidate!.sector.regionId).toBe(region)
    expect(candidate!.water).toBeGreaterThan(0)
    for (const { x, y } of candidate!.ground) {
      expect(terrainWalkable(candidate!.sector.rows[y]![x]!)).toBe(true)
      expect(isWaterTerrain(candidate!.sector.rows[y]![x]!)).toBe(false)
      expect(
        [
          [0, 1],
          [1, 0],
          [0, -1],
          [-1, 0],
        ].some(([dx, dy]) => isWaterTerrain(candidate!.sector.rows[y + dy!]?.[x + dx!])),
      ).toBe(true)
    }
  })
}

test('prefers wilderness banks when a built-up bank is also available', () => {
  const sectors = atlasSectors()
  const candidate = waterReviewCandidate(sectors, 'verdant-expanse')!
  expect(candidate.sector.townId).toBeFalsy()
  expect(waterReviewCandidate(sectors, 'unknown-region')).toBeUndefined()
})
