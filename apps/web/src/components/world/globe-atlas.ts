import { globeVeilTexture } from './globe-veil'
import {
  globeHash as hash,
  globeNoise as noise,
  globeSmooth as smooth,
  globeRangeHeight,
  globeMaterials,
} from './globe-terrain'
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
export interface GlobePainting {
  pixels: Uint8Array | Uint8ClampedArray
  width: number
  height: number
}
export function readGlobePainting(image: HTMLImageElement): GlobePainting {
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = Math.round((2048 * image.naturalHeight) / image.naturalWidth)
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
let detailCache:
  | {
      key: string
      painting?: GlobePainting
      image: {
        pixels: Uint8Array
        width: number
        height: number
        ocean: { pixels: Uint8Array; width: number; height: number }
        veil: ReturnType<typeof globeVeilTexture>
      }
    }
  | undefined

export function globeAtlasDetailPixels(
  atlas: readonly WorldAtlasCell[],
  columns: number,
  rows: number,
  painting?: GlobePainting,
) {
  // World confirmations deserialize an equivalent overview every 200ms. Keep
  // just one public image; repeated confirmations must not rebuild millions of
  // terrain pixels, and a changed liquid footprint must invalidate immediately.
  const key =
    `${columns}:${rows}:` +
    atlas
      .filter((cell) => cell.charted)
      .map(
        (cell) => `${cell.id}:${cell.column}:${cell.row}:${cell.regionId}:${cell.waterTiles ?? ''}`,
      )
      .join('|')
  if (detailCache?.key === key && detailCache.painting === painting) return detailCache.image
  const scale = GLOBE_DETAIL_SCALE,
    width = columns * scale,
    height = rows * scale
  const pixels = new Uint8Array(width * height * 4)
  const cells = new Map(atlas.filter((c) => c.charted).map((c) => [`${c.column}:${c.row}`, c]))
  const anchors = new Map(
    atlas.filter((c) => c.charted && c.id === c.regionId).map((c) => [c.regionId, c]),
  )
  const mask = new Float32Array(columns * rows)
  for (const cell of cells.values())
    if (cell.column >= 0 && cell.column < columns && cell.row >= 0 && cell.row < rows)
      mask[cell.row * columns + cell.column] = 1
  const weights = [1, 4, 6, 4, 1]
  const horizontal = new Float32Array(mask.length),
    coastField = new Float32Array(mask.length)
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++)
      for (let n = -2; n <= 2; n++)
        horizontal[row * columns + column]! +=
          (mask[row * columns + ((column + n + columns) % columns)]! * weights[n + 2]!) / 16
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++)
      for (let n = -2; n <= 2; n++)
        if (row + n >= 0 && row + n < rows)
          coastField[row * columns + column]! +=
            (horizontal[(row + n) * columns + column]! * weights[n + 2]!) / 16
  const coastAt = (column: number, row: number) =>
    row >= 0 && row < rows
      ? coastField[row * columns + (((column % columns) + columns) % columns)]!
      : 0
  const thresholds = new Float32Array(mask.length)
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) {
      let maximum = 0
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) maximum = Math.max(maximum, coastAt(column + dx, row + dy))
      // Thin known islands/circumnavigation land retain a narrow continuous body.
      thresholds[row * columns + column] = Math.max(
        0.035,
        Math.min(0.75, maximum - (maximum < 0.3 ? 0.02 : 0.08)),
      )
    }
  const material = painting ? globeMaterials(painting) : undefined
  const materialColor = [0, 0, 0]
  // Reconstruct a continuous coastline from public neighbours. The contour is
  // clipped inward to supplied charted sectors. Broader reconstruction rounds bays
  // and never generates land in a missing or private sector.
  const surfaceAt = (x: number, y: number, fallback: readonly number[]) => {
    const gx = x / scale - 0.5,
      gy = y / scale - 0.5
    const left = Math.floor(gx),
      top = Math.floor(gy)
    const fx = gx - left,
      fy = gy - top
    let coverage = 0,
      mountain = 0,
      forest = 0,
      snow = 0
    const rgb = [0, 0, 0]
    for (let dy = 0; dy <= 1; dy++)
      for (let dx = 0; dx <= 1; dx++) {
        const neighbor = cells.get(`${(((left + dx) % columns) + columns) % columns}:${top + dy}`)
        if (!neighbor) continue
        const weight = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy)
        coverage += weight
        if (['frostmere', 'starfall-highlands', 'emberreach'].includes(neighbor.regionId))
          mountain += weight
        if (['verdant-expanse', 'umbral-march'].includes(neighbor.regionId)) forest += weight
        if (neighbor.regionId === 'frostmere') snow += weight
        const color = colors[neighbor.regionId] ?? fallback
        const anchor = anchors.get(neighbor.regionId)
        if (material) {
          let offset = x / scale - (anchor?.column ?? 0)
          offset -= Math.round(offset / columns) * columns
          material(
            neighbor.regionId,
            0.5 + offset / 26,
            0.5 + (y / scale - (anchor?.row ?? 0)) / 24,
            materialColor,
          )
        }
        for (let channel = 0; channel < 3; channel++)
          rgb[channel]! +=
            (color[channel]! + (material ? materialColor[channel]! * 0.95 : 0)) * weight
      }
    for (let channel = 0; channel < 3; channel++)
      rgb[channel] = coverage ? rgb[channel]! / coverage : fallback[channel]!
    const blurred =
      (coastAt(left, top) * (1 - fx) + coastAt(left + 1, top) * fx) * (1 - fy) +
      (coastAt(left, top + 1) * (1 - fx) + coastAt(left + 1, top + 1) * fx) * fy
    const column = Math.max(0, Math.min(columns - 1, Math.floor(x / scale))),
      row = Math.max(0, Math.min(rows - 1, Math.floor(y / scale)))
    const threshold = thresholds[row * columns + column]!
    const coastDistance = blurred - threshold + (noise(x * 0.028, y * 0.028) - 0.5) * 0.025
    return {
      rgb,
      alpha: Math.round(smooth(-0.018, 0.018, coastDistance) * 255),
      coastDistance,
      coverage,
      mountain: mountain / (coverage || 1),
      forest: forest / (coverage || 1),
      snow: snow / (coverage || 1),
    }
  }
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
    for (let sy = 0; sy < scale; sy++)
      for (let sx = 0; sx < scale; sx++) {
        const x = cell.column * scale + sx,
          y = cell.row * scale + sy
        const surface = surfaceAt(x + 0.5, y + 0.5, base)
        const anchor = anchors.get(cell.regionId)
        const u = x / scale - (anchor?.column ?? 0),
          v = y / scale - (anchor?.row ?? 0)
        const height = globeRangeHeight(u, v)
        const light = globeRangeHeight(u - 0.07, v - 0.07) - globeRangeHeight(u + 0.07, v + 0.07)
        const grain = (hash(x, y) - 0.5) * 0.016
        const forestPatch = smooth(0.28, 0.72, noise(x * 0.023, y * 0.023))
        const forestGrain = (noise(x * 0.18, y * 0.18) - 0.5) * 0.045
        let shade =
          0.95 +
          (noise(x * 0.019, y * 0.019) - 0.5) * 0.12 +
          grain -
          surface.forest * (forestPatch * 0.19 + forestGrain)
        shade =
          shade * (1 - surface.mountain) +
          (0.68 + height * 0.36 + light * 2.7 + grain) * surface.mountain
        const snow = material ? 0 : surface.snow * smooth(0.43, 0.9, height) * 105
        if (material) shade = 0.97 + grain * 0.2
        const beach = 1 - smooth(0.018, 0.115, surface.coastDistance)
        const index = (y * width + x) * 4
        const terrain =
          cell.waterTiles?.length === 117
            ? cell.waterTiles[
                Math.floor(((sy + 0.5) * 9) / scale) * 13 + Math.floor(((sx + 0.5) * 13) / scale)
              ]
            : '.'
        const water = terrain === '~' || terrain === 'w',
          lava = terrain === 'l'
        for (let channel = 0; channel < 3; channel++)
          pixels[index + channel] = Math.max(
            0,
            Math.min(
              255,
              water
                ? [43, 105, 130][channel]! * (0.92 + grain * 0.05)
                : lava
                  ? [192, 70, 32][channel]! * (0.95 + grain * 0.08)
                  : (surface.rgb[channel]! * shade + snow) * (1 - beach * 0.65) +
                    [200, 181, 137][channel]! * beach * 0.65,
            ),
          )
        // Coast antialiasing changes depiction only; movement/picking keep their canonical addresses.
        pixels[index + 3] = surface.alpha
      }
  }
  const distance = new Float32Array(width * height)
  for (let i = 0; i < distance.length; i++) distance[i] = pixels[i * 4 + 3]! > 0 ? 0 : 1000
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (x) distance[i] = Math.min(distance[i]!, distance[i - 1]! + 1)
      if (y)
        distance[i] = Math.min(
          distance[i]!,
          distance[i - width]! + 1,
          x ? distance[i - width - 1]! + 1.414 : 1000,
          x + 1 < width ? distance[i - width + 1]! + 1.414 : 1000,
        )
    }
  for (let y = height - 1; y >= 0; y--)
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x
      if (x + 1 < width) distance[i] = Math.min(distance[i]!, distance[i + 1]! + 1)
      if (y + 1 < height)
        distance[i] = Math.min(
          distance[i]!,
          distance[i + width]! + 1,
          x ? distance[i + width - 1]! + 1.414 : 1000,
          x + 1 < width ? distance[i + width + 1]! + 1.414 : 1000,
        )
    }
  // Bathymetric colour is derived only from the public coast. It never adds
  // land alpha or uses an undiscovered shoreline.
  const shallow = new Uint8Array(pixels.length)
  for (let i = 0; i < distance.length; i++)
    if (distance[i]! > 0 && distance[i]! < 32) {
      shallow[i * 4] = 34
      shallow[i * 4 + 1] = 116
      shallow[i * 4 + 2] = 124
      shallow[i * 4 + 3] = Math.round((1 - smooth(1, 32, distance[i]!)) * 0.68 * 255)
    }
  const image = {
    pixels,
    width,
    height,
    ocean: { pixels: shallow, width, height },
    veil: globeVeilTexture(painting),
  }

  detailCache = { key, painting, image }
  return image
}
