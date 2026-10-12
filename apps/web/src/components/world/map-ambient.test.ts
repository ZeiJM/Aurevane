import { expect, it } from 'vitest'
import { projectWorld } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import { createWildlife, wildlifePose, type Wildlife } from './map-ambient'
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

it('drives visible strides from ground distance and settles every gait during a pause', () => {
  const fox: Wildlife = {
    seed: 0,
    index: 4,
    flying: false,
    path: [
      { x: 0.5, y: 0.5 },
      { x: 1.5, y: 0.5 },
    ],
  }
  const first = wildlifePose(fox, 550, true)
  const next = wildlifePose(fox, 900, true)
  expect(first.gait).toBeGreaterThan(0)
  expect(next.gait).not.toBe(first.gait)
  expect(first.step).toBeGreaterThan(0)
  expect(first.bob).toBe(0)
  expect(wildlifePose(fox, 2500, true)).toEqual(wildlifePose(fox, 3100, true))
  expect(wildlifePose(fox, 2500, true).step).toBe(0)
  expect(wildlifePose(fox, 12000, false)).toEqual(wildlifePose(fox, 0, false))
})

it('crouches and hops only while a rabbit travels, and reverses on its connected route', () => {
  const rabbit: Wildlife = {
    seed: 0,
    index: 6,
    flying: false,
    path: [
      { x: 0.5, y: 0.5 },
      { x: 1.5, y: 0.5 },
      { x: 1.5, y: 1.5 },
    ],
  }
  const poses = Array.from({ length: 20 }, (_, i) => wildlifePose(rabbit, i * 110, true))
  expect(poses.some((pose) => pose.hop > 0.25)).toBe(true)
  expect(poses.some((pose) => pose.crouch > 0.1)).toBe(true)
  expect(wildlifePose(rabbit, 2500, true).hop).toBe(0)
  expect(wildlifePose(rabbit, 2500, true).crouch).toBe(0)
  expect(wildlifePose(rabbit, 11000, true).facing).toBe(-1)
})
