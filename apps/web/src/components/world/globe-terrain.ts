/** Illustrative material only. These functions contain no game geography. */
export function globeHash(x: number, y: number) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

export function globeNoise(x: number, y: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy
  const u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy)
  return (
    (globeHash(ix, iy) * (1 - u) + globeHash(ix + 1, iy) * u) * (1 - v) +
    (globeHash(ix, iy + 1) * (1 - u) + globeHash(ix + 1, iy + 1) * u) * v
  )
}

export function globeSmooth(from: number, to: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

/** Long crests with branching foothills; variation follows the spine rather
 * than covering the whole surface in isotropic, pebble-like relief. */
export function globeRangeHeight(x: number, y: number) {
  const spine = x * 0.53 + y * 0.8 + Math.sin(x * 0.13) * 0.7
  const peaks = 0.72 + globeNoise(x * 0.34, y * 0.34) * 0.28
  return (
    Math.exp(-Math.abs(spine) * 1.8) * peaks +
    Math.exp(-Math.abs(spine - 3.3 - Math.sin(y * 0.17)) * 2.1) * 0.38 +
    Math.exp(-Math.abs(spine + 4.1 + Math.sin(x * 0.2)) * 2.3) * 0.24
  )
}

export interface GlobeMaterialPainting {
  pixels: Uint8Array | Uint8ClampedArray
  width: number
  height: number
}
const materialOrder = [
  'verdant-expanse',
  'aureth-crown',
  'frostmere',
  'hollow-coast',
  'glasswind-desert',
  'emberreach',
  'starfall-highlands',
  'umbral-march',
  'uncharted',
]
let materialCache:
  | {
      painting: GlobeMaterialPainting
      sample: (id: string, u: number, v: number, out: number[], centered?: boolean) => void
    }
  | undefined

/** Generated swatches supply ground materials only. Subtracting each swatch's
 * mean keeps regional palette authority and rejects arbitrary blue exposure. */
export function globeMaterials(painting: GlobeMaterialPainting) {
  if (materialCache?.painting === painting) return materialCache.sample
  const packed = painting.height >= painting.width * 0.9
  const rectangle = (n: number) =>
    n === 8
      ? { left: 0, top: painting.height / 2, width: painting.width, height: painting.height / 2 }
      : {
          left: ((n % 4) * painting.width) / 4,
          top: (Math.floor(n / 4) * painting.height) / (packed ? 4 : 2),
          width: painting.width / 4,
          height: painting.height / (packed ? 4 : 2),
        }
  const means = materialOrder.map((_, n) => {
    const rgb = [0, 0, 0],
      rect = rectangle(n)
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const px = Math.min(
          painting.width - 1,
          Math.floor(rect.left + ((x + 0.5) / 16) * rect.width),
        )
        const py = Math.min(
          painting.height - 1,
          Math.floor(rect.top + ((y + 0.5) / 16) * rect.height),
        )
        const index = (py * painting.width + px) * 4
        for (let c = 0; c < 3; c++) rgb[c]! += painting.pixels[index + c]! / 256
      }
    return rgb
  })
  const sample = (id: string, u: number, v: number, out: number[], centered = true) => {
    const n = Math.max(0, materialOrder.indexOf(id))
    const rect = rectangle(n)
    const x = rect.left + Math.max(0.015, Math.min(0.985, u)) * rect.width - 0.5
    const y = rect.top + Math.max(0.015, Math.min(0.985, v)) * rect.height - 0.5
    const left = Math.floor(x),
      top = Math.floor(y),
      fx = x - left,
      fy = y - top
    out.fill(0)
    for (let dy = 0; dy <= 1; dy++)
      for (let dx = 0; dx <= 1; dx++) {
        const px = Math.max(0, Math.min(painting.width - 1, left + dx)),
          py = Math.max(0, Math.min(painting.height - 1, top + dy))
        const index = (py * painting.width + px) * 4,
          weight = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy)
        for (let c = 0; c < 3; c++) out[c]! += painting.pixels[index + c]! * weight
      }
    if (centered) for (let c = 0; c < 3; c++) out[c]! -= means[n]![c]!
  }
  materialCache = { painting, sample }
  return sample
}
