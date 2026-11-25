import { expect, it } from 'vitest'
import { FERRY_DURATION_MS, FERRY_RETURN_OFFSET_MS, nextFerryDeparture } from '@/world/ferry'
import { globeFerryPosition, UNCHARTED_FERRY_CHART_LOCATION } from './globe-ferry'

it('plots both legs to the illustrated harbor and omits the ship while docked', () => {
  const dock = { longitude: 176, latitude: -1 }
  const departure = nextFerryDeparture('mainland', 1_800_000_000_000)
  const halfway = departure + FERRY_DURATION_MS / 2
  expect(globeFerryPosition(departure, dock)).toEqual(dock)
  expect(globeFerryPosition(halfway, dock)).toEqual({ longitude: 169.5, latitude: -13.325 })
  expect(globeFerryPosition(departure + FERRY_DURATION_MS * 0.9, dock)?.latitude).toBeCloseTo(
    -23.185,
  )
  expect(globeFerryPosition(departure + FERRY_DURATION_MS, dock)).toBeNull()
  expect(globeFerryPosition(departure + FERRY_RETURN_OFFSET_MS, dock)).toEqual(
    UNCHARTED_FERRY_CHART_LOCATION,
  )
  expect(globeFerryPosition(halfway + FERRY_RETURN_OFFSET_MS, dock)).toEqual(
    globeFerryPosition(halfway, dock),
  )
})

it('plots the northern ferry between its two public docks in both directions', () => {
  const dock = { longitude: 170, latitude: 10 }
  const coast = { longitude: -170, latitude: 50 }
  const departure = nextFerryDeparture('north-shore', 1_800_000_000_000)
  expect(globeFerryPosition(departure, dock, coast)).toEqual(dock)
  expect(globeFerryPosition(departure + FERRY_RETURN_OFFSET_MS, dock, coast)).toEqual(coast)
  expect(globeFerryPosition(departure + FERRY_DURATION_MS / 2, dock, coast)).toEqual({
    longitude: -180,
    latitude: 30,
  })
  expect(globeFerryPosition(departure + FERRY_DURATION_MS, dock, coast)).toBeNull()
})
