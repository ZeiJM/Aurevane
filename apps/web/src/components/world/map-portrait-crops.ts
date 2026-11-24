import {
  releaseStaticRaster,
  snapshotStaticRaster,
  type StaticMapRaster,
} from './map-static-raster'

/** Compact map portraits keep their native-density crop and occlusion treatment while travelling. */
export function createMapPortraitCrops() {
  const pictures = new Map<string, StaticMapRaster>()
  let pixels = 0
  return {
    get(picture: HTMLImageElement, diameter: number, ratio: number, ghost: boolean) {
      const size = Math.ceil(diameter * ratio)
      const area = size * size
      if (size <= 0 || area > 1_000_000) return null
      const w = picture.naturalWidth || picture.width
      const h = picture.naturalHeight || picture.height
      const key = JSON.stringify([picture.src, w, h, size, ghost])
      const hit = pictures.get(key)
      if (hit) {
        pictures.delete(key)
        pictures.set(key, hit)
        return hit
      }
      const layer = document.createElement('canvas')
      layer.width = layer.height = size
      const ctx = layer.getContext('2d')
      if (!ctx) return null
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      if (ghost) ctx.filter = 'grayscale(1)'
      const side = Math.min(w, h)
      ctx.drawImage(picture, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size)
      const crop = snapshotStaticRaster(layer)
      while (pictures.size >= 128 || pixels + area > 1_000_000) {
        const first = pictures.keys().next().value!
        const oldest = pictures.get(first)!
        pixels -= oldest.width * oldest.height
        releaseStaticRaster(oldest)
        pictures.delete(first)
      }
      pictures.set(key, crop)
      pixels += area
      return crop
    },
    clear() {
      for (const crop of pictures.values()) releaseStaticRaster(crop)
      pictures.clear()
      pixels = 0
    },
  }
}
