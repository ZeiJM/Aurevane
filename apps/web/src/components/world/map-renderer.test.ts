import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { projectWorld } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import { WorldMotion } from './world-motion'
import { createMapRenderer } from './map-renderer'

function scene() {
  const images: { onload: (() => void) | null }[] = []
  const fills: { colour: string; alpha: number; order: number }[] = []
  const draws: { src: string; order: number }[] = []
  let drawOrder = 0
  let resizeCallback!: () => void
  const context = new Proxy(
    {
      measureText: (text: string) => ({ width: text.length * 7 }),
      globalAlpha: 1,
      fillStyle: '',
      fill() {
        fills.push({ colour: this.fillStyle, alpha: this.globalAlpha, order: ++drawOrder })
      },
      drawImage(image: HTMLImageElement) {
        draws.push({ src: image.src ?? '', order: ++drawOrder })
      },
    },
    {
      get(target, key) {
        return key in target
          ? target[key as keyof typeof target]
          : key === 'createLinearGradient' || key === 'createRadialGradient'
            ? () => ({ addColorStop() {} })
            : vi.fn()
      },
    },
  )
  let visibility = 'visible',
    nextId = 0
  const frames = new Map<number, FrameRequestCallback>(),
    listeners = new Map<string, EventListener>()
  vi.stubGlobal('window', {
    devicePixelRatio: 3,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  })
  vi.stubGlobal(
    'Image',
    class {
      constructor() {
        images.push(this)
      }
      complete = true
      naturalWidth = 1200
      width = 1200
      height = 1200
      src = ''
      onload: (() => void) | null = null
    },
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resizeCallback = callback
      }
      observe() {}
      disconnect() {}
    },
  )
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextId, callback)
    return nextId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.stubGlobal('document', {
    get visibilityState() {
      return visibility
    },
    createElement: () => ({ width: 0, height: 0, getContext: () => context }),
    addEventListener: (name: string, callback: EventListener) =>
      listeners.set('document:' + name, callback),
    removeEventListener: (name: string) => listeners.delete('document:' + name),
  })
  const canvas = {
    clientWidth: 800,
    clientHeight: 600,
    width: 0,
    height: 0,
    dataset: {},
    getContext: () => context,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    setPointerCapture() {},
    addEventListener: (name: string, callback: EventListener) => listeners.set(name, callback),
    removeEventListener: (name: string) => listeners.delete(name),
  } as unknown as HTMLCanvasElement
  const view = projectWorld(newWorldState(), [], 1000),
    select = vi.fn()
  const motion = new WorldMotion(view)
  const renderer = createMapRenderer(canvas, motion, view, select, vi.fn())!
  return {
    fills,
    draws,
    images,
    resize: () => resizeCallback(),
    view,
    canvas,
    motion,
    renderer,
    select,
    frames,
    listeners,
    event(name: string, x: number, y: number) {
      listeners.get(name)!({ clientX: x, clientY: y, pointerId: 1 } as unknown as Event)
    },
    visibility(value: string) {
      visibility = value
      listeners.get('document:visibilitychange')?.(new Event('visibilitychange'))
    },
    frame(now: number) {
      const callbacks = [...frames.values()]
      frames.clear()
      callbacks.forEach((callback) => callback(now))
    },
  }
}
describe('native map input and bounded lifecycle', () => {
  it('keeps a traveller visible above a bridge or landmark prop', () => {
    const s = scene()
    const sector = s.view.sectors.find((sector) => sector.id === s.view.position.sectorId)!
    const bridge = sector.landmarks.find((landmark) => landmark.kind === 'bridge')!
    s.renderer.update({
      ...s.view,
      players: [
        {
          characterId: 'bridge-traveller',
          name: 'Traveller',
          level: 1,
          portraitRef: '',
          imageUrl: null,
          online: true,
          attackable: false,
          position: { sectorId: sector.id, x: bridge.x, y: bridge.y },
        },
      ],
    })
    s.frame(40)
    const props = s.draws.filter((draw) => draw.src.endsWith('props-v02.webp'))
    expect(props.length).toBeGreaterThan(0)
    const lastProp = Math.max(...props.map((draw) => draw.order))
    expect(s.fills.some((fill) => fill.colour === '#a6b1b0' && fill.order > lastProp)).toBe(true)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('keeps the identity overlay opaque when scenery occludes a traveller', () => {
    const s = scene()
    const sector = s.view.sectors.find((sector) => sector.id === s.view.position.sectorId)!
    const building = sector.buildings![0]!
    s.renderer.update({
      ...s.view,
      players: [
        {
          characterId: 'occluded-traveller',
          name: 'Traveller',
          level: 1,
          portraitRef: '',
          imageUrl: null,
          online: true,
          attackable: false,
          position: { sectorId: sector.id, x: building.x, y: building.y },
        },
      ],
    })
    s.frame(40)
    const overlays = s.fills.filter((fill) => fill.colour === '#a6b1b0')
    expect(overlays.length).toBeGreaterThan(0)
    expect(overlays.every((fill) => fill.alpha === 1)).toBe(true)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('redraws late art and a resized canvas while otherwise idle', () => {
    const s = scene()
    s.renderer.settings({ animate: false, zoom: 1 })
    s.frame(40)
    expect(s.frames.size).toBe(0)
    s.images[0]!.onload!()
    expect(s.frames.size).toBe(1)
    s.frame(80)
    s.resize()
    expect(s.frames.size).toBe(1)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('pauses an occluded map even during movement and redraws when exposed', () => {
    const s = scene()
    s.motion.plan(
      [{ position: { ...s.view.position, x: s.view.position.x + 1 }, durationMs: 200 }],
      s.view.sectors,
      0,
    )
    s.renderer.settings({ animate: true, zoom: 1, paused: true })
    s.frame(40)
    expect(s.frames.size).toBe(0)
    s.renderer.update(s.view)
    expect(s.frames.size).toBe(0)
    s.renderer.settings({ animate: true, zoom: 1, paused: false })
    expect(s.frames.size).toBe(1)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('inverts a ground click exactly and never walks on the river or after dragging', () => {
    const s = scene()
    s.event('pointerdown', 563.2, 384.48)
    s.event('pointerup', 563.2, 384.48)
    expect(s.select).toHaveBeenLastCalledWith({ sectorId: 'verdant-expanse', x: 8, y: 4 })
    s.event('pointerdown', 780.8, 384.48)
    s.event('pointerup', 780.8, 384.48)
    expect(s.select).toHaveBeenCalledTimes(1)
    s.event('pointerdown', 400, 300)
    s.event('pointermove', 450, 300)
    s.event('pointerup', 450, 300)
    expect(s.select).toHaveBeenCalledTimes(1)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('suspends its animation request while hidden and resumes one loop', () => {
    const s = scene()
    expect(s.frames.size).toBe(1)
    s.visibility('hidden')
    expect(s.frames.size).toBe(0)
    s.visibility('visible')
    expect(s.frames.size).toBe(1)
    s.renderer.dispose()
    expect(s.frames.size).toBe(0)
    vi.unstubAllGlobals()
  })
  it('caps high-DPI resolution and reports bounded terrain memory', () => {
    const s = scene()
    expect(s.canvas.width).toBe(1200)
    for (let i = 1; i <= 61; i++) s.frame(i * 40)
    expect(Number(s.canvas.dataset.cachedPixels)).toBeLessThanOrEqual(8_000_000)
    expect(Number(s.canvas.dataset.visibleScenery)).toBeLessThanOrEqual(180)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('does not keep an idle animation loop when ambient effects are disabled', () => {
    const s = scene()
    s.renderer.settings({ animate: false, zoom: 1 })
    s.frame(40)
    expect(s.frames.size).toBe(0)
    s.event('pointermove', 400, 300)
    expect(s.frames.size).toBe(1)
    s.frame(80)
    expect(s.frames.size).toBe(0)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
})
