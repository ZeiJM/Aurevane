import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { sectorMapOrigin, WORLD_MAP_WIDTH } from '@/world/topology'
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
    // A solitary blocked cell carries a small rock sprite, not a raised tile.
    // Drawing cliff strips around it makes a dark, square plinth under the rock.
    if (!sides.some(([dx, dy]) => known.get(`${cell.x + dx}:${cell.y + dy}`)?.terrain === '#'))
      continue
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

// One small reusable raster per destination context, released with its ground cache.
// This painter runs during static ground construction, never in the animation pass.
const contourResolution = 16
const contourRasters = new WeakMap<
  CanvasRenderingContext2D,
  {
    canvas: HTMLCanvasElement
    context: CanvasRenderingContext2D
    pixels: ImageData
  }
>()

/** Cosmetic crests/slopes/basins on supplied natural ground, with no height authority. */
export function paintTerrainContours(
  context: CanvasRenderingContext2D,
  sector: WorldSectorView,
  tile: number,
): number {
  if (
    sector.townId ||
    (!sector.charted && !sector.warpedTheme) ||
    sector.id.startsWith('ferry:') ||
    tile <= 0
  )
    return 0
  const cells = sector.cells.filter(
    (cell) =>
      !cell.safe &&
      (cell.terrain === '.' || cell.terrain === 't' || cell.terrain === '#') &&
      cell.x >= 0 &&
      cell.x < GRID_WIDTH &&
      cell.y >= 0 &&
      cell.y < GRID_HEIGHT &&
      !sector.buildings?.some(
        (b) => cell.x >= b.x && cell.x < b.x + b.width && cell.y >= b.y && cell.y < b.y + b.height,
      ),
  )
  if (!cells.length || typeof document === 'undefined') return 0
  let raster = contourRasters.get(context)
  const width = GRID_WIDTH * contourResolution,
    height = GRID_HEIGHT * contourResolution
  if (!raster) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const scratch = canvas.getContext('2d')
    if (!scratch) return 0
    raster = { canvas, context: scratch, pixels: scratch.createImageData(width, height) }
    contourRasters.set(context, raster)
  }
  const origin = sectorMapOrigin(sector),
    pixels = raster.pixels.data
  const shadow = sector.warpedTheme ? [74, 49, 99] : [30, 43, 38],
    light = sector.warpedTheme ? [255, 247, 189] : [251, 244, 210]
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const wx = origin.x + (x + 0.5) / contourResolution,
        wy = origin.y + (y + 0.5) / contourResolution,
        longitude = (wx * Math.PI * 2) / WORLD_MAP_WIDTH
      // Integer longitudinal harmonics close at the public wrap. Their periods span
      // many cells, so the same ridge/basin crosses tile and sector boundaries.
      const a = longitude * 45 + wy * 0.19,
        b = longitude * 19 - wy * 0.13,
        c = longitude * 71 + wy * 0.31
      const slope = Math.cos(a) * 0.51 - Math.sin(b) * 0.28 + Math.cos(c) * 0.21
      const basin = Math.sin(a) * 0.4 + Math.cos(b) * 0.35
      const shade = Math.max(-1, Math.min(1, slope * 0.82 + basin * 0.18)),
        colour = shade < 0 ? shadow : light,
        i = (y * width + x) * 4
      pixels[i] = colour[0]!
      pixels[i + 1] = colour[1]!
      pixels[i + 2] = colour[2]!
      pixels[i + 3] = Math.round(Math.abs(shade) * (shade < 0 ? 112 : 66))
    }
  raster.context.putImageData(raster.pixels, 0, 0)
  for (const cell of cells)
    context.drawImage(
      raster.canvas,
      cell.x * contourResolution,
      cell.y * contourResolution,
      contourResolution,
      contourResolution,
      cell.x * tile,
      cell.y * tile,
      tile,
      tile,
    )
  return cells.length
}
