import { expect, it } from 'vitest'
import type { WorldSectorView } from '@/world/types'
import { ShallowWaterRipples } from './map-shallow-ripples'

function sector(overrides: Partial<WorldSectorView> = {}): WorldSectorView {
  return {
    id: 'town',
    name: 'Town',
    coordinate: 'S01-01',
    regionId: 'verdant-expanse',
    charted: true,
    atlasColumn: 0,
    atlasRow: 0,
    art: null,
    east: 0,
    north: 0,
    landmarks: [],
    exits: [],
    cells: Array.from({ length: 117 }, (_, index) => ({
      x: index % 13,
      y: Math.floor(index / 13),
      terrain: 'w',
      walkable: true,
      safe: true,
    })),
    ...overrides,
  }
}
function sampler(sectors: readonly WorldSectorView[] = [sector()]) {
  const ripples = new ShallowWaterRipples()
  return {
    ripples,
    sample: (
      x: number,
      now: number,
      options: Partial<Parameters<ShallowWaterRipples['sample']>[0]> = {},
    ) =>
      ripples.sample({
        point: { x, y: 2.5 },
        moving: true,
        now,
        enabled: true,
        sectors,
        currentSectorId: sectors[0]!.id,
        ...options,
      }),
  }
}
it('emits restrained expanding rings only after actual presented shallow-water movement', () => {
  const { sample } = sampler()
  expect(sample(1.5, 0)).toEqual([])
  const first = sample(2.2, 140)
  expect(first).toHaveLength(1)
  expect(first[0]).toMatchObject({ worldx: 2.2, worldy: 2.5 })
  expect(first[0]!.radius).toBeGreaterThan(0)
  expect(first[0]!.alpha).toBeGreaterThan(0)
  const later = sample(2.2, 540, { moving: false })
  expect(later).toHaveLength(1)
  expect(later[0]!.worldx).toBe(2.2)
  expect(later[0]!.radius).toBeGreaterThan(first[0]!.radius)
  expect(later[0]!.alpha).toBeLessThan(first[0]!.alpha)
  expect(sample(2.2, 1040, { moving: false })).toEqual([])
})
it('requires both movement distance and cadence and never emits from idle coordinates', () => {
  const { sample } = sampler()
  sample(1.5, 0)
  expect(sample(1.7, 140)).toEqual([])
  expect(sample(1.85, 160)).toHaveLength(1)
  expect(sample(2.2, 200)).toHaveLength(1)
  expect(sample(2.25, 300)).toHaveLength(2)
  for (let now = 320; now < 1000; now += 20) expect(sample(2.25, now).length).toBeLessThanOrEqual(2)
  expect(sample(2.25, 1200, { moving: false })).toEqual([])
})
it.each([
  { terrain: '.', walkable: true },
  { terrain: '?', walkable: false },
  { terrain: '~', walkable: false },
  { terrain: 'l', walkable: false },
  { terrain: 'w', walkable: false },
])('does not generate footsteps over $terrain with walkable=$walkable', ({ terrain, walkable }) => {
  const s = sector()
  s.cells = s.cells.map((c) => ({ ...c, terrain, walkable }))
  const { sample } = sampler([s])
  sample(1.5, 0)
  expect(sample(2.2, 140)).toEqual([])
})
it('accepts explicitly supplied walkable legacy water and rejects withheld cells', () => {
  const s = sector({ cells: [{ x: 2, y: 2, terrain: '~', walkable: true, safe: false }] })
  const { sample } = sampler([s])
  sample(1.5, 0)
  expect(sample(2.2, 140)).toHaveLength(1)
  expect(sample(3.2, 340)).toHaveLength(1)
  expect(sample(3.6, 480)).toHaveLength(1)
})
it('clears effects for disabled/reduced motion and resumes without replaying old movement', () => {
  const { sample } = sampler()
  sample(1.5, 0)
  expect(sample(2.2, 140)).toHaveLength(1)
  expect(sample(2.3, 160, { enabled: false })).toEqual([])
  expect(sample(5.5, 180, { enabled: false })).toEqual([])
  expect(sample(5.5, 200)).toEqual([])
  expect(sample(6.2, 340)).toHaveLength(1)
})
it('resets teleport jumps, suspended samples and backwards clocks without drawing a trail', () => {
  const { sample } = sampler()
  sample(1.5, 0)
  sample(2.2, 140)
  expect(sample(10.5, 160)).toEqual([])
  expect(sample(11.2, 300)).toHaveLength(1)
  expect(sample(11.8, 2400)).toEqual([])
  expect(sample(11.8, 2200)).toEqual([])
  expect(sample(12.2, 2340)).toHaveLength(1)
})
it('keeps domain identity isolated across realms even when coordinates and cells overlap', () => {
  const a = sector({
    id: 'void:ivory-veil:0:0',
    charted: false,
    atlasColumn: undefined,
    atlasRow: undefined,
    sceneColumn: 0,
    sceneRow: 0,
  })
  const b = sector({
    id: 'void:amber-drowned:0:0',
    charted: false,
    atlasColumn: undefined,
    atlasRow: undefined,
    sceneColumn: 0,
    sceneRow: 0,
  })
  const { sample } = sampler([a, b])
  sample(1.5, 0)
  expect(sample(2.2, 140)).toHaveLength(1)
  expect(sample(2.2, 160, { currentSectorId: b.id })).toEqual([])
  expect(sample(2.9, 300, { currentSectorId: b.id })).toHaveLength(1)
  expect(sample(3.6, 440, { currentSectorId: 'not-supplied' })).toEqual([])
})
it('does not use another realm wet cell or retain a ring after its cell becomes withheld', () => {
  const a = sector({
    id: 'void:ivory-veil:0:0',
    charted: false,
    atlasColumn: undefined,
    atlasRow: undefined,
    sceneColumn: 0,
    sceneRow: 0,
    cells: [],
  })
  const b = sector({
    id: 'void:amber-drowned:0:0',
    charted: false,
    atlasColumn: undefined,
    atlasRow: undefined,
    sceneColumn: 0,
    sceneRow: 0,
  })
  const { sample } = sampler([a, b])
  sample(1.5, 0)
  expect(sample(2.2, 140)).toEqual([])
  const wet = sector(),
    supplied = sampler([wet])
  supplied.sample(1.5, 0)
  supplied.sample(2.2, 140)
  expect(supplied.sample(2.2, 160, { sectors: [{ ...wet, cells: [] }], moving: false })).toEqual([])
})
it('continues across adjacent atlas sectors and a continuously presented longitude seam', () => {
  const west = sector({ id: 'west', atlasColumn: 127 }),
    east = sector({ id: 'east' })
  const { sample } = sampler([west, east])
  sample(1663.5, 0)
  expect(sample(1664.2, 140, { currentSectorId: east.id })).toHaveLength(1)
  expect(sample(1664.9, 280, { currentSectorId: east.id })).toHaveLength(2)
})
it('bounds retained events and reuses the supplied terrain index on every unchanged frame', () => {
  const s = sector(),
    cells = s.cells
  let reads = 0
  Object.defineProperty(s, 'cells', {
    get() {
      reads++
      return cells
    },
  })
  const { sample } = sampler([s])
  sample(1.5, 0)
  const indexed = reads
  for (let n = 1; n < 80; n++) {
    const events = sample(1.5 + (n % 14) * 0.7, n * 140)
    expect(events.length).toBeLessThanOrEqual(16)
  }
  expect(reads).toBe(indexed)
  sample(2.5, 11200, { sectors: [s] })
  expect(reads).toBe(indexed)
})
it('rejects non-finite samples and recovers with fresh motion', () => {
  const { sample } = sampler()
  sample(1.5, 0)
  sample(2.2, 140)
  expect(sample(Number.NaN, 160)).toEqual([])
  expect(sample(3.5, 180)).toEqual([])
  expect(sample(4.2, 320)).toHaveLength(1)
})
