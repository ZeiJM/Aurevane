import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { hashString } from '@/world/terrain-gen'
import type { WorldView } from '@/world/types'
import { atlasNeighbor, WORLD_MAP_WIDTH } from '@/world/topology'
import { MAP_Y, projectMapPoint, unprojectMapPoint } from './map-projection'
import type { MapPoint } from './world-motion'
import type { SurfaceWeather } from './map-water'

export interface CoastEdge {
  side: 0 | 1 | 2 | 3
  from: number
  to: number
  seed: number
  openStart: boolean
  openEnd: boolean
}
const offsets = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const

/** A missing loaded chunk is never an ocean: consult the complete public overview. */
export function buildPublicCoasts(view: Pick<WorldView, 'sectors' | 'atlas'>) {
  const occupied = new Set([
    ...(view.atlas ?? [])
      .filter((cell) => cell.charted)
      .map((cell) => `${cell.column}:${cell.row}`),
    ...view.sectors
      .filter((s) => s.charted && s.atlasColumn !== undefined && s.atlasRow !== undefined)
      .map((s) => `${s.atlasColumn}:${s.atlasRow}`),
  ])
  const field = new Map<string, CoastEdge[]>()
  for (const sector of view.sectors) {
    const edges: CoastEdge[] = []
    field.set(sector.id, edges)
    if (
      !view.atlas ||
      !sector.charted ||
      sector.atlasColumn === undefined ||
      sector.atlasRow === undefined
    )
      continue
    const known = new Map(sector.cells.map((cell) => [`${cell.x}:${cell.y}`, cell.terrain]))
    for (let side = 0; side < 4; side++) {
      const [dx, dy] = offsets[side]!
      const neighbor = atlasNeighbor(sector.atlasColumn, sector.atlasRow, dx, dy)
      if (neighbor && occupied.has(`${neighbor.column}:${neighbor.row}`)) continue
      const length = side % 2 ? GRID_HEIGHT : GRID_WIDTH
      let start: number | null = null
      for (let i = 0; i <= length; i++) {
        const x = side === 1 ? GRID_WIDTH - 1 : side === 3 ? 0 : i,
          y = side === 0 ? 0 : side === 2 ? GRID_HEIGHT - 1 : i,
          terrain = i < length ? known.get(`${x}:${y}`) : undefined,
          land =
            terrain !== undefined &&
            terrain !== '~' &&
            terrain !== 'w' &&
            terrain !== 'l' &&
            terrain !== '?'
        if (land && start === null) start = i
        if (!land && start !== null) {
          edges.push({
            side: side as CoastEdge['side'],
            from: start,
            to: i,
            seed: hashString(`${sector.atlasColumn}:${sector.atlasRow}:${side}`),
            openStart: false,
            openEnd: false,
          })
          start = null
        }
      }
    }
    // An exposed side can end at another occupied chunk or in the middle of
    // its own water channel. Round only the open-sea corners where two full
    // land edges meet and the diagonal has no public terrain.
    const corners = [
      { x: -1, y: -1, horizontal: 0, vertical: 3 },
      { x: 1, y: -1, horizontal: 0, vertical: 1 },
      { x: -1, y: 1, horizontal: 2, vertical: 3 },
      { x: 1, y: 1, horizontal: 2, vertical: 1 },
    ] as const
    for (const corner of corners) {
      const diagonal = atlasNeighbor(sector.atlasColumn, sector.atlasRow, corner.x, corner.y)
      if (diagonal && occupied.has(`${diagonal.column}:${diagonal.row}`)) continue
      const xEnd = corner.x > 0 ? 'openEnd' : 'openStart'
      const yEnd = corner.y > 0 ? 'openEnd' : 'openStart'
      const horizontal = edges.find(
        (edge) =>
          edge.side === corner.horizontal &&
          (corner.x > 0 ? edge.to === GRID_WIDTH : edge.from === 0),
      )
      const vertical = edges.find(
        (edge) =>
          edge.side === corner.vertical &&
          (corner.y > 0 ? edge.to === GRID_HEIGHT : edge.from === 0),
      )
      if (horizontal && vertical) {
        horizontal[xEnd] = true
        vertical[yEnd] = true
      }
    }
  }
  return field
}

/** Positive distance points out to sea. Dry material uses a separate inland pass. */
export function coastPoint(
  edge: CoastEdge,
  t: number,
  distance: number,
): readonly [number, number] {
  const along = edge.from + (edge.to - edge.from) * t,
    // Keep the legal ground intact. This wet apron only extends into public
    // sea, tapering to the authored endpoints and away from the bank's face.
    apron =
      Math.sin(t * Math.PI) ** 2 *
      (0.13 +
        Math.sin(along * 0.81 + edge.seed) * 0.07 +
        Math.sin(along * 1.73 + edge.seed) * 0.04),
    outward =
      distance +
      apron * Math.max(0, 1 - Math.abs(distance) / 0.65) +
      (Math.sin(along * 1.23 + edge.seed) * 0.12 + Math.sin(along * 2.81 + edge.seed) * 0.045) *
        distance *
        Math.sin(t * Math.PI)
  return edge.side === 0
    ? [along, -outward]
    : edge.side === 1
      ? [GRID_WIDTH + outward, along]
      : edge.side === 2
        ? [along, GRID_HEIGHT + outward]
        : [-outward, along]
}
function trace(
  context: CanvasRenderingContext2D,
  edge: CoastEdge,
  tile: number,
  distance: number,
  reverse = false,
) {
  const steps = Math.max(4, (edge.to - edge.from) * 2)
  for (let i = 0; i <= steps; i++) {
    const point = coastPoint(edge, reverse ? 1 - i / steps : i / steps, distance)
    if (i === 0 && !reverse) context.moveTo(point[0] * tile, point[1] * tile)
    else context.lineTo(point[0] * tile, point[1] * tile)
  }
}

type CoastPalette = {
  dry: string
  wet: string
  shelf: string
  stone: string
  width: number
}

const commonCoast: CoastPalette = {
  dry: '181,159,113',
  wet: '#635f4c',
  shelf: '#65998f',
  stone: '#9a947d',
  width: 0.7,
}
const rockyCoast: CoastPalette = {
  dry: '132,129,112',
  wet: '#4c5149',
  shelf: '#578b86',
  stone: '#b3ac96',
  width: 0.44,
}
const regionalCoasts: Record<string, CoastPalette> = {
  frostmere: {
    dry: '165,150,125',
    wet: '#575b54',
    shelf: '#72a3a0',
    stone: '#d0c7b8',
    width: 0.82,
  },
  'hollow-coast': rockyCoast,
  'starfall-highlands': rockyCoast,
  'umbral-march': {
    dry: '104,110,78',
    wet: '#4e5242',
    shelf: '#5a8070',
    stone: '#8b9b78',
    width: 0.56,
  },
  'glasswind-desert': {
    dry: '199,176,130',
    wet: '#77674a',
    shelf: '#6b9f92',
    stone: '#c6b79c',
    width: 0.9,
  },
  emberreach: {
    dry: '110,101,96',
    wet: '#494846',
    shelf: '#638982',
    stone: '#948785',
    width: 0.56,
  },
}

function colourBand(
  context: CanvasRenderingContext2D,
  edge: CoastEdge,
  tile: number,
  from: number,
  to: number,
) {
  // A perpendicular gradient uses the nominal offsets. A perturbed midpoint
  // can leave the far edge tinted where the wavy shelf is narrower.
  const near = coastPoint(edge, 0, from)
  const far = coastPoint(edge, 0, to)
  return context.createLinearGradient(near[0] * tile, near[1] * tile, far[0] * tile, far[1] * tile)
}

function paintBand(
  context: CanvasRenderingContext2D,
  edge: CoastEdge,
  tile: number,
  from: number,
  to: number,
  colour: CanvasGradient | string,
) {
  context.beginPath()
  trace(context, edge, tile, from)
  trace(context, edge, tile, to, true)
  context.closePath()
  context.fillStyle = colour
  context.fill()
}

/** Inland texture must not inherit the sea apron: the raster clips at legal ground. */
function landPoint(edge: CoastEdge, t: number, depth: number): readonly [number, number] {
  const along = edge.from + (edge.to - edge.from) * t
  const inland =
    depth *
    (0.89 + Math.sin(along * 4.3 + edge.seed) * 0.22 + Math.sin(along * 8.1 + edge.seed) * 0.11)
  return edge.side === 0
    ? [along, inland]
    : edge.side === 1
      ? [GRID_WIDTH - inland, along]
      : edge.side === 2
        ? [along, GRID_HEIGHT - inland]
        : [inland, along]
}

function paintLandBand(
  context: CanvasRenderingContext2D,
  edge: CoastEdge,
  tile: number,
  width: number,
  colour: CanvasGradient,
  from = 0,
  to = 1,
  broken = false,
) {
  const steps = Math.max(8, Math.ceil((edge.to - edge.from) * (to - from) * 8))
  context.beginPath()
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i <= steps; i++) {
      const fraction = side ? 1 - i / steps : i / steps
      const t = from + (to - from) * fraction
      // Taper each wrack patch to an inland tip; leave clear sediment gaps.
      const taper = broken ? Math.sin(fraction * Math.PI) : 1
      const depth = side ? 0.04 + width * taper : broken ? 0.04 * Math.max(0, 1 - taper * 2) : 0
      const [x, y] = landPoint(edge, t, depth)
      if (side === 0 && i === 0) context.moveTo(x * tile, y * tile)
      else context.lineTo(x * tile, y * tile)
    }
  }
  context.closePath()
  context.fillStyle = colour
  context.fill()
}

/** Cache dry sediment and stone details with the land raster. */
export function paintCoastLand(
  context: CanvasRenderingContext2D,
  edges: readonly CoastEdge[],
  tile: number,
  regionId: string,
) {
  const palette = regionalCoasts[regionId] ?? commonCoast
  context.save()
  for (const edge of edges) {
    const gradient = colourBand(context, edge, tile, 0, -palette.width)
    gradient.addColorStop(0, `rgba(${palette.dry},.96)`)
    gradient.addColorStop(0.24, `rgba(${palette.dry},.9)`)
    gradient.addColorStop(0.68, `rgba(${palette.dry},.28)`)
    gradient.addColorStop(1, 'transparent')
    paintLandBand(context, edge, tile, palette.width, gradient)
    // Dark wet-sediment tongues reach into legal ground in short, separated
    // patches. They change only the cached surface material: the authored
    // border, walkability and sea apron remain exactly where they were.
    const wash = colourBand(context, edge, tile, 0, -0.72)
    wash.addColorStop(0, palette.wet)
    wash.addColorStop(0.38, `rgba(${palette.dry},.58)`)
    wash.addColorStop(1, 'transparent')
    const washPatches = Math.max(3, Math.ceil((edge.to - edge.from) / 1.7))
    for (let i = 0; i < washPatches; i++) {
      const seed = hashString(`${edge.seed}:${edge.from}:${i}:wash`)
      const from = (i + 0.04 + (seed % 11) / 100) / washPatches
      const to = Math.min(1, (i + 0.5 + ((seed >>> 7) % 19) / 100) / washPatches)
      paintLandBand(context, edge, tile, 0.34 + ((seed >>> 15) % 15) / 100, wash, from, to, true)
    }
    const wrack = colourBand(context, edge, tile, 0, -0.36)
    wrack.addColorStop(0, 'rgba(48,49,44,.72)')
    wrack.addColorStop(0.42, `rgba(${palette.dry},.51)`)
    wrack.addColorStop(1, 'rgba(48,49,44,0)')
    const patches = Math.ceil((edge.to - edge.from) * 1.6)
    for (let i = 0; i < patches; i++) {
      const seed = hashString(`${edge.seed}:${edge.from}:${i}:wrack`)
      const from = (i + 0.06 + (seed % 13) / 100) / patches
      const to = (i + 0.62 + ((seed >>> 8) % 21) / 100) / patches
      paintLandBand(context, edge, tile, 0.12 + (seed % 19) / 100, wrack, from, to, true)
    }
    context.fillStyle = palette.stone
    const count = (edge.to - edge.from) * 5
    for (let i = 0; i < count; i++) {
      const seed = hashString(`${edge.seed}:${edge.from}:${i}:gravel`)
      const fraction = (i + (seed % 79) / 79) / count
      const [x, y] = landPoint(edge, fraction, 0.09 + ((seed >>> 8) % 47) / 100)
      const size = tile * (0.015 + ((seed >>> 16) % 42) / 1000)
      context.globalAlpha = 0.15 + (seed % 23) / 100
      context.fillRect(x * tile, y * tile, size * 1.6, size)
      if (seed % 7 === 0)
        context.fillRect((x + 0.025) * tile, (y - 0.045) * tile, size * 0.9, size * 1.25)
    }
    context.globalAlpha = 1
    // Rooted tufts interrupt long grassy or marshy banks while rocky and cold
    // shores keep their more exposed silhouettes.
    if (
      regionId === 'verdant-expanse' ||
      regionId === 'hollow-coast' ||
      regionId === 'umbral-march'
    ) {
      context.beginPath()
      context.strokeStyle =
        regionId === 'hollow-coast' ? 'rgba(141,149,109,.56)' : 'rgba(103,119,66,.62)'
      context.lineWidth = tile * 0.012
      for (let i = 0; i < edge.to - edge.from; i++) {
        const seed = hashString(`${edge.seed}:${edge.from + i}:reeds`)
        if (seed % 5 < 2) continue
        const t = (i + 0.24 + (seed % 47) / 100) / (edge.to - edge.from)
        const [x, y] = landPoint(edge, t, 0.25 + (seed % 19) / 100)
        for (let blade = -1; blade <= 1; blade++) {
          context.moveTo((x + blade * 0.025) * tile, y * tile)
          context.lineTo((x + blade * 0.062) * tile, (y - 0.09 - (seed % 7) / 100) * tile)
        }
      }
      context.stroke()
    }
  }
  context.restore()
}

const SHELF_DEPTH = 2.65
// The outline varies by at most 16.5%. Finish fading inside its shallowest dip
// so a deep shelf cannot paint over the shallows from an adjoining coastline.
const SHELF_BLEND = SHELF_DEPTH * 0.82
function shelfStops(gradient: CanvasGradient, palette: CoastPalette) {
  gradient.addColorStop(0, palette.wet)
  gradient.addColorStop(0.18, palette.shelf)
  gradient.addColorStop(0.56, 'rgba(57,107,115,.82)')
  gradient.addColorStop(1, 'rgba(40,75,87,0)')
}
function paintOpenCorner(
  context: CanvasRenderingContext2D,
  edge: CoastEdge,
  tile: number,
  end: 0 | 1,
  palette: CoastPalette,
) {
  const [x, y] = coastPoint(edge, end, 0)
  const cx = x * tile
  const cy = y * tile
  const size = SHELF_DEPTH * tile
  const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, SHELF_BLEND * tile)
  shelfStops(gradient, palette)
  context.fillStyle = gradient
  context.fillRect(cx + (end === 0 ? -size : 0), cy + (edge.side === 0 ? -size : 0), size, size)
}

/** Paint the submerged shelf outside legal ground. Only the surf phase varies. */
export function paintCoastSea(
  context: CanvasRenderingContext2D,
  edges: readonly CoastEdge[],
  tile: number,
  now: number,
  animate: boolean,
  budget = 16,
  regionId = '',
  waves = 3,
  windSpeed = 0,
) {
  const roughness = animate ? Math.min(1, Math.abs(windSpeed) / 0.055) : 0
  const visibleEdges = edges.slice(0, Math.max(0, Math.min(16, budget)))
  const palette = regionalCoasts[regionId] ?? commonCoast
  context.save()
  context.lineCap = 'butt'
  for (const edge of visibleEdges) {
    if (edge.side === 0 || edge.side === 2) {
      if (edge.openStart) paintOpenCorner(context, edge, tile, 0, palette)
      if (edge.openEnd) paintOpenCorner(context, edge, tile, 1, palette)
    }
    const gradient = colourBand(context, edge, tile, 0, SHELF_BLEND)
    shelfStops(gradient, palette)
    paintBand(context, edge, tile, 0, SHELF_DEPTH, gradient)
    // The cached dry raster ends at the rectangular sector border. Back the
    // curved wet lip before that raster is drawn, so the border cannot show
    // through as a straight gap between land and the displaced shallows.
    const lip = colourBand(context, edge, tile, -0.3, 0.3)
    lip.addColorStop(0, `rgb(${palette.dry})`)
    lip.addColorStop(0.45, `rgb(${palette.dry})`)
    lip.addColorStop(1, palette.wet)
    paintBand(context, edge, tile, -0.3, 0, lip)
    // Long swell groups occasionally break; gusts strengthen them, never add crests.
    const swellPhase = animate
      ? (now / (23000 + (edge.seed % 7000)) + (edge.seed % 131) / 131) % 1
      : 0
    const breaker = animate ? Math.max(0, Math.sin(swellPhase * Math.PI * 2)) ** 8 : 0
    for (let wave = 0; wave < Math.max(0, Math.min(3, waves)); wave++) {
      const phase = animate
        ? (now / (9600 + (edge.seed % 2000)) + wave / waves + (edge.seed % 97) / 97) % 1
        : (wave + 1) / (waves + 1)
      context.globalAlpha =
        Math.sin(phase * Math.PI) * (0.22 + roughness * 0.17 + breaker * (0.16 + roughness * 0.12))
      context.strokeStyle = '#d1e3cd'
      context.lineWidth = tile * (0.013 + roughness * 0.01 + breaker * (0.022 + roughness * 0.026))
      context.beginPath()
      trace(context, edge, tile, 0.08 + (1 - phase) * (1.15 + roughness * 0.62))
      context.stroke()
    }
    context.globalAlpha = 1
  }
  context.restore()
  return visibleEdges.length
}

/** Screen-space ocean background, drawn before land; no geography is consulted.
 * `camera` is the effective camera + pan centre in world tiles.
 */
export function paintOpenSea(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  tile: number,
  camera: MapPoint,
  now: number,
  animate: boolean,
  weather?: SurfaceWeather,
  budget = 48,
) {
  if (
    ![width, height, tile, camera.x, camera.y].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    tile <= 0
  )
    return 0
  const origin = { x: 0, y: 0 }
  const project = (point: MapPoint) => projectMapPoint(point, camera, origin, tile, width, height)
  const bands = Math.min(20, Math.max(2, Math.ceil(height / (tile * MAP_Y * 64)) + 2))
  const band = Math.floor((camera.x + camera.y) / 64) - Math.floor(bands / 2)
  const a = project({ x: band * 32, y: band * 32 }),
    b = project({ x: (band + bands) * 32, y: (band + bands) * 32 })
  context.save()
  // Broad repeating depth bands retain their world phase during camera motion.
  const depth = context.createLinearGradient(a.x, a.y, b.x, b.y)
  for (let i = 0; i < bands; i++) {
    depth.addColorStop(i / bands, '#173f53')
    depth.addColorStop((i + 0.5) / bands, '#285e70')
  }
  depth.addColorStop(1, '#173f53')
  context.fillStyle = depth
  context.fillRect(0, 0, width, height)
  const limit = Number.isFinite(budget) ? Math.max(0, Math.min(48, Math.floor(budget))) : 0
  if (!limit) {
    context.restore()
    return 0
  }
  const corners = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ].map(([x, y]) => unprojectMapPoint({ x: x!, y: y! }, camera, origin, tile, width, height))
  const left = Math.min(...corners.map((p) => p.x)),
    right = Math.max(...corners.map((p) => p.x))
  const top = Math.min(...corners.map((p) => p.y)),
    bottom = Math.max(...corners.map((p) => p.y))
  const required = Math.sqrt(((right - left) * (bottom - top)) / Math.max(1, limit * 0.8))
  const spacing = 4 * 2 ** Math.max(0, Math.ceil(Math.log2(required / 4)))
  const roughness = animate ? Math.min(1, Math.abs(weather?.windSpeed ?? 0) / 0.06) : 0
  const rain = animate ? Math.max(0, Math.min(1, weather?.rain ?? 0)) : 0
  const clock = animate && Number.isFinite(now) ? now : 0
  let count = 0,
    attempts = 0
  context.lineCap = 'round'
  for (let y = Math.floor(top / spacing); y <= Math.ceil(bottom / spacing) && count < limit; y++) {
    for (
      let x = Math.floor(left / spacing);
      x <= Math.ceil(right / spacing) && count < limit;
      x++
    ) {
      if (++attempts > 128) break
      const wx = x * spacing,
        wy = y * spacing
      const canonicalX = ((wx % WORLD_MAP_WIDTH) + WORLD_MAP_WIDTH) % WORLD_MAP_WIDTH
      const seed = hashString(`${canonicalX}:${wy}:open-sea`)
      const centre = {
        x: wx + spacing * (0.15 + (seed % 127) / 181),
        y: wy + spacing * (0.15 + ((seed >>> 8) % 127) / 181),
      }
      const p = project(centre)
      if (p.x < -tile * 2 || p.x > width + tile * 2 || p.y < -tile * 2 || p.y > height + tile * 2)
        continue
      const phase = (clock / (10000 + (seed % 7000)) + (seed % 997) / 997) % 1
      const length = 0.65 + (seed % 191) / 100
      const bend = Math.sin(phase * Math.PI * 2) * (0.025 + roughness * 0.06)
      const start = project({ x: centre.x - length / 2, y: centre.y + length / 2 })
      const c1 = project({ x: centre.x - length / 6 + bend, y: centre.y + length / 6 + bend })
      const c2 = project({ x: centre.x + length / 6 + bend, y: centre.y - length / 6 + bend })
      const end = project({ x: centre.x + length / 2, y: centre.y - length / 2 })
      context.globalAlpha = (0.08 + roughness * 0.14) * (0.45 + Math.sin(phase * Math.PI) * 0.55)
      context.strokeStyle = seed % 3 ? '#a6cbd0' : '#6fa9b9'
      context.lineWidth = Math.max(0.45, tile * 0.008) * (1 + roughness * 0.8)
      context.beginPath()
      context.moveTo(start.x, start.y)
      context.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y)
      // Sparse rain rings share the same fixed crest budget.
      if (rain > 0.015 && seed % 3 === 0 && phase < 0.35) {
        const radius = tile * (0.015 + phase * 0.25)
        context.ellipse(p.x, p.y, radius, radius * 0.52, 0, 0, Math.PI * 2)
      }
      context.stroke()
      count++
    }
    if (attempts > 128) break
  }
  context.restore()
  return count
}
