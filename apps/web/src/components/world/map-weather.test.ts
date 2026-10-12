import { describe, expect, it } from 'vitest'
import { precipitationKind, precipitationParticle, terrainHeatEmitters } from './map-weather'
import type { WorldSectorView } from '@/world/types'

describe('bounded weather motion', () => {
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
