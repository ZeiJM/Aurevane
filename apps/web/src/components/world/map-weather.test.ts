import { describe, expect, it } from 'vitest'
import {
  advanceWorldWind,
  precipitationKind,
  precipitationParticle,
  terrainHeatEmitters,
  worldWindTarget,
} from './map-weather'
import type { WorldSectorView } from '@/world/types'

describe('bounded weather motion', () => {
  it('responds to authoritative weather gradually and moves rain and snow with one wind', () => {
    const clear = worldWindTarget('clear', 'frostmere')
    const storm = worldWindTarget('storm', 'frostmere')
    expect(Math.sign(clear)).toBe(Math.sign(storm))
    expect(Math.abs(storm)).toBeGreaterThan(Math.abs(clear))

    const first = advanceWorldWind({ speed: clear, offset: 0 }, storm, 16)
    expect(Math.abs(first.speed)).toBeGreaterThan(Math.abs(clear))
    expect(Math.abs(first.speed)).toBeLessThan(Math.abs(storm))
    const later = advanceWorldWind(first, storm, 5000)
    expect(later.speed).toBeCloseTo(storm, 2)

    for (const kind of ['rain', 'snow'] as const) {
      const west = precipitationParticle(kind, 4, 800, 600, 1000, -35)
      const east = precipitationParticle(kind, 4, 800, 600, 1000, 35)
      expect(east.x).toBeGreaterThan(west.x)
      expect(east.y).toBe(west.y)
    }
  })
  it('anchors embers only to supplied lava and visible campfires', () => {
    const sector: WorldSectorView = {
      id: 'known',
      name: 'Known',
      coordinate: 'S03-04',
      regionId: 'emberreach',
      art: null,
      east: 26,
      north: 27,
      charted: true,
      exits: [],
      atlasColumn: 2,
      atlasRow: 3,
      cells: [
        { x: 1, y: 2, terrain: 'l', walkable: false, safe: false },
        { x: 4, y: 5, terrain: '.', walkable: true, safe: false },
      ],
      landmarks: [
        { id: 'fire', name: 'Camp', kind: 'camp', x: 5, y: 4 },
        { id: 'dry', name: 'Grove', kind: 'grove', x: 8, y: 2 },
      ],
    }
    expect(terrainHeatEmitters([sector]).map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 27.5, y: 29.5 },
      { x: 31.5, y: 31.5 },
    ])
    expect(terrainHeatEmitters([{ ...sector, cells: [], landmarks: [] }])).toEqual([])
  })
  it('shows falling rain and independently drifting snow for cold-region precipitation', () => {
    expect(precipitationKind('rain', 'verdant-expanse')).toBe('rain')
    expect(precipitationKind('storm', 'frostmere')).toBe('snow')
    expect(precipitationKind('clear', 'frostmere')).toBe(null)
    const rain = precipitationParticle('rain', 4, 800, 600, 1000),
      laterRain = precipitationParticle('rain', 4, 800, 600, 1100),
      snow = precipitationParticle('snow', 4, 800, 600, 1000),
      laterSnow = precipitationParticle('snow', 4, 800, 600, 1100)
    expect(laterRain.y - rain.y).toBeGreaterThan(25)
    expect(laterSnow.y - snow.y).toBeGreaterThan(1)
    expect(laterSnow.y - snow.y).toBeLessThan(laterRain.y - rain.y)
    expect(laterSnow.x).not.toBe(snow.x)
    expect(precipitationParticle('snow', 5, 800, 600, 1000).radius).not.toBe(snow.radius)
  })
})
