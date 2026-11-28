import { afterEach, expect, it, vi } from 'vitest'
import { createMapActorFrames } from './map-actor-frames'

afterEach(() => vi.unstubAllGlobals())

function actorScene() {
  const draws = vi.fn()
  const surfaces: {
    width: number
    height: number
    getContext: () => { drawImage: typeof draws }
  }[] = []
  vi.stubGlobal('OffscreenCanvas', undefined)
  vi.stubGlobal('document', {
    createElement() {
      const surface = { width: 0, height: 0, getContext: () => ({ drawImage: draws }) }
      surfaces.push(surface)
      return surface
    },
  })
  const actor = {
    atlas: {
      src: '/api/media/appearance/character/atlas',
      naturalWidth: 1536,
      naturalHeight: 448,
    } as HTMLImageElement,
    column: 8,
    row: 1,
    still: false,
  }
  const ctx = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D
  return { draws, surfaces, actor, ctx, frames: createMapActorFrames() }
}

it('reuses native-density actor poses across people and camera movement and isolates changing presentation', () => {
  const { draws, surfaces, actor, ctx, frames } = actorScene()
  frames.draw(ctx, actor, 10, 20, 1, 2, false)
  frames.draw(ctx, { ...actor }, 30, 40, 1, 2, false)
  expect(draws).toHaveBeenCalledExactlyOnceWith(actor.atlas, 384, 64, 48, 64, 4, 4, 96, 128)
  expect(ctx.drawImage).toHaveBeenCalledTimes(2)
  expect(surfaces[0]).toMatchObject({ width: 104, height: 136 })
  frames.draw(ctx, actor, 30, 40, 1, 2, true)
  frames.draw(ctx, { ...actor, column: 9 }, 30, 40, 1, 2, false)
  frames.draw(ctx, actor, 30, 40, 1.5, 2, false)
  expect(draws).toHaveBeenCalledTimes(4)
  frames.clear()
  expect(surfaces.every((s) => s.width === 0 && s.height === 0)).toBe(true)
})

it('samples an entire native-resolution authored pose at its correct atlas column and row', () => {
  const { draws, actor, ctx, frames } = actorScene()
  const atlas = { ...actor.atlas, naturalWidth: 3072, naturalHeight: 768 } as HTMLImageElement
  frames.draw(ctx, { ...actor, atlas, frameScale: 2 }, 10, 20, 1.5, 2, false)
  expect(draws).toHaveBeenCalledExactlyOnceWith(atlas, 768, 128, 96, 128, 4, 4, 144, 192)
  frames.clear()
})

it('keeps the actor surface cache bounded across a crowd changing poses', () => {
  const { surfaces, actor, ctx, frames } = actorScene()
  for (let i = 0; i < 800; i++)
    frames.draw(
      ctx,
      { ...actor, atlas: { ...actor.atlas, src: 'actor-' + i } as HTMLImageElement },
      5,
      5,
      1.5,
      2,
      false,
    )
  const retained = surfaces.filter((s) => s.width)
  expect(retained.length).toBeGreaterThan(0)
  expect(retained.length).toBeLessThanOrEqual(256)
  expect(retained.reduce((sum, s) => sum + s.width * s.height, 0)).toBeLessThanOrEqual(
    3 * 1024 * 1024,
  )
})
