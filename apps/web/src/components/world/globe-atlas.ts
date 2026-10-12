import type { WorldAtlasCell } from '@/world/types'

const colors: Record<string, readonly number[]> = {
  'verdant-expanse': [83, 121, 75],
  'aureth-crown': [153, 147, 91],
  frostmere: [173, 193, 199],
  'hollow-coast': [107, 142, 134],
  'glasswind-desert': [199, 173, 121],
  emberreach: [128, 83, 65],
  'starfall-highlands': [145, 140, 163],
  'umbral-march': [58, 85, 78],
}
/** RGBA map cells come only from the server's charted overview. Ocean/private cells
 * remain transparent; this texture contains no undiscovered identities or terrain. */
export function globeAtlasPixels(atlas: readonly WorldAtlasCell[], columns: number, rows: number) {
  const pixels = new Uint8Array(columns * rows * 4)
  for (const cell of atlas) {
    if (
      !cell.charted ||
      cell.column < 0 ||
      cell.column >= columns ||
      cell.row < 0 ||
      cell.row >= rows
    )
      continue
    const index = (cell.row * columns + cell.column) * 4
    pixels.set([...(colors[cell.regionId] ?? colors['verdant-expanse']!), 255], index)
  }
  return pixels
}

export const GLOBE_DETAIL_SCALE = 16
const paintedRegions: Record<string, readonly [number, number]> = {
  'aureth-crown': [0.34, 0.41],
  'verdant-expanse': [0.51, 0.43],
  frostmere: [0.5, 0.13],
  emberreach: [0.66, 0.31],
  'glasswind-desert': [0.31, 0.6],
  'hollow-coast': [0.48, 0.53],
  'starfall-highlands': [0.28, 0.28],
  'umbral-march': [0.65, 0.65],
}
export interface GlobePainting {
  pixels: Uint8Array | Uint8ClampedArray
  width: number
  height: number
}
export function readGlobePainting(image: HTMLImageElement): GlobePainting {
  const canvas = document.createElement('canvas')
  canvas.width = 1536
  canvas.height = 768
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return {
    pixels: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    width: canvas.width,
    height: canvas.height,
  }
}
/** Terrain relief is illustrative biome detail inside the exact server land mask.
 * No hidden terrain, private identities or speculative coastlines are imported. */
export function globeAtlasDetailPixels(
  atlas: readonly WorldAtlasCell[],
  columns: number,
  rows: number,
  painting?: GlobePainting,
) {
  const scale = GLOBE_DETAIL_SCALE,
    width = columns * scale,
    height = rows * scale
  const pixels = new Uint8Array(width * height * 4)
  const land = new Set(atlas.filter((c) => c.charted).map((c) => `${c.column}:${c.row}`))
  const anchors = new Map(
    atlas.filter((c) => c.charted && c.id === c.regionId).map((c) => [c.regionId, c]),
  )
  const relief = (x: number, y: number) =>
    Math.sin(x * 0.083 + Math.sin(y * 0.061) * 2.3) * Math.cos(y * 0.097 + Math.sin(x * 0.037))
  for (const cell of atlas) {
    if (
      !cell.charted ||
      cell.column < 0 ||
      cell.column >= columns ||
      cell.row < 0 ||
      cell.row >= rows
    )
      continue
    const base = colors[cell.regionId] ?? colors['verdant-expanse']!
    const mountain = ['frostmere', 'starfall-highlands', 'emberreach'].includes(cell.regionId)
    const forest = ['verdant-expanse', 'umbral-march'].includes(cell.regionId)
    for (let sy = 0; sy < scale; sy++)
      for (let sx = 0; sx < scale; sx++) {
        const x = cell.column * scale + sx,
          y = cell.row * scale + sy
        const h = relief(x, y),
          light = relief(x - 1, y - 1) - relief(x + 1, y + 1)
        const grain = Math.sin(x * 1.17 + y * 3.31) * Math.cos(y * 1.89 - x * 0.7)
        let shade =
          0.86 + h * (mountain ? 0.21 : 0.12) + light * (mountain ? 0.7 : 0.35) + grain * 0.035
        if (forest) {
          const crown = Math.max(0, Math.sin(x * 0.69 + Math.sin(y * 0.23)) * Math.cos(y * 0.83))
          shade -= crown * 0.27
        }
        const coast = Math.min(
          land.has(`${cell.column - 1}:${cell.row}`) ? scale : sx,
          land.has(`${cell.column + 1}:${cell.row}`) ? scale : scale - sx - 1,
          land.has(`${cell.column}:${cell.row - 1}`) ? scale : sy,
          land.has(`${cell.column}:${cell.row + 1}`) ? scale : scale - sy - 1,
        )
        if (coast < 2) shade *= coast === 0 ? 0.62 : 1.12
        const snow = cell.regionId === 'frostmere' ? Math.max(0, h - 0.28) * 65 : 0
        const index = (y * width + x) * 4
        let artIndex: number | null = null
        if (painting) {
          const source = paintedRegions[cell.regionId] ?? paintedRegions['verdant-expanse']!
          const anchor = anchors.get(cell.regionId) ?? cell
          const u = source[0] + (cell.column + sx / scale - anchor.column) * 0.009
          const v = source[1] + (cell.row + sy / scale - anchor.row) * 0.011
          const px = Math.max(0, Math.min(painting.width - 1, Math.floor(u * painting.width)))
          const py = Math.max(0, Math.min(painting.height - 1, Math.floor(v * painting.height)))
          const candidate = (py * painting.width + px) * 4
          if (!(
            painting.pixels[candidate + 2]! > painting.pixels[candidate]! * 1.4 &&
            painting.pixels[candidate + 2]! > painting.pixels[candidate + 1]! * 1.02
          ))
            artIndex = candidate
        }
        for (let channel = 0; channel < 3; channel++)
          pixels[index + channel] = Math.max(
            0,
            Math.min(
              255,
              artIndex !== null && painting
                ? painting.pixels[artIndex + channel]! * 0.82 +
                    (base[channel]! * shade + snow) * 0.18
                : base[channel]! * shade + snow,
            ),
          )
        pixels[index + 3] = 255
      }
  }
  return { pixels, width, height }
}
