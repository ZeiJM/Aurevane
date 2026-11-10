/** The cartographer's illustrative cover is not a set of game coordinates. */
export const UNCHARTED_VEIL_FOCUS = { longitude: 136, latitude: -43 } as const

const smooth = (from: number, to: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

let cached: { width: number; height: number; pixels: Uint8Array } | undefined

/** A fixed fog painting, independent of the public land mask and server geography. */
export function globeVeilTexture() {
  if (cached) return cached
  const width = 512,
    height = 256
  const pixels = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const longitude = ((x + 0.5) / width) * 360 - 180
      const latitude = 90 - ((y + 0.5) / height) * 180
      const dx = (longitude - UNCHARTED_VEIL_FOCUS.longitude) / 27
      const dy = (latitude - UNCHARTED_VEIL_FOCUS.latitude) / 25
      if (Math.abs(dx) > 1.64 || Math.abs(dy) > 1.37) continue
      const northCape = Math.hypot((dx - 0.28) * 1.55, (dy - 0.34) * 1.35) + 0.1
      const southShelf = Math.hypot((dx + 0.32) * 1.65, (dy + 0.23) * 1.45) + 0.05
      const coast =
        Math.min(northCape, southShelf) +
        Math.sin(dy * 11 + dx * 5) * 0.065 +
        Math.cos(dx * 16 - dy * 8) * 0.047
      const cloud = Math.sin(dx * 9 + Math.sin(dy * 8) * 2) * Math.sin(dy * 6 - dx * 4)
      const filament = Math.sin((dx * 5 + dy * 6 + cloud * 0.35) * 5)
      const contour = 1 - smooth(0.018, 0.065, Math.abs(coast - 0.87))
      const fog = (1 - smooth(0.71, 1.26, coast + cloud * 0.09)) * 0.97
      const core = smooth(0.28, 0.82, coast)
      const i = (y * width + x) * 4
      pixels[i] = 45 + core * 29 + cloud * 9 + filament * 2 + contour * 20
      pixels[i + 1] = 43 + core * 34 + cloud * 10 + filament * 2 + contour * 16
      pixels[i + 2] = 65 + core * 31 + cloud * 13 + filament * 3 + contour * 18
      pixels[i + 3] = Math.round(255 * fog)
    }
  cached = { width, height, pixels }
  return cached
}
