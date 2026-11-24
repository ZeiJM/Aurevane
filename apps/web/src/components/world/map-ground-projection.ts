import { MAP_X, MAP_Y } from './map-projection'
import {
  releaseStaticRaster,
  snapshotStaticRaster,
  type StaticMapRaster,
} from './map-static-raster'

/** Cover only the subpixel gap and resampling footprint between adjacent rasters.
 * Interior pixels keep their exact projection; no grid or texture rescaling. */
export function drawGroundSurface(
  context: CanvasRenderingContext2D,
  source: StaticMapRaster,
  width: number,
  height: number,
  ratio: number,
) {
  const bleed = 1.25 / ratio,
    sw = source.width,
    sh = source.height
  for (const [sx, sy, sourceWidth, sourceHeight, x, y, w, h] of [
    [0, 0, sw, 1, 0, -bleed, width, bleed],
    [0, sh - 1, sw, 1, 0, height, width, bleed],
    [0, 0, 1, sh, -bleed, 0, bleed, height],
    [sw - 1, 0, 1, sh, width, 0, bleed, height],
    [0, 0, 1, 1, -bleed, -bleed, bleed, bleed],
    [sw - 1, 0, 1, 1, width, -bleed, bleed, bleed],
    [0, sh - 1, 1, 1, -bleed, height, bleed, bleed],
    [sw - 1, sh - 1, 1, 1, width, height, bleed, bleed],
  ])
    context.drawImage(source, sx!, sy!, sourceWidth!, sourceHeight!, x!, y!, w!, h!)
  context.drawImage(source, 0, 0, width, height)
}

interface GroundProjection {
  canvas: StaticMapRaster
  left: number
  top: number
  width: number
  height: number
  ratio: number
  frame: number
}

/** Reuse the costly affine ground raster; camera movement needs only a native-density translation. */
export function createGroundProjectionCache(pixelLimit = 8_000_000) {
  const entries = new Map<StaticMapRaster, GroundProjection>()
  let pixels = 0
  let frame = 0
  const remove = (source: StaticMapRaster) => {
    const entry = entries.get(source)!
    pixels -= entry.canvas.width * entry.canvas.height
    releaseStaticRaster(entry.canvas)
    entries.delete(source)
  }
  return {
    get pixels() {
      return pixels
    },
    get immutableImages() {
      return [...entries.values()].filter(({ canvas }) => 'close' in canvas).length
    },
    beginFrame() {
      frame++
    },
    get(source: StaticMapRaster, width: number, height: number, ratio: number, entryLimit = 16) {
      if (![width, height, ratio].every((value) => Number.isFinite(value) && value > 0)) return null
      const cached = entries.get(source)
      if (cached?.width === width && cached.height === height && cached.ratio === ratio) {
        cached.frame = frame
        entries.delete(source)
        entries.set(source, cached)
        return cached
      }
      if (cached) remove(source)
      // Keep every projected corner and its filtered edge inside the bitmap.
      const left = Math.floor(-height * MAP_X * ratio) - 2
      const top = -2
      const right = Math.ceil(width * MAP_X * ratio) + 2
      const bottom = Math.ceil((width + height) * MAP_Y * ratio) + 2
      const area = (right - left) * (bottom - top)
      if (area > pixelLimit) return null
      // Never evict a bitmap already used in this frame. If the visible set
      // exceeds the budget, retain its warmed subset and draw the rest directly.
      while (entries.size && (pixels + area > pixelLimit || entries.size >= entryLimit)) {
        const oldest = entries.keys().next().value!
        if (entries.get(oldest)!.frame === frame) return null
        remove(oldest)
      }
      const canvas = document.createElement('canvas')
      canvas.width = right - left
      canvas.height = bottom - top
      const context = canvas.getContext('2d')
      if (!context) return null
      context.save()
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.setTransform(ratio * MAP_X, ratio * MAP_Y, -ratio * MAP_X, ratio * MAP_Y, -left, -top)
      drawGroundSurface(context, source, width, height, ratio)
      context.restore()
      const image = snapshotStaticRaster(canvas)
      const entry = { canvas: image, left, top, width, height, ratio, frame }
      entries.set(source, entry)
      pixels += area
      return entry
    },
    clear() {
      for (const entry of entries.values()) releaseStaticRaster(entry.canvas)
      entries.clear()
      pixels = 0
    },
  }
}
