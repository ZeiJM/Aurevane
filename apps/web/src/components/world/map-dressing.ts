import type { WorldCell, WorldSectorView } from '@/world/types'
import type { WorldWeather } from '@/world/environment'
import { hashString } from '@/world/terrain-gen'

export type DressingSheet =
  | 'settlement-dressing'
  | 'town-centres-north'
  | 'town-centres-south'
  | 'void-dressing'
  | 'void-relics'
  | 'void-frontier'
  | 'wild-verges'
  | 'hamlet-dressing'
export interface ScenicDressing {
  x: number
  y: number
  sheet: DressingSheet
  index: number
  glow?: string
}

type SetPiece = readonly [DressingSheet, number, number, number]
const townCentres: Partial<Record<string, SetPiece>> = {
  'aureth-crown': ['town-centres-north', 0, 5, 6],
  'verdant-expanse': ['town-centres-north', 1, 3, 6],
  frostmere: ['town-centres-north', 2, 8, 6],
  'starfall-highlands': ['town-centres-north', 3, 7, 2],
  emberreach: ['town-centres-south', 0, 6, 2],
  'glasswind-desert': ['town-centres-south', 1, 5, 6],
  'hollow-coast': ['town-centres-south', 2, 9, 6],
  'umbral-march': ['town-centres-south', 3, 3, 6],
}

const hamletWork: Partial<Record<string, number>> = {
  'Hayward Farmstead': 0,
  "Millers' Rest": 1,
  'Thistledown Farm': 2,
  'Brookside Steading': 3,
}

export const hamletFamilyIndex = (name: string) => hamletWork[name]

const voidGlow = {
  haven: '#cfe8bd',
  ashen: '#f89557',
  fracture: '#c5d7fa',
  amber: '#ffe18d',
  amethyst: '#deabfb',
  wayfarer: '#e9ce99',
} as const

type Point = Pick<WorldCell, 'x' | 'y'>
const distance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

export function sceneryDressing(sector: WorldSectorView): ScenicDressing[] {
  if (sector.id.startsWith('ferry:')) return []
  if (sector.warpedTheme) {
    const focal = sector.warpedScenery
    return !sector.charted &&
      focal &&
      sector.cells.some(({ x, y, walkable }) => walkable && x === focal.x && y === focal.y)
      ? [{ ...focal, glow: voidGlow[sector.warpedTheme] }]
      : []
  }

  const market = sector.landmarks.find(({ kind }) => kind === 'marketplace')
  const smallSettlement = sector.landmarks.find(({ kind }) => kind === 'hamlet')
  const building = sector.buildings?.find(({ artIndex }) => artIndex === 2)
  const bridge = sector.landmarks.find(({ kind }) => kind === 'bridge')
  const shore = sector.cells.filter(({ terrain }) => terrain === '~')
  const dressing: ScenicDressing[] = []

  const place = (
    sheet: DressingSheet,
    index: number,
    anchor: Point,
    {
      shoreOnly = false,
      sideGround = false,
      glow,
    }: {
      shoreOnly?: boolean
      sideGround?: boolean
      glow?: string
    } = {},
  ) => {
    let point: WorldCell | undefined
    let closest = Infinity
    for (const cell of sector.cells) {
      const span = distance(cell, anchor)
      if (
        span > 4 ||
        span >= closest ||
        !cell.walkable ||
        (cell.terrain !== '.' && cell.terrain !== 's') ||
        (sector.townId && !cell.safe) ||
        (sideGround && Math.abs(cell.y - 4) <= 1) ||
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
    if (point) dressing.push({ x: point.x, y: point.y, sheet, index, ...(glow ? { glow } : {}) })
  }

  if (!sector.townId && !smallSettlement) return []
  const center = market ?? smallSettlement ?? building
  if (!center) return []
  switch (sector.regionId) {
    case 'frostmere':
      place('settlement-dressing', 0, bridge ?? center, { shoreOnly: true })
      if (building) place('settlement-dressing', 1, building)
      break
    case 'verdant-expanse':
      place('settlement-dressing', 2, center)
      break
    case 'hollow-coast':
      place('settlement-dressing', 3, bridge ?? center, { shoreOnly: true })
      break
  }
  const focus = townCentres[sector.regionId]
  if (focus && sector.id === sector.townId) {
    const [sheet, index, x, y] = focus
    place(sheet, index, { x, y }, { sideGround: true })
  }
  if (smallSettlement) {
    const index = hamletFamilyIndex(smallSettlement.name)
    if (index !== undefined) place('hamlet-dressing', index, smallSettlement)
  }
  return dressing
}

const wildernessPlants: Partial<Record<string, number>> = {
  'aureth-crown': 0,
  'verdant-expanse': 0,
  'umbral-march': 0,
  frostmere: 2,
  'starfall-highlands': 2,
  'glasswind-desert': 3,
}

/** Sparse scenery from known natural ground only. */
export function naturalDressing(sector: WorldSectorView): ScenicDressing[] {
  if (sector.townId || sector.warpedTheme || !sector.charted) return []
  const species = wildernessPlants[sector.regionId]
  const shore = sector.cells.filter(({ terrain }) => terrain === '~')
  const patches: { prop: ScenicDressing; seed: number }[] = []
  for (const cell of sector.cells) {
    if (cell.safe || !cell.walkable || cell.terrain !== '.') continue
    if (sector.landmarks.some((landmark) => distance(landmark, cell) < 2)) continue
    const waterside = shore.some((edge) => distance(edge, cell) === 1)
    const index = waterside && (species === 0 || sector.regionId === 'hollow-coast') ? 1 : species
    if (index === undefined) continue
    const seed = hashString(`${sector.id}:${cell.x}:${cell.y}:undergrowth`)
    if (!waterside && seed % 13 !== 0) continue
    patches.push({ prop: { x: cell.x, y: cell.y, sheet: 'wild-verges', index }, seed })
  }
  const result: ScenicDressing[] = []
  for (const { prop } of patches.sort((a, b) => a.seed - b.seed)) {
    if (result.some((other) => distance(other, prop) < 3)) continue
    result.push(prop)
    if (result.length === 2) break
  }
  return result
}

const northLights = [
  [0.5, 0.75, '175,224,217'],
  [0.1, 0.48, '255,195,115'],
  [0.41, 0.52, '255,194,109'],
  [0.5, 0.44, '204,211,255'],
] as const
const southLights = [
  [0.48, 0.68, '255,124,53'],
  [0.53, 0.68, '158,217,225'],
  [0.35, 0.31, '255,204,109'],
  [0.2, 0.55, '135,222,221'],
] as const

/** Local reflections and warm light, independent of geometry and movement. */
export function paintTownLight(
  ctx: CanvasRenderingContext2D,
  sheet: 'town-centres-north' | 'town-centres-south',
  index: number,
  left: number,
  top: number,
  size: number,
  now: number,
  weather: WorldWeather,
  night: boolean,
) {
  const [u, v, colour] = (sheet === 'town-centres-north' ? northLights : southLights)[index]!
  const x = left + size * u
  const y = top + size * v
  const radius = size * (weather === 'fog' ? 0.22 : 0.13)
  const pulse = 0.65 + 0.35 * Math.sin(now / 340 + index * 1.9)
  const strength = (night ? 0.27 : 0.16) * pulse
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius)
  glow.addColorStop(0, `rgba(${colour},${strength})`)
  glow.addColorStop(1, `rgba(${colour},0)`)
  ctx.fillStyle = glow
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
}

/** A few local sparks stay within the scenery budget and follow the shared wind. */
export function paintVoidGlimmer(
  ctx: CanvasRenderingContext2D,
  glow: string,
  x: number,
  y: number,
  size: number,
  now: number,
  seed: number,
  wind: number,
  weather: WorldWeather,
) {
  ctx.save()
  ctx.fillStyle = glow
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
