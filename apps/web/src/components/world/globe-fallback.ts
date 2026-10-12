import type { GlobeLocation } from '@/world/globe-math'

/** Bounded software sphere for devices without WebGL; same projection/picking. */
export function globeFallbackPixels(
  texture: { pixels: Uint8Array; width: number; height: number },
  camera: GlobeLocation,
  zoom: number,
  columns: number,
  rows: number,
  size = 420,
) {
  const pixels = new Uint8ClampedArray(size * size * 4)
  const radians = Math.PI / 180,
    tilt = camera.latitude * radians
  const ct = Math.cos(tilt),
    st = Math.sin(tilt),
    longitude = camera.longitude * radians
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const px = ((2 * (x + 0.5)) / size - 1) / zoom,
        py = (1 - (2 * (y + 0.5)) / size) / zoom
      if (
        px * px + py * py > 1 ||
        (zoom > 1 && Math.hypot((2 * x) / size - 1, (2 * y) / size - 1) > 1)
      )
        continue
      const z = Math.sqrt(1 - px * px - py * py)
      const lat = Math.asin(Math.max(-1, Math.min(1, py * ct + z * st)))
      const lon = Math.atan2(px, z * ct - py * st) + longitude
      const u = (((0.5 + lon / (Math.PI * 2)) % 1) + 1) % 1,
        v = 0.5 - lat / Math.PI
      const tx = Math.min(texture.width - 1, Math.floor(u * texture.width)),
        ty = Math.min(texture.height - 1, Math.floor(v * texture.height))
      const source = (ty * texture.width + tx) * 4,
        index = (y * size + x) * 4
      const land = texture.pixels[source + 3] === 255
      const light = 0.7 + z * 0.3,
        rim = Math.pow(1 - z, 4) * 0.24
      const wave = Math.sin(u * 197 + Math.sin(v * 59)) * Math.sin(v * 131)
      const ocean = [22 + wave * 3, 58 + wave * 5, 69 + wave * 6]
      const edge = Math.min(
        (u * columns) % 1,
        1 - ((u * columns) % 1),
        (v * rows) % 1,
        1 - ((v * rows) % 1),
      )
      for (let c = 0; c < 3; c++) {
        const value = land ? texture.pixels[source + c]! : ocean[c]!
        pixels[index + c] =
          value * light * (1 - rim) +
          [61, 134, 149][c]! * rim +
          (edge < 0.016 ? (land ? 11 : 3) : 0)
      }
      pixels[index + 3] = 255
    }
  return pixels
}
