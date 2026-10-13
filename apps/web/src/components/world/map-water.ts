import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { hashString } from '@/world/terrain-gen'
import type { WorldCell as TerrainCell, WorldSectorView } from '@/world/types'

type Point = readonly [number, number]
type Curve = readonly [Point, Point, Point, Point]
type Side = 0 | 1 | 2 | 3
/** Source-art channel coordinates: only the falling water moves, never its rocks. */
export function waterfallHighlights(now: number) {
  return Array.from({ length: 8 }, (_, i) => {
    const lower = i >= 4,
      phase = (now / (820 + i * 39) + (i % 4) / 4) % 1
    return {
      x: (lower ? 0.48 : 0.47) + ((i % 3) - 1) * 0.013,
      y: (lower ? 0.51 : 0.32) + phase * 0.13,
      length: 0.022,
      alpha: Math.sin(phase * Math.PI) * 0.32,
    }
  })
}
export function paintWaterfallMotion(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  now: number,
) {
  context.save()
  context.strokeStyle = '#e4f6f1'
  context.lineCap = 'round'
  context.lineWidth = Math.max(0.6, width * 0.007)
  for (const point of waterfallHighlights(now)) {
    context.globalAlpha = point.alpha
    context.beginPath()
    context.moveTo(x + point.x * width, y + point.y * height)
    context.lineTo(x + point.x * width, y + (point.y + point.length) * height)
    context.stroke()
  }
  const phase = (now / 2400) % 1
  context.globalAlpha = (1 - phase) * 0.18
  context.beginPath()
  context.ellipse(
    x + width * 0.49,
    y + height * 0.78,
    width * (0.05 + phase * 0.12),
    height * (0.015 + phase * 0.025),
    0,
    0,
    Math.PI * 2,
  )
  context.stroke()
  context.restore()
}
interface Bank {
  side: Side
  edge: Curve[]
  shallow: Curve[]
}
export interface WaterCell {
  x: number
  y: number
  seed: number
  channel: boolean
  banks: Bank[]
  flow: Curve
}
interface WaterSector {
  key: string
  cells: Map<string, WaterCell>
}
const directions = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const
const cellKey = (x: number, y: number) => `${x}:${y}`
const bankPoint = (side: Side, along: number, inset: number): Point =>
  side === 0
    ? [along, inset]
    : side === 1
      ? [1 - inset, along]
      : side === 2
        ? [along, 1 - inset]
        : [inset, along]

function bankCurves(side: Side, worldX: number, worldY: number, shallow: boolean): Curve[] {
  const vertical = side === 1 || side === 3
  const along = vertical ? worldY : worldX
  const across = vertical ? worldX + Number(side === 1) : worldY + Number(side === 2)
  const inset = (t: number) => {
    const phase = (along + t) * 1.7 + across * 0.43
    return (
      (shallow ? 0.15 : 0.025) +
      Math.sin(phase) * (shallow ? 0.035 : 0.013) +
      Math.sin(phase * 2.3) * 0.008
    )
  }
  const derivative = (t: number) => {
    const phase = (along + t) * 1.7 + across * 0.43
    return (
      Math.cos(phase) * 1.7 * (shallow ? 0.035 : 0.013) + Math.cos(phase * 2.3) * 1.7 * 2.3 * 0.008
    )
  }
  return [0, 0.5].map((t) => [
    bankPoint(side, t, inset(t)),
    bankPoint(side, t + 1 / 6, inset(t) + derivative(t) / 6),
    bankPoint(side, t + 1 / 3, inset(t + 0.5) - derivative(t + 0.5) / 6),
    bankPoint(side, t + 0.5, inset(t + 0.5)),
  ])
}

function currentCurve(worldX: number, worldY: number, connected: boolean[]): Curve {
  let start: Side = 0,
    end: Side = 2
  if (connected[0] && connected[2]) {
    start = 0
    end = 2
  } else if (connected[1] && connected[3]) {
    start = 3
    end = 1
  } else if (connected[0] && connected[1]) {
    start = 0
    end = 1
  } else if (connected[3] && connected[2]) {
    start = 3
    end = 2
  } else if (connected[0] && connected[3]) {
    start = 0
    end = 3
  } else if (connected[2] && connected[1]) {
    start = 1
    end = 2
  } else if (connected[1] || connected[3]) {
    start = 3
    end = 1
  }
  const port = (side: Side): Point => {
    const vertical = side === 0 || side === 2
    // Both cells sharing an edge evaluate exactly the same world-space port.
    const along = vertical ? worldY + Number(side === 2) : worldX + Number(side === 1)
    const across = vertical ? worldX : worldY
    return bankPoint(side, 0.5 + Math.sin(along * 0.67 + across * 0.31) * 0.065, 0)
  }
  const a = port(start),
    b = port(end)
  const inward = (p: Point, side: Side): Point => [
    p[0] - directions[side][0] * 0.42,
    p[1] - directions[side][1] * 0.42,
  ]
  return [a, inward(a, start), inward(b, end), b]
}

/** Only supplied cells participate. Private/legacy sectors have their own namespace. */
export function buildWaterField(sectors: readonly WorldSectorView[]): Map<string, WaterSector> {
  const terrain = new Map<string, TerrainCell>()
  const namespace = (sector: WorldSectorView) =>
    sector.charted && sector.atlasColumn !== undefined && sector.atlasRow !== undefined
      ? 'atlas'
      : sector.id
  for (const sector of sectors) {
    const ox = (sector.atlasColumn ?? 0) * GRID_WIDTH,
      oy = (sector.atlasRow ?? 0) * GRID_HEIGHT
    for (const cell of sector.cells)
      terrain.set(`${namespace(sector)}:${cellKey(ox + cell.x, oy + cell.y)}`, cell)
  }
  const field = new Map<string, WaterSector>()
  for (const sector of sectors) {
    const cells = new Map<string, WaterCell>()
    const ox = (sector.atlasColumn ?? 0) * GRID_WIDTH,
      oy = (sector.atlasRow ?? 0) * GRID_HEIGHT
    for (const cell of sector.cells) {
      if (cell.terrain !== '~') continue
      const wx = ox + cell.x,
        wy = oy + cell.y
      const neighbours = directions.map(([dx, dy]) => {
        const at = (distance: number) =>
          terrain.get(`${namespace(sector)}:${cellKey(wx + dx * distance, wy + dy * distance)}`)
        const neighbour = at(1)
        if (neighbour?.terrain === '=' && neighbour.walkable)
          for (let distance = 2; distance <= 4; distance++) {
            const next = at(distance)
            // The dry bridge remains dry and legal. Only a supplied water
            // endpoint proves that this bank continues beneath its deck.
            if (next?.terrain === '~') return '~'
            if (next?.terrain !== '=' || !next.walkable) break
          }
        return neighbour?.terrain
      })
      const banks: Bank[] = []
      neighbours.forEach((material, side) => {
        // Unknown cells are neither invented land nor an exposed shoreline.
        if (material === undefined || material === '~') return
        banks.push({
          side: side as Side,
          edge: bankCurves(side as Side, wx, wy, false),
          shallow: bankCurves(side as Side, wx, wy, true),
        })
      })
      cells.set(cellKey(cell.x, cell.y), {
        x: cell.x,
        y: cell.y,
        seed: hashString(`${namespace(sector)}:${wx}:${wy}:water`),
        channel: neighbours.filter((material) => material === '~').length <= 2,
        banks,
        flow: currentCurve(
          wx,
          wy,
          neighbours.map((material) => material === '~'),
        ),
      })
    }
    // Adjacent changes must invalidate a cached bank even when its own cells are identical.
    field.set(sector.id, { key: JSON.stringify([...cells.values()]), cells })
  }
  return field
}

function trace(context: CanvasRenderingContext2D, curve: Curve, tile: number, move = true) {
  if (move) context.moveTo(curve[0][0] * tile, curve[0][1] * tile)
  context.bezierCurveTo(
    curve[1][0] * tile,
    curve[1][1] * tile,
    curve[2][0] * tile,
    curve[2][1] * tile,
    curve[3][0] * tile,
    curve[3][1] * tile,
  )
}
function sample(curve: Curve, t: number) {
  const u = 1 - t
  return {
    x:
      u ** 3 * curve[0][0] +
      3 * u * u * t * curve[1][0] +
      3 * u * t * t * curve[2][0] +
      t ** 3 * curve[3][0],
    y:
      u ** 3 * curve[0][1] +
      3 * u * u * t * curve[1][1] +
      3 * u * t * t * curve[2][1] +
      t ** 3 * curve[3][1],
    dx:
      3 * u * u * (curve[1][0] - curve[0][0]) +
      6 * u * t * (curve[2][0] - curve[1][0]) +
      3 * t * t * (curve[3][0] - curve[2][0]),
    dy:
      3 * u * u * (curve[1][1] - curve[0][1]) +
      6 * u * t * (curve[2][1] - curve[1][1]) +
      3 * t * t * (curve[3][1] - curve[2][1]),
  }
}
function stream(curve: Curve, from: number, to: number, offset: number): Curve {
  const a = sample(curve, from),
    b = sample(curve, to),
    interval = (to - from) / 3
  const shift = (point: typeof a): Point => {
    const length = Math.hypot(point.dx, point.dy) || 1
    return [point.x - (point.dy / length) * offset, point.y + (point.dx / length) * offset]
  }
  const p = shift(a),
    q = shift(b)
  return [
    p,
    [p[0] + a.dx * interval, p[1] + a.dy * interval],
    [q[0] - b.dx * interval, q[1] - b.dy * interval],
    q,
  ]
}
function clipCell(context: CanvasRenderingContext2D, tile: number) {
  context.beginPath()
  context.rect(0, 0, tile, tile)
  context.clip()
  context.lineCap = 'round'
  context.lineJoin = 'round'
}

/** Static depth, reflected colour and broken filaments belong in the ground cache. */
export function paintWaterGround(context: CanvasRenderingContext2D, cell: WaterCell, tile: number) {
  context.save()
  context.translate(cell.x * tile, cell.y * tile)
  clipCell(context, tile)
  if (cell.channel) {
    for (const width of [0.76, 0.58, 0.36]) {
      context.beginPath()
      trace(context, cell.flow, tile)
      context.lineWidth = tile * width
      context.strokeStyle = 'rgba(9,47,58,.09)'
      context.stroke()
    }
  }
  for (const bank of cell.banks) {
    const vertical = bank.side === 1 || bank.side === 3
    const start = bankPoint(bank.side, 0.5, 0),
      end = bankPoint(bank.side, 0.5, 0.2)
    const gradient = context.createLinearGradient(
      start[0] * tile,
      start[1] * tile,
      end[0] * tile,
      end[1] * tile,
    )
    gradient.addColorStop(0, 'rgba(40,51,35,.85)')
    gradient.addColorStop(0.16, 'rgba(125,133,79,.63)')
    gradient.addColorStop(0.38, 'rgba(93,157,124,.54)')
    gradient.addColorStop(0.72, 'rgba(101,174,155,.31)')
    gradient.addColorStop(1, 'rgba(97,174,161,0)')
    context.beginPath()
    const a = bankPoint(bank.side, 0, 0),
      b = bankPoint(bank.side, 1, 0)
    context.moveTo(a[0] * tile, a[1] * tile)
    context.lineTo(b[0] * tile, b[1] * tile)
    for (const curve of [...bank.shallow].reverse()) {
      context.lineTo(curve[3][0] * tile, curve[3][1] * tile)
      trace(context, [curve[3], curve[2], curve[1], curve[0]], tile, false)
    }
    context.closePath()
    context.fillStyle = gradient
    context.fill()
    context.beginPath()
    bank.edge.forEach((curve, i) => trace(context, curve, tile, i === 0))
    context.strokeStyle = vertical ? 'rgba(195,195,130,.48)' : 'rgba(181,199,147,.37)'
    context.lineWidth = tile * 0.022
    context.stroke()
    // A wide transparent rim adds bank depth without a hard straight outline.
    context.strokeStyle = 'rgba(12,55,54,.21)'
    context.lineWidth = tile * 0.065
    context.stroke()
  }
  const colours = [
    'rgba(137,199,180,.20)',
    'rgba(191,215,177,.13)',
    'rgba(13,67,78,.20)',
    'rgba(181,220,205,.27)',
  ]
  for (let i = 0; i < 19; i++) {
    const salt = hashString(`${cell.seed}:${i}`),
      from = ((salt % 8191) / 8191) * 0.88
    const offset = (((salt >>> 13) % 1021) / 1021 - 0.5) * 0.66
    context.beginPath()
    trace(
      context,
      stream(cell.flow, from, Math.min(1, from + 0.07 + (i % 4) * 0.025), offset),
      tile,
    )
    context.strokeStyle = colours[i % colours.length]!
    context.lineWidth = tile * (i % 5 === 0 ? 0.045 : 0.009)
    context.stroke()
  }
  context.restore()
}

/** Four short travelling glints follow the cached current; work stays capped by the caller. */
export function paintWaterMotion(
  context: CanvasRenderingContext2D,
  cell: WaterCell,
  tile: number,
  now: number,
) {
  context.save()
  clipCell(context, tile)
  const speed = 8500 + (cell.seed % 3500)
  for (let i = 0; i < 4; i++) {
    const phase = (now / speed + i * 0.25 + (cell.seed % 997) / 997) % 1
    const from = phase * 0.86,
      offset = (i - 1.5) * 0.13
    context.globalAlpha = Math.sin(phase * Math.PI) * (i === 1 ? 0.54 : 0.3)
    context.strokeStyle = i % 2 ? '#bbded0' : '#82c6c7'
    context.lineWidth = tile * (i === 1 ? 0.014 : 0.009)
    context.beginPath()
    trace(context, stream(cell.flow, from, from + 0.09, offset), tile)
    context.stroke()
  }
  context.restore()
}
