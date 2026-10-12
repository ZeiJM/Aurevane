import type { WorldAtlasCell } from '@/world/types'
import { ATLAS_COLUMNS, ATLAS_ROWS } from '@/world/atlas'
import { globeSectorCenter, projectGlobePoint, type GlobeLocation } from '@/world/globe-math'

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
/** Towns are the projected authored anchor and its actual charted districts. */
export function globeTowns(atlas: readonly WorldAtlasCell[]) {
  return atlas
    .filter((cell) => cell.charted && cell.townId === cell.id)
    .map((sector) => ({
      sector,
      districts: atlas.filter((cell) => cell.charted && cell.townId === sector.id),
    }))
}
export function projectGlobeTowns(
  atlas: readonly WorldAtlasCell[],
  camera: GlobeLocation,
  zoom: number,
) {
  return globeTowns(atlas).flatMap((town) => {
    const location = globeSectorCenter(town.sector.coordinate, ATLAS_COLUMNS, ATLAS_ROWS)
    if (!location) return []
    const point = projectGlobePoint(location, camera)
    const x = point.x * zoom,
      y = point.y * zoom
    return point.visible && Math.hypot(x, y) < Math.min(0.95, zoom * 0.95)
      ? [{ ...town, left: (x + 1) * 50, top: (1 - y) * 50 }]
      : []
  })
}
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
  const towns = new Map(
    atlas.filter((c) => c.charted && c.townId).map((c) => [`${c.column}:${c.row}`, c.townId]),
  )
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
    const west = land.has(`${(cell.column - 1 + columns) % columns}:${cell.row}`),
      east = land.has(`${(cell.column + 1) % columns}:${cell.row}`),
      north = land.has(`${cell.column}:${cell.row - 1}`),
      south = land.has(`${cell.column}:${cell.row + 1}`)
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
          west ? scale : sx,
          east ? scale : scale - sx - 1,
          north ? scale : sy,
          south ? scale : scale - sy - 1,
        )
        if (coast < 2) shade *= coast === 0 ? 0.62 : 1.12
        const snow = cell.regionId === 'frostmere' ? Math.max(0, h - 0.28) * 65 : 0
        const index = (y * width + x) * 4
        if (painting) {
          const source = paintedRegions[cell.regionId] ?? paintedRegions['verdant-expanse']!
          const anchor = anchors.get(cell.regionId) ?? cell
          const u = source[0] + (cell.column + sx / scale - anchor.column) * 0.009
          const v = source[1] + (cell.row + sy / scale - anchor.row) * 0.011
          const px = Math.max(0, Math.min(painting.width - 1, Math.floor(u * painting.width)))
          const py = Math.max(0, Math.min(painting.height - 1, Math.floor(v * painting.height)))
          const candidate = (py * painting.width + px) * 4
          // Painting supplies light and texture, never geographic color. Teal
          // illustration samples cannot turn authoritative dry ground into water.
          const luminance =
            (painting.pixels[candidate]! * 0.299 +
              painting.pixels[candidate + 1]! * 0.587 +
              painting.pixels[candidate + 2]! * 0.114) /
            255
          shade *= 0.72 + luminance * 0.58
        }
        const terrain =
          cell.waterTiles?.length === 117
            ? cell.waterTiles[
                Math.floor(((sy + 0.5) * 9) / scale) * 13 + Math.floor(((sx + 0.5) * 13) / scale)
              ]
            : '.'
        const water = terrain === '~',
          lava = terrain === 'l'
        const townEdge =
          cell.townId &&
          ((sx === 0 && towns.get(`${cell.column - 1}:${cell.row}`) !== cell.townId) ||
            (sx === scale - 1 && towns.get(`${cell.column + 1}:${cell.row}`) !== cell.townId) ||
            (sy === 0 && towns.get(`${cell.column}:${cell.row - 1}`) !== cell.townId) ||
            (sy === scale - 1 && towns.get(`${cell.column}:${cell.row + 1}`) !== cell.townId))
        for (let channel = 0; channel < 3; channel++)
          pixels[index + channel] = Math.max(
            0,
            Math.min(
              255,
              water
                ? [43, 105, 130][channel]! * (0.92 + grain * 0.05)
                : lava
                  ? [192, 70, 32][channel]! * (0.95 + grain * 0.08)
                  : townEdge
                    ? [209, 174, 106][channel]!
                    : cell.townId
                      ? (base[channel]! * 0.75 + [190, 164, 107][channel]! * 0.25) * shade + snow
                      : base[channel]! * shade + snow,
            ),
          )
        // Every charted cell remains opaque: a dry corner must not become ocean.
        pixels[index + 3] = 255
      }
  }
  return { pixels, width, height }
}
