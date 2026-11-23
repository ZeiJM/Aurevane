import { expect, it } from 'vitest'
import { projectMapPoint, unprojectMapPoint } from './map-projection'
it('round-trips the painted perspective after camera movement, dragging and zoom', () => {
  for (const tile of [33.6, 64, 89.6])
    for (const point of [
      { x: 442.5, y: 130.5 },
      { x: 469, y: 129 },
      { x: 428, y: 144 },
    ]) {
      const camera = { x: 449, y: 131 },
        pan = { x: 3, y: -2 },
        screen = projectMapPoint(point, camera, pan, tile, 1000, 700)
      const restored = unprojectMapPoint(screen, camera, pan, tile, 1000, 700)
      expect(restored.x).toBeCloseTo(point.x, 9)
      expect(restored.y).toBeCloseTo(point.y, 9)
    }
})
