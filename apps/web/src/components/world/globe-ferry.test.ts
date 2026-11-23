import { expect, it } from 'vitest'
import { FERRY_DURATION_MS, FERRY_HOUR_MS, FERRY_RETURN_OFFSET_MS } from '@/world/ferry'
import { globeFerryPosition } from './globe-ferry'

it('plots the shared ship on both legs, obscures it by the veil and omits it while docked', () => {
  const dock = { longitude: 176, latitude: -1 }
  const departure = FERRY_HOUR_MS
  const halfway = departure + FERRY_DURATION_MS / 2
  expect(globeFerryPosition(departure, dock)).toEqual(dock)
  expect(globeFerryPosition(halfway, dock)).toEqual({ longitude: 169.5, latitude: -11.5 })
  expect(globeFerryPosition(departure + FERRY_DURATION_MS * 0.9, dock)).toBeNull()
  expect(globeFerryPosition(departure + FERRY_DURATION_MS, dock)).toBeNull()
  expect(globeFerryPosition(halfway + FERRY_RETURN_OFFSET_MS, dock)).toEqual(
    globeFerryPosition(halfway, dock),
  )
})

it('plots the northern ferry between its two public docks in both directions', () => {
  const dock = { longitude: 170, latitude: 10 }
  const coast = { longitude: -170, latitude: 50 }
  const hour = 3600_000 * 500_000
  expect(globeFerryPosition(hour + 15 * 60_000, dock, coast)).toEqual(dock)
  expect(globeFerryPosition(hour + 45 * 60_000, dock, coast)).toEqual(coast)
  expect(globeFerryPosition(hour + 17.5 * 60_000, dock, coast)).toEqual({
    longitude: -180,
    latitude: 30,
  })
  expect(globeFerryPosition(hour + 20 * 60_000, dock, coast)).toBeNull()
})
