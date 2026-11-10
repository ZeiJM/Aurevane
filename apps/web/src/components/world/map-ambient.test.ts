import { expect, it, vi } from 'vitest'
import { projectWorld } from '@/server/world/world-service'
import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { newWorldState } from '@/world/travel'
import { createWildlife, wildlifePose, wildlifeVisible, type Wildlife } from './map-ambient'
vi.mock('server-only', () => ({}))

const town = projectWorld(newWorldState(), [], 1000).sectors[0]!
function countryside(regionId: string, terrain: (x: number, y: number) => string = () => '.') {
  return {
    ...town,
    id: 'habitat',
    townId: undefined,
    landmarks: [],
    regionId,
    cells: Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, (_, index) => {
      const x = index % GRID_WIDTH
      const y = Math.floor(index / GRID_WIDTH)
      const ground = terrain(x, y)
      return { x, y, terrain: ground, safe: ground === 's', walkable: ground !== '~' }
    }),
  }
}

function population(sector: ReturnType<typeof countryside>) {
  return Array.from({ length: 60 }, (_, i) =>
    createWildlife({ ...sector, id: `${sector.id}-${i}` }),
  ).flat()
}

it('keeps wildlife sparse across countryside while retaining independently seeded animals', () => {
  const sector = countryside('verdant-expanse', (x) => (x < 2 ? '~' : x >= 9 ? 't' : '.'))
  const wildlife = Array.from({ length: 30 }, (_, i) =>
    createWildlife({ ...sector, id: 'density-' + i }),
  )
  expect(wildlife.every((animals) => animals.length <= 1)).toBe(true)
  expect(wildlife.flat().some((animal) => animal.flying)).toBe(true)
  expect(wildlife.flat().some((animal) => !animal.flying)).toBe(true)
  expect(createWildlife(sector)).toEqual(createWildlife(sector))
})

it('wanders along legal connected ground with pauses instead of sliding in place', () => {
  const sector = countryside('frostmere')
  const wildlife = createWildlife(sector)
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

it('keeps wildlife out of town districts, ferry decks and private Void terrain', () => {
  const sector = countryside('frostmere')
  expect(createWildlife({ ...sector, townId: 'frostmere' })).toEqual([])
  expect(createWildlife({ ...sector, id: 'ferry:test' })).toEqual([])
  expect(createWildlife({ ...sector, warpedTheme: 'haven' })).toEqual([])
})

it('uses shore, woodland and open snow species only in their allowed habitats', () => {
  const shore = population(countryside('hollow-coast', (x) => (x < 2 ? '~' : '.')))
  const woods = population(countryside('verdant-expanse', (x) => (x % 2 === 0 ? 't' : '.')))
  const snow = population(countryside('frostmere'))

  expect(new Set(shore.map(({ index }) => index))).toEqual(new Set([7]))
  expect(new Set(woods.map(({ index }) => index))).toEqual(new Set([4, 5]))
  expect(new Set(snow.map(({ index }) => index))).toEqual(new Set([6]))
  expect(population(countryside('glasswind-desert'))).toEqual([])
  expect(shore.every(({ path }) => path.every(({ x }) => x >= 2 && x < 4))).toBe(true)
})

it('keeps every route point outside the local road and protected ground buffers', () => {
  const sector = countryside('frostmere', (x) => (x === 3 ? '=' : x === 10 ? 's' : '.'))
  const animals = population(sector)
  expect(animals.length).toBeGreaterThan(0)
  for (const { path } of animals)
    expect(path.every(({ x }) => Math.abs(Math.floor(x) - 3) > 2 && Math.floor(x) < 10)).toBe(true)
})

it('uses shared daylight and weather for when animals appear', () => {
  const deer: Wildlife = { seed: 1, index: 5, flying: false, path: [] }
  const hare: Wildlife = { ...deer, index: 6 }
  expect(wildlifeVisible(deer, 'Dusk', 'clear')).toBe(true)
  expect(wildlifeVisible(deer, 'Day', 'clear')).toBe(false)
  expect(wildlifeVisible(hare, 'Dawn', 'clear')).toBe(true)
  expect(wildlifeVisible(hare, 'Night', 'clear')).toBe(false)
  expect(wildlifeVisible(deer, 'Dusk', 'storm')).toBe(false)
  expect(wildlifeVisible({ ...deer, seed: 3 }, 'Dusk', 'fog')).toBe(true)
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
