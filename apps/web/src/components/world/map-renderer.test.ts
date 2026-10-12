import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { projectWorld } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import { localRoute, mapPoint, WorldMotion } from './world-motion'
import { createMapRenderer } from './map-renderer'
import { projectMapPoint } from './map-projection'
import type { WorldView } from '@/world/types'

function scene(reduced = false, initial?: WorldView) {
  const images: { onload: (() => void) | null }[] = []
  const fills: { colour: string; alpha: number; order: number }[] = []
  const draws: { src: string; order: number; args: number[]; matrix: number[] }[] = []
  const texts: { text: string; x: number; y: number }[] = []
  const transforms: number[][] = []
  const groundCurves: number[][] = []
  const gradients: { coordinates: number[]; stops: [number, string][] }[] = []
  let drawOrder = 0
  let createdLayers = 0
  let resizeCallback!: () => void
  let matrix = [1, 0, 0, 1, 0, 0]
  const matrices: number[][] = []
  const multiply = (b: number[]) => {
    const a = matrix
    matrix = [
      a[0]! * b[0]! + a[2]! * b[1]!,
      a[1]! * b[0]! + a[3]! * b[1]!,
      a[0]! * b[2]! + a[2]! * b[3]!,
      a[1]! * b[2]! + a[3]! * b[3]!,
      a[0]! * b[4]! + a[2]! * b[5]! + a[4]!,
      a[1]! * b[4]! + a[3]! * b[5]! + a[5]!,
    ]
  }
  const context = new Proxy(
    {
      measureText: (text: string) => ({ width: text.length * 7 }),
      globalAlpha: 1,
      fillStyle: '',
      fill() {
        fills.push({ colour: this.fillStyle, alpha: this.globalAlpha, order: ++drawOrder })
      },
      drawImage(image: HTMLImageElement, ...args: number[]) {
        draws.push({ src: image.src ?? '', order: ++drawOrder, args, matrix: [...matrix] })
      },
      fillText(text: string, x: number, y: number) {
        texts.push({ text, x, y })
      },
      transform(...values: number[]) {
        transforms.push(values)
        multiply(values)
      },
      setTransform(...values: number[]) {
        matrix = values
      },
      translate(x: number, y: number) {
        multiply([1, 0, 0, 1, x, y])
      },
      scale(x: number, y: number) {
        multiply([x, 0, 0, y, 0, 0])
      },
      save() {
        matrices.push([...matrix])
      },
      restore() {
        matrix = matrices.pop() ?? matrix
      },
    },
    {
      get(target, key) {
        return key in target
          ? target[key as keyof typeof target]
          : key === 'createLinearGradient' || key === 'createRadialGradient'
            ? (...coordinates: number[]) => {
                const gradient = { coordinates, stops: [] as [number, string][] }
                gradients.push(gradient)
                return {
                  addColorStop: (offset: number, colour: string) =>
                    gradient.stops.push([offset, colour]),
                }
              }
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
    addEventListener: (name: string, callback: EventListener) =>
      listeners.set('window:' + name, callback),
    removeEventListener: (name: string) => listeners.delete('window:' + name),
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
  const view = initial ?? projectWorld(newWorldState(), [], 1000),
    select = vi.fn(),
    onZoom = vi.fn(),
    onVisiblePlayers = vi.fn(),
    onStop = vi.fn()
  const motion = new WorldMotion(view)
  const renderer = createMapRenderer(
    canvas,
    motion,
    view,
    select,
    vi.fn(),
    onZoom,
    onVisiblePlayers,
    onStop,
  )!
  return {
    fills,
    draws,
    texts,
    transforms,
    groundCurves,
    gradients,
    images,
    resize: () => resizeCallback(),
    view,
    canvas,
    motion,
    renderer,
    select,
    onZoom,
    onVisiblePlayers,
    onStop,
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
  it.each([200, 400])(
    'streams held walking at authored %ims cadence without OS-repeat commands',
    (stepMs) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
      const s = scene()
      const view = { ...s.view, sectors: s.view.sectors.map((sector) => ({ ...sector, stepMs })) }
      s.renderer.update(view)
      s.select.mockImplementation((destination) => {
        const route = localRoute(view, s.motion.sample(performance.now()).position, destination)
        if (route) s.motion.plan(route, view.sectors, performance.now())
      })
      const key = (repeat = false) =>
        s.listeners.get('keydown')!({ key: 'd', repeat, preventDefault() {} } as unknown as Event)
      key()
      for (let i = 0; i < 30; i++) key(true)
      expect(s.select).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(stepMs - 1)
      expect(s.select).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(1)
      expect(s.select).toHaveBeenCalledTimes(2)
      expect(s.select).toHaveBeenLastCalledWith({ ...view.position, x: view.position.x + 2 })
      s.listeners.get('keyup')?.({ key: 'd' } as unknown as Event)
      vi.advanceTimersByTime(1000)
      expect(s.select).toHaveBeenCalledTimes(2)
      s.renderer.dispose()
      vi.useRealTimers()
      vi.unstubAllGlobals()
    },
  )
  it.each(['keyup', 'blur', 'window:blur', 'hidden', 'dispose'])(
    'ends a held-key stream on %s and keeps a tap to one step',
    (release) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
      const s = scene()
      s.listeners.get('keydown')!({ key: 'd', preventDefault() {} } as unknown as Event)
      if (release === 'hidden') s.visibility('hidden')
      else if (release === 'dispose') s.renderer.dispose()
      else s.listeners.get(release)?.({ key: 'd' } as unknown as Event)
      vi.advanceTimersByTime(1000)
      expect(s.select).toHaveBeenCalledTimes(1)
      s.renderer.dispose()
      vi.useRealTimers()
      vi.unstubAllGlobals()
    },
  )
  it('continues held walking over a known longitude seam at the exit cadence', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    const initial = projectWorld(newWorldState(), [], 1000),
      sector = initial.sectors[0]!
    const west = { sectorId: 'west', x: 12, y: 4 },
      east = { sectorId: 'east', x: 0, y: 4 }
    const cells = Array.from({ length: 117 }, (_, i) => ({
      x: i % 13,
      y: Math.floor(i / 13),
      terrain: '.',
      walkable: true,
      safe: true,
    }))
    const view = {
      ...initial,
      position: { ...west, x: 11 },
      sectors: [
        {
          ...sector,
          id: 'west',
          atlasColumn: 127,
          atlasRow: 32,
          charted: true,
          stepMs: 200,
          cells,
          exits: [{ from: west, to: east, durationMs: 400, name: 'Seam' }],
        },
        {
          ...sector,
          id: 'east',
          atlasColumn: 0,
          atlasRow: 32,
          charted: true,
          stepMs: 200,
          cells,
          exits: [{ from: east, to: west, durationMs: 400, name: 'Seam' }],
        },
      ],
    }
    const s = scene(true, view)
    s.select.mockImplementation((destination) => {
      const route = localRoute(view, s.motion.sample(performance.now()).position, destination)
      if (route) s.motion.plan(route, view.sectors, performance.now())
    })
    s.listeners.get('keydown')!({ key: 'd', preventDefault() {} } as unknown as Event)
    vi.advanceTimersByTime(200)
    expect(s.select).toHaveBeenLastCalledWith(east)
    vi.advanceTimersByTime(399)
    expect(s.select).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(1)
    expect(s.select).toHaveBeenLastCalledWith({ ...east, x: 1 })
    s.renderer.dispose()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
  it('does not submit held-key destinations on water or beyond supplied terrain', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    const s = scene()
    const view = {
      ...s.view,
      sectors: s.view.sectors.map((sector) => ({
        ...sector,
        cells: sector.cells.map((cell) =>
          sector.id === s.view.position.sectorId &&
          cell.x === s.view.position.x + 2 &&
          cell.y === s.view.position.y
            ? { ...cell, terrain: '~', walkable: false }
            : cell,
        ),
      })),
    }
    s.renderer.update(view)
    s.select.mockImplementation((destination) => {
      const route = localRoute(view, s.motion.sample(performance.now()).position, destination)
      if (route) s.motion.plan(route, view.sectors, performance.now())
    })
    s.listeners.get('keydown')!({ key: 'd', preventDefault() {} } as unknown as Event)
    vi.advanceTimersByTime(1200)
    expect(s.select).toHaveBeenCalledExactlyOnceWith({ ...view.position, x: view.position.x + 1 })
    s.renderer.update({ ...view, sectors: [] })
    vi.advanceTimersByTime(1200)
    expect(s.select).toHaveBeenCalledTimes(1)
    s.renderer.dispose()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
  it('uses Escape on the focused map to stop travel and end held input', () => {
    const s = scene(),
      preventDefault = vi.fn()
    s.listeners.get('keydown')!({ key: 'Escape', preventDefault } as unknown as Event)
    expect(s.onStop).toHaveBeenCalledOnce()
    expect(preventDefault).toHaveBeenCalledOnce()
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('keeps all traveller portraits and nameplates above atmospheric dimming and cloud shadows', () => {
    const s = scene()
    s.canvas.dataset.portrait = '/self-sharp.png'
    s.renderer.update({
      ...s.view,
      environment: { ...s.view.environment, minuteOfDay: 0, weather: 'overcast' },
      players: [
        {
          characterId: 'other',
          name: 'Other',
          level: 1,
          portraitRef: '',
          imageUrl: '/other-sharp.png',
          online: true,
          attackable: false,
          position: { ...s.view.position, x: s.view.position.x + 1 },
        },
      ],
    })
    s.frame(40)
    const lastCloud = Math.max(
      ...s.draws.filter((draw) => draw.src === '').map((draw) => draw.order),
    )
    for (const src of ['/self-sharp.png', '/other-sharp.png'])
      expect(s.draws.filter((draw) => draw.src === src).at(-1)!.order).toBeGreaterThan(lastCloud)
    expect(
      s.fills
        .filter((fill) => fill.colour === 'rgba(6,28,35,.92)')
        .every((fill) => fill.order > lastCloud),
    ).toBe(true)
    for (const text of s.texts.filter((text) => text.text === 'You' || text.text === 'Other')) {
      expect(text.x * 1.5).toBeCloseTo(Math.round(text.x * 1.5))
      expect(text.y * 1.5).toBeCloseTo(Math.round(text.y * 1.5))
    }
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('retains the clicked ground tile when the following camera moves before release', () => {
    const s = scene()
    s.frame(40)
    const destination = { sectorId: 'verdant-expanse', x: 8, y: 4 }
    s.event('pointerdown', 563.2, 384.48)
    s.motion.plan([{ position: { ...s.view.position, x: 8 }, durationMs: 200 }], s.view.sectors, 40)
    for (let now = 56; now <= 200; now += 16) s.frame(now)
    s.event('pointerup', 563.2, 384.48)
    expect(s.select).toHaveBeenCalledExactlyOnceWith(destination)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('remounts after a longitude crossing in the retained motion frame without a world-wide camera sweep', () => {
    const state = { ...newWorldState(), position: { sectorId: 'atlas:127:32', x: 12, y: 4 } },
      view = projectWorld(state, [], 1000),
      s = scene(true, view),
      destination = { sectorId: 'atlas:0:32', x: 0, y: 4 },
      arrived = projectWorld({ ...state, position: destination }, [], 1200)
    s.motion.plan([{ position: destination, durationMs: 200 }], view.sectors, 0)
    s.motion.reconcile(arrived, 200)
    expect(s.motion.sample(200).point.x).toBe(1664.5)
    s.renderer.dispose()
    const remounted = createMapRenderer(s.canvas, s.motion, arrived, s.select, vi.fn())!
    s.frame(400)
    expect(Number(s.canvas.dataset.cameraX)).toBe(1664.5)
    remounted.dispose()
    vi.unstubAllGlobals()
  })
  it('anchors the painted bridge footprint on its legal crossing and aligns its span with the road', () => {
    const s = scene(true)
    const props = s.images.find((image) =>
      (image as HTMLImageElement).src.endsWith('props-v02.webp'),
    )!
    Object.assign(props, { width: 1774, height: 887, naturalWidth: 1774 })
    s.frame(40)
    const bridge = s.draws.find(
      (draw) =>
        draw.src.endsWith('props-v02.webp') &&
        draw.args[0]! >= 887 &&
        draw.args[0]! < 1331 &&
        draw.args[1]! < 100,
    )!
    const paintedPoint = (x: number, y: number) => {
      const a = bridge.args,
        m = bridge.matrix
      const dx = a[4]! + ((x - a[0]!) / a[2]!) * a[6]!,
        dy = a[5]! + ((y - a[1]!) / a[3]!) * a[7]!
      return { x: m[0]! * dx + m[2]! * dy + m[4]!, y: m[1]! * dx + m[3]! * dy + m[5]! }
    }
    const center = paintedPoint(1194.72, 308.14)
    const point = mapPoint({ sectorId: s.view.position.sectorId, x: 10, y: 4 }, s.view.sectors)
    const expected = projectMapPoint(
      point,
      mapPoint(s.view.position, s.view.sectors),
      { x: 0, y: 0 },
      64,
      800,
      600,
    )
    expect(center.x).toBeCloseTo(expected.x * 1.5, 1)
    expect(center.y).toBeCloseTo(expected.y * 1.5, 1)
    const a = paintedPoint(1035, 386),
      b = paintedPoint(1354, 230)
    expect((b.x - a.x) * (b.y - a.y)).toBeGreaterThan(0)
    expect(
      s.fills.some((fill) => fill.colour === 'rgba(48,108,118,.96)' && fill.order < bridge.order),
    ).toBe(true)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('does not draw a bridge prop on a road without a real known liquid crossing', () => {
    const s = scene(true)
    s.renderer.update({
      ...s.view,
      sectors: s.view.sectors.map((sector) => ({
        ...sector,
        cells: sector.cells.map((cell) => ({
          ...cell,
          terrain: cell.terrain === '~' || cell.terrain === 'l' ? '.' : cell.terrain,
        })),
      })),
    })
    s.frame(40)
    expect(
      s.draws.some(
        (draw) =>
          draw.src.endsWith('props-v02.webp') &&
          draw.args[0]! >= 600 &&
          draw.args[0]! < 900 &&
          draw.args[1]! < 150,
      ),
    ).toBe(false)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('does not place a waterfall or receiving pond where the projected terrain contains no water', () => {
    const s = scene(true)
    const sector = s.view.sectors.find((sector) => sector.id === s.view.position.sectorId)!
    s.renderer.update({
      ...s.view,
      sectors: [
        {
          ...sector,
          cells: sector.cells.map((cell) => ({ ...cell, terrain: '.', walkable: true })),
          buildings: [],
          landmarks: [
            { id: 'dry-waterfall', name: 'Falls', kind: 'spring', x: 8, y: 3, sceneryIndex: 4 },
          ],
        },
      ],
    })
    s.frame(40)
    expect(
      s.draws.some(
        (draw) =>
          draw.src.endsWith('beauties-v03.webp') && draw.args[0] === 0 && draw.args[1] === 600,
      ),
    ).toBe(false)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
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
  it('feathers loaded biome materials over three tiles and retains the cached result while moving', () => {
    const s = scene(true)
    const current = s.view.sectors.find((sector) => sector.id === s.view.position.sectorId)!
    const cells = current.cells.map((cell) => ({ ...cell, terrain: '.', walkable: true }))
    const own = { ...current, cells, buildings: [], landmarks: [] }
    const neighbor = {
      ...own,
      id: 'other-biome',
      atlasColumn: own.atlasColumn! + 1,
      regionId: 'umbral-march',
    }
    s.renderer.update({ ...s.view, sectors: [own] })
    s.frame(40)
    const before = s.layerCount()
    s.renderer.update({ ...s.view, sectors: [own, neighbor] })
    s.frame(80)
    const feather = s.gradients.filter((gradient) =>
      gradient.stops.some((stop) => stop[1] === 'rgba(0,0,0,.5)'),
    )
    expect(feather).toHaveLength(2)
    for (const gradient of feather) {
      expect(Math.abs(gradient.coordinates[2]! - gradient.coordinates[0]!)).toBe(3 * 64)
      expect(gradient.stops).toEqual([
        [0, 'rgba(0,0,0,.5)'],
        [1, 'rgba(0,0,0,0)'],
      ])
    }
    expect(s.layerCount()).toBeGreaterThan(before)
    const cached = s.layerCount()
    s.renderer.update({ ...s.view, sectors: [own, neighbor] })
    s.frame(1240)
    expect(s.layerCount()).toBe(cached)
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
          imageUrl: '/bridge-traveller.png',
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
    expect(
      s.draws.some((draw) => draw.src === '/bridge-traveller.png' && draw.order > lastProp),
    ).toBe(true)
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
    expect(s.frames.size).toBe(0)
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
      // The motion reaches the exact tile; display anchors quantize by at most
      // half a physical pixel so the identity does not resample between pixels.
      expect(s.motion.sample(201).point).toEqual(point)
      const expectedScreen = projectMapPoint(point, camera, { x: 0, y: 0 }, tile, 800, 600)
      expect(Math.abs(groundX - expectedScreen.x)).toBeLessThanOrEqual(1 / 3 + 1e-9)
      expect(Math.abs(groundY - expectedScreen.y)).toBeLessThanOrEqual(1 / 3 + 1e-9)
      for (let now = 217; now <= 1600 && s.frames.size; now += 16) s.frame(now)
      expect(Number(s.canvas.dataset.cameraX)).toBe(point.x)
      expect(Number(s.canvas.dataset.cameraY)).toBe(point.y)
      expect(s.frames.size).toBe(0)
      s.renderer.dispose()
      vi.unstubAllGlobals()
    },
  )
})
