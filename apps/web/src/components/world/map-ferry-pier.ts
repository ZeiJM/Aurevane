import type { FerryShoreSide } from '@/world/ferry'
import type { MapPoint } from './world-motion'

const seaward: Record<FerryShoreSide, MapPoint> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
}

export function ferryPierPlacement(
  dock: MapPoint,
  shoreSide: FerryShoreSide,
  waterAt: (point: MapPoint) => boolean,
) {
  const normal = seaward[shoreSide]
  const at = (distance: number) => ({
    x: dock.x + normal.x * distance,
    y: dock.y + normal.y * distance,
  })
  let first = 1
  while (first <= 8 && !waterAt(at(first))) first++
  if (first > 8) return null

  // Follow a single surveyed run outward from shore. The pier's half-width
  // fits inside one water cell and the outermost piles stay short of its edge.
  let tiles = 1
  while (tiles < 4 && waterAt(at(first + tiles))) tiles++
  const from = at(first - 0.57)
  const length = tiles - 0.08
  const to = at(first + tiles - 0.65)
  const cross = { x: -normal.y, y: normal.x }
  const pier = { from, to, normal, cross, length }
  // The hull runs parallel to the jetty. Prefer the bankward side of the
  // painted sail's projection so the hull can stay close to the outer piles.
  const preferredSide = shoreSide === 'north' ? -1 : 1
  for (const side of [preferredSide, -preferredSide]) {
    const clearance = side === preferredSide ? 1.27 : 4.05
    for (const extra of [0, 0.5, 1]) {
      const offset = side * (clearance + extra)
      for (const depth of [2.4, 2.9, 3.4, 3.9]) {
        const center = at(first + depth)
        const berth = { x: center.x + cross.x * offset, y: center.y + cross.y * offset }
        const afloat = [-2.85, -2, -1, 0, 1, 2, 2.85].every((along) =>
          [-0.8, 0, 0.8].every((across) =>
            waterAt({
              x: berth.x + normal.x * along + cross.x * across,
              y: berth.y + normal.y * along + cross.y * across,
            }),
          ),
        )
        if (afloat) return { ...pier, mooring: berth }
      }
    }
  }
  return { ...pier, mooring: null }
}

type FerryPier = NonNullable<ReturnType<typeof ferryPierPlacement>>

export function paintFerryPier(
  ctx: CanvasRenderingContext2D,
  pier: FerryPier,
  project: (point: MapPoint) => MapPoint,
  tile: number,
  texture?: HTMLImageElement,
) {
  const { from, normal, cross, length } = pier
  const point = (along: number, side: number) =>
    project({
      x: from.x + normal.x * along + cross.x * side,
      y: from.y + normal.y * along + cross.y * side,
    })
  const halfWidth = 0.39
  const level = tile * 0.14
  const corners = [
    point(0, -halfWidth),
    point(0, halfWidth),
    point(length, halfWidth),
    point(length, -halfWidth),
  ] as const
  const path = (vertices: readonly MapPoint[]) => {
    ctx.beginPath()
    ctx.moveTo(vertices[0]!.x, vertices[0]!.y)
    for (const vertex of vertices.slice(1)) ctx.lineTo(vertex.x, vertex.y)
    ctx.closePath()
  }
  const offset = (p: MapPoint, rise: number) => ({ x: p.x, y: p.y + rise })

  ctx.save()
  ctx.lineCap = 'round'
  const supports: MapPoint[] = []
  for (const along of [Math.min(0.43, length / 2), length - 0.16]) {
    for (const side of [-halfWidth, halfWidth]) supports.push(point(along, side))
  }
  for (const p of supports) {
    const wood = ctx.createLinearGradient(p.x - tile * 0.055, 0, p.x + tile * 0.055, 0)
    wood.addColorStop(0, '#332b23')
    wood.addColorStop(0.44, '#836244')
    wood.addColorStop(1, '#4e3a2b')
    ctx.fillStyle = wood
    ctx.fillRect(p.x - tile * 0.055, p.y - level, tile * 0.11, tile * 0.29)
  }
  ctx.fillStyle = '#4b392b'
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i]!
    const b = corners[(i + 1) % corners.length]!
    path([offset(a, -level), offset(b, -level), offset(b, -level * 0.4), offset(a, -level * 0.4)])
    ctx.fill()
  }
  const wood = ctx.createLinearGradient(corners[0].x, corners[0].y, corners[2].x, corners[2].y)
  wood.addColorStop(0, '#a18059')
  wood.addColorStop(0.52, '#816444')
  wood.addColorStop(1, '#a4855f')
  ctx.fillStyle = wood
  path(corners.map((p) => offset(p, -level)))
  ctx.fill()
  ctx.strokeStyle = '#55412e'
  ctx.lineWidth = Math.max(0.65, tile * 0.023)
  ctx.stroke()

  if (texture?.complete && texture.naturalWidth) {
    const left = corners[0]
    const right = corners[1]
    const end = corners[3]
    ctx.save()
    ctx.clip()
    ctx.transform(
      right.x - left.x,
      right.y - left.y,
      end.x - left.x,
      end.y - left.y,
      left.x,
      left.y - level,
    )
    ctx.globalAlpha = 0.9
    // Reuse the deck's painted planks with their grain laid across the jetty.
    const repeat = 1.35 / length
    for (let along = 0; along < 1; along += repeat) ctx.drawImage(texture, 0, along, 1, repeat)
    ctx.restore()
  } else {
    for (let along = 0.12; along < length; along += 0.117) {
      const a = point(along, -halfWidth)
      const b = point(along, halfWidth)
      ctx.strokeStyle = 'rgba(63,43,28,.63)'
      ctx.lineWidth = Math.max(0.45, tile * 0.012)
      ctx.beginPath()
      ctx.moveTo(a.x, a.y - level)
      ctx.lineTo(b.x, b.y - level)
      ctx.stroke()
    }
  }
  for (const { x, y } of supports) {
    const top = y - level - tile * 0.15
    ctx.fillStyle = '#6b4b31'
    ctx.fillRect(x - tile * 0.05, top, tile * 0.1, tile * 0.18)
    ctx.fillStyle = '#aa845c'
    ctx.beginPath()
    ctx.ellipse(x, top, tile * 0.05, Math.max(1, tile * 0.023), 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}
