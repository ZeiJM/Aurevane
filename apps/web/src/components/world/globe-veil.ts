import {
  globeNoise,
  globeSmooth,
  globeMaterials,
  type GlobeMaterialPainting,
} from './globe-terrain'

/** The cartographer's illustrative cover is not a set of game coordinates. */
export const UNCHARTED_VEIL_FOCUS = { longitude: 180, latitude: -45 } as const
let cached: { width: number; height: number; pixels: Uint8Array } | undefined
let cachedPainting: GlobeMaterialPainting | undefined

/** Fictional dry relief beneath broken cloud banks. The illustration is fixed,
 * independent of player progress and authoritative hidden terrain. */
export function globeVeilTexture(painting?: GlobeMaterialPainting) {
  if (cached && cachedPainting === painting) return cached
  const material = painting ? globeMaterials(painting) : undefined,
    sample = [0, 0, 0]
  const width = 1024,
    height = 512,
    pixels = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const longitude = ((x + 0.5) / width) * 360 - 180,
        latitude = 90 - ((y + 0.5) / height) * 180
      const dx = (((longitude - UNCHARTED_VEIL_FOCUS.longitude + 540) % 360) - 180) / 102
      const dy = (latitude - UNCHARTED_VEIL_FOCUS.latitude) / 38
      if (Math.abs(dx) > 1.6 || Math.abs(dy) > 1.6) continue
      const coast =
        Math.min(
          Math.hypot((dx + 0.1) * 0.92, (dy - 0.14) * 1.1),
          Math.hypot((dx - 0.25) * 1.4, (dy + 0.31) * 1.7),
        ) +
        Math.sin(dy * 11 + dx * 5) * 0.065 +
        Math.cos(dx * 16 - dy * 8) * 0.047
      const alpha = 1 - globeSmooth(0.86, 1.03, coast)
      if (!alpha) continue
      const u = dx * 14,
        v = dy * 14
      const foothills = globeNoise(u * 0.19 + 7, v * 0.19 + 3)
      const forest = globeSmooth(0.38, 0.72, globeNoise(u * 0.3 - 4, v * 0.3 + 5))
      const light = 0.92 + foothills * 0.08
      const beach = globeSmooth(0.8, 0.96, coast)
      const ground = [144 - forest * 32, 125 - forest * 20, 87 - forest * 4]
      const cloudField =
        globeNoise(u * 0.13 + 13, v * 0.24 + 9) * 0.58 +
        globeNoise(u * 0.37 - 8, v * 0.51 + 4) * 0.42
      const cloud = globeSmooth(0.39, 0.68, cloudField) * 0.76
      const cloudLight = 185 + globeNoise(u * 0.21 + 11, v * 0.32 - 7) * 38
      const index = (y * width + x) * 4
      if (material) material('uncharted', 0.5 + dx * 0.44, 0.5 + dy * 0.44, sample)
      for (let channel = 0; channel < 3; channel++) {
        const earth = (ground[channel]! + (material ? sample[channel]! * 1.05 : 0)) * light
        const dry = earth * (1 - beach * 0.55) + [188, 169, 124][channel]! * beach * 0.55
        pixels[index + channel] = Math.max(
          0,
          Math.min(255, dry * (1 - cloud) + (cloudLight + [2, 3, 8][channel]!) * cloud),
        )
      }
      pixels[index + 3] = Math.round(alpha * 255)
    }
  cachedPainting = painting
  cached = { width, height, pixels }
  return cached
}
