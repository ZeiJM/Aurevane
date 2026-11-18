import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { atlasSectors } from '@/world/atlas'
import { GRAND_DISCOVERY_SITES } from '@/world/discovery-sites'
import { grandDiscoveryBarrier } from '@/world/discovery-collision'
import { terrainWalkable } from '@/world/terrain'
import { savedWorldGeometryRecovery } from './world-geometry-recovery'

describe('authoritative release-specific saved world position recovery', () => {
  it('repairs every newly solid arena and valley origin into legal connected ground', () => {
    const sectors = atlasSectors()
    let affected = 0
    for (const sector of sectors)
      for (let y = 0; y < 9; y++)
        for (let x = 0; x < 13; x++) {
          const gx = sector.atlasColumn! * 13 + x
          const gy = sector.atlasRow! * 9 + y
          if (
            !GRAND_DISCOVERY_SITES.some((site) =>
              grandDiscoveryBarrier(site.id, gx - site.left, gy - site.top),
            ) ||
            terrainWalkable(sector.rows[y]![x]!)
          )
            continue
          const position = { sectorId: sector.id, x, y }
          const repaired = savedWorldGeometryRecovery(position)
          expect(repaired).not.toBeNull()
          expect(repaired).not.toEqual(position)
          const arrival = sectors.find((candidate) => candidate.id === repaired!.sectorId)
          expect(arrival).toBeDefined()
          expect(terrainWalkable(arrival!.rows[repaired!.y]![repaired!.x]!)).toBe(true)
          expect(savedWorldGeometryRecovery(repaired!)).toBeNull()
          affected++
        }
    expect(affected).toBeGreaterThan(250)
  })
  it('also repairs a blocked historic public cell outside the two grand sites', () => {
    const sector = atlasSectors().find(
      (item) =>
        item.charted && item.id !== 'umbral-march' && item.rows.some((row) => row.includes('#')),
    )!
    const y = sector.rows.findIndex((row) => row.includes('#'))
    const x = sector.rows[y]!.indexOf('#')
    const target = savedWorldGeometryRecovery({ sectorId: sector.id, x, y })
    expect(target).not.toBeNull()
    expect(target?.sectorId.startsWith('void:')).toBe(false)
  })
  it('moves saved Emberreach origins out of the new lava basin', () => {
    for (const position of [
      { sectorId: 'emberreach', x: 9, y: 8 },
      { sectorId: 'atlas:80:21', x: 11, y: 1 },
    ]) {
      const repaired = savedWorldGeometryRecovery(position)
      expect(repaired).not.toBeNull()
      expect(savedWorldGeometryRecovery(repaired!)).toBeNull()
    }
  })
  it('never relocates normal map cells or private realm positions', () => {
    expect(savedWorldGeometryRecovery({ sectorId: 'umbral-march', x: 6, y: 4 })).toBeNull()
    expect(savedWorldGeometryRecovery({ sectorId: 'void:ivory-veil:0:0', x: 6, y: 4 })).toBeNull()
    expect(savedWorldGeometryRecovery({ sectorId: 'uncharted-landing', x: 6, y: 4 })).toBeNull()
  })
})
