import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { hashString } from '@/world/terrain-gen'
import type { WorldView } from '@/world/types'
import { atlasNeighbor } from '@/world/topology'

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
    ...(view.atlas ?? []).map((cell) => `${cell.column}:${cell.row}`),
    ...view.sectors
      .filter((s) => s.atlasColumn !== undefined && s.atlasRow !== undefined)
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
          land = terrain !== undefined && terrain !== '~' && terrain !== 'l'
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
    outward =
      distance +
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
  colour: CanvasGradient,
) {
  context.beginPath()
  trace(context, edge, tile, from)
  trace(context, edge, tile, to, true)
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
    gradient.addColorStop(0, palette.wet)
    gradient.addColorStop(0.24, `rgba(${palette.dry},.9)`)
    gradient.addColorStop(0.68, `rgba(${palette.dry},.28)`)
    gradient.addColorStop(1, 'transparent')
    paintBand(context, edge, tile, 0, -palette.width, gradient)
    const wrack = colourBand(context, edge, tile, 0, -0.18)
    wrack.addColorStop(0, 'rgba(48,49,44,.72)')
    wrack.addColorStop(1, 'rgba(48,49,44,0)')
    paintBand(context, edge, tile, 0, -0.22, wrack)
    // A narrow irregular face gives the dry bank relief where it meets the water.
    const face = colourBand(context, edge, tile, 0, -0.15)
    face.addColorStop(0, 'rgba(37,38,32,.55)')
    face.addColorStop(0.43, `rgba(${palette.dry},.51)`)
    face.addColorStop(1, 'transparent')
    paintBand(context, edge, tile, 0, -0.18, face)
    context.fillStyle = palette.stone
    const count = (edge.to - edge.from) * 5
    for (let i = 0; i < count; i++) {
      const seed = hashString(`${edge.seed}:${edge.from}:${i}:gravel`)
      const fraction = (i + (seed % 79) / 79) / count
      const [x, y] = coastPoint(edge, fraction, -0.09 - ((seed >>> 8) % 47) / 100)
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
        const [x, y] = coastPoint(edge, t, -0.25 - (seed % 19) / 100)
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
    for (let wave = 0; wave < waves; wave++) {
      const phase = animate
        ? (now / (9600 + (edge.seed % 2000)) + wave / waves + (edge.seed % 97) / 97) % 1
        : (wave + 1) / (waves + 1)
      context.globalAlpha = Math.sin(phase * Math.PI) * (0.22 + roughness * 0.17)
      context.strokeStyle = '#d1e3cd'
      context.lineWidth = tile * (0.013 + roughness * 0.01)
      context.beginPath()
      trace(context, edge, tile, 0.08 + phase * (1.15 + roughness * 0.62))
      context.stroke()
    }
    context.globalAlpha = 1
  }
  context.restore()
  return visibleEdges.length
}
