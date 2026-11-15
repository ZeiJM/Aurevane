import { MAP_X, MAP_Y } from './map-projection'

interface GroundProjection {
  canvas: HTMLCanvasElement
  left: number
  top: number
  width: number
  height: number
  ratio: number
  frame: number
}

/** Reuse the costly affine ground raster; camera movement needs only a native-density translation. */
export function createGroundProjectionCache(pixelLimit = 8_000_000) {
  const entries = new Map<HTMLCanvasElement, GroundProjection>()
  let pixels = 0
  let frame = 0
  const remove = (source: HTMLCanvasElement) => {
    const entry = entries.get(source)!
    pixels -= entry.canvas.width * entry.canvas.height
    entries.delete(source)
  }
  return {
    get pixels() {
      return pixels
    },
    beginFrame() {
      frame++
    },
    get(source: HTMLCanvasElement, width: number, height: number, ratio: number) {
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
      const left = Math.floor(-height * MAP_X * ratio) - 1
      const top = -1
      const right = Math.ceil(width * MAP_X * ratio) + 1
      const bottom = Math.ceil((width + height) * MAP_Y * ratio) + 1
      const area = (right - left) * (bottom - top)
      if (area > pixelLimit) return null
      // Never evict a bitmap already used in this frame. If the visible set
      // exceeds the budget, retain its warmed subset and draw the rest directly.
      while (entries.size && (pixels + area > pixelLimit || entries.size >= 16)) {
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
      context.drawImage(source, 0, 0, width, height)
      context.restore()
      const entry = { canvas, left, top, width, height, ratio, frame }
      entries.set(source, entry)
      pixels += area
      return entry
    },
    clear() {
      entries.clear()
      pixels = 0
    },
  }
}
