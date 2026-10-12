import { expect, it } from 'vitest'
import { projectWorld } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import { createWildlife, wildlifePose } from './map-ambient'
import { vi } from 'vitest'
vi.mock('server-only', () => ({}))

it('wanders along legal connected ground with pauses instead of sliding in place', () => {
  const sector = projectWorld(newWorldState(), [], 1000).sectors[0]!
  const wildlife = createWildlife({ ...sector, townId: undefined })
  const animal = wildlife.find((a) => !a.flying)!
  expect(animal.path.length).toBeGreaterThan(1)
  const poses = Array.from({ length: 120 }, (_, i) => wildlifePose(animal, i * 300, true))
  const xs = poses.map((p) => p.x),
    ys = poses.map((p) => p.y)
  expect(Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.8)
  expect(poses.some((p) => !p.moving)).toBe(true)
  for (const p of poses) {
    expect(
      sector.cells.find((c) => c.x === Math.floor(p.x) && c.y === Math.floor(p.y))?.walkable,
    ).toBe(true)
  }
  expect(wildlifePose(animal, 12000, false)).toEqual(wildlifePose(animal, 0, false))
})
