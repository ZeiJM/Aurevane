import { ASTERWAKE_REGION_ID } from '@/world/asterwake'
import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { ATLAS_COLUMNS, wrapAtlasColumn } from '@/world/topology'
import type { WorldAtlasCell } from '@/world/types'

type ChartedCell = (column: number, row: number) => WorldAtlasCell | undefined

function shoreBlend(from: number, to: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

/** Reconstruct a sub-tile shore from the public terrain, including across chunk edges. */
export function asterwakeShore(column: number, row: number, charted: ChartedCell) {
  const stride = GRID_WIDTH + 2
  const mask = new Uint8Array(stride * (GRID_HEIGHT + 2))
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const sector = charted(wrapAtlasColumn(column + dx), row + dy)
      if (!sector?.charted || sector.regionId !== ASTERWAKE_REGION_ID) continue
      const fromX = dx < 0 ? -1 : dx > 0 ? GRID_WIDTH : 0
      const toX = dx === 0 ? GRID_WIDTH - 1 : fromX
      const fromY = dy < 0 ? -1 : dy > 0 ? GRID_HEIGHT : 0
      const toY = dy === 0 ? GRID_HEIGHT - 1 : fromY
      for (let y = fromY; y <= toY; y++) {
        for (let x = fromX; x <= toX; x++) {
          const type =
            sector.waterTiles?.[(y - dy * GRID_HEIGHT) * GRID_WIDTH + x - dx * GRID_WIDTH]
          mask[(y + 1) * stride + x + 1] = type === '~' || type === 'w' ? 0 : 1
        }
      }
    }
  }
  if (mask.every((sample) => sample === 1)) return undefined
  const half = ATLAS_COLUMNS / 2
  const west = (wrapAtlasColumn(column + half) - half) * GRID_WIDTH
  return (x: number, y: number) => {
    const left = Math.floor(x - 0.5),
      top = Math.floor(y - 0.5),
      fx = x - 0.5 - left,
      fy = y - 0.5 - top,
      index = (top + 1) * stride + left + 1
    const north = mask[index]! * (1 - fx) + mask[index + 1]! * fx
    const south = mask[index + stride]! * (1 - fx) + mask[index + stride + 1]! * fx
    const coverage = north * (1 - fy) + south * fy
    const wx = west + x,
      wy = row * GRID_HEIGHT + y
    return (
      coverage +
      (Math.sin(wx * 2.1 + wy * 1.7) + Math.sin(wx * 4.7 - wy * 3.9)) *
        0.065 *
        coverage *
        (1 - coverage)
    )
  }
}

/** The cached shoreline leaves wet sediment visible without changing any walkable cell. */
export function paintAsterwakeShore(
  context: CanvasRenderingContext2D,
  tile: number,
  sample: NonNullable<ReturnType<typeof asterwakeShore>>,
) {
  const density = 8
  const layer = document.createElement('canvas')
  layer.width = GRID_WIDTH * density
  layer.height = GRID_HEIGHT * density
  const surface = layer.getContext('2d')!
  const mask = surface.createImageData(layer.width, layer.height)
  const shore = surface.createImageData(layer.width, layer.height)
  for (let y = 0; y < layer.height; y++) {
    for (let x = 0; x < layer.width; x++) {
      const coverage = sample((x + 0.5) / density, (y + 0.5) / density)
      const index = (y * layer.width + x) * 4
      mask.data[index + 3] = 255 * shoreBlend(0.54, 0.65, coverage)
      const sediment = shoreBlend(0.44, 0.62, coverage)
      shore.data[index] = 70 + sediment * 109
      shore.data[index + 1] = 117 + sediment * 43
      shore.data[index + 2] = 112 - sediment * 6
      shore.data[index + 3] =
        240 * shoreBlend(0.02, 0.48, coverage) * (1 - shoreBlend(0.55, 0.98, coverage))
    }
  }
  const width = GRID_WIDTH * tile,
    height = GRID_HEIGHT * tile
  context.save()
  context.globalCompositeOperation = 'destination-in'
  surface.putImageData(mask, 0, 0)
  context.drawImage(layer, 0, 0, width, height)
  context.restore()
  surface.putImageData(shore, 0, 0)
  context.drawImage(layer, 0, 0, width, height)
  layer.width = layer.height = 0
}
