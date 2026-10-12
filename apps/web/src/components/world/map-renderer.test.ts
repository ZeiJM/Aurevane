import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { projectWorld } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import { mapPoint, WorldMotion } from './world-motion'
import { createMapRenderer } from './map-renderer'

function scene(reduced = false) {
  const images: { onload: (() => void) | null }[] = []
  const fills: { colour: string; alpha: number; order: number }[] = []
  const draws: { src: string; order: number; args: number[] }[] = []
  const transforms: number[][] = []
  const groundCurves: number[][] = []
  let drawOrder = 0
  let createdLayers = 0
  let resizeCallback!: () => void
  const context = new Proxy(
    {
      measureText: (text: string) => ({ width: text.length * 7 }),
      globalAlpha: 1,
      fillStyle: '',
      fill() {
        fills.push({ colour: this.fillStyle, alpha: this.globalAlpha, order: ++drawOrder })
      },
      drawImage(image: HTMLImageElement, ...args: number[]) {
        draws.push({ src: image.src ?? '', order: ++drawOrder, args })
      },
      transform(...values: number[]) {
        transforms.push(values)
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
    matchMedia: () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }),
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
    createElement: () => {
      createdLayers++
      const layerContext = new Proxy(context, {
        get(target, key) {
          if (key === 'bezierCurveTo') return (...args: number[]) => groundCurves.push(args)
          return Reflect.get(target, key)
        },
      })
      return { width: 0, height: 0, getContext: () => layerContext }
    },
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
    select = vi.fn(),
    onZoom = vi.fn(),
    onVisiblePlayers = vi.fn()
  const motion = new WorldMotion(view)
  const renderer = createMapRenderer(
    canvas,
    motion,
    view,
    select,
    vi.fn(),
    onZoom,
    onVisiblePlayers,
  )!
  return {
    fills,
    draws,
    transforms,
    groundCurves,
    images,
    resize: () => resizeCallback(),
    view,
    canvas,
    motion,
    renderer,
    select,
    onZoom,
    onVisiblePlayers,
    frames,
    layerCount: () => createdLayers,
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
  it('keeps curved bank and flowing surface detail in the cached river with reduced motion', () => {
    const s = scene(true)
    s.frame(40)
    expect(s.groundCurves.length).toBeGreaterThan(20)
    const detail = s.groundCurves.map((curve) => [...curve])
    s.renderer.update(s.view)
    s.frame(80)
    expect(s.groundCurves).toEqual(detail)
    expect(s.frames.size).toBe(0)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('refreshes a cached river bank when connected terrain across a sector edge changes', () => {
    const s = scene(true)
    const current = s.view.sectors.find((sector) => sector.id === s.view.position.sectorId)!
    const cell = (x: number, y: number, terrain: string) => ({
      x,
      y,
      terrain,
      walkable: terrain !== '~',
      safe: false,
    })
    const sectors = [
      { ...current, cells: [cell(10, 8, '~')], buildings: [], landmarks: [] },
      {
        ...current,
        id: 'connected-bank',
        atlasRow: current.atlasRow! + 1,
        cells: [cell(10, 0, '~')],
        buildings: [],
        landmarks: [],
      },
    ]
    s.renderer.update({ ...s.view, sectors })
    s.frame(40)
    const layers = s.layerCount()
    s.renderer.update({
      ...s.view,
      sectors: [sectors[0]!, { ...sectors[1]!, cells: [cell(10, 0, '.')] }],
    })
    s.frame(80)
    expect(s.layerCount() - layers).toBe(2)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('uses a centered cover crop for wide portraits, keeping the battle-grid face proportions', () => {
    const s = scene()
    s.canvas.dataset.portrait = '/wide-portrait.png'
    s.frame(40)
    const portrait = s.images.find(
      (image) => (image as HTMLImageElement).src === '/wide-portrait.png',
    )!
    Object.assign(portrait, { width: 1200, height: 600, naturalHeight: 600 })
    s.renderer.update(s.view)
    s.frame(80)
    const draw = s.draws.filter((draw) => draw.src === '/wide-portrait.png').at(-1)!
    expect(draw.args.slice(0, 4)).toEqual([300, 0, 600, 600])
    expect(draw.args.slice(-2)).toEqual([34, 34])
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('keeps your own portrait when other travellers share your tile', () => {
    const s = scene()
    s.canvas.dataset.portrait = '/your-portrait.png'
    s.renderer.update({
      ...s.view,
      players: [
        {
          characterId: 'other',
          name: 'Other',
          level: 1,
          portraitRef: '',
          imageUrl: '/other-portrait.png',
          position: s.view.position,
          online: true,
          attackable: false,
        },
      ],
    })
    s.frame(40)
    s.draws.length = 0
    s.frame(4800)
    expect(s.draws.some((d) => d.src === '/your-portrait.png')).toBe(true)
    expect(s.draws.some((d) => d.src === '/other-portrait.png')).toBe(false)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('walks with WASD in either case while retaining arrow-key movement', () => {
    const s = scene()
    s.renderer.update({
      ...s.view,
      sectors: s.view.sectors.map((sector) => ({
        ...sector,
        cells: sector.cells.map((cell) => ({ ...cell, walkable: true })),
      })),
    })
    for (const [key, dx, dy] of [
      ['w', 0, -1],
      ['W', 0, -1],
      ['a', -1, 0],
      ['s', 0, 1],
      ['d', 1, 0],
      ['ArrowRight', 1, 0],
    ] as const) {
      const preventDefault = vi.fn()
      s.listeners.get('keydown')!({ key, preventDefault } as unknown as Event)
      expect(s.select).toHaveBeenLastCalledWith({
        ...s.view.position,
        x: s.view.position.x + dx,
        y: s.view.position.y + dy,
      })
      expect(preventDefault).toHaveBeenCalledOnce()
    }
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('starts smoothly after a long idle and a small pointer slip without shifting the camera', () => {
    const s = scene()
    s.renderer.settings({ animate: false, zoom: 1 })
    s.frame(40)
    const origin = mapPoint(s.view.position, s.view.sectors)
    s.event('pointerdown', 500, 300)
    s.event('pointermove', 503, 302)
    s.event('pointerup', 503, 302)
    expect(Number(s.canvas.dataset.cameraX)).toBe(origin.x)
    expect(Number(s.canvas.dataset.cameraY)).toBe(origin.y)
    s.motion.plan(
      [{ position: { ...s.view.position, x: s.view.position.x + 1 }, durationMs: 200 }],
      s.view.sectors,
      10_000,
    )
    s.renderer.update(s.view)
    s.frame(10_016)
    expect(Number(s.canvas.dataset.cameraX) - origin.x).toBeCloseTo(
      0.08 * (1 - Math.exp(-16 / 90)),
      8,
    )
    expect(Number(s.canvas.dataset.cameraY)).toBe(origin.y)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('reports on-screen tokens through zoom and resizing without allowing dragging to pan or walk', () => {
    const s = scene()
    const player = (id: string, x: number, y: number) => ({
      characterId: id,
      name: id,
      level: 1,
      portraitRef: '',
      imageUrl: null,
      online: true,
      attackable: false,
      position: { ...s.view.position, x, y },
    })
    const view = { ...s.view, players: [player('near', 7, 4), player('edge', 12, 0)] }
    s.renderer.settings({ animate: false, zoom: 1 })
    s.renderer.update(view)
    s.frame(40)
    expect(s.onVisiblePlayers).toHaveBeenLastCalledWith(['near'])
    s.renderer.update(view)
    s.frame(80)
    expect(s.onVisiblePlayers).toHaveBeenCalledOnce()
    s.renderer.settings({ animate: false, zoom: 0.6 })
    s.frame(120)
    expect(s.onVisiblePlayers).toHaveBeenLastCalledWith(['edge', 'near'])
    s.renderer.settings({ animate: false, zoom: 1 })
    s.frame(160)
    const camera = s.canvas.dataset.cameraX + ':' + s.canvas.dataset.cameraY
    s.event('pointerdown', 400, 300)
    s.event('pointermove', 0, 300)
    s.event('pointerup', 0, 300)
    s.frame(200)
    expect(s.onVisiblePlayers).toHaveBeenLastCalledWith(['near'])
    expect(s.canvas.dataset.cameraX + ':' + s.canvas.dataset.cameraY).toBe(camera)
    expect(s.select).not.toHaveBeenCalled()
    Object.assign(s.canvas, { clientWidth: 1200 })
    s.resize()
    s.frame(240)
    expect(s.onVisiblePlayers).toHaveBeenLastCalledWith(['edge', 'near'])
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('pinches with two fingers without submitting a walk on release', () => {
    const s = scene()
    const touch = (name: string, id: number, x: number) =>
      s.listeners.get(name)!({
        pointerType: 'touch',
        pointerId: id,
        clientX: x,
        clientY: 300,
      } as unknown as Event)
    touch('pointerdown', 1, 350)
    touch('pointerdown', 2, 450)
    touch('pointermove', 2, 500)
    expect(s.onZoom).toHaveBeenCalled()
    touch('pointerup', 2, 500)
    touch('pointerup', 1, 350)
    expect(s.select).not.toHaveBeenCalled()
    s.renderer.settings({ animate: true, zoom: 1, zoomLocked: true })
    s.onZoom.mockClear()
    touch('pointerdown', 1, 350)
    touch('pointerdown', 2, 450)
    touch('pointermove', 2, 500)
    expect(s.onZoom).not.toHaveBeenCalled()
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('zooms with the wheel and blocks accidental wheel zoom when locked', () => {
    const s = scene(),
      preventDefault = vi.fn()
    s.listeners.get('wheel')?.({ deltaY: -100, ctrlKey: false, preventDefault } as unknown as Event)
    expect(s.onZoom).toHaveBeenCalledWith(expect.any(Number))
    expect(s.onZoom.mock.calls[0]![0]).toBeGreaterThan(1)
    s.renderer.settings({ animate: true, zoom: 1, zoomLocked: true })
    s.onZoom.mockClear()
    preventDefault.mockClear()
    s.listeners.get('wheel')?.({ deltaY: -100, ctrlKey: false, preventDefault } as unknown as Event)
    expect(s.onZoom).not.toHaveBeenCalled()
    expect(preventDefault).toHaveBeenCalledOnce()
    s.renderer.dispose()
    expect(s.listeners.has('wheel')).toBe(false)
    vi.unstubAllGlobals()
  })
  it('keeps the detailed world static when the device requests reduced motion', () => {
    const s = scene(true)
    s.frame(120)
    expect(s.canvas.dataset.clouds).toBe('0')
    expect(s.frames.size).toBe(0)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('keeps drifting textured cloud shadows visible even in clear weather', () => {
    const s = scene()
    s.renderer.update({ ...s.view, environment: { ...s.view.environment, weather: 'clear' } })
    s.frame(120)
    expect(Number(s.canvas.dataset.clouds)).toBeGreaterThan(0)
    expect(Number(s.canvas.dataset.clouds)).toBeLessThanOrEqual(6)
    const first = s.canvas.dataset.cloudPhase
    s.frame(2120)
    expect(s.canvas.dataset.cloudPhase).not.toBe(first)
    s.renderer.settings({ animate: false, zoom: 1 })
    s.frame(2160)
    expect(s.canvas.dataset.clouds).toBe('0')
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('renders actual blossom sprites in a sakura landscape', () => {
    const s = scene()
    s.renderer.update({
      ...s.view,
      sectors: s.view.sectors.map((sector) => ({ ...sector, landscape: 'sakura' })),
    })
    s.frame(120)
    expect(s.draws.some((draw) => draw.src.endsWith('beauties-v03.webp'))).toBe(true)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('varies tree canopy sway independently while keeping the trunk base fixed', () => {
    const s = scene()
    s.frame(120)
    const canopies = s.transforms.filter((t) => t[0] === 1 && t[1] === 0 && t[3] === 1)
    expect(canopies.length).toBeGreaterThan(1)
    expect(new Set(canopies.map((t) => t[2])).size).toBeGreaterThan(1)
    expect(canopies.every((t) => Math.abs(t[2]!) <= 0.025)).toBe(true)
    s.transforms.length = 0
    s.renderer.settings({ animate: false, zoom: 1 })
    s.frame(160)
    expect(s.transforms.filter((t) => t[0] === 1 && t[1] === 0 && t[3] === 1)).toEqual([])
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
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
    s.frame(40)
    const layers = s.layerCount()
    for (let i = 1; i <= 61; i++) s.frame(i * 40)
    expect(Number(s.canvas.dataset.cachedPixels)).toBeLessThanOrEqual(8_000_000)
    expect(Number(s.canvas.dataset.visibleScenery)).toBeLessThanOrEqual(180)
    expect(Number(s.canvas.dataset.waterCells)).toBeLessThanOrEqual(60)
    expect(s.layerCount()).toBe(layers)
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
  it.each(['effects off', 'reduced motion'])(
    'finishes the drawn step and camera with %s without pointer input',
    (mode) => {
      const s = scene(mode === 'reduced motion')
      s.canvas.dataset.portrait = '/self-portrait.png'
      if (mode === 'effects off') s.renderer.settings({ animate: false, zoom: 1 })
      const destination = { ...s.view.position, x: s.view.position.x + 1 }
      s.motion.plan([{ position: destination, durationMs: 200 }], s.view.sectors, 0)
      for (let now = 16; now <= 192; now += 16) s.frame(now)
      // The terminal sample must draw even though the idle cadence is slower.
      s.frame(201)
      const point = mapPoint(destination, s.view.sectors)
      const drawn = s.draws.filter((draw) => draw.src === '/self-portrait.png').at(-1)!
      const tile = Number(s.canvas.dataset.tileSize)
      const camera = { x: Number(s.canvas.dataset.cameraX), y: Number(s.canvas.dataset.cameraY) }
      const groundX = drawn.args.at(-4)! + 17,
        groundY = drawn.args.at(-3)! + 34
      // Invert the actual portrait drawing, rather than only checking the motion model.
      expect(
        camera.x + ((groundX - 400) / (tile * 0.85) + (groundY - 300) / (tile * 0.44)) / 2,
      ).toBeCloseTo(point.x, 8)
      expect(
        camera.y + ((groundY - 300) / (tile * 0.44) - (groundX - 400) / (tile * 0.85)) / 2,
      ).toBeCloseTo(point.y, 8)
      for (let now = 217; now <= 1600 && s.frames.size; now += 16) s.frame(now)
      expect(Number(s.canvas.dataset.cameraX)).toBe(point.x)
      expect(Number(s.canvas.dataset.cameraY)).toBe(point.y)
      expect(s.frames.size).toBe(0)
      s.renderer.dispose()
      vi.unstubAllGlobals()
    },
  )
})
