import type { WorldSectorView } from '@/world/types'
import { warpedPalette } from './map-regional-art'

const sides = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const

/** Cached cosmetic relief on supplied rock faces; never changes travel or reveals land. */
export function paintTerrainRelief(
  context: CanvasRenderingContext2D,
  sector: WorldSectorView,
  tile: number,
) {
  if (sector.townId || (!sector.charted && !sector.warpedTheme) || sector.id.startsWith('ferry:'))
    return 0
  const known = new Map(sector.cells.map((cell) => [`${cell.x}:${cell.y}`, cell]))
  const lip = sector.warpedTheme
    ? warpedPalette[sector.warpedTheme]
    : sector.regionId === 'frostmere'
      ? '#dbe5e5'
      : sector.regionId === 'glasswind-desert'
        ? '#e9c786'
        : sector.regionId === 'emberreach'
          ? '#c89468'
          : '#a5b68c'
  const shadow = sector.warpedTheme ? '71,48,103' : '38,48,43'
  let faces = 0
  context.save()
  for (const cell of sector.cells) {
    if (cell.terrain !== '#') continue
    if (sector.landmarks.some((site) => Math.abs(site.x - cell.x) + Math.abs(site.y - cell.y) < 2))
      continue
    if (
      sector.buildings?.some(
        (b) =>
          cell.x >= b.x - 1 &&
          cell.x <= b.x + b.width &&
          cell.y >= b.y - 1 &&
          cell.y <= b.y + b.height,
      )
    )
      continue
    for (const [side, [dx, dy]] of sides.entries()) {
      const lower = known.get(`${cell.x + dx}:${cell.y + dy}`)
      if (
        !lower ||
        !lower.walkable ||
        lower.safe ||
        (lower.terrain !== '.' && lower.terrain !== 't')
      )
        continue
      const point = (t: number, depth: number) => {
        const x = cell.x,
          y = cell.y
        return side === 0
          ? [(x + t) * tile, (y + depth) * tile]
          : side === 1
            ? [(x + 1 - depth) * tile, (y + t) * tile]
            : side === 2
              ? [(x + t) * tile, (y + 1 - depth) * tile]
              : [(x + depth) * tile, (y + t) * tile]
      }
      const near = point(0.5, 0),
        high = point(0.5, 0.48)
      const shade = context.createLinearGradient(near[0]!, near[1]!, high[0]!, high[1]!)
      shade.addColorStop(0, `rgba(${shadow},.4)`)
      shade.addColorStop(0.36, `rgba(${shadow},.28)`)
      shade.addColorStop(0.76, `rgba(${shadow},.12)`)
      shade.addColorStop(1, `rgba(${shadow},0)`)
      context.fillStyle = shade
      context.beginPath()
      for (const [i, [t, depth]] of [
        [0, 0],
        [1, 0],
        [1, 0.48],
        [0, 0.48],
      ].entries()) {
        const [x, y] = point(t!, depth!)
        if (i === 0) context.moveTo(x!, y!)
        else context.lineTo(x!, y!)
      }
      context.closePath()
      context.fill()
      // Broken strata and a lit upper rim form a face, all inside existing rock.
      for (const depth of [0.13, 0.27, 0.41]) {
        context.beginPath()
        for (let step = 0; step <= 8; step++) {
          const t = step / 8
          const irregular = Math.sin((cell.x + cell.y) * 1.7 + t * 11) * 0.025
          const [x, y] = point(t, depth + irregular)
          if (step === 0) context.moveTo(x!, y!)
          else context.lineTo(x!, y!)
        }
        context.strokeStyle = lip
        context.globalAlpha = depth > 0.4 ? 0.38 : 0.15
        context.lineWidth = tile * (depth > 0.4 ? 0.022 : 0.009)
        context.stroke()
      }
      context.globalAlpha = 1
      faces++
    }
  }
  context.restore()
  return faces
}
