import { expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { atlasSectors } from '../src/world/atlas'
import { isWalkable } from '../src/world/travel'
import { canonicalOcclusionWalks, correctionScenes } from './world-map-correction-scenes'
it('selects the bounded correction matrix from actual public terrain and legal review positions', () => {
  const matrix = correctionScenes(),
    sectors = atlasSectors()
  expect(matrix.towns).toHaveLength(8)
  expect(matrix.landscapes).toHaveLength(6)
  expect(matrix.discoveries).toHaveLength(4)
  for (const scene of [...matrix.towns, ...matrix.landscapes, ...matrix.discoveries]) {
    const sector = sectors.find((s) => s.id === scene.position.sectorId)!
    expect(sector.charted).toBe(true)
    expect(isWalkable(sector, scene.position), scene.id).toBe(true)
    expect(scene.assets.length).toBeGreaterThan(0)
    for (const asset of scene.assets)
      expect(
        existsSync(new URL(`../public/media/art/world/runtime/${asset}`, import.meta.url)),
        asset,
      ).toBe(true)
  }
})

it('derives real current Frostmere roof and tree walks without standing inside a building', () => {
  const sectors = atlasSectors()
  const cases = canonicalOcclusionWalks()
  expect(cases.map((c) => c.label)).toEqual(['roof', 'tree'])
  for (const fixture of cases) {
    const sector = sectors.find((s) => s.id === fixture.sectorId)!
    expect(sector.townId).toBe('frostmere')
    expect(isWalkable(sector, fixture.from)).toBe(true)
    expect(isWalkable(sector, fixture.to)).toBe(true)
    expect(Math.abs(fixture.from.x - fixture.to.x) + Math.abs(fixture.from.y - fixture.to.y)).toBe(
      1,
    )
    if (fixture.label === 'tree') expect(sector.rows[fixture.from.y]![fixture.from.x]).toBe('t')
    else
      expect(
        sector.buildings!.some(
          (b) =>
            fixture.from.x >= b.x &&
            fixture.from.x < b.x + b.width &&
            fixture.from.y >= b.y &&
            fixture.from.y < b.y + b.height,
        ),
      ).toBe(false)
  }
})

it('requires painted close-view valley layers before accepting normal-scale scene captures', () => {
  const valley = correctionScenes().discoveries.find((scene) => scene.id === 'elemental-valley')!
  expect(valley.normalAssets).toEqual([
    'valley-cascade-detail-v01.webp',
    'valley-fire-detail-v01.webp',
    'valley-ice-detail-v01.webp',
  ])
})
