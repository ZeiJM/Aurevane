import { APPEARANCE_FRAME } from '@/appearance/appearance-manifest'
import {
  releaseStaticRaster,
  snapshotStaticRaster,
  type StaticMapRaster,
} from './map-static-raster'

type Actor = { atlas: HTMLImageElement; column: number; row: number; still: boolean }
const { width, height } = APPEARANCE_FRAME
const maxPixels = 3 * 1024 * 1024
const maxFrames = 256
const padding = 4

const actorFilter = (ghost: boolean) =>
  ghost
    ? 'brightness(1.28) contrast(1.08) saturate(.76) drop-shadow(0 1px 1px #101a20)'
    : 'brightness(1.16) contrast(1.08) drop-shadow(0 1px 1px #101a20)'

function drawBody(
  ctx: CanvasRenderingContext2D,
  actor: Actor,
  x: number,
  y: number,
  scale: number,
) {
  ctx.drawImage(
    actor.atlas,
    actor.column * width,
    actor.row * height,
    actor.still ? actor.atlas.naturalWidth : width,
    actor.still ? actor.atlas.naturalHeight : height,
    x,
    y,
    width * scale,
    height * scale,
  )
}

/** Reuse the displayed pose at native identity-layer density while characters or the camera move. */
export function createMapActorFrames() {
  const frames = new Map<string, StaticMapRaster>()
  let pixels = 0
  return {
    draw(
      ctx: CanvasRenderingContext2D,
      actor: Actor,
      x: number,
      y: number,
      scale: number,
      ratio: number,
      ghost: boolean,
    ) {
      const density = scale * ratio
      const key = JSON.stringify([
        actor.atlas.src,
        actor.column,
        actor.row,
        actor.still,
        density,
        ghost,
      ])
      let frame = frames.get(key)
      if (frame) {
        frames.delete(key)
        frames.set(key, frame)
      } else {
        const w = Math.ceil(width * density) + 2 * padding
        const h = Math.ceil(height * density) + 2 * padding
        const area = w * h
        if (area <= maxPixels) {
          const layer = document.createElement('canvas')
          layer.width = w
          layer.height = h
          const target = layer.getContext('2d')
          if (target) {
            target.imageSmoothingEnabled = true
            target.imageSmoothingQuality = 'high'
            target.filter = actorFilter(ghost)
            drawBody(target, actor, padding, padding, density)
            frame = snapshotStaticRaster(layer)
            while (frames.size >= maxFrames || pixels + area > maxPixels) {
              const oldest = frames.keys().next().value!
              const evicted = frames.get(oldest)!
              pixels -= evicted.width * evicted.height
              releaseStaticRaster(evicted)
              frames.delete(oldest)
            }
            frames.set(key, frame)
            pixels += area
          }
        }
      }
      if (!frame) {
        ctx.filter = actorFilter(ghost)
        drawBody(ctx, actor, x, y, scale)
        return
      }
      ctx.filter = 'none'
      ctx.drawImage(
        frame,
        (Math.round(x * ratio) - padding) / ratio,
        (Math.round(y * ratio) - padding) / ratio,
        frame.width / ratio,
        frame.height / ratio,
      )
    },
    clear() {
      for (const frame of frames.values()) releaseStaticRaster(frame)
      frames.clear()
      pixels = 0
    },
  }
}
