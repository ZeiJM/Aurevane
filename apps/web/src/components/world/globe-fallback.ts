import type { GlobeLocation } from '@/world/globe-math'
import { globeVeilTexture } from './globe-veil'

type Texture = {
  pixels: Uint8Array
  width: number
  height: number
  veil?: ReturnType<typeof globeVeilTexture>
  ocean?: { pixels: Uint8Array; width: number; height: number }
}

// Match WebGL LINEAR sampling, including alpha at reconstructed coasts and the
// longitude seam. RGB is normalized by coverage to avoid dark coastal fringes.
function sample(texture: Texture, u: number, v: number, out: number[]) {
  const x = u * texture.width - 0.5,
    y = v * texture.height - 0.5
  const left = Math.floor(x),
    top = Math.floor(y),
    fx = x - left,
    fy = y - top
  out.fill(0)
  for (let dy = 0; dy <= 1; dy++)
    for (let dx = 0; dx <= 1; dx++) {
      const tx = (((left + dx) % texture.width) + texture.width) % texture.width
      const ty = Math.max(0, Math.min(texture.height - 1, top + dy))
      const index = (ty * texture.width + tx) * 4
      const weight = ((dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * texture.pixels[index + 3]!) / 255
      for (let c = 0; c < 3; c++) out[c]! += texture.pixels[index + c]! * weight
      out[3]! += weight
    }
  if (out[3]) for (let c = 0; c < 3; c++) out[c]! /= out[3]!
}

/** Bounded software sphere for devices without WebGL; same projection/picking. */
export function globeFallbackPixels(
  texture: Texture,
  camera: GlobeLocation,
  zoom: number,
  columns: number,
  rows: number,
  size = 420,
  grid = false,
) {
  const pixels = new Uint8ClampedArray(size * size * 4)
  const veil = texture.veil ?? globeVeilTexture()
  const terrainSample = [0, 0, 0, 0],
    veilSample = [0, 0, 0, 0],
    oceanSample = [0, 0, 0, 0]
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
      const index = (y * size + x) * 4
      sample(texture, u, v, terrainSample)
      sample(veil, u, v, veilSample)
      if (texture.ocean) sample(texture.ocean, u, v, oceanSample)
      const land = terrainSample[3]!
      const fog = veilSample[3]! * (1 - land)
      const light = 0.7 + z * 0.3,
        rim = Math.pow(1 - z, 4) * 0.24
      const wave = Math.sin(u * 21 + Math.sin(v * 13) * 1.6) * Math.cos(v * 17 - u * 9)
      const ocean = [11 + wave * 2, 33 + wave * 4, 48 + wave * 5]
      const edge = Math.min(
        (u * columns) % 1,
        1 - ((u * columns) % 1),
        (v * rows) % 1,
        1 - ((v * rows) % 1),
      )
      for (let c = 0; c < 3; c++) {
        const sea = ocean[c]! * (1 - oceanSample[3]!) + oceanSample[c]! * oceanSample[3]!
        const surface = terrainSample[c]! * land + sea * (1 - land)
        const value = surface * (1 - fog) + veilSample[c]! * fog
        pixels[index + c] =
          value * light * (1 - rim) +
          [61, 134, 149][c]! * rim +
          (grid && edge < 0.016 ? (land ? 11 : 3) : 0)
      }
      pixels[index + 3] = 255
    }
  return pixels
}
