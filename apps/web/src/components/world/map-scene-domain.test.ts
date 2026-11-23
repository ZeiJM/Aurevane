import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { newWorldState, revealNearby } from '@/world/travel'
import { warpedContinentSectors } from '@/server/world/warped-continent'
import { projectWorld } from '@/server/world/world-service'
import type { WorldSectorView } from '@/world/types'
import { mapSceneDomain } from './map-scene-domain'
import { buildWaterField } from './map-water'

function projectedNeighbors() {
  const state = revealNearby({
    ...newWorldState(),
    position: { sectorId: 'uncharted-geodes', x: 12, y: 4 },
    warpedPhase: 0,
  })
  const view = projectWorld(state, [], 1000)
  return [
    view.sectors.find((s) => s.id === 'uncharted-geodes')!,
    view.sectors.find((s) => s.id === 'uncharted-expanse:4:2')!,
  ] as const
}

describe('supplied scene domains', () => {
  it('joins actual projected legacy and continental extension neighbors in one private scene', () => {
    const [legacy, extension] = projectedNeighbors()
    expect(legacy).toBeDefined()
    expect(extension).toBeDefined()
    expect([
      legacy.sceneColumn,
      legacy.sceneRow,
      extension.sceneColumn,
      extension.sceneRow,
    ]).toEqual([3, 2, 4, 2])
    expect(mapSceneDomain(legacy)).toBe(mapSceneDomain(extension))
    expect(mapSceneDomain(legacy)).not.toBe('atlas')
  })

  it('recognizes all thirteen existing identities and rejects mismatched extension metadata', () => {
    const [legacy] = projectedNeighbors()
    for (const sector of warpedContinentSectors)
      expect(mapSceneDomain({ ...sector, cells: [], exits: [] })).toBe(mapSceneDomain(legacy))
    const inconsistent = { ...legacy, id: 'uncharted-expanse:4:2' }
    expect(mapSceneDomain(inconsistent)).toBe(inconsistent.id)
  })

  it('keeps other private maps and arbitrary future prefixes isolated from legacy Uncharted', () => {
    const [legacy] = projectedNeighbors()
    const uncharted = mapSceneDomain(legacy)
    for (const id of [
      'survey-01',
      'sealed-realm:test',
      'ferry:outbound:1000',
      'void:ivory-veil:4:2',
      'void:cinder-choir:4:2',
      'uncharted-unknown',
      'uncharted-expanse:64:2',
      'uncharted-expanse:4:48',
      'uncharted-expanse:04:2',
      'uncharted-expanse:4:2\n',
      'uncharted-expanse:-1:2',
    ])
      expect(mapSceneDomain({ ...legacy, id })).not.toBe(uncharted)
    expect(mapSceneDomain({ ...legacy, id: 'void:ivory-veil:4:2' })).not.toBe(
      mapSceneDomain({ ...legacy, id: 'void:cinder-choir:4:2' }),
    )
    expect(
      mapSceneDomain({ ...legacy, id: 'public', charted: true, atlasColumn: 3, atlasRow: 2 }),
    ).toBe('atlas')
  })

  it('requires finite bounded local scene addresses before joining the legacy scene', () => {
    const [legacy] = projectedNeighbors()
    for (const coordinate of [undefined, -1, 64, 1.5, NaN, Infinity])
      expect(mapSceneDomain({ ...legacy, sceneColumn: coordinate })).toBe(legacy.id)
    for (const coordinate of [undefined, -1, 48, 1.5, NaN, Infinity])
      expect(mapSceneDomain({ ...legacy, sceneRow: coordinate })).toBe(legacy.id)
  })

  it('joins only supplied seam water and propagates a real bank without inventing withheld or foreign ground', () => {
    const [legacy, extension] = projectedNeighbors()
    // Keep real projected addresses/visibility; use a minimal supplied liquid seam
    // to exercise the shared presentation index independently of authored material.
    const a: WorldSectorView = {
      ...legacy,
      cells: [{ x: 12, y: 4, terrain: '~', walkable: false, safe: false }],
    }
    const b: WorldSectorView = {
      ...extension,
      cells: [
        { x: 0, y: 4, terrain: '~', walkable: false, safe: false },
        { x: 1, y: 4, terrain: '.', walkable: true, safe: false },
      ],
    }
    const joined = buildWaterField([a, b]),
      water = joined.get(a.id)!.cells.get('12:4')!
    expect(water.channel).toBe(true)
    expect(water.banks).toEqual([])
    expect(water.depth).toBe(1)
    expect(
      joined
        .get(b.id)!
        .cells.get('0:4')!
        .banks.map((bank) => bank.side),
    ).toEqual([1])
    const foreign = {
      ...b,
      id: 'survey-01',
      cells: [{ x: 0, y: 4, terrain: '.', walkable: true, safe: false }],
    }
    const withheld = { ...b, cells: [{ x: 0, y: 4, terrain: '?', walkable: false, safe: false }] }
    for (const sectors of [
      [a, foreign],
      [a, withheld, foreign],
    ]) {
      const isolated = buildWaterField(sectors).get(a.id)!.cells.get('12:4')!
      expect(isolated.channel).toBe(false)
      expect(isolated.banks).toEqual([])
      expect(isolated.depth).toBe(3)
    }
  })
})
