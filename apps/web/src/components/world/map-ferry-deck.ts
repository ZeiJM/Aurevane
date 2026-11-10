import type { FerryPassage } from '@/world/ferry'
import { hashString } from '@/world/terrain-gen'
import type { WorldSectorView } from '@/world/types'
import type { WorldWind } from './map-weather'

type DeckCell = WorldSectorView['cells'][number]
type HullEdge = readonly [x1: number, y1: number, x2: number, y2: number]
type ProjectDeckPoint = (x: number, y: number) => { x: number; y: number }

export function ferryWaterFrame(
  passage: FerryPassage | undefined,
  serverNow: number,
  now: number,
  wind: WorldWind,
  animate: boolean,
) {
  return {
    underway: Boolean(passage && serverNow >= passage.departureAt && serverNow < passage.arrivalAt),
    chop: Math.min(1, Math.abs(wind.speed) / 0.055),
    phase: animate ? now / 1_000 : 0,
    drift: animate ? wind.offset : 0,
    wind: wind.speed,
  }
}

type FerryWaterFrame = ReturnType<typeof ferryWaterFrame>

export function ferryHullEdges(cells: readonly DeckCell[]): HullEdge[] {
  const deck = new Set(
    cells.filter(({ terrain }) => terrain !== '~').map(({ x, y }) => `${x}:${y}`),
  )
  const edges: HullEdge[] = []
  for (const { x, y, terrain } of cells) {
    if (terrain === '~') continue
    if (!deck.has(`${x}:${y + 1}`)) edges.push([x, y + 1, x + 1, y + 1])
    if (!deck.has(`${x + 1}:${y}`)) edges.push([x + 1, y, x + 1, y + 1])
  }
  return edges
}

const hullEdges = new WeakMap<readonly DeckCell[], HullEdge[]>()

export function paintFerrySea(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: FerryWaterFrame,
  lowDetail: boolean,
) {
  const depth = context.createLinearGradient(0, 0, width * 0.2, height)
  depth.addColorStop(0, '#386774')
  depth.addColorStop(0.55, '#254f60')
  depth.addColorStop(1, '#173a4d')
  context.fillStyle = depth
  context.fillRect(0, 0, width, height)

  // The open sea is screen-space scenery. The ferry's deck never drifts with it.
  const waveCount = lowDetail ? 18 : 42
  const wrap = (value: number, span: number) => ((value % span) + span) % span
  context.lineWidth = 0.8
  for (let i = 0; i < waveCount; i++) {
    const depth = ((i * 43) % 97) / 97
    const x = wrap(i * 173.17 + frame.drift * (0.17 + depth * 0.16), width + 72) - 36
    const y = wrap(i * 103.63, height + 20) - 10
    const length = 12 + depth * 48
    const lift = Math.sin(frame.phase * (1.4 + depth) + i) * (2 + frame.chop * 3)
    const alpha = (0.11 + depth * 0.1) * (0.65 + frame.chop * 0.65)
    context.strokeStyle = `rgba(164,213,210,${alpha})`
    context.beginPath()
    context.moveTo(x, y)
    context.quadraticCurveTo(x + length * 0.42, y - 4 + lift, x + length, y + lift * 0.6)
    context.stroke()
  }
}

export function paintFerryHull(
  context: CanvasRenderingContext2D,
  cells: readonly DeckCell[],
  project: ProjectDeckPoint,
  tile: number,
  frame: FerryWaterFrame,
  lowDetail: boolean,
) {
  const stern = project(1.25, 4.5)
  const bow = project(11.75, 4.5)
  const span = Math.hypot(bow.x - stern.x, bow.y - stern.y)
  const dx = (bow.x - stern.x) / span
  const dy = (bow.y - stern.y) / span
  const hullDepth = Math.max(6, tile * 0.58)
  context.save()
  context.translate(stern.x, stern.y + hullDepth * 0.7)
  context.rotate(Math.atan2(dy, dx))
  if (frame.underway) {
    const wash = lowDetail ? 2 : 4
    for (const side of [-1, 1]) {
      for (let i = 0; i < wash; i++) {
        const length = tile * (2.1 + i * 0.76)
        const spread = tile * side * (0.32 + i * 0.19)
        const drift = Math.sin(frame.phase * 2.4 - i * 1.7) * tile * (0.07 + frame.chop * 0.08)
        context.strokeStyle = `rgba(199,233,222,${0.53 - i * 0.09})`
        context.lineWidth = Math.max(1, tile * (0.035 - i * 0.004))
        context.beginPath()
        context.moveTo(tile * 0.42, spread * 0.5)
        context.bezierCurveTo(
          -length * 0.24,
          spread * 0.25 + drift,
          -length * 0.72,
          spread * 1.6 - drift,
          -length,
          spread * 2 + drift,
        )
        context.stroke()
      }
    }
  }
  context.restore()

  let edges = hullEdges.get(cells)
  if (!edges) {
    edges = ferryHullEdges(cells)
    hullEdges.set(cells, edges)
  }
  for (const [x1, y1, x2, y2] of edges) {
    const a = project(x1, y1)
    const b = project(x2, y2)
    const finish = context.createLinearGradient(0, a.y, 0, a.y + hullDepth)
    finish.addColorStop(0, x1 === x2 ? '#75543a' : '#926a46')
    finish.addColorStop(0.6, '#4b3330')
    finish.addColorStop(1, '#292a2c')
    context.fillStyle = finish
    context.beginPath()
    context.moveTo(a.x, a.y - 1)
    context.lineTo(b.x, b.y - 1)
    context.lineTo(b.x, b.y + hullDepth)
    context.lineTo(a.x, a.y + hullDepth)
    context.closePath()
    context.fill()
    context.strokeStyle = '#342d2d'
    context.lineWidth = Math.max(1, hullDepth * 0.14)
    context.beginPath()
    context.moveTo(a.x, a.y + hullDepth * 0.36)
    context.lineTo(b.x, b.y + hullDepth * 0.36)
    context.moveTo(a.x, a.y + hullDepth * 0.79)
    context.lineTo(b.x, b.y + hullDepth * 0.79)
    context.stroke()
  }
}

export function paintFerryRig(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  frame: FerryWaterFrame,
) {
  const reach = size * (0.11 + frame.chop * 0.085)
  const lift = Math.sin(frame.phase * (4 + frame.chop * 4)) * size * (0.012 + frame.chop * 0.025)
  context.save()
  context.translate(x, y)
  if (frame.underway) {
    // Both ties stay on the yard. The free edge bellies toward the bow and
    // relaxes in light wind. Keep the cloth on the existing mast depth slot.
    const billow = (0.04 + frame.chop * 0.028) * Math.sin(frame.phase * 3.3)
    const fabric = context.createLinearGradient(-size * 0.21, size * 0.22, size * 0.2, size * 0.6)
    fabric.addColorStop(0, '#eee0b3')
    fabric.addColorStop(0.52, '#c8aa71')
    fabric.addColorStop(1, '#8d6946')
    context.fillStyle = fabric
    context.strokeStyle = '#6f5638'
    context.lineWidth = Math.max(0.8, size * 0.012)
    context.beginPath()
    context.moveTo(-size * 0.225, size * 0.2)
    context.lineTo(size * 0.16, size * 0.315)
    context.quadraticCurveTo(
      size * (0.27 + billow),
      size * 0.43,
      size * (0.13 + billow),
      size * 0.6,
    )
    context.quadraticCurveTo(-size * 0.09, size * (0.51 + billow), -size * 0.27, size * 0.46)
    context.quadraticCurveTo(-size * (0.19 - billow), size * 0.33, -size * 0.225, size * 0.2)
    context.closePath()
    context.fill()
    context.stroke()
    context.strokeStyle = 'rgba(247,224,175,.6)'
    context.lineWidth = Math.max(0.6, size * 0.006)
    context.beginPath()
    context.moveTo(-size * 0.1, size * 0.24)
    context.quadraticCurveTo(-size * (0.03 - billow), size * 0.37, -size * 0.12, size * 0.5)
    context.moveTo(size * 0.04, size * 0.28)
    context.quadraticCurveTo(size * (0.12 + billow), size * 0.44, size * 0.025, size * 0.55)
    context.stroke()
  }
  if (frame.wind < 0) context.scale(-1, 1)
  context.fillStyle = '#9c493d'
  context.strokeStyle = '#542e27'
  context.lineWidth = Math.max(0.6, size * 0.005)
  context.beginPath()
  context.moveTo(0, 0)
  context.quadraticCurveTo(reach * 0.55, lift, reach, size * 0.012 + lift)
  context.lineTo(reach * 0.79, size * 0.036 + lift)
  context.lineTo(reach, size * 0.068 + lift)
  context.quadraticCurveTo(reach * 0.52, size * 0.055, 0, size * 0.06)
  context.closePath()
  context.fill()
  context.stroke()
  context.restore()
}

/** Cached deck material and brass gunwale, projected with the existing square tile. */
export function paintFerryDeck(
  context: CanvasRenderingContext2D,
  cell: DeckCell,
  tile: number,
  deck: ReadonlySet<string>,
) {
  const x = cell.x * tile
  const y = cell.y * tile
  const wood = ['#846044', '#8e6849', '#9a7651', '#90654a']
  const plank = tile / 7
  for (let row = 0; row < 7; row++) {
    const seed = hashString(`deck:${cell.x}:${cell.y}:${row}`)
    context.fillStyle = wood[seed % wood.length]!
    context.fillRect(x, y + row * plank, tile + 0.5, plank + 0.5)
    context.fillStyle = 'rgba(46,29,23,.35)'
    context.fillRect(x, y + (row + 1) * plank - 0.7, tile, 0.7)
    context.fillStyle = 'rgba(224,184,126,.28)'
    context.fillRect(x + ((seed >>> 8) % 13) * (tile / 24), y + row * plank + 2, tile * 0.38, 0.7)
  }
  const rim = Math.max(2, tile * 0.07)
  const edge = (left: number, top: number, width: number, height: number) => {
    context.fillStyle = '#382c29'
    context.fillRect(left, top, width, height)
    context.fillStyle = '#ad8e54'
    context.fillRect(left + 0.6, top + 0.6, Math.max(1, width - 1.2), Math.max(1, height - 1.2))
    context.fillStyle = '#e1bb75'
    const stud = Math.max(1, rim * 0.46)
    context.fillRect(left + (width - stud) / 2, top + (height - stud) / 2, stud, stud)
  }
  if (!deck.has(`${cell.x - 1}:${cell.y}`)) edge(x, y, rim, tile)
  if (!deck.has(`${cell.x + 1}:${cell.y}`)) edge(x + tile - rim, y, rim, tile)
  if (!deck.has(`${cell.x}:${cell.y - 1}`)) edge(x, y, tile, rim)
  if (!deck.has(`${cell.x}:${cell.y + 1}`)) edge(x, y + tile - rim, tile, rim)
}
