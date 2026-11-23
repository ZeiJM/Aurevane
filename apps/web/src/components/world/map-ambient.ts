import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import type { WorldWeather, worldDayPhase } from '@/world/environment'
import type { WorldSectorView } from '@/world/types'
import { hashString, seeded } from '@/world/terrain-gen'

export interface Wildlife {
  seed: number
  index: number
  flying: boolean
  path: { x: number; y: number }[]
}
const FOX = 4
const DEER = 5
const HARE = 6
const SHORE_BIRD = 7
const woods = new Set(['aureth-crown', 'verdant-expanse', 'frostmere', 'umbral-march'])
const shore = new Set(['aureth-crown', 'verdant-expanse', 'frostmere', 'hollow-coast'])
const snowfields = new Set(['frostmere', 'starfall-highlands'])
const steps = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const
const tileKey = (x: number, y: number) => y * GRID_WIDTH + x
const inBounds = (x: number, y: number) => x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT

function addBuffer(cells: Set<number>, cx: number, cy: number, radius: number) {
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = Math.abs(dy) - radius; dx <= radius - Math.abs(dy); dx++)
      if (inBounds(cx + dx, cy + dy)) cells.add(tileKey(cx + dx, cy + dy))
}

/** Decoration only. Both the spawn and its route stay inside the same local habitat. */
export function createWildlife(sector: WorldSectorView): Wildlife[] {
  if (sector.townId || sector.warpedTheme || sector.id.startsWith('ferry:')) return []
  const wooded = woods.has(sector.regionId)
  const coastal = shore.has(sector.regionId)
  const snowy = snowfields.has(sector.regionId)
  if (!wooded && !coastal && !snowy) return []

  const excluded = new Set<number>()
  const water = new Set<number>()
  const trees = new Set<number>()
  for (const cell of sector.cells) {
    if (cell.safe) addBuffer(excluded, cell.x, cell.y, 6)
    else if (cell.terrain === '=') addBuffer(excluded, cell.x, cell.y, 2)
    if (coastal && cell.terrain === '~') addBuffer(water, cell.x, cell.y, 2)
    if (cell.terrain === 't') addBuffer(trees, cell.x, cell.y, 2)
  }
  for (const landmark of sector.landmarks)
    if (landmark.kind === 'hamlet' || landmark.kind === 'settlement')
      addBuffer(excluded, landmark.x, landmark.y, 6)

  const habitats = new Map<number, readonly number[]>()
  const ground = sector.cells.filter((cell) => {
    const key = tileKey(cell.x, cell.y)
    if (!cell.walkable || cell.terrain !== '.' || excluded.has(key)) return false
    const species = water.has(key)
      ? [SHORE_BIRD]
      : trees.has(key)
        ? wooded
          ? [FOX, DEER]
          : []
        : snowy
          ? [HARE]
          : []
    if (species.length === 0) return false
    habitats.set(key, species)
    return true
  })
  const random = seeded(sector.id + ':wildlife')
  const cell = ground[Math.floor(random() * ground.length)]
  if (!cell) return []
  const species = habitats.get(tileKey(cell.x, cell.y))!
  const index = species[Math.floor(random() * species.length)]!
  const route = [{ x: cell.x, y: cell.y }]
  for (let step = 0; step < 3; step++) {
    const previous = route[route.length - 1]!
    const choices = steps
      .map(([dx, dy]) => ({ x: previous.x + dx, y: previous.y + dy }))
      .filter(
        ({ x, y }) =>
          inBounds(x, y) &&
          habitats.get(tileKey(x, y))?.includes(index) &&
          !route.some((point) => point.x === x && point.y === y),
      )
    const next = choices[Math.floor(random() * choices.length)]
    if (!next) break
    route.push(next)
  }
  if (route.length < 2) return []
  return [
    {
      seed: hashString(sector.id + ':0'),
      index,
      flying: index === SHORE_BIRD,
      path: route.map(({ x, y }) => ({ x: x + 0.5, y: y + 0.5 })),
    },
  ]
}

export function wildlifeVisible(
  animal: Wildlife,
  daylight: ReturnType<typeof worldDayPhase>,
  weather: WorldWeather,
) {
  if (animal.index === DEER && daylight !== 'Dusk') return false
  if (animal.index === HARE && daylight !== 'Dawn') return false
  return (weather !== 'storm' && weather !== 'fog') || animal.seed % 3 === 0
}
export interface WildlifePose {
  x: number
  y: number
  moving: boolean
  facing: number
  bob: number
  gait: number
  step: number
  hop: number
  crouch: number
  wing: number
}

export function wildlifePose(animal: Wildlife, now: number, animate: boolean): WildlifePose {
  // Reflect the route by index; do not allocate a reversed route on every frame.
  const segments = Math.max(1, (animal.path.length - 1) * 2)
  const travel = animal.flying ? 5800 : 2200 + (animal.seed % 1700)
  const pause = animal.flying ? 0 : 1300 + (animal.seed % 2000)
  const clock = animate ? (now + (animal.seed % 17000)) / (travel + pause) : 0
  const segment = Math.floor(clock) % segments
  const next = (segment + 1) % segments
  const from = animal.path[Math.min(segment, segments - segment)]!,
    to = animal.path[Math.min(next, segments - next)]!
  const progress = animate ? Math.min(1, ((clock % 1) * (travel + pause)) / travel) : 0
  const eased = progress * progress * (3 - 2 * progress)
  const moving = animate && progress > 0 && progress < 1
  const step = moving ? Math.sin(progress * Math.PI) : 0
  // Ground route edges are one legal tile: four fox strides / three deer or rabbit strides.
  const gait = moving ? (eased * (animal.index === 4 ? 4 : 3)) % 1 : 0
  const bounce = Math.sin(gait * Math.PI * 2) * step
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
    moving,
    facing: to.x - to.y >= from.x - from.y ? 1 : -1,
    bob: animate && animal.flying ? Math.sin(now / 260 + animal.seed) * 2.5 : 0,
    gait,
    step,
    hop: animal.index === 6 ? Math.max(0, bounce) : 0,
    crouch: animal.index === 6 ? Math.max(0, -bounce) : 0,
    wing: animate && animal.flying ? Math.sin(now / 110 + animal.seed) : 0,
  }
}

/** Irregular, feathered cloud silhouette rasterized once, not blurred every frame. */
export function createCloudTexture(seed: string) {
  const layer = document.createElement('canvas')
  layer.width = 384
  layer.height = 192
  const ctx = layer.getContext('2d')!
  const random = seeded(seed)
  for (let i = 0; i < 22; i++) {
    const x = 50 + random() * 284,
      y = 45 + random() * 100,
      radius = 22 + random() * 52
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, 'rgba(16,30,39,.13)')
    gradient.addColorStop(0.5, 'rgba(16,30,39,.075)')
    gradient.addColorStop(1, 'rgba(16,30,39,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }
  return layer
}
