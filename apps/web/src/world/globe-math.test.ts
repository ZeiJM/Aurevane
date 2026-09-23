import { expect, it } from 'vitest'
import { globeSectorCenter, projectGlobePoint, unprojectGlobePoint } from './globe-math'
it('centres the player on the actual road sector rather than its parent region', () => {
  expect(globeSectorCenter('S16-08')).toEqual({ longitude: -5.625, latitude: 5.625 })
  expect(globeSectorCenter('S18-08')).toEqual({ longitude: 16.875, latitude: 5.625 })
  for (const coordinate of ['Survey I', 'S00-08', 'S33-08', 'S16-00', 'S16-17', ''])
    expect(globeSectorCenter(coordinate)).toBeNull()
})
it('round trips visible locations through the rotated globe', () => {
  for (const camera of [
    { longitude: 0, latitude: 0 },
    { longitude: 30, latitude: 20 },
    { longitude: -100, latitude: -35 },
  ]) {
    const location = { longitude: camera.longitude + 15, latitude: camera.latitude + 10 }
    const projected = projectGlobePoint(location, camera)
    expect(projected.visible).toBe(true)
    const restored = unprojectGlobePoint(projected.x, projected.y, camera)!
    expect(restored.longitude).toBeCloseTo(location.longitude, 6)
    expect(restored.latitude).toBeCloseTo(location.latitude, 6)
  }
})
it('rejects space and hides the far hemisphere', () => {
  expect(unprojectGlobePoint(2, 0, { longitude: 0, latitude: 0 })).toBeNull()
  expect(
    projectGlobePoint({ longitude: 180, latitude: 0 }, { longitude: 0, latitude: 0 }).visible,
  ).toBe(false)
})
