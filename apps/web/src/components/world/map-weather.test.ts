import { describe, expect, it, vi } from 'vitest'
import {
  advanceWorldWind,
  paintPrecipitation,
  precipitationBudget,
  paintWeatherVeil,
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
  it('renders storms with denser directional spindrift than normal snowfall', () => {
    const drawing = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
    }
    const canvas = drawing as unknown as CanvasRenderingContext2D
    const wind = { speed: -0.05, offset: -40 }
    const flakes = paintPrecipitation(canvas, 800, 600, 1000, 'rain', 'frostmere', wind)
    const storm = paintPrecipitation(canvas, 800, 600, 1000, 'storm', 'frostmere', wind)
    expect(storm).toBeGreaterThan(flakes)
    expect(drawing.stroke).toHaveBeenCalledTimes(storm)
    expect(drawing.arc).toHaveBeenCalledTimes(flakes)
    expect(drawing.lineTo.mock.calls[0]![0]).toBeLessThan(drawing.moveTo.mock.calls[0]![0])
  })
})

it('adds soft fog without making clear or windy skies look overcast', () => {
  const gradient = { addColorStop: vi.fn() }
  const drawing = {
    save: vi.fn(),
    restore: vi.fn(),
    createRadialGradient: vi.fn(() => gradient),
    fillRect: vi.fn(),
  }
  const canvas = drawing as unknown as CanvasRenderingContext2D
  paintWeatherVeil(canvas, 800, 600, 'clear', 1200)
  paintWeatherVeil(canvas, 800, 600, 'wind', -100)
  expect(drawing.fillRect).not.toHaveBeenCalled()
  paintWeatherVeil(canvas, 800, 600, 'fog', -100)
  expect(drawing.createRadialGradient).toHaveBeenCalledTimes(4)
  expect(gradient.addColorStop).toHaveBeenCalledWith(1, 'rgba(20,34,42,0)')
})

it('keeps airborne pollen and leaves out of wet/foggy skies and within the existing quality budget', async () => {
  const { airborneMoteProfile } = await import('./map-weather')
  for (const weather of ['rain', 'storm', 'fog'] as const)
    expect(airborneMoteProfile(weather, false)).toBeNull()
  const calm = airborneMoteProfile('clear', false)!,
    wind = airborneMoteProfile('wind', false)!
  expect(wind.drift).toBeGreaterThan(calm.drift)
  expect(wind.width).toBeGreaterThan(calm.width)
  expect(airborneMoteProfile('clear', true)!.colour).not.toBe(calm.colour)
})

it('makes normal rain and snowfall visibly sparser than storms without exceeding particle budgets', () => {
  expect(precipitationBudget('rain', 'rain')).toBeLessThan(precipitationBudget('storm', 'rain'))
  expect(precipitationBudget('rain', 'snow')).toBeLessThan(precipitationBudget('storm', 'snow'))
  expect(precipitationBudget('storm', 'snow', 0.35)).toBeLessThan(
    precipitationBudget('storm', 'snow'),
  )
  expect(precipitationBudget('storm', 'rain', 10)).toBeLessThanOrEqual(192)
  expect(precipitationBudget('clear', null)).toBe(0)
})
