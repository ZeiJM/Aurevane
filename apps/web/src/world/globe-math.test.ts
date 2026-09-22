import { expect, it } from 'vitest'
import { projectGlobePoint, unprojectGlobePoint } from './globe-math'
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
