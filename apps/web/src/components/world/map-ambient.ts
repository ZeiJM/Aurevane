import type { WorldSectorView } from '@/world/types'
import { hashString, seeded } from '@/world/terrain-gen'

export interface Wildlife {
  seed: number
  index: number
  flying: boolean
  path: { x: number; y: number }[]
}
/** Decoration only: ground paths use projected legal cells, never player commands. */
export function createWildlife(sector: WorldSectorView): Wildlife[] {
  const random = seeded(sector.id + ':wildlife')
  const ground = sector.cells.filter((c) => c.walkable && (c.terrain === '.' || c.terrain === '='))
  const cells = new Map(ground.map((c) => [`${c.x}:${c.y}`, c]))
  const animals: Wildlife[] = []
  for (let i = 0; i < (sector.townId ? 1 : 3); i++) {
    const cell = ground[Math.floor(random() * ground.length)]
    if (!cell) continue
    const flying = i === 0
    const path = [{ x: cell.x + 0.5, y: cell.y + 0.5 }]
    if (flying) path.push({ x: cell.x + 3.5, y: cell.y + 2.5 })
    else {
      for (let j = 0; j < 3; j++) {
        const p = path[path.length - 1]!
        const choices = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]
          .map(([x, y]) => ({ x: p.x + x!, y: p.y + y! }))
          .filter(
            (p) =>
              cells.has(`${Math.floor(p.x)}:${Math.floor(p.y)}`) &&
              !path.some((q) => p.x === q.x && p.y === q.y),
          )
        const next = choices[Math.floor(random() * choices.length)]
        if (!next) break
        path.push(next)
      }
    }
    if (path.length < 2) continue
    animals.push({
      seed: hashString(sector.id + ':' + i),
      index: flying ? 7 : 4 + Math.floor(random() * 3),
      flying,
      path,
    })
  }
  return animals
}
export function wildlifePose(animal: Wildlife, now: number, animate: boolean) {
  const path = [...animal.path, ...animal.path.slice(1, -1).reverse()]
  const travel = animal.flying ? 5800 : 2200 + (animal.seed % 1700)
  const pause = animal.flying ? 0 : 1300 + (animal.seed % 2000)
  const clock = animate ? (now + (animal.seed % 17000)) / (travel + pause) : 0
  const segment = Math.floor(clock) % path.length
  const from = path[segment]!,
    to = path[(segment + 1) % path.length]!
  const progress = animate ? Math.min(1, ((clock % 1) * (travel + pause)) / travel) : 0
  const eased = progress * progress * (3 - 2 * progress)
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
    moving: animate && progress < 1,
    facing: to.x - to.y >= from.x - from.y ? 1 : -1,
    bob: animate
      ? Math.sin(now / (animal.flying ? 260 : 180) + animal.seed) *
        (animal.flying ? 2.5 : progress < 1 ? 0.9 : 0.15)
      : 0,
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
