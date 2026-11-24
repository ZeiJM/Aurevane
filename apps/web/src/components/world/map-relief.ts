import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { sectorMapOrigin, WORLD_MAP_WIDTH } from '@/world/topology'
import type { WorldSectorView } from '@/world/types'

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
  const shadow = sector.warpedTheme
    ? '71,48,103'
    : sector.regionId === 'frostmere'
      ? '58,72,81'
      : '38,48,43'
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
    for (const [dx, dy] of sides) {
      const lower = known.get(`${cell.x + dx}:${cell.y + dy}`)
      if (
        !lower ||
        !lower.walkable ||
        lower.safe ||
        (lower.terrain !== '.' && lower.terrain !== 't')
      )
        continue
      // Fade across the contact and along its ends. Hard tile-edge strips
      // read as a raised square underneath clustered rock sprites.
      const x = (cell.x + 0.5 + dx * 0.36) * tile
      const y = (cell.y + 0.5 + dy * 0.36) * tile
      const width = tile * (dx ? 0.26 : 0.42)
      const height = tile * (dy ? 0.26 : 0.42)
      context.save()
      context.translate(x, y)
      context.scale(width, height)
      const shade = context.createRadialGradient(0, 0, 0, 0, 0, 1)
      shade.addColorStop(0, `rgba(${shadow},.24)`)
      shade.addColorStop(0.55, `rgba(${shadow},.12)`)
      shade.addColorStop(1, `rgba(${shadow},0)`)
      context.fillStyle = shade
      context.beginPath()
      context.ellipse(0, 0, 1, 1, 0, 0, Math.PI * 2)
      context.fill()
      context.restore()
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
  // Each wave is an X phase plus a Y phase. Factor their sine/cosine
  // addition so neighboring pixels keep the exact same continuous field
  // without five trigonometric calls per terrain pixel.
  const phases = new Float64Array(width * 6)
  for (let x = 0; x < width; x++) {
    const longitude = ((origin.x + (x + 0.5) / contourResolution) * Math.PI * 2) / WORLD_MAP_WIDTH
    const i = x * 6
    phases[i] = Math.cos(longitude * 45)
    phases[i + 1] = Math.sin(longitude * 45)
    phases[i + 2] = Math.cos(longitude * 19)
    phases[i + 3] = Math.sin(longitude * 19)
    phases[i + 4] = Math.cos(longitude * 71)
    phases[i + 5] = Math.sin(longitude * 71)
  }
  for (let y = 0; y < height; y++) {
    const wy = origin.y + (y + 0.5) / contourResolution
    const ay = wy * 0.19,
      by = -wy * 0.13,
      cy = wy * 0.31
    const ac = Math.cos(ay) * (0.51 * 0.82) + Math.sin(ay) * (0.4 * 0.18)
    const as = -Math.sin(ay) * (0.51 * 0.82) + Math.cos(ay) * (0.4 * 0.18)
    const bc = -Math.sin(by) * (0.28 * 0.82) + Math.cos(by) * (0.35 * 0.18)
    const bs = -Math.cos(by) * (0.28 * 0.82) - Math.sin(by) * (0.35 * 0.18)
    const cc = Math.cos(cy) * (0.21 * 0.82),
      cs = -Math.sin(cy) * (0.21 * 0.82)
    for (let x = 0; x < width; x++) {
      const phase = x * 6
      const shade =
          phases[phase]! * ac +
          phases[phase + 1]! * as +
          phases[phase + 2]! * bc +
          phases[phase + 3]! * bs +
          phases[phase + 4]! * cc +
          phases[phase + 5]! * cs,
        colour = shade < 0 ? shadow : light,
        i = (y * width + x) * 4
      pixels[i] = colour[0]!
      pixels[i + 1] = colour[1]!
      pixels[i + 2] = colour[2]!
      pixels[i + 3] = Math.round(Math.abs(shade) * (shade < 0 ? 112 : 66))
    }
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
