import { expect, it } from 'vitest'
import { FERRY_DURATION_MS, FERRY_HOUR_MS, FERRY_RETURN_OFFSET_MS } from '@/world/ferry'
import { globeFerryPosition } from './globe-ferry'

it('plots the shared ship on both legs, obscures it by the veil and omits it while docked', () => {
  const dock = { longitude: 176, latitude: -1 }
  const departure = FERRY_HOUR_MS
  const halfway = departure + FERRY_DURATION_MS / 2
  expect(globeFerryPosition(departure, dock)).toEqual(dock)
  expect(globeFerryPosition(halfway, dock)).toEqual({ longitude: 156, latitude: -22 })
  expect(globeFerryPosition(departure + FERRY_DURATION_MS * 0.9, dock)).toBeNull()
  expect(globeFerryPosition(departure + FERRY_DURATION_MS, dock)).toBeNull()
  expect(globeFerryPosition(halfway + FERRY_RETURN_OFFSET_MS, dock)).toEqual(
    globeFerryPosition(halfway, dock),
  )
})
