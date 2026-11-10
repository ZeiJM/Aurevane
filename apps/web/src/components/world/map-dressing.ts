import type { WorldCell, WorldSectorView } from '@/world/types'
import type { WorldWeather } from '@/world/environment'

export type DressingSheet = 'settlement-dressing' | 'void-dressing'
export interface ScenicDressing {
  x: number
  y: number
  sheet: DressingSheet
  index: number
}

const voidDressing = {
  haven: 0,
  ashen: 1,
  fracture: 2,
  amber: 3,
  amethyst: 3,
  wayfarer: undefined,
} as const

type Point = Pick<WorldCell, 'x' | 'y'>
const distance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

export function sceneryDressing(sector: WorldSectorView): ScenicDressing[] {
  if (sector.id.startsWith('ferry:')) return []
  const market = sector.landmarks.find(({ kind }) => kind === 'marketplace')
  const smallSettlement = sector.landmarks.find(({ kind }) => kind === 'hamlet')
  const building = sector.buildings?.find(({ artIndex }) => artIndex === 2)
  const bridge = sector.landmarks.find(({ kind }) => kind === 'bridge')
  const shore = sector.cells.filter(({ terrain }) => terrain === '~')
  const dressing: ScenicDressing[] = []

  const place = (sheet: DressingSheet, index: number, anchor: Point, shoreOnly = false) => {
    let point: WorldCell | undefined
    let closest = Infinity
    for (const cell of sector.cells) {
      const span = distance(cell, anchor)
      if (
        span < 1 ||
        span > 4 ||
        span >= closest ||
        !cell.walkable ||
        (cell.terrain !== '.' && cell.terrain !== 's') ||
        (sheet === 'settlement-dressing' && sector.townId && !cell.safe) ||
        (shoreOnly && !shore.some((edge) => distance(edge, cell) <= 2)) ||
        sector.landmarks.some((landmark) => distance(landmark, cell) < 2) ||
        sector.buildings?.some(
          (structure) =>
            cell.x >= structure.x &&
            cell.x < structure.x + structure.width &&
            cell.y >= structure.y &&
            cell.y < structure.y + structure.height,
        ) ||
        dressing.some((prop) => distance(prop, cell) < 2)
      )
        continue
      closest = span
      point = cell
    }
    if (point) dressing.push({ x: point.x, y: point.y, sheet, index })
  }

  if (sector.warpedTheme) {
    if (sector.charted) return []
    const index = voidDressing[sector.warpedTheme]
    const feature = sector.landmarks.find(({ warpedArt }) => warpedArt !== undefined)
    if (index !== undefined && feature) place('void-dressing', index, feature)
    return dressing
  }
  if (!sector.townId && !smallSettlement) return []
  const center = market ?? smallSettlement ?? building
  if (!center) return []
  switch (sector.regionId) {
    case 'frostmere':
      place('settlement-dressing', 0, bridge ?? center, true)
      if (building) place('settlement-dressing', 1, building)
      break
    case 'verdant-expanse':
      place('settlement-dressing', 2, center)
      break
    case 'hollow-coast':
      place('settlement-dressing', 3, bridge ?? center, true)
      break
  }
  return dressing
}

/** A few local sparks stay within the scenery budget and follow the shared wind. */
export function paintVoidGlimmer(
  ctx: CanvasRenderingContext2D,
  index: number,
  x: number,
  y: number,
  size: number,
  now: number,
  seed: number,
  wind: number,
  weather: WorldWeather,
) {
  ctx.save()
  ctx.fillStyle = ['#cfe8bd', '#f89557', '#c5d7fa', '#ffe18d'][index]!
  const strength = weather === 'storm' || weather === 'fog' ? 0.3 : 0.55
  for (let mote = 0; mote < 3; mote++) {
    const drift = (now / (1750 + mote * 220) + (seed % 79) / 79 + mote / 3) % 1
    ctx.globalAlpha = Math.sin(drift * Math.PI) * strength
    const left = x + size * (0.32 + mote * 0.17) + drift * wind * 220
    const top = y + size * (0.72 - drift * 0.55)
    const radius = Math.max(0.8, size * 0.02)
    ctx.fillRect(left, top, radius, radius)
  }
  ctx.restore()
}
