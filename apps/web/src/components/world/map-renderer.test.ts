import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { projectWorld } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import { localRoute, mapPoint, WorldMotion } from './world-motion'
import { createMapRenderer } from './map-renderer'
import { MAP_X, MAP_Y, projectMapPoint, unprojectMapPoint } from './map-projection'
import type { WorldView } from '@/world/types'
import * as biomes from './map-biome-transitions'

type RecordedPath = { operation: 'M' | 'L' | 'C' | 'Z'; points: number[] }[]
const imageRuntime = createRequire(import.meta.url)
const sharp = imageRuntime(imageRuntime.resolve('sharp', { paths: [imageRuntime.resolve('next')] }))

function scene(reduced = false, initial?: WorldView) {
  const images: { onload: (() => void) | null }[] = []
  const fills: { colour: string; alpha: number; order: number; path: RecordedPath }[] = []
  const rectangles: { colour: string; order: number }[] = []
  const ellipses: { point: { x: number; y: number }; order: number }[] = []
  const draws: {
    src: string
    image: HTMLImageElement
    order: number
    args: number[]
    matrix: number[]
  }[] = []
  const texts: {
    text: string
    x: number
    y: number
    font: string
    align: string
    maxWidth?: number
  }[] = []
  const transforms: number[][] = []
  const groundCurves: number[][] = []
  const gradients: { coordinates: number[]; stops: [number, string][] }[] = []
  const clips: { points: number[][]; matrix: number[]; order: number; path: RecordedPath }[] = []
  const strokes: { path: RecordedPath; matrix: number[]; order: number; colour: string }[] = []
  let path: number[][] = []
  let recordedPath: RecordedPath = []
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
        fills.push({
          colour: this.fillStyle,
          alpha: this.globalAlpha,
          order: ++drawOrder,
          path: recordedPath.map((part) => ({ ...part, points: [...part.points] })),
        })
      },
      stroke() {
        strokes.push({
          path: recordedPath.map((part) => ({ ...part, points: [...part.points] })),
          matrix: [...matrix],
          order: ++drawOrder,
          colour: (this as unknown as { strokeStyle: string }).strokeStyle,
        })
      },
      fillRect() {
        rectangles.push({ colour: this.fillStyle, order: ++drawOrder })
      },
      ellipse(x: number, y: number) {
        ellipses.push({
          point: {
            x: matrix[0]! * x + matrix[2]! * y + matrix[4]!,
            y: matrix[1]! * x + matrix[3]! * y + matrix[5]!,
          },
          order: drawOrder,
        })
      },
      drawImage(image: HTMLImageElement, ...args: number[]) {
        draws.push({ src: image.src ?? '', image, order: ++drawOrder, args, matrix: [...matrix] })
      },
      fillText(text: string, x: number, y: number, maxWidth?: number) {
        const state = this as unknown as { font: string; textAlign: string }
        texts.push({ text, x, y, font: state.font, align: state.textAlign, maxWidth })
      },
      beginPath() {
        recordedPath = []
        path = []
      },
      moveTo(x: number, y: number) {
        recordedPath.push({ operation: 'M', points: [x, y] })
        path.push([x, y])
      },
      lineTo(x: number, y: number) {
        recordedPath.push({ operation: 'L', points: [x, y] })
        path.push([x, y])
      },
      bezierCurveTo(...points: number[]) {
        recordedPath.push({ operation: 'C', points })
      },
      closePath() {
        recordedPath.push({ operation: 'Z', points: [] })
      },
      rect(x: number, y: number, width: number, height: number) {
        path.push([x, y], [x + width, y], [x + width, y + height], [x, y + height])
      },
      clip() {
        clips.push({
          points: path.map((point) => [...point]),
          path: recordedPath.map((part) => ({ ...part, points: [...part.points] })),
          matrix: [...matrix],
          order: drawOrder,
        })
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
  const identityDraws: typeof draws = []
  const identityClear = vi.fn()
  const identityCanvas = {
    style: {},
    width: 0,
    height: 0,
    getContext: () =>
      new Proxy(context, {
        get(target, key) {
          if (key === 'clearRect') return identityClear
          if (key === 'drawImage')
            return (image: HTMLImageElement, ...args: number[]) => {
              target.drawImage(image, ...args)
              identityDraws.push(draws.at(-1)!)
            }
          return Reflect.get(target, key)
        },
      }),
  } as unknown as HTMLCanvasElement
  const view = initial ?? projectWorld(newWorldState(), [], 1000),
    select = vi.fn(),
    selectPlayer = vi.fn(),
    onZoom = vi.fn(),
    onVisiblePlayers = vi.fn(),
    onStop = vi.fn()
  const motion = new WorldMotion(view)
  const renderer = createMapRenderer(
    canvas,
    motion,
    view,
    select,
    selectPlayer,
    onZoom,
    onVisiblePlayers,
    onStop,
    identityCanvas,
  )!
  return {
    fills,
    rectangles,
    ellipses,
    draws,
    texts,
    transforms,
    groundCurves,
    gradients,
    clips,
    strokes,
    images,
    resize: () => resizeCallback(),
    view,
    canvas,
    identityCanvas,
    identityDraws,
    identityClear,
    motion,
    renderer,
    select,
    selectPlayer,
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
  it('retains the displayed walking phase across a long background-tab interval', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
    const s = scene()
    const route = [6, 7, 8, 9, 10].map((x) => ({
      position: { ...s.view.position, x },
      durationMs: 200,
    }))
    s.motion.reconcile({ ...s.view, route, nextStepAt: 1200 }, 0)
    s.frame(100)
    const before = s.motion.sample(100)
    clock.mockReturnValue(100)
    s.visibility('hidden')
    expect(s.motion.sample(10100)).toEqual(before)
    clock.mockReturnValue(10100)
    s.visibility('visible')
    s.frame(10100)
    expect(s.motion.sample(10100)).toEqual(before)
    expect(s.motion.sample(10116).point.x - before.point.x).toBeCloseTo(0.08)
    expect(s.motion.sample(10200).position).toEqual(route[0]!.position)
    s.renderer.dispose()
    clock.mockRestore()
    vi.unstubAllGlobals()
  })
  it.each([
    ['oak', 'verdant-expanse', undefined, 7, false, 'nature', 224, 603, 0, 443],
    ['snow pine', 'frostmere', undefined, 7, false, 'nature', 599, 596, 439, 764],
    ['fallback birch', 'aureth-crown', undefined, 7, true, 'nature', 947, 594, 762, 1120],
    ['fallback pine', 'hollow-coast', undefined, 7, true, 'nature', 1336, 603, 1118, 1514],
    ['palm', 'glasswind-desert', undefined, 7, false, 'biomes', 230, 419, 30, 420],
    ['bare tree', 'emberreach', undefined, 7, false, 'biomes', 252, 867, 0, 443],
    ['willow', 'hollow-coast', undefined, 7, false, 'biomes', 630, 853, 442, 895],
    ['cypress', 'aureth-crown', undefined, 7, false, 'biomes', 1102, 866, 915, 1333],
    ['marsh pine', 'umbral-march', undefined, 7, false, 'biomes', 1510, 851, 1320, 1774],
    ['pink cherry', 'verdant-expanse', 'sakura', 7, false, 'beauties', 217, 444, 0, 458],
    ['white cherry', 'verdant-expanse', 'sakura', 8, false, 'beauties', 668, 435, 446, 899],
    ['autumn', 'verdant-expanse', 'autumn', 7, false, 'beauties', 1077, 439, 891, 1335],
    ['wisteria', 'verdant-expanse', 'wisteria', 7, false, 'beauties', 1540, 443, 1323, 1774],
  ] as const)(
    'isolates the %s canopy and roots at the original painted scale',
    (
      _name,
      regionId,
      landscape,
      treeX,
      fallback,
      family,
      contactX,
      contactY,
      safeLeft,
      safeRight,
    ) => {
      const base = projectWorld(newWorldState(), [], 1000),
        sector = base.sectors.find((sector) => sector.id === base.position.sectorId)!,
        position = { ...base.position, x: treeX },
        cells = sector.cells.map((cell) => ({
          ...cell,
          terrain: cell.x === treeX && cell.y === position.y ? 't' : '.',
        })),
        s = scene(true, {
          ...base,
          sectors: [{ ...sector, regionId, landscape, cells, buildings: [], landmarks: [] }],
        })
      for (const image of s.images) {
        const picture = image as HTMLImageElement
        if (picture.src.endsWith('nature-v02.webp'))
          Object.assign(image, { width: 1514, height: 1039, naturalWidth: 1514 })
        if (picture.src.endsWith('biomes-v02.webp') || picture.src.endsWith('beauties-v03.webp'))
          Object.assign(image, { width: 1774, height: 887, naturalWidth: 1774 })
        if (fallback && picture.src.endsWith('biomes-v02.webp'))
          Object.assign(image, { complete: false, naturalWidth: 0 })
      }
      s.frame(40)
      const tree = s.draws.find(
          (draw) =>
            draw.src.includes(`${family}-v`) && (family !== 'nature' || draw.args[1]! < 300),
        )!,
        a = tree.args,
        m = tree.matrix,
        x = a[4]! + ((contactX - a[0]!) / a[2]!) * a[6]!,
        y = a[5]! + ((contactY - a[1]!) / a[3]!) * a[7]!,
        point = mapPoint(position, s.view.sectors),
        expected = projectMapPoint(
          { x: point.x, y: point.y + 0.25 },
          mapPoint(base.position, s.view.sectors),
          { x: 0, y: 0 },
          64,
          800,
          600,
        )
      expect(a[0]).toBeGreaterThanOrEqual(safeLeft)
      expect(a[0]! + a[2]!).toBeLessThanOrEqual(safeRight)
      expect(a[1]! + a[3]!).toBeGreaterThan(contactY)
      expect(a[6]! / a[2]!).toBeCloseTo((64 * 1.65) / (family === 'nature' ? 1514 / 4 : 1774 / 4))
      expect(a[7]! / a[3]!).toBeCloseTo((64 * 2.55) / (family === 'nature' ? 1039 / 2 : 887 / 2))
      expect(m[0]! * x + m[2]! * y + m[4]!).toBeCloseTo(expected.x * 1.5, 1)
      expect(m[1]! * x + m[3]! * y + m[5]!).toBeCloseTo(expected.y * 1.5, 1)
      s.renderer.dispose()
      vi.unstubAllGlobals()
    },
  )
  it.each(['animated', 'effects off', 'reduced motion'])(
    'keeps an isolated snow tree floor fixed with %s without rebuilding ground',
    (mode) => {
      const base = projectWorld(newWorldState(), [], 1000),
        sector = base.sectors.find((sector) => sector.id === base.position.sectorId)!,
        cells = sector.cells.map((cell) => ({
          ...cell,
          terrain: cell.x === base.position.x + 2 && cell.y === base.position.y ? 't' : '.',
        })),
        s = scene(mode === 'reduced motion', {
          ...base,
          sectors: [{ ...sector, regionId: 'frostmere', cells, buildings: [], landmarks: [] }],
        })
      const sheet = s.images.find((image) =>
        (image as HTMLImageElement).src.endsWith('nature-v02.webp'),
      )!
      Object.assign(sheet, { width: 1514, height: 1039, naturalWidth: 1514 })
      if (mode === 'effects off') s.renderer.settings({ animate: false, zoom: 1 })
      const point = mapPoint({ ...base.position, x: base.position.x + 2 }, s.view.sectors)
      const expected = projectMapPoint(
        { x: point.x, y: point.y + 0.25 },
        mapPoint(base.position, s.view.sectors),
        { x: 0, y: 0 },
        64,
        800,
        600,
      )
      const contacts = [],
        canopies = [],
        layers = []
      for (const now of [40, 440, 840]) {
        s.renderer.settings({ animate: mode !== 'effects off', zoom: 1 })
        s.frame(now)
        const tree = s.draws
            .filter((draw) => draw.src.endsWith('nature-v02.webp') && draw.args[1]! < 300)
            .at(-1)!,
          a = tree.args,
          m = tree.matrix,
          project = (px: number, py: number) => {
            const x = a[4]! + ((px - a[0]!) / a[2]!) * a[6]!,
              y = a[5]! + ((py - a[1]!) / a[3]!) * a[7]!
            return { x: m[0]! * x + m[2]! * y + m[4]!, y: m[1]! * x + m[3]! * y + m[5]! }
          }
        contacts.push(project(599, 596))
        canopies.push(project(587, 80))
        layers.push(s.layerCount())
      }
      for (const contact of contacts) {
        expect(contact.x).toBeCloseTo(expected.x * 1.5, 1)
        expect(contact.y).toBeCloseTo(expected.y * 1.5, 1)
      }
      expect(layers[2]).toBe(layers[0])
      expect(contacts[0]!.x).toBeCloseTo(contacts[2]!.x)
      expect(contacts[0]!.y).toBeCloseTo(contacts[2]!.y)
      if (mode === 'animated') expect(canopies[0]!.x).not.toBeCloseTo(canopies[2]!.x)
      else expect(canopies[0]!.x).toBeCloseTo(canopies[2]!.x)
      s.renderer.dispose()
      vi.unstubAllGlobals()
    },
  )
  it.each([
    ['frostmere', 1552, 392],
    ['emberreach', 1109, 409],
  ] as const)(
    'plants the %s rock floor on its blocked cell with a contact shadow and no hard terrain diamond',
    (regionId, contactX, contactY) => {
      const base = projectWorld(newWorldState(), [], 1000),
        sector = base.sectors.find((sector) => sector.id === base.position.sectorId)!,
        rockPosition = { ...base.position, x: base.position.x + 2 },
        cells = sector.cells.map((cell) => ({
          ...cell,
          terrain: cell.x === rockPosition.x && cell.y === rockPosition.y ? '#' : '.',
          walkable: cell.x !== rockPosition.x || cell.y !== rockPosition.y,
        })),
        s = scene(true, {
          ...base,
          sectors: [{ ...sector, regionId, cells, buildings: [], landmarks: [] }],
          players: [],
        })
      const sheet = s.images.find((image) =>
        (image as HTMLImageElement).src.endsWith('biomes-v02.webp'),
      )!
      Object.assign(sheet, { width: 1774, height: 887, naturalWidth: 1774 })
      s.frame(40)
      const rock = s.draws.find((draw) => draw.src.endsWith('biomes-v02.webp'))!,
        a = rock.args,
        m = rock.matrix,
        x = a[4]! + ((contactX - a[0]!) / a[2]!) * a[6]!,
        y = a[5]! + ((contactY - a[1]!) / a[3]!) * a[7]!,
        contact = { x: m[0]! * x + m[2]! * y + m[4]!, y: m[1]! * x + m[3]! * y + m[5]! },
        expected = projectMapPoint(
          mapPoint(rockPosition, s.view.sectors),
          mapPoint(s.view.position, s.view.sectors),
          { x: 0, y: 0 },
          64,
          800,
          600,
        )
      expect(contact.x).toBeCloseTo(expected.x * 1.5, 1)
      expect(contact.y).toBeCloseTo(expected.y * 1.5, 1)
      expect(
        s.ellipses.some(
          (shadow) =>
            shadow.order < rock.order &&
            Math.hypot(shadow.point.x - contact.x, shadow.point.y - contact.y) < 0.1,
        ),
      ).toBe(true)
      expect(s.rectangles.some((rectangle) => rectangle.colour === '#4f5350')).toBe(false)
      expect(
        s.view.sectors[0]!.cells.find(
          (cell) => cell.x === rockPosition.x && cell.y === rockPosition.y,
        )?.walkable,
      ).toBe(false)
      s.renderer.dispose()
      vi.unstubAllGlobals()
    },
  )
  it('waits for the rock sheet instead of drawing a padded tree crop on blocked Frostmere ground', () => {
    const base = projectWorld(newWorldState(), [], 1000)
    const sector = base.sectors.find((sector) => sector.id === base.position.sectorId)!
    const rockPosition = { ...base.position, x: base.position.x + 2 }
    const s = scene(true, {
      ...base,
      players: [],
      sectors: [
        {
          ...sector,
          regionId: 'frostmere',
          buildings: [],
          landmarks: [],
          cells: sector.cells.map((cell) => ({
            ...cell,
            terrain: cell.x === rockPosition.x && cell.y === rockPosition.y ? '#' : '.',
            walkable: cell.x !== rockPosition.x || cell.y !== rockPosition.y,
          })),
        },
      ],
    })
    try {
      const sheet = s.images.find((image) =>
        (image as HTMLImageElement).src.endsWith('biomes-v02.webp'),
      )!
      Object.assign(sheet, { complete: false, width: 1774, height: 887, naturalWidth: 1774 })
      s.frame(40)
      expect(
        s.draws.some((draw) => draw.src.endsWith('nature-v02.webp') && draw.args[1] === 0),
      ).toBe(false)
      expect(s.draws.some((draw) => draw.src.endsWith('biomes-v02.webp'))).toBe(false)
      Object.assign(sheet, { complete: true })
      sheet.onload?.()
      s.frame(80)
      expect(
        s.draws.some((draw) => draw.src.endsWith('biomes-v02.webp') && draw.args[0] === 1348),
      ).toBe(true)
      expect(
        s.view.sectors[0]!.cells.find(
          (cell) => cell.x === rockPosition.x && cell.y === rockPosition.y,
        )?.walkable,
      ).toBe(false)
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  })
  it('retains indexed terrain for unchanged receipts and rebuilds for actual terrain or atlas changes', () => {
    const build = vi.spyOn(biomes, 'buildBiomeTransitions')
    const s = scene(true),
      initialCalls = build.mock.calls.length
    s.renderer.update({ ...s.view, players: [] })
    expect(build).toHaveBeenCalledTimes(initialCalls)
    s.renderer.update({ ...s.view, sectors: [...s.view.sectors] })
    expect(build).toHaveBeenCalledTimes(initialCalls)
    s.renderer.update({
      ...s.view,
      sectors: s.view.sectors.map((sector, index) =>
        index
          ? sector
          : {
              ...sector,
              cells: sector.cells.map((cell, i) =>
                i ? cell : { ...cell, terrain: '~', walkable: false },
              ),
            },
      ),
    })
    expect(build).toHaveBeenCalledTimes(initialCalls + 1)
    s.renderer.update({ ...s.view, sectors: [...s.view.sectors], atlas: [...(s.view.atlas ?? [])] })
    expect(build).toHaveBeenCalledTimes(initialCalls + 2)
    s.renderer.dispose()
    build.mockRestore()
    vi.unstubAllGlobals()
  })
  it.each(['effects off', 'reduced motion'])(
    'interpolates a confirmed remote traveller at 60fps with %s and paints the terminal frame',
    (mode) => {
      vi.useFakeTimers({ toFake: ['performance'] })
      const base = projectWorld(newWorldState(), [], 1000)
      const player = {
        characterId: 'remote',
        name: 'Remote',
        level: 1,
        portraitRef: '',
        imageUrl: '/remote-moving.png',
        online: true,
        attackable: false,
        position: { ...base.position, x: base.position.x + 1 },
      }
      const s = scene(mode === 'reduced motion', { ...base, players: [player] })
      if (mode === 'effects off') s.renderer.settings({ animate: false, zoom: 1 })
      s.frame(0)
      const anchor = () =>
        s.draws
          .filter((draw) => draw.src === '/remote-moving.png')
          .at(-1)!
          .args.at(-4)! + 17
      const before = anchor()
      s.renderer.update({
        ...base,
        players: [{ ...player, position: { ...player.position, x: player.position.x + 2 } }],
      })
      s.frame(0)
      expect(anchor()).toBe(before)
      expect(s.frames.size).toBe(1)
      s.frame(17)
      expect(anchor()).toBeGreaterThan(before)
      expect(anchor() - before).toBeLessThan(6)
      expect(s.frames.size).toBe(1)
      for (let now = 34; now <= 391; now += 17) s.frame(now)
      s.frame(401)
      expect(anchor() - before).toBeCloseTo(2 * 64 * 0.85, 0)
      expect(s.frames.size).toBe(0)
      s.renderer.dispose()
      vi.useRealTimers()
      vi.unstubAllGlobals()
    },
  )
  it('keeps held motion advancing while the next key timer is dispatched late', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
    const s = scene()
    s.select.mockImplementation((destination) => {
      const now = performance.now()
      const route = localRoute(s.view, s.motion.sample(now).position, destination)
      if (route) s.motion.plan(route, s.view.sectors, now)
    })
    try {
      s.listeners.get('keydown')!({ key: 'd', preventDefault() {} } as unknown as Event)
      let previous = s.motion.sample(200).point.x
      // The event loop dispatches the scheduled200ms callback at260ms.
      // Frames in that window must still traverse the already supplied route.
      for (const now of [208, 224, 240, 256]) {
        clock.mockReturnValue(now)
        const sample = s.motion.sample(now)
        expect(sample.moving).toBe(true)
        expect(sample.point.x).toBeGreaterThan(previous)
        previous = sample.point.x
      }
      clock.mockReturnValue(260)
      const before = s.motion.sample(260).point
      vi.advanceTimersByTime(200)
      expect(s.motion.sample(260).point).toEqual(before)
      expect(s.motion.sample(276).moving).toBe(true)
      s.listeners.get('keyup')!({ key: 'd' } as unknown as Event)
      const calls = s.select.mock.calls.length
      vi.advanceTimersByTime(1000)
      expect(s.select).toHaveBeenCalledTimes(calls)
    } finally {
      s.renderer.dispose()
      clock.mockRestore()
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })
  it.each(['attack', 'approach'])(
    'does not enqueue a held-key release write before focusing %s',
    (action) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
      const s = scene()
      s.select.mockImplementation((destination) => {
        const route = localRoute(s.view, s.motion.sample(performance.now()).position, destination)
        if (route) s.motion.plan(route, s.view.sectors, performance.now())
      })
      try {
        s.listeners.get('keydown')!({ key: 'd', preventDefault() {} } as unknown as Event)
        vi.advanceTimersByTime(50)
        s.listeners.get('blur')!({
          relatedTarget: {
            getAttribute: (name: string) => (name === 'data-world-primary-action' ? action : null),
          },
        } as unknown as Event)
        if (action === 'attack') s.motion.hold(50)
        vi.advanceTimersByTime(1000)
        expect(s.select).toHaveBeenCalledTimes(1)
        if (action === 'attack') expect(s.motion.sample(1050).moving).toBe(false)
      } finally {
        s.renderer.dispose()
        vi.useRealTimers()
        vi.unstubAllGlobals()
      }
    },
  )
  it('keeps approved slow-terrain walking continuous through a late held callback and finishes only the released landing', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
    const s = scene()
    const view = {
      ...s.view,
      sectors: s.view.sectors.map((sector) => ({ ...sector, stepMs: 400 })),
    }
    s.renderer.update(view)
    s.select.mockImplementation((destination) => {
      const route = localRoute(view, s.motion.sample(performance.now()).position, destination)
      if (route) s.motion.plan(route, view.sectors, performance.now())
    })
    try {
      s.listeners.get('keydown')!({ key: 'd', preventDefault() {} } as unknown as Event)
      const route = localRoute(view, view.position, { ...view.position, x: view.position.x + 3 })!
      clock.mockReturnValue(90)
      s.motion.reconcile(
        { ...view, route, version: view.version + 1, serverNow: 1090, nextStepAt: 1400 },
        90,
      )
      let previous = s.motion.sample(400).point.x
      for (const now of [408, 424, 440, 456]) {
        clock.mockReturnValue(now)
        const sample = s.motion.sample(now)
        expect(sample.moving).toBe(true)
        expect(sample.point.x).toBeGreaterThan(previous)
        previous = sample.point.x
      }
      clock.mockReturnValue(460)
      const before = s.motion.sample(460).point
      vi.advanceTimersByTime(400)
      expect(s.motion.sample(460).point).toEqual(before)
      s.listeners.get('keyup')!({ key: 'd' } as unknown as Event)
      const calls = s.select.mock.calls.length
      vi.advanceTimersByTime(1000)
      expect(s.select).toHaveBeenCalledTimes(calls)
      expect(s.motion.sample(1200).position).toEqual({ ...view.position, x: view.position.x + 2 })
    } finally {
      s.renderer.dispose()
      clock.mockRestore()
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })
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
      expect(s.motion.sample(stepMs).position).toEqual({ ...view.position, x: view.position.x + 1 })
      s.listeners.get('keyup')?.({ key: 'd' } as unknown as Event)
      const calls = s.select.mock.calls.length
      vi.advanceTimersByTime(1000)
      expect(s.select).toHaveBeenCalledTimes(calls)
      expect(s.motion.sample(stepMs * 3).position).toEqual({
        ...view.position,
        x: view.position.x + 2,
      })
      s.renderer.dispose()
      vi.useRealTimers()
      vi.unstubAllGlobals()
    },
  )
  it('continues authored held-key cadence until the actual delayed key release', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    const s = scene()
    const selectedAt: number[] = []
    s.select.mockImplementation((destination) => {
      const now = performance.now()
      selectedAt.push(now)
      const route = localRoute(s.view, s.motion.sample(now).position, destination)
      if (route) s.motion.plan(route, s.view.sectors, now)
    })
    try {
      s.listeners.get('keydown')!({ key: 'd', preventDefault() {} } as unknown as Event)
      vi.advanceTimersByTime(850)
      expect(selectedAt).toEqual([0, 200, 400, 600, 800])
      s.listeners.get('keyup')!({ key: 'd' } as unknown as Event)
      vi.advanceTimersByTime(1000)
      expect(selectedAt).toEqual([0, 200, 400, 600, 800, 850])
      expect(s.motion.sample(1850).position).toEqual({
        ...s.view.position,
        x: s.view.position.x + 5,
      })
    } finally {
      s.renderer.dispose()
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })
  it.each([200, 400].flatMap((stepMs) => [8, 20].map((cost) => ({ stepMs, cost }))))(
    'keeps held-key deadlines at $stepMs ms despite $cost ms selection work',
    ({ stepMs, cost }) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
      const s = scene()
      const view = { ...s.view, sectors: s.view.sectors.map((sector) => ({ ...sector, stepMs })) }
      s.renderer.update(view)
      const selectedAt: number[] = []
      s.select.mockImplementation((destination) => {
        const now = performance.now()
        selectedAt.push(now)
        const route = localRoute(view, s.motion.sample(now).position, destination)
        if (route) s.motion.plan(route, view.sectors, now)
        vi.advanceTimersByTime(cost)
      })
      try {
        s.listeners.get('keydown')!({ key: 'd', preventDefault() {} } as unknown as Event)
        vi.advanceTimersByTime(stepMs - cost)
        expect(selectedAt).toEqual([0, stepMs])
        s.listeners.get('keyup')!({ key: 'd' } as unknown as Event)
        expect(s.motion.sample(stepMs + cost).moving).toBe(true)
      } finally {
        s.renderer.dispose()
        vi.useRealTimers()
        vi.unstubAllGlobals()
      }
    },
  )
  it.each(['keyup', 'blur', 'window:blur', 'hidden', 'dispose'])(
    'ends a held-key stream on %s and keeps a tap to one step',
    (release) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
      const s = scene()
      s.select.mockImplementation((destination) => {
        const now = performance.now()
        const route = localRoute(s.view, s.motion.sample(now).position, destination)
        if (route) s.motion.plan(route, s.view.sectors, now)
      })
      try {
        s.listeners.get('keydown')!({ key: 'd', preventDefault() {} } as unknown as Event)
        vi.advanceTimersByTime(50)
        if (release === 'hidden') s.visibility('hidden')
        else if (release === 'dispose') s.renderer.dispose()
        else s.listeners.get(release)?.({ key: 'd' } as unknown as Event)
        const calls = s.select.mock.calls.length
        vi.advanceTimersByTime(1000)
        expect(s.select).toHaveBeenCalledTimes(calls)
        if (release === 'hidden') {
          s.visibility('visible')
          vi.advanceTimersByTime(200)
        }
        expect(s.motion.sample(performance.now()).position).toEqual({
          ...s.view.position,
          x: s.view.position.x + 1,
        })
      } finally {
        s.renderer.dispose()
        vi.useRealTimers()
        vi.unstubAllGlobals()
      }
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
    try {
      s.listeners.get('keydown')!({ key: 'd', preventDefault() {} } as unknown as Event)
      vi.advanceTimersByTime(200)
      expect(s.motion.sample(200).position).toEqual(west)
      vi.advanceTimersByTime(399)
      expect(s.select).toHaveBeenCalledTimes(2)
      expect(s.motion.sample(599).position).toEqual(west)
      vi.advanceTimersByTime(1)
      expect(s.motion.sample(600).position).toEqual(east)
      expect(s.select).toHaveBeenCalledTimes(3)
      s.listeners.get('keyup')!({ key: 'd' } as unknown as Event)
      const calls = s.select.mock.calls.length
      vi.advanceTimersByTime(1000)
      expect(s.select).toHaveBeenCalledTimes(calls)
      expect(s.motion.sample(1600).position).toEqual({ ...east, x: 1 })
    } finally {
      s.renderer.dispose()
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
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
      expect(text.x * 3).toBeCloseTo(Math.round(text.x * 3))
      expect(text.y * 3).toBeCloseTo(Math.round(text.y * 3))
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
      s.clips.some(
        (clip) => clip.path.some((part) => part.operation === 'C') && clip.order < bridge.order,
      ),
    ).toBe(true)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it.each([
    ['verdant-expanse', 3, 6],
    ['aureth-crown', 4, 5],
  ] as const)(
    'clips the %s arch water to its complete proven legal crossing',
    (sectorId, from, to) => {
      const state = newWorldState()
      state.position = { ...state.position, sectorId }
      const s = scene(true, projectWorld(state, [], 1000))
      s.frame(40)
      const origin = mapPoint({ ...s.view.position, x: 0, y: 0 }, s.view.sectors)
      const camera = mapPoint(s.view.position, s.view.sectors)
      const openingIndex = s.clips.findIndex((clip) =>
        clip.path.some((part) => part.operation === 'C'),
      )
      const crossing = s.clips.find((clip, index) => {
        if (index !== openingIndex - 1 || clip.points.length !== 4) return false
        const points = clip.points.map(([x, y]) => {
          const m = clip.matrix
          const world = unprojectMapPoint(
            {
              x: (m[0]! * x! + m[2]! * y! + m[4]!) / 1.5,
              y: (m[1]! * x! + m[3]! * y! + m[5]!) / 1.5,
            },
            camera,
            { x: 0, y: 0 },
            64,
            800,
            600,
          )
          return { x: world.x - origin.x + 0.5, y: world.y - origin.y + 0.5 }
        })
        return (
          Math.abs(Math.min(...points.map((p) => p.x)) - 10) < 1e-8 &&
          Math.abs(Math.max(...points.map((p) => p.x)) - 11) < 1e-8 &&
          Math.abs(Math.min(...points.map((p) => p.y)) - from) < 1e-8 &&
          Math.abs(Math.max(...points.map((p) => p.y)) - to) < 1e-8
        )
      })
      expect(crossing).toBeDefined()
      s.renderer.dispose()
      vi.unstubAllGlobals()
    },
  )
  it.each([
    ['water', '~', 0],
    ['water', '~', 1],
    ['lava', 'l', 0],
    ['lava', 'l', 1],
  ] as const)(
    'fills the original transparent %s (%s) arch through its mouths on axis %s',
    async (material, terrain, axis) => {
      const base = projectWorld(newWorldState(), [], 1000)
      const sector = base.sectors.find((sector) => sector.id === base.position.sectorId)!
      const cells = sector.cells.map((cell) => {
        const along = axis === 0 ? cell.x : cell.y
        const across = axis === 0 ? cell.y : cell.x
        const center = axis === 0 ? 6 : 4
        const crossCenter = axis === 0 ? 4 : 6
        const value =
          along === center
            ? Math.abs(across - crossCenter) === 2
              ? terrain
              : Math.abs(across - crossCenter) < 2
                ? '='
                : '.'
            : '.'
        return { ...cell, terrain: value, walkable: value !== terrain }
      })
      const s = scene(true, {
        ...base,
        players: [],
        sectors: [
          {
            ...sector,
            cells,
            buildings: [],
            landmarks: [{ id: 'crossing', kind: 'bridge', name: 'Bridge', x: 6, y: 4 }],
          },
        ],
      })
      try {
        const sheet = s.images.find((image) =>
          (image as HTMLImageElement).src.endsWith('props-v02.webp'),
        )!
        Object.assign(sheet, { width: 1774, height: 887, naturalWidth: 1774 })
        s.frame(40)
        const bridge = s.draws.find((draw) => draw.src.endsWith('props-v02.webp'))!
        const colour = material === 'water' ? 'rgba(48,108,118,.96)' : 'rgba(183,79,40,.96)'
        expect(s.fills.some((fill) => fill.colour === colour)).toBe(false)
        const openingIndex = s.clips.findIndex((clip) =>
          clip.path.some((part) => part.operation === 'C'),
        )
        const opening = s.clips[openingIndex]!
        const strip = s.clips[openingIndex - 1]!
        const surface = s.draws.find(
          (draw) =>
            draw.src === '' &&
            draw.args.length === 4 &&
            draw.image.width < 400 &&
            draw.order < bridge.order,
        )!
        expect(surface).toBeDefined()
        const a = bridge.args
        const point = (x: number, y: number) => [
          ((x - a[4]!) / a[6]!) * a[2]! + a[0]!,
          ((y - a[5]!) / a[7]!) * a[3]! + a[1]!,
        ]
        const commands = opening.path
          .map(
            ({ operation, points }) =>
              operation +
              points
                .flatMap((value, i) => (i % 2 === 0 ? point(value, points[i + 1]!) : []))
                .join(' '),
          )
          .join(' ')
        const crossing = strip.points.map(([x, y]) => point(x!, y!).join(',')).join(' ')
        const image = await readFile(
          new URL('../../../public/media/art/world/runtime/props-v02.webp', import.meta.url),
        )
        const colours =
          material === 'water'
            ? ['#245e67', '#3e7b82', '#244e60']
            : ['#702f25', '#bd5b2e', '#4d2526']
        const materialGradients = s.gradients.filter(
          (gradient) =>
            gradient.stops.length === 3 &&
            gradient.stops.every((stop, i) => stop[1] === colours[i]),
        )
        expect(materialGradients).toHaveLength(2)
        const gradient = materialGradients[1]!
        const projectedGradient = (x: number, y: number) =>
          point(
            (x + surface.args[0]! - y - surface.args[1]!) * MAP_X * (axis === 0 ? -1 : 1),
            (x + surface.args[0]! + y + surface.args[1]!) * MAP_Y,
          )
        const [gx1, gy1] = projectedGradient(gradient.coordinates[0]!, gradient.coordinates[1]!)
        const [gx2, gy2] = projectedGradient(gradient.coordinates[2]!, gradient.coordinates[3]!)
        const stops = gradient.stops
          .map(([offset, value]) => `<stop offset="${offset}" stop-color="${value}"/>`)
          .join('')
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="600" viewBox="950 60 720 600"><defs><clipPath id="crossing"><polygon points="${crossing}"/></clipPath><clipPath id="prop"><rect x="950" y="60" width="460" height="380"/></clipPath><linearGradient id="liquid" gradientUnits="userSpaceOnUse" x1="${gx1}" y1="${gy1}" x2="${gx2}" y2="${gy2}">${stops}</linearGradient></defs><rect x="950" y="60" width="720" height="600" fill="#a49b77"/><path d="${commands}" fill="url(#liquid)" clip-path="url(#crossing)"/><image width="1774" height="887" href="data:image/webp;base64,${image.toString('base64')}" clip-path="url(#prop)"/></svg>`
        const raster: Buffer = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer()
        const original: Buffer = await sharp(image).ensureAlpha().raw().toBuffer()
        const pixel = (x: number, y: number) =>
          Array.from(
            raster.subarray(((y - 60) * 720 + x - 950) * 4, ((y - 60) * 720 + x - 950) * 4 + 3),
          )
        for (const [x, y] of [
          [1290, 350],
          [1280, 365],
          [1250, 375],
          [1260, 270],
        ]) {
          expect(original[(y! * 1774 + x!) * 4 + 3]).toBeLessThan(10)
          const [red, green, blue] = pixel(x!, y!)
          if (material === 'water') {
            expect(green!).toBeGreaterThan(red! * 1.5)
            expect(blue!).toBeGreaterThan(red! * 1.5)
          } else expect(red!).toBeGreaterThan(blue! * 2)
        }
        // The river outlet continues beyond the bridge crop without a rectangular material edge.
        const outlet = pixel(1420, 355)
        expect(outlet).not.toEqual([164, 155, 119])
        expect(outlet).not.toEqual(material === 'water' ? [48, 108, 118] : [183, 79, 40])
        // Adjacent ground and the underpass evaluate the same world gradient.
        const origin = mapPoint({ ...base.position, x: 0, y: 0 }, base.sectors)
        const offsetX = (origin.x - 0.5 + (axis === 0 ? 6 : 5)) * 64
        const offsetY = (origin.y - 0.5 + (axis === 0 ? 3 : 4)) * 64
        expect(gradient.coordinates[0]).toBe(-offsetX)
        expect(gradient.coordinates[1]).toBe(-offsetY)
        // This transparent source pixel belongs to the dry bank, outside the proved strip.
        expect(pixel(1170, 410)).toEqual([164, 155, 119])
      } finally {
        s.renderer.dispose()
        vi.unstubAllGlobals()
      }
    },
  )
  it.each([
    ['water', 'verdant-expanse', 'animated'],
    ['water', 'verdant-expanse', 'off'],
    ['water', 'verdant-expanse', 'reduced'],
    ['water', 'verdant-expanse', 'paused'],
    ['lava', 'emberreach', 'animated'],
    ['lava', 'emberreach', 'off'],
    ['lava', 'emberreach', 'reduced'],
    ['lava', 'emberreach', 'paused'],
  ] as const)(
    'retains cached %s underpass material in %s with %s motion',
    (material, sectorId, mode) => {
      const state = newWorldState()
      state.position = { sectorId, x: 9, y: 4 }
      const view = projectWorld(state, [], 1000)
      const own = view.sectors.find((sector) => sector.id === sectorId)!
      const s = scene(mode === 'reduced', { ...view, players: [], sectors: [own] })
      try {
        const props = s.images.find((image) =>
          (image as HTMLImageElement).src.endsWith('props-v02.webp'),
        )!
        Object.assign(props, { width: 1774, height: 887, naturalWidth: 1774 })
        s.renderer.settings({ animate: mode !== 'off', zoom: 1 })
        s.frame(40)
        const terrain = JSON.stringify(s.view.sectors[0]!.cells)
        const layers = s.layerCount()
        const underpass = () => {
          const bridge = s.draws
            .filter(
              (draw) => draw.src.endsWith('props-v02.webp') && Math.abs(draw.args[0]! - 950) < 1e-5,
            )
            .at(-1)!
          const surface = s.draws
            .filter(
              (draw) => draw.src === '' && draw.image.width < 400 && draw.order < bridge.order,
            )
            .at(-1)!
          return s.strokes
            .filter(
              (stroke) =>
                stroke.order > surface.order &&
                stroke.order < bridge.order &&
                (material === 'water'
                  ? stroke.colour === '#bbded0' || stroke.colour === '#82c6c7'
                  : stroke.colour === 'rgba(255,196,95,.44)'),
            )
            .map((stroke) => stroke.path)
        }
        const first = underpass()
        if (mode === 'animated' || mode === 'paused') expect(first.length).toBeGreaterThan(0)
        else expect(first).toEqual([])
        const draws = s.draws.length
        if (mode === 'paused') s.renderer.settings({ animate: true, zoom: 1, paused: true })
        else s.renderer.update(s.view)
        s.frame(640)
        if (mode === 'animated') expect(underpass()).not.toEqual(first)
        else if (mode === 'paused') expect(s.draws).toHaveLength(draws)
        else expect(underpass()).toEqual([])
        expect(s.layerCount()).toBe(layers)
        expect(JSON.stringify(s.view.sectors[0]!.cells)).toBe(terrain)
      } finally {
        s.renderer.dispose()
        vi.unstubAllGlobals()
      }
    },
  )
  it('invalidates a bridge surface when an adjacent sector changes an internal underpass bank', () => {
    const base = projectWorld(newWorldState(), [], 1000)
    const original = base.sectors.find((sector) => sector.id === base.position.sectorId)!
    const makeCells = (columns: number[]) =>
      original.cells.map((cell) => {
        const terrain = columns.includes(cell.x)
          ? cell.y === 1 || cell.y === 7
            ? '~'
            : cell.y >= 2 && cell.y <= 6
              ? '='
              : '.'
          : '.'
        return { ...cell, terrain, walkable: terrain !== '~' }
      })
    const own = {
      ...original,
      cells: makeCells([11, 12]),
      buildings: [],
      landmarks: [{ id: 'crossing', kind: 'bridge' as const, name: 'Bridge', x: 12, y: 4 }],
    }
    const neighbor = {
      ...own,
      id: 'next-bank',
      atlasColumn: own.atlasColumn! + 1,
      cells: makeCells([0, 1]),
      landmarks: [],
    }
    const s = scene(true, {
      ...base,
      position: { ...base.position, x: 11 },
      sectors: [own, neighbor],
    })
    try {
      const props = s.images.find((image) =>
        (image as HTMLImageElement).src.endsWith('props-v02.webp'),
      )!
      Object.assign(props, { width: 1774, height: 887, naturalWidth: 1774 })
      s.frame(40)
      const surface = () =>
        s.draws
          .filter(
            (draw) => draw.src === '' && draw.image.width === 384 && draw.image.height === 480,
          )
          .at(-1)?.image
      const before = surface()
      expect(before).toBeDefined()
      s.renderer.update({
        ...s.view,
        sectors: [
          own,
          {
            ...neighbor,
            cells: neighbor.cells.map((cell) =>
              cell.x === 2 && cell.y === 3 ? { ...cell, terrain: '~', walkable: false } : cell,
            ),
          },
        ],
      })
      s.frame(80)
      expect(surface()).not.toBe(before)
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
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
  it('reuses warmed procedural terrain when camera visibility changes raster density', () => {
    const initial = projectWorld(newWorldState(), [], 1000)
    const sectors = Array.from({ length: 25 }, (_, index) => {
      const column = index % 5,
        row = Math.floor(index / 5),
        id = `dense-${column}-${row}`
      const position = (column: number, x: number) => ({
        sectorId: `dense-${column}-${row}`,
        x,
        y: 4,
      })
      return {
        ...initial.sectors[0]!,
        id,
        name: id,
        atlasColumn: column,
        atlasRow: row,
        regionId: (column + row) % 2 ? 'umbral-march' : 'verdant-expanse',
        charted: true,
        art: null,
        landmarks: [],
        buildings: [],
        cells: Array.from({ length: 117 }, (_, i) => ({
          x: i % 13,
          y: Math.floor(i / 13),
          terrain: Math.floor(i / 13) === 4 ? '=' : i % 13 === 10 ? '~' : '.',
          walkable: i % 13 !== 10 || Math.floor(i / 13) === 4,
          safe: false,
        })),
        exits: [
          ...(column < 4
            ? [
                {
                  from: position(column, 12),
                  to: position(column + 1, 0),
                  durationMs: 200,
                  name: 'Road',
                },
              ]
            : []),
          ...(column > 0
            ? [
                {
                  from: position(column, 0),
                  to: position(column - 1, 12),
                  durationMs: 200,
                  name: 'Road',
                },
              ]
            : []),
        ],
      }
    })
    const view = {
      ...initial,
      position: { sectorId: 'dense-1-2', x: 1, y: 4 },
      sectors,
      route: Array.from({ length: 37 }, (_, i) => ({
        position: { sectorId: `dense-${Math.floor((15 + i) / 13)}-2`, x: (15 + i) % 13, y: 4 },
        durationMs: 200,
      })),
      version: 1,
      nextStepAt: 1200,
    }
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
    const s = scene(true, view)
    try {
      for (let now = 0; now <= 1000; now += 40) s.frame(now)
      const curves = s.groundCurves.length
      s.frame(1040)
      expect(s.groundCurves.length).toBe(curves)
      for (let now = 1080; now <= 1280; now += 40) s.frame(now)
      const nextCurves = s.groundCurves.length
      s.frame(1320)
      expect(s.groundCurves.length).toBe(nextCurves)
      for (let now = 1360; now <= 2680; now += 40) s.frame(now)
      const beforeBudgetTransition = s.groundCurves.length
      s.frame(2720)
      expect(s.groundCurves.length).toBe(beforeBudgetTransition)
      for (let now = 2760; now <= 8000; now += 40) {
        s.frame(now)
        if (s.canvas.dataset.cachedPixels)
          expect(Number(s.canvas.dataset.cachedPixels)).toBeLessThanOrEqual(8_000_000)
      }
    } finally {
      s.renderer.dispose()
      clock.mockRestore()
      vi.unstubAllGlobals()
    }
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
    expect(s.identityDraws.some((d) => d.src === '/your-portrait.png')).toBe(true)
    expect(s.draws.some((d) => d.src === '/other-portrait.png')).toBe(false)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('walks with WASD in either case while retaining arrow-key movement', () => {
    for (const [key, dx, dy] of [
      ['w', 0, -1],
      ['W', 0, -1],
      ['a', -1, 0],
      ['s', 0, 1],
      ['d', 1, 0],
      ['ArrowRight', 1, 0],
    ] as const) {
      const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
      const s = scene()
      const view = {
        ...s.view,
        sectors: s.view.sectors.map((sector) => ({
          ...sector,
          cells: sector.cells.map((cell) => ({ ...cell, terrain: '.', walkable: true })),
        })),
      }
      s.renderer.update(view)
      s.select.mockImplementation((destination) => {
        const route = localRoute(view, s.motion.sample(performance.now()).position, destination)
        if (route) s.motion.plan(route, view.sectors, performance.now())
      })
      try {
        const preventDefault = vi.fn()
        s.listeners.get('keydown')!({ key, preventDefault } as unknown as Event)
        s.listeners.get('keyup')!({ key } as unknown as Event)
        const target = { ...view.position, x: view.position.x + dx, y: view.position.y + dy }
        expect(s.select).toHaveBeenLastCalledWith(target)
        expect(s.motion.sample(201).position).toEqual(target)
        expect(preventDefault).toHaveBeenCalledOnce()
      } finally {
        s.renderer.dispose()
        clock.mockRestore()
        vi.unstubAllGlobals()
      }
    }
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
  it.each([390, 800])('zooms out to 35%% at width %i without moving the camera', (width) => {
    const s = scene()
    Object.assign(s.canvas, { clientWidth: width })
    s.resize()
    s.renderer.settings({ animate: false, zoom: 1 })
    s.frame(40)
    const camera = [s.canvas.dataset.cameraX, s.canvas.dataset.cameraY]
    s.listeners.get('wheel')!({ deltaY: 10000, preventDefault() {} } as unknown as Event)
    s.frame(80)
    expect(s.onZoom).toHaveBeenLastCalledWith(0.35)
    expect(Number(s.canvas.dataset.tileSize)).toBeCloseTo((width < 600 ? 48 : 64) * 0.35)
    expect([s.canvas.dataset.cameraX, s.canvas.dataset.cameraY]).toEqual(camera)
    expect(s.select).not.toHaveBeenCalled()
    s.renderer.settings({ animate: false, zoom: 0.35, zoomLocked: true })
    s.onZoom.mockClear()
    s.listeners.get('wheel')!({ deltaY: -10000, preventDefault() {} } as unknown as Event)
    s.frame(120)
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
  it('drifts the same cloud silhouettes without frame-to-frame texture swaps', () => {
    const initial = projectWorld(newWorldState(), [], 1000)
    initial.sectors = initial.sectors.map((sector) =>
      sector.id === initial.position.sectorId
        ? { ...sector, atlasColumn: 10, atlasRow: 4 }
        : sector,
    )
    const s = scene(false, initial)
    const shadows = () =>
      s.draws.filter((draw) => draw.image.width === 384 && draw.image.height === 192)
    // At this elapsed time the old subtract-drift/floor expression rounds an
    // exact lattice index down on some frames, selecting a different texture.
    s.frame(36066.66666663011)
    const first = shadows()
    expect(first.length).toBeGreaterThan(0)
    for (let i = 1; i <= 30; i++) {
      s.draws.length = 0
      s.frame(36066.66666663011 + i * 34)
      const next = shadows()
      expect(next.length).toBe(first.length)
      for (let j = 0; j < next.length; j++) {
        expect(next[j]!.image).toBe(first[j]!.image)
        expect(next[j]!.args[0]! - first[j]!.args[0]!).toBeCloseTo((i * 34 * 64 * 0.85) / 18000)
        expect(next[j]!.args[1]! - first[j]!.args[1]!).toBeCloseTo((i * 34 * 64 * 0.44) / 18000)
      }
    }
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('retains every visible shadow on a large zoomed-out viewport instead of dropping at six', () => {
    const s = scene()
    Object.assign(s.canvas, { clientWidth: 2400, clientHeight: 1600 })
    s.renderer.settings({ animate: true, zoom: 0.6 })
    s.resize()
    s.frame(120)
    expect(Number(s.canvas.dataset.clouds)).toBeGreaterThan(6)
    expect(Number(s.canvas.dataset.clouds)).toBeLessThan(80)
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
  it.each([1, 2, 2.625, 3])(
    'renders portraits on a separate native-DPR surface with device-aligned edges at %s DPR',
    (density) => {
      const s = scene()
      window.devicePixelRatio = density
      s.resize()
      s.canvas.dataset.portrait = '/sharp-custom-portrait.png'
      s.frame(40)
      expect(s.canvas.width).toBe(Math.round(800 * Math.min(density, 1.5)))
      expect(s.identityCanvas.width).toBe(Math.round(800 * density))
      expect(s.identityCanvas.height).toBe(Math.round(600 * density))
      const draw = s.identityDraws.find((entry) => entry.src === '/sharp-custom-portrait.png')!
      expect(draw).toBeDefined()
      expect(draw.args.slice(0, 4)).toEqual([0, 0, 1200, 1200])
      const [x, y, width, height] = draw.args.slice(-4)
      for (const edge of [x!, y!, x! + width!, y! + height!])
        expect(edge * density).toBeCloseTo(Math.round(edge * density), 8)
      expect(width! * density).toBe(Math.round(34 * density))
      expect(height).toBe(width)
      expect(draw.matrix.slice(0, 4)).toEqual([density, 0, 0, density])
      expect(s.identityClear).toHaveBeenCalledWith(0, 0, 800, 600)
      expect(s.frames.size).toBe(1)
      s.renderer.dispose()
      expect(s.frames.size).toBe(0)
      vi.unstubAllGlobals()
    },
  )
  it.each([1, 2, 2.625, 3].flatMap((density) => [0.35, 1, 1.4].map((zoom) => ({ density, zoom }))))(
    'draws readable, uncompressed player labels at $zoom zoom and $density DPR',
    ({ density, zoom }) => {
      const s = scene()
      window.devicePixelRatio = density
      s.resize()
      s.renderer.update({
        ...s.view,
        players: [
          {
            characterId: 'name-peer',
            name: 'Sellophina',
            level: 1,
            portraitRef: '',
            imageUrl: '/peer.webp',
            online: true,
            attackable: false,
            position: { ...s.view.position, x: s.view.position.x + 1 },
          },
          {
            characterId: 'long-name-peer',
            name: 'A traveller with a very long display name',
            level: 1,
            portraitRef: '',
            imageUrl: '/long-peer.webp',
            online: true,
            attackable: false,
            position: { ...s.view.position, x: s.view.position.x + 2 },
          },
        ],
      })
      s.renderer.settings({ animate: true, zoom })
      s.frame(40)
      const self = s.texts.findLast((text) => text.text === 'You')!
      const peer = s.texts.findLast((text) => text.text === 'Sellophina')!
      const longName = s.texts.findLast((text) => text.text.startsWith('A traveller'))!
      expect(self).toBeDefined()
      expect(peer).toBeDefined()
      expect(longName).toBeDefined()
      for (const text of [self, peer, longName]) {
        expect(text.maxWidth).toBeUndefined()
        expect(text.align).toBe('left')
        expect(Number(/(\d+)px/.exec(text.font)![1])).toBeGreaterThanOrEqual(11)
        for (const coordinate of [text.x, text.y])
          expect(coordinate * density).toBeCloseTo(Math.round(coordinate * density), 8)
      }
      expect(longName.text).toMatch(/…$/)
      s.renderer.dispose()
      vi.unstubAllGlobals()
    },
  )
  it.each([1, 2, 2.625, 3])(
    'keeps the native identity surface at its exact bitmap scale in a fractional layout at %s DPR',
    (density) => {
      const s = scene()
      const style: Record<string, string> = {}
      Object.assign(s.identityCanvas, { style })
      Object.assign(s.canvas, {
        clientWidth: 847,
        clientHeight: 750,
        getBoundingClientRect: () => ({ left: 204.46875, top: 131.8125 }),
      })
      window.devicePixelRatio = density
      s.resize()
      expect(style.width).toBe(`${s.identityCanvas.width / density}px`)
      expect(style.height).toBe(`${s.identityCanvas.height / density}px`)
      const translate = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(style.transform)!
      expect(translate).not.toBeNull()
      expect((204.46875 + Number(translate[1])) * density).toBeCloseTo(
        Math.round(204.46875 * density),
        8,
      )
      expect((131.8125 + Number(translate[2])) * density).toBeCloseTo(
        Math.round(131.8125 * density),
        8,
      )
      s.renderer.dispose()
      vi.unstubAllGlobals()
    },
  )
  it('reuses the native identity bitmap during ambient-only frames without repeating portrait paint', () => {
    const s = scene()
    s.canvas.dataset.portrait = '/sharp-static.webp'
    s.frame(40)
    const portraits = s.identityDraws.length
    const clearCount = s.identityClear.mock.calls.length
    const phase = s.canvas.dataset.cloudPhase
    const scenery = s.draws.length
    s.frame(200)
    expect(s.identityDraws).toHaveLength(portraits)
    expect(s.identityClear).toHaveBeenCalledTimes(clearCount)
    expect(s.canvas.dataset.cloudPhase).not.toBe(phase)
    expect(s.draws.length).toBeGreaterThan(scenery)
    s.event('pointerdown', 400, 283)
    s.event('pointerup', 400, 283)
    expect(s.select).not.toHaveBeenCalled()
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it.each([0.35, 1, 1.4])(
    'sizes identities in proportion to terrain and matches their picking area at %s zoom',
    (zoom) => {
      const s = scene()
      s.canvas.dataset.portrait = '/scaled.webp'
      s.renderer.update({
        ...s.view,
        players: [
          {
            characterId: 'scaled-peer',
            name: 'Peer',
            level: 1,
            portraitRef: '',
            imageUrl: '/scaled-peer.webp',
            online: true,
            attackable: false,
            position: { ...s.view.position, x: s.view.position.x + 1 },
          },
        ],
      })
      s.renderer.settings({ animate: true, zoom })
      s.frame(40)
      const draw = s.identityDraws.find((entry) => entry.src === '/scaled-peer.webp')!
      const scale = Number(s.canvas.dataset.tileSize) / 64
      const diameter = Math.round(34 * scale * 3) / 3
      expect(draw.args.at(-2)).toBe(diameter)
      expect(draw.args.at(-1)).toBe(diameter)
      const x = draw.args.at(-4)! + diameter / 2,
        y = draw.args.at(-3)! + diameter / 2
      s.frame(200)
      s.event('pointerdown', x, y)
      s.event('pointerup', x, y)
      expect(s.selectPlayer).toHaveBeenCalledWith('scaled-peer')
      s.selectPlayer.mockClear()
      const outside = diameter / 2 + 4 * scale + 1
      s.event('pointerdown', x + outside, y)
      s.event('pointerup', x + outside, y)
      expect(s.selectPlayer).not.toHaveBeenCalled()
      s.renderer.dispose()
      vi.unstubAllGlobals()
    },
  )
  it('repaints a stationary centered portrait when wheel zoom changes its terrain-relative size', () => {
    const s = scene()
    s.canvas.dataset.portrait = '/wheel-scaled.webp'
    s.frame(40)
    const before = s.identityDraws.at(-1)!.args.at(-2)!
    s.listeners.get('wheel')!({ deltaY: -1000, preventDefault() {} } as unknown as Event)
    s.frame(80)
    const after = s.identityDraws.at(-1)!.args.at(-2)!
    expect(after).toBeGreaterThan(before)
    expect(after * 3).toBe(Math.round(((34 * Number(s.canvas.dataset.tileSize)) / 64) * 3))
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('repaints the identity bitmap for movement, late image decoding and changed portrait sources', () => {
    const s = scene()
    s.canvas.dataset.portrait = '/late-static.webp'
    s.frame(40)
    const picture = s.images.find(
      (image) => (image as HTMLImageElement).src === '/late-static.webp',
    )!
    Object.assign(picture, { complete: false })
    s.renderer.update(s.view)
    s.frame(80)
    const clearCount = s.identityClear.mock.calls.length
    Object.assign(picture, { complete: true })
    picture.onload!()
    s.frame(120)
    expect(s.identityClear).toHaveBeenCalledTimes(clearCount + 1)
    const destination = { ...s.view.position, x: s.view.position.x + 1 }
    s.motion.plan([{ position: destination, durationMs: 200 }], s.view.sectors, 120)
    s.frame(160)
    expect(s.identityClear).toHaveBeenCalledTimes(clearCount + 2)
    s.canvas.dataset.portrait = '/replacement.webp'
    s.frame(200)
    expect(s.identityDraws.some((entry) => entry.src === '/replacement.webp')).toBe(true)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('keeps stack fades and cycling live while reusing the settled identity bitmap', () => {
    const s = scene()
    const position = { ...s.view.position, x: s.view.position.x + 1 }
    s.renderer.update({
      ...s.view,
      players: ['first', 'second'].map((id) => ({
        characterId: id,
        name: id,
        level: 1,
        portraitRef: '',
        imageUrl: `/${id}.webp`,
        online: true,
        attackable: false,
        position,
      })),
    })
    s.frame(40)
    const first = s.identityClear.mock.calls.length
    s.frame(240)
    expect(s.identityClear).toHaveBeenCalledTimes(first + 1)
    s.frame(540)
    const settled = s.identityClear.mock.calls.length
    s.frame(740)
    expect(s.identityClear).toHaveBeenCalledTimes(settled)
    s.frame(3640)
    expect(s.identityClear).toHaveBeenCalledTimes(settled + 1)
    const cycled = s.identityDraws.length
    s.renderer.settings({ animate: false, zoom: 1 })
    s.frame(3680)
    expect(s.identityDraws.slice(cycled).some((draw) => draw.src === '/first.webp')).toBe(true)
    expect(s.identityDraws.slice(cycled).some((draw) => draw.src === '/second.webp')).toBe(false)
    s.renderer.dispose()
    expect(s.identityCanvas.width).toBe(0)
    expect(s.identityCanvas.height).toBe(0)
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
