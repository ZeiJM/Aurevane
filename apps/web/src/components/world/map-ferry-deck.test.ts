import type { FerryPassage } from '@/world/ferry'
import { expect, it } from 'vitest'
import { ferrySeaSighting, ferryVesselVersion, ferryWaterFrame } from './map-ferry-deck'

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

it('moves even in still weather, leaves the departure shore and approaches the destination shore', () => {
  const calm = { speed: 0, offset: 0 }
  const frame = (serverNow: number) => ferryWaterFrame(passage, serverNow, 500, calm, true)
  expect(frame(9_999)).toMatchObject({
    advance: 0,
    shore: { coast: 'pine', arriving: false, offset: 0 },
  })
  expect(frame(21_000)).toMatchObject({
    advance: 264,
    shore: { coast: 'pine', arriving: false, offset: 0.5 },
  })
  expect(frame(32_000)).toMatchObject({ advance: 528, shore: null })
  expect(frame(298_000).shore).toEqual({ coast: 'cliff', arriving: true, offset: 0.5 })
  expect(ferryWaterFrame(passage, 298_000, 500, calm, false)).toMatchObject({
    advance: 0,
    shore: { coast: 'cliff', arriving: true, offset: 0 },
  })
})

it('selects stable but varied wildlife per sailing and leaves both coasts clear', () => {
  const sightings = (trip: FerryPassage) =>
    Array.from({ length: 300 }, (_, second) => ferrySeaSighting(trip, second))
  const first = sightings(passage)
  expect(first).toEqual(sightings(passage))
  expect(first).not.toEqual(sightings({ ...passage, departureAt: passage.departureAt + 3_600_000 }))
  expect(
    new Set(first.flatMap((sighting) => (sighting ? [sighting.kind] : []))).size,
  ).toBeGreaterThan(1)
  expect(first.slice(0, 25).every((sighting) => sighting === null)).toBe(true)
  expect(first.slice(271).every((sighting) => sighting === null)).toBe(true)
})

it('keeps the vessel stable per sailing and uses the full fleet over time', () => {
  const trips = Array.from(
    { length: 24 },
    (_, hour) => `ferry:outbound:${1_800_000_000_000 + hour * 3_600_000}`,
  )
  expect(trips.map(ferryVesselVersion)).toEqual(trips.map(ferryVesselVersion))
  expect(new Set(trips.map(ferryVesselVersion))).toEqual(new Set(['v02', 'v03', 'v04']))
})
