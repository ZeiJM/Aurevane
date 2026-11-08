import { expect, it } from 'vitest'
import { ferryHullEdges, ferryWaterFrame } from './map-ferry-deck'

const passage = { direction: 'outbound', departureAt: 10_000, arrivalAt: 310_000 } as const

it('shows a wake only during a confirmed crossing and responds to wind', () => {
  const calm = { speed: 0.008, offset: 40 }
  const wind = { speed: 0.05, offset: 80 }
  const moored = ferryWaterFrame(passage, 9_999, 500, calm, true)
  const sailing = ferryWaterFrame(passage, 10_000, 500, calm, true)
  expect(moored.underway).toBe(false)
  expect(sailing.underway).toBe(true)
  expect(ferryWaterFrame(passage, 309_999, 500, calm, true).underway).toBe(true)
  expect(ferryWaterFrame(passage, 310_000, 500, calm, true).underway).toBe(false)
  expect(ferryWaterFrame(undefined, 10_000, 500, calm, true).underway).toBe(false)
  expect(ferryWaterFrame(passage, 10_000, 750, wind, true).chop).toBeGreaterThan(sailing.chop)
  expect(ferryWaterFrame(passage, 10_000, 750, wind, true).phase).not.toBe(sailing.phase)
})

it('keeps the crossing readable without advancing cosmetic motion when reduced', () => {
  const fixed = ferryWaterFrame(passage, 10_000, 500, { speed: 0.01, offset: 20 }, false)
  expect(fixed.underway).toBe(true)
  expect(ferryWaterFrame(passage, 10_000, 750, { speed: 0.01, offset: 90 }, false)).toEqual(fixed)
})

it('builds the visible hull only below existing deck edges, including blocked fittings', () => {
  const cell = (x: number, y: number, terrain: '~' | 's' | '#') => ({
    x,
    y,
    terrain,
    safe: terrain !== '~',
    walkable: terrain === 's',
  })
  expect(ferryHullEdges([cell(0, 0, 's'), cell(1, 0, '#'), cell(0, 1, '~')])).toEqual([
    [0, 1, 1, 1],
    [1, 1, 2, 1],
    [2, 0, 2, 1],
  ])
})
