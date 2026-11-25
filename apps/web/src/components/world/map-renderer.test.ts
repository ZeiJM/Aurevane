import { ferryVesselVersion } from './map-ferry-deck'
import { resolveWorldEnvironment, DEFAULT_WORLD_ENVIRONMENT_SETTINGS } from '@/world/environment'
import { APPEARANCE_PRESETS, compileAppearanceManifest } from '@/appearance/appearance-manifest'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { projectWorld, projectWorldSector, resolveWorldIntent } from '@/server/world/world-service'
import { voidRealmFerryDock } from '@/server/world/void-realms'
import {
  FERRY_BOARDING_MS,
  FERRY_TERMINAL_NAMES,
  FERRYMAN_PORTRAIT,
  FERRYMAN_SPRITE,
  nextFerryDeparture,
} from '@/world/ferry'
import { atlasSectors } from '@/world/atlas'
import { CHARTED_SECTORS, GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { GRAND_DISCOVERY_SITES, OFFSHORE_DISCOVERY } from '@/world/discovery-sites'
import { WORLD_MAP_WIDTH } from '@/world/topology'
import { WORLD_MIN_ZOOM } from './world-zoom'
import legacyTownTopology from '@/world/town-topology.legacy.json'
import townGrandManifest from '../../../public/media/art/world/runtime/town-grand-architecture-v01.manifest.json'
import { newWorldState, revealNearby } from '@/world/travel'
import { localRoute, mapPoint, WorldMotion } from './world-motion'
import * as navigation from './world-motion'
import { createMapRenderer } from './map-renderer'
import { WorldController } from './world-controller'
import { MAP_X, MAP_Y, projectMapPoint, unprojectMapPoint } from './map-projection'
import type { WorldView } from '@/world/types'
import * as biomes from './map-biome-transitions'
import * as waterPainting from './map-water'
import * as vegetation from './map-vegetation'
import { worldWindTarget } from './map-weather'
import * as weatherPainting from './map-weather'
import { worldRenderTerrain } from './map-render-terrain'
import { grandDiscoveryPlacements } from './map-grand-discoveries'
import { valleyDetailArt } from './map-grand-detail-art'
import { colosseumDetailArt } from './map-colosseum-detail-art'
import { correctionScenes } from '../../../e2e/world-map-correction-scenes'

type RecordedPath = { operation: 'M' | 'L' | 'C' | 'E' | 'Z'; points: number[] }[]
const imageRuntime = createRequire(import.meta.url)
const sharp = imageRuntime(imageRuntime.resolve('sharp', { paths: [imageRuntime.resolve('next')] }))

/** PR1038's captured rows and exact root footprints isolate old-art compatibility.
 * Current town topology is asserted independently, including the shallow moat below. */
function legacyTownView(sectorId: string, x = 6, y = 4): WorldView {
  const state = { ...newWorldState(), position: { sectorId, x, y } }
  const base = projectWorld(state, [], 1000)
  const canonical = atlasSectors().find((sector) => sector.id === sectorId)!
  const rows = legacyTownTopology.find((sector) => sector.id === sectorId)!.rows
  const artIndex = [
    'verdant-expanse',
    'aureth-crown',
    'frostmere',
    'hollow-coast',
    'glasswind-desert',
    'emberreach',
    'starfall-highlands',
    'umbral-march',
  ].indexOf(sectorId)
  const sector = projectWorldSector(state, {
    ...canonical,
    rows,
    buildings: [
      { id: `${sectorId}:building0`, x: 4, y: 1, width: 2, height: 2, artIndex },
      { id: `${sectorId}:building1`, x: 8, y: 1, width: 2, height: 2, artIndex },
      { id: `${sectorId}:building2`, x: 11, y: 1, width: 2, height: 2, artIndex: 8 },
      { id: `${sectorId}:building3`, x: 2, y: 3, width: 1, height: 1, artIndex: -1, propIndex: 1 },
      { id: `${sectorId}:building4`, x: 1, y: 0, width: 3, height: 1, artIndex: -1, propIndex: 0 },
    ],
    landmarks: [
      ...CHARTED_SECTORS.find((sector) => sector.id === sectorId)!.landmarks,
      { id: `${sectorId}:marketplace`, name: 'Marketplace', kind: 'marketplace', x: 2, y: 1 },
      { id: `${sectorId}:bridge`, name: 'Bridge', kind: 'bridge', x: 10, y: 4 },
    ],
    roads: [],
  })
  return { ...base, sectors: [sector], scenery: [], players: [] }
}

function scene(reduced = false, initial?: WorldView) {
  const images: { onload: (() => void) | null }[] = []
  const fills: {
    colour: string
    alpha: number
    order: number
    path: RecordedPath
    points: number[][]
  }[] = []
  const rectangles: { colour: string; order: number }[] = []
  const ellipses: { point: { x: number; y: number }; order: number }[] = []
  const draws: {
    src: string
    image: HTMLImageElement
    order: number
    args: number[]
    matrix: number[]
    filter: string
  }[] = []
  const texts: {
    text: string
    x: number
    y: number
    font: string
    align: string
    maxWidth?: number
    colour: string
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
  const composites = new Map<object, object[]>()
  const layerDraws = new Map<object, typeof draws>()
  const offscreenDraws = new WeakSet<object>()
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
      createImageData: (width: number, height: number) => ({
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4),
      }),
      putImageData() {},
      measureText: (text: string) => ({ width: text.length * 7 }),
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      filter: 'none',
      fillStyle: '',
      fill() {
        fills.push({
          colour: this.fillStyle,
          points: path.map((point) => [...point]),
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
      ellipse(x: number, y: number, ...parameters: number[]) {
        recordedPath.push({ operation: 'E', points: [x, y, ...parameters] })
        ellipses.push({
          point: {
            x: matrix[0]! * x + matrix[2]! * y + matrix[4]!,
            y: matrix[1]! * x + matrix[3]! * y + matrix[5]!,
          },
          order: drawOrder,
        })
      },
      drawImage(image: HTMLImageElement, ...args: number[]) {
        draws.push({
          src: image.src ?? '',
          image,
          order: ++drawOrder,
          args,
          matrix: [...matrix],
          filter: this.filter,
        })
      },
      fillText(text: string, x: number, y: number, maxWidth?: number) {
        const state = this as unknown as { font: string; textAlign: string }
        texts.push({
          text,
          x,
          y,
          font: state.font,
          align: state.textAlign,
          maxWidth,
          colour: this.fillStyle,
        })
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
      naturalHeight = 1200
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
      const layer = { width: 0, height: 0, getContext: () => layerContext }
      composites.set(layer, [])
      layerDraws.set(layer, [])
      const layerContext = new Proxy(context, {
        get(target, key) {
          if (key === 'bezierCurveTo') return (...args: number[]) => groundCurves.push(args)
          if (key === 'drawImage')
            return (image: HTMLImageElement, ...args: number[]) => {
              composites.get(layer)!.push(image)
              target.drawImage(image, ...args)
              const recorded = draws.at(-1)!
              layerDraws.get(layer)!.push(recorded)
              offscreenDraws.add(recorded)
            }
          return Reflect.get(target, key)
        },
      })
      return layer
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
    dataset: { characterName: 'Wayfarer' },
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
  const resolvePaintedSource = (draw: (typeof draws)[number]) => {
    const contents = layerDraws.get(draw.image)
    const source = contents?.length === 1 ? contents[0] : undefined
    if (
      source?.args.length !== 8 ||
      draw.args.length !== 4 ||
      source.args[4] !== 0 ||
      source.args[5] !== 0 ||
      source.args[6] !== draw.image.width ||
      source.args[7] !== draw.image.height
    )
      return draw
    return {
      ...draw,
      src: source.src,
      image: source.image,
      args: [...source.args.slice(0, 4), ...draw.args],
    }
  }
  return {
    fills,
    rectangles,
    ellipses,
    draws,
    // Follow a single pre-scaled atlas crop through its final canvas draw.
    // Anchor, silhouette and growth checks concern the painted CSS geometry,
    // while raw draws remain available for resampling/work-count assertions.
    get spriteDraws() {
      return draws.filter((draw) => !offscreenDraws.has(draw)).map(resolvePaintedSource)
    },
    get identitySprites() {
      return identityDraws.map(resolvePaintedSource)
    },
    texts,
    transforms,
    groundCurves,
    composites,
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
    event(name: string, x: number, y: number, timeStamp?: number) {
      listeners.get(name)!({
        clientX: x,
        clientY: y,
        pointerId: 1,
        ...(timeStamp === undefined ? {} : { timeStamp }),
      } as unknown as Event)
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
  it('paints the real deck art while keeping fixtures out of the map labels', () => {
    const departureAt = 1_800_000_000_000
    const state = {
      ...newWorldState(),
      position: { sectorId: `ferry:outbound:${departureAt}`, x: 6, y: 4 },
      ferry: {
        direction: 'outbound' as const,
        departureAt,
        arrivalAt: departureAt + 300_000,
        warpedPhase: null,
      },
    }
    const view = projectWorld(state, [], departureAt + 61_000)
    const s = scene(true, view)
    try {
      s.frame(40)
      expect(s.draws.map(({ src }) => src)).toEqual(
        expect.arrayContaining([
          `/media/art/world/runtime/ferry-passenger-hull-${ferryVesselVersion(state.position.sectorId)}.webp`,
        ]),
      )
      expect(s.texts.map(({ text }) => text)).not.toContain('Stern cabin')
      expect(s.texts.map(({ text }) => text)).not.toContain('Foremast')
      expect(view.sectors[0]?.cells.find(({ x, y }) => x === 8 && y === 6)?.walkable).toBe(true)
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  })

  it('does not paint exploration fog over private terrain, including partial movement scenes', () => {
    const state = revealNearby({
      ...newWorldState(),
      position: { sectorId: 'uncharted-landing', x: 6, y: 4 },
    })
    const s = scene(true, { ...projectWorld(state, [], 1000), unchartedTerrain: undefined })
    try {
      s.frame(40)
      expect(
        s.gradients.some(({ stops }) =>
          stops.some(([, colour]) => colour === 'rgba(37,44,61,.71)'),
        ),
      ).toBe(false)
      expect(s.draws.some(({ src }) => src.endsWith('void-ground-v01.webp'))).toBe(true)
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  })
  it('does not submit a walk from unsurveyed render-only Uncharted ground', () => {
    const state = revealNearby({
      ...newWorldState(),
      position: { sectorId: 'uncharted-expanse:32:24', x: 6, y: 4 },
    })
    const view = projectWorld(state, [], 1000)
    const s = scene(true, view)
    try {
      s.frame(40)
      const camera = mapPoint(view.position, view.sectors)
      const candidate = worldRenderTerrain(view)
        .flatMap((sector) =>
          sector.cells
            .filter(
              (cell) =>
                cell.walkable &&
                !view.sectors.some(
                  (known) =>
                    known.id === sector.id &&
                    known.cells.some((p) => p.x === cell.x && p.y === cell.y),
                ),
            )
            .map((cell) => {
              const position = { sectorId: sector.id, x: cell.x, y: cell.y }
              return {
                position,
                point: projectMapPoint(
                  mapPoint(position, [sector], camera),
                  camera,
                  { x: 0, y: 0 },
                  64,
                  800,
                  600,
                ),
              }
            }),
        )
        .find(({ point }) => point.x > 30 && point.x < 770 && point.y > 30 && point.y < 570)
      expect(candidate).toBeDefined()
      s.event('pointerdown', candidate!.point.x, candidate!.point.y)
      s.event('pointerup', candidate!.point.x, candidate!.point.y)
      expect(s.select).not.toHaveBeenCalled()
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  })
  it('renders the full Orchard ferry with a visible Ferryman and accepts clicks inland', () => {
    const { sectorId, x, y } = voidRealmFerryDock('hollow-orchard')
    const position = { sectorId, x, y }
    const departure = nextFerryDeparture('uncharted', 0)
    const view = projectWorld(
      revealNearby({ ...newWorldState(), position }),
      [],
      departure - FERRY_BOARDING_MS / 2,
    )
    const s = scene(true, {
      ...view,
      players: [
        {
          characterId: 'orchard-visitor',
          name: 'Orchard visitor',
          level: 1,
          portraitRef: '',
          imageUrl: '/visitor.webp',
          online: true,
          attackable: false,
          position: { ...position, y: y + 1 },
        },
      ],
      npcs: [
        {
          id: 'ferryman',
          name: 'Ferryman',
          position: { ...position, x: x + 1 },
          imageUrl: FERRYMAN_PORTRAIT,
          spriteUrl: FERRYMAN_SPRITE,
        },
      ],
    })
    try {
      s.frame(40)
      const vessel = ferryVesselVersion(`ferry:return:${departure}`)
      const hull = s.spriteDraws.find(({ src }) =>
        src.endsWith(`ferry-passenger-hull-${vessel}.webp`),
      )
      const sprite = s.identityDraws.find(({ image }) =>
        s.composites
          .get(image)
          ?.some((source) => (source as HTMLImageElement).src === FERRYMAN_SPRITE),
      )
      expect(hull?.args).toHaveLength(4)
      expect(sprite?.args.at(-1)).toBeGreaterThan(64)
      expect(s.texts.map(({ text }) => text)).toEqual(
        expect.arrayContaining([FERRY_TERMINAL_NAMES.uncharted, 'Ferryman']),
      )
      const labelColours = Object.fromEntries(s.texts.map(({ text, colour }) => [text, colour]))
      expect(labelColours).toMatchObject({
        Wayfarer: '#ffdb86',
        'Orchard visitor': '#a5efe2',
        Ferryman: '#ffc2a6',
        [FERRY_TERMINAL_NAMES.uncharted]: '#dbc8ff',
      })
      const destination = { sectorId, x: x + 3, y }
      expect(
        view.sectors
          .find(({ id }) => id === sectorId)
          ?.cells.some((cell) => cell.x === destination.x && cell.y === y),
      ).toBe(false)
      const camera = mapPoint(position, view.sectors)
      const point = projectMapPoint(
        mapPoint(destination, view.sectors, camera),
        camera,
        { x: 0, y: 0 },
        64,
        800,
        600,
      )
      s.event('pointerdown', point.x, point.y)
      s.event('pointerup', point.x, point.y)
      expect(s.select).toHaveBeenCalledWith(destination)
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  })
  it('uses the regional artwork and published liquid mask while the public scene is pending', () => {
    const view = legacyTownView('verdant-expanse')
    const own = view.sectors.find((sector) => sector.id === view.position.sectorId)!
    const candidate = {
      id: 'next-charted',
      name: 'Next charted ground',
      coordinate: 'S03-02',
      regionId: 'glasswind-desert',
      column: (own.atlasColumn ?? 1) + 1,
      row: own.atlasRow ?? 1,
      charted: true,
    }
    const centre = {
      ...own,
      atlasColumn: candidate.column - 1,
      atlasRow: candidate.row,
    }
    const s = scene(true, { ...view, atlas: [candidate], scenery: [], sectors: [centre] })
    try {
      s.renderer.settings({ animate: false, zoom: 0.35 })
      s.frame(40)
      const desertCrop = () =>
        s.draws.some(
          ({ src, args }) =>
            src.endsWith('regional-ground-v02.webp') &&
            args[0]! >= 300 &&
            args[0]! < 600 &&
            args[1]! >= 600,
        )
      expect(desertCrop()).toBe(true)
      const publicWater = () =>
        s.gradients.some(
          ({ stops, coordinates }) =>
            stops.some((stop) => stop[1] === '#245e67') &&
            coordinates[0] === -candidate.column * GRID_WIDTH * 16,
        )
      expect(publicWater()).toBe(false)
      s.gradients.length = 0
      s.renderer.update({
        ...view,
        atlas: [{ ...candidate, waterTiles: '~'.repeat(117) }],
        scenery: [],
        sectors: [centre],
      })
      s.frame(90)
      expect(publicWater()).toBe(true)
      const point = projectMapPoint(
        { x: candidate.column * GRID_WIDTH + 0.5, y: candidate.row * GRID_HEIGHT + 0.5 },
        mapPoint(view.position, [centre]),
        { x: 0, y: 0 },
        64 * 0.35,
        800,
        600,
      )
      s.event('pointerdown', point.x, point.y)
      s.event('pointerup', point.x, point.y)
      expect(s.select).not.toHaveBeenCalled()
      s.gradients.length = s.draws.length = 0
      s.renderer.update({
        ...view,
        atlas: [{ ...candidate, charted: false, waterTiles: '~'.repeat(117) }],
        scenery: [],
        sectors: [centre],
      })
      s.frame(140)
      expect(publicWater()).toBe(false)
      expect(desertCrop()).toBe(false)
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  })
  it('submits charted ground clicks through a partial public navigation scene', () => {
    const view = legacyTownView('verdant-expanse', 5, 4)
    const current = view.sectors[0]!
    const supplied = {
      ...current,
      landmarks: [],
      buildings: [],
      cells: current.cells.filter((cell) => cell.x === 5 && cell.y === 4),
    }
    const s = scene(true, { ...view, sectors: [supplied] })
    try {
      s.frame(40)
      expect(s.rectangles.some(({ colour }) => colour === '#233d3c')).toBe(false)
      const sampledMaterial = s.draws.find(
        ({ src, args }) =>
          src.endsWith('regional-ground-v02.webp') && args[6] === 17 && args[7] === 17,
      )
      expect(sampledMaterial).toBeDefined()
      s.event('pointerdown', 563.2, 384.48)
      s.event('pointerup', 563.2, 384.48)
      expect(s.select).toHaveBeenCalledWith({ sectorId: current.id, x: 8, y: 4 })
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  })
  it('keeps the public atlas visible when the owned sector arrives before its cells', () => {
    const view = legacyTownView('verdant-expanse', 5, 4)
    const s = scene(true, view)
    try {
      s.frame(40)
      s.draws.length = 0
      s.renderer.update({ ...view, sectors: [], scenery: [] })
      s.frame(90)
      const groundSheet = s.images.find((image) =>
        (image as HTMLImageElement).src.endsWith('regional-ground-v02.webp'),
      )!
      expect(
        s.draws.some(({ image }) =>
          s.composites.get(image)?.includes(groundSheet as HTMLImageElement),
        ),
      ).toBe(true)
      s.event('pointerdown', 563.2, 384.48)
      s.event('pointerup', 563.2, 384.48)
      expect(s.select).not.toHaveBeenCalled()
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  })
  it('toggles location names without hiding player identities or disabling map input', () => {
    const s = scene(true)
    try {
      s.frame(40)
      s.frame(76)
      expect(s.texts.filter(({ text }) => text === 'Forest Settlement')).toHaveLength(1)
      s.texts.length = 0
      s.renderer.settings({ animate: false, zoom: 1, showLocationLabels: false })
      s.renderer.update({
        ...s.view,
        players: [
          {
            characterId: 'labels-peer',
            name: 'Label peer',
            level: 1,
            portraitRef: '',
            imageUrl: '/peer.webp',
            online: true,
            attackable: false,
            position: { ...s.view.position, x: s.view.position.x + 2 },
          },
        ],
      })
      s.frame(80)
      expect(s.texts.some(({ text }) => text === 'Forest Settlement')).toBe(false)
      expect(s.texts.some(({ text }) => text === 'Wayfarer')).toBe(true)
      const camera = mapPoint(s.view.position, s.view.sectors)
      const target = { ...s.view.position, x: s.view.position.x + 1 }
      const point = projectMapPoint(
        mapPoint(target, s.view.sectors),
        camera,
        { x: 0, y: 0 },
        64,
        800,
        600,
      )
      s.event('pointerdown', point.x, point.y)
      s.event('pointerup', point.x, point.y)
      expect(s.select).toHaveBeenCalledExactlyOnceWith(target)
      s.texts.length = 0
      s.renderer.settings({ animate: false, zoom: 1, showLocationLabels: true })
      s.frame(120)
      expect(s.texts.some(({ text }) => text === 'Forest Settlement')).toBe(true)
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  })
  // The fake RAF timestamps use a zero epoch. Keep the ordinary callback clock
  // on that epoch; tests for delayed callbacks explicitly advance this clock.
  beforeEach(() => {
    vi.spyOn(performance, 'now').mockReturnValue(0)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reuses remote navigation for an equivalent serialized scene receipt', () => {
    const prepare = vi.spyOn(navigation, 'prepareLocalRoute')
    const s = scene()
    const prepared = prepare.mock.calls.length
    try {
      s.renderer.update(JSON.parse(JSON.stringify(s.view)) as WorldView)
      expect(prepare).toHaveBeenCalledTimes(prepared)
      const changed = JSON.parse(JSON.stringify(s.view)) as WorldView
      changed.sectors[0]!.exits = [
        ...changed.sectors[0]!.exits,
        {
          from: { sectorId: changed.sectors[0]!.id, x: 0, y: 0 },
          to: { sectorId: changed.sectors[0]!.id, x: 1, y: 0 },
          durationMs: 200,
          name: 'Changed route',
        },
      ]
      s.renderer.update(changed)
      expect(prepare).toHaveBeenCalledTimes(prepared + 1)
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  })

  it('submits clicks on visible public ground beyond the peer scene without inventing a preview route', () => {
    const s = scene(true)
    Object.assign(s.canvas, { clientWidth: 1296, clientHeight: 944 })
    s.resize()
    s.renderer.settings({ animate: false, zoom: 0.35 })
    s.frame(40)
    const camera = mapPoint(s.view.position, s.view.sectors)
    const candidates = worldRenderTerrain(s.view)
      .filter((sector) => !s.view.sectors.some((known) => known.id === sector.id))
      .flatMap((sector) =>
        sector.cells
          .filter((cell) => cell.walkable)
          .map((cell) => {
            const position = { sectorId: sector.id, x: cell.x, y: cell.y }
            const point = projectMapPoint(
              mapPoint(position, [sector], camera),
              camera,
              { x: 0, y: 0 },
              64 * 0.35,
              1296,
              944,
            )
            return { position, point }
          }),
      )
    const target = candidates.find(
      ({ point }) => point.x > 20 && point.x < 1276 && point.y > 20 && point.y < 924,
    )
    expect(target).toBeDefined()
    expect(localRoute(s.view, s.view.position, target!.position)).toBeNull()
    s.event('pointerdown', target!.point.x, target!.point.y)
    s.event('pointerup', target!.point.x, target!.point.y)
    expect(s.select).toHaveBeenCalledExactlyOnceWith(target!.position)
    s.renderer.update({
      ...s.view,
      atlas: s.view.atlas!.map((sector) =>
        sector.id === target!.position.sectorId ? { ...sector, charted: false } : sector,
      ),
    })
    s.event('pointerdown', target!.point.x, target!.point.y)
    s.event('pointerup', target!.point.x, target!.point.y)
    expect(s.select).toHaveBeenCalledTimes(1)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('publishes each completed frame only when precise frame counting is requested', () => {
    const s = scene()
    try {
      s.frame(40)
      expect(s.canvas.dataset.renderFrames).toBeUndefined()
      s.canvas.dataset.renderDiagnostics = 'frames'
      s.frame(80)
      expect(s.canvas.dataset.renderFrames).toBe('2')
      expect(s.canvas.dataset.renderTiming).toBeUndefined()
      expect(s.canvas.dataset.paintedGroundIds).toBeUndefined()
      s.frame(120)
      expect(s.canvas.dataset.renderFrames).toBe('3')
      delete s.canvas.dataset.renderDiagnostics
      s.frame(160)
      expect(s.canvas.dataset.renderFrames).toBe('3')
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  })
  it('reuses supplied terrain for a liquid field without authored bridge decks', () => {
    const base = projectWorld(newWorldState(), [], 1000)
    const root = base.sectors.find((sector) => sector.id === base.position.sectorId)!
    const supplied = {
      ...root,
      buildings: [],
      landmarks: [],
      cells: root.cells.map((cell) => ({ ...cell, terrain: '.', walkable: true })),
    }
    const build = vi.spyOn(waterPainting, 'buildWaterField')
    const s = scene(true, { ...base, sectors: [supplied], scenery: undefined })
    try {
      expect(build).toHaveBeenCalled()
      for (const [sectors] of build.mock.calls) {
        expect(sectors).toHaveLength(1)
        expect(sectors[0]).toBe(supplied)
      }
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
      build.mockRestore()
    }
  })
  it('does not collect timing records or query stage clocks without diagnostic opt-in', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
    const s = scene(true)
    try {
      clock.mockClear()
      s.frame(40)
      // Animation samples share the callback clock; drawing also measures start/end.
      expect(clock).toHaveBeenCalledTimes(3)
      expect(s.canvas.dataset.renderTiming).toBeUndefined()
      expect(s.canvas.dataset.renderDiagnostics).toBeUndefined()
      expect(s.canvas.dataset.paintedGroundIds).toBeUndefined()
    } finally {
      s.renderer.dispose()
      clock.mockRestore()
      vi.unstubAllGlobals()
    }
  })
  it('reports painted ground alongside timing diagnostics when coverage collection is requested', () => {
    const s = scene(true)
    try {
      s.canvas.dataset.renderDiagnostics = 'timing'
      s.canvas.dataset.testGroundCoverage = '[]'
      s.frame(40)
      const ids: string[] = JSON.parse(s.canvas.dataset.paintedGroundIds ?? '[]')
      expect(ids).toContain(s.view.position.sectorId)
      expect(new Set(ids).size).toBe(ids.length)
      expect(JSON.parse(s.canvas.dataset.testGroundCoverage ?? '[]')).toEqual([
        expect.objectContaining({
          at: expect.any(Number),
          x: expect.any(Number),
          y: expect.any(Number),
          width: 800,
          height: 600,
          tile: expect.any(Number),
          painted: ids,
        }),
      ])
      s.canvas.dataset.testGroundCoverageStopped = 'true'
      const stopped = s.canvas.dataset.testGroundCoverage
      s.renderer.update(s.view)
      s.frame(60)
      expect(s.canvas.dataset.testGroundCoverage).toBe(stopped)
      delete s.canvas.dataset.testGroundCoverage
      delete s.canvas.dataset.renderDiagnostics
      s.renderer.update(s.view)
      s.frame(80)
      expect(s.canvas.dataset.paintedGroundIds).toBeUndefined()
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  })
  it('reports callback-clock frame work while retaining the scheduled RAF timestamp', () => {
    let now = 0
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now)
    const base = projectWorld(newWorldState(), [], 1000)
    const view = {
      ...base,
      atlas: undefined,
      scenery: undefined,
      sectors: [
        {
          ...base.sectors[0]!,
          charted: false,
          landmarks: [],
          buildings: [],
          cells: base.sectors[0]!.cells.map((cell) => ({ ...cell, terrain: '.', walkable: true })),
        },
      ],
    }
    const s = scene(true, view)
    const context = s.identityCanvas.getContext('2d')!
    const drawText = context.fillText.bind(context)
    const identities = vi.spyOn(context, 'fillText').mockImplementation((...args) => {
      if (args[0] === 'Wayfarer') now += 11
      drawText(...args)
    })
    const create = document.createElement.bind(document)
    const layers = vi.spyOn(document, 'createElement').mockImplementation((...args) => {
      now += 7
      return create(...args)
    })
    try {
      s.canvas.dataset.renderDiagnostics = 'timing'
      now = 100
      s.frame(40)
      expect(s.canvas.dataset.frameNow).toBe('100')
      expect(s.canvas.dataset.renderTiming).toBeDefined()
      const cold = JSON.parse(s.canvas.dataset.renderTiming!)
      expect(cold).toMatchObject({
        frameAt: 100,
        rafAt: 40,
        callbackDelayMs: 60,
        startedAt: 100,
        groundBuilds: 1,
        groundBuildMs: 7,
        groundResamples: 0,
        groundResampleMs: 0,
        prepareMs: 0,
        // Cold ground plus its once-only projected raster each allocate a layer.
        terrainMs: 14,
        sceneryMs: 0,
        atmosphereMs: 0,
        identityMs: 11,
        completedAt: 125,
        updates: 0,
        updateMs: 0,
        terrainIndexes: 0,
        terrainIndexMs: 0,
      })
      now = 140
      s.renderer.update(view)
      s.frame(80)
      expect(JSON.parse(s.canvas.dataset.renderTiming!)).toMatchObject({
        frameAt: 140,
        rafAt: 80,
        callbackDelayMs: 60,
        startedAt: 140,
        groundBuilds: 0,
        groundBuildMs: 0,
        terrainMs: 0,
        updates: 1,
        terrainIndexes: 0,
      })
      const build = biomes.buildBiomeTransitions
      const indexing = vi.spyOn(biomes, 'buildBiomeTransitions').mockImplementation((...args) => {
        now += 19
        return build(...args)
      })
      s.renderer.update({
        ...view,
        sectors: view.sectors.map((sector) => ({
          ...sector,
          cells: sector.cells.map((cell, i) => (i ? cell : { ...cell, terrain: '#' })),
        })),
      })
      s.frame(120)
      expect(JSON.parse(s.canvas.dataset.renderTiming!)).toMatchObject({
        frameAt: 159,
        rafAt: 120,
        callbackDelayMs: 39,
        startedAt: 159,
        updates: 1,
        updateMs: 19,
        terrainIndexes: 1,
        terrainIndexMs: 19,
        groundBuilds: 1,
        groundBuildMs: 7,
      })
      indexing.mockRestore()
      s.renderer.settings({ animate: false, zoom: 1, paused: true })
      const paused = s.canvas.dataset.renderTiming
      now = 1000
      s.frame(1000)
      expect(s.canvas.dataset.renderTiming).toBe(paused)
      s.renderer.settings({ animate: false, zoom: 1, paused: false })
      s.frame(1000)
      expect(JSON.parse(s.canvas.dataset.renderTiming!)).toMatchObject({ updates: 0, updateMs: 0 })
      delete s.canvas.dataset.renderDiagnostics
      s.renderer.update(view)
      s.frame(1040)
      expect(s.canvas.dataset.renderTiming).toBeUndefined()
    } finally {
      layers.mockRestore()
      identities.mockRestore()
      s.renderer.dispose()
      clock.mockRestore()
      vi.restoreAllMocks()
      vi.unstubAllGlobals()
    }
  })
  it('reveals late scenery sheets without repainting unchanged terrain layers', () => {
    const s = scene(true)
    s.frame(40)
    const painted = s.layerCount()
    for (const [index, image] of s.images.slice(0, 6).entries()) {
      if (index === 0) continue // The terrain sheet is the only ground-cache dependency.
      image.onload!()
      s.frame(80 + index * 40)
      expect(s.layerCount()).toBe(painted)
    }
    s.images[0]!.onload!()
    s.frame(400)
    expect(s.layerCount()).toBeGreaterThan(painted)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('paints a delayed scenery sheet at minimum zoom without waiting for input or ambient animation', () => {
    const s = scene(true)
    try {
      const nature = s.images.find((image) =>
        (image as HTMLImageElement).src.endsWith('nature-v02.webp'),
      )!
      Object.assign(nature, { complete: false, naturalWidth: 0 })
      s.renderer.settings({ animate: false, zoom: 0.35 })
      for (let at = 40; at < 5040 && s.frames.size; at += 40) s.frame(at)
      s.canvas.dataset.renderDiagnostics = 'timing'
      expect(s.draws.filter((draw) => draw.src.endsWith('nature-v02.webp'))).toHaveLength(0)
      expect(s.frames.size).toBe(0)
      Object.assign(nature, { complete: true, naturalWidth: 1200 })
      nature.onload!()
      expect(s.frames.size).toBe(1)
      s.frame(5080)
      expect(s.draws.some((draw) => draw.src.endsWith('nature-v02.webp'))).toBe(true)
      expect(JSON.parse(s.canvas.dataset.renderTiming!).groundBuilds).toBe(0)
      expect(s.frames.size).toBe(0)
      expect(s.select).not.toHaveBeenCalled()
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  })
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
    'isolates the fallback %s canopy with its roots fixed at its growth scale',
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
        if (picture.src.endsWith('living-trees-v01.webp'))
          Object.assign(image, { complete: false, naturalWidth: 0 })
        if (picture.src.endsWith('nature-v02.webp'))
          Object.assign(image, { width: 1514, height: 1039, naturalWidth: 1514 })
        if (picture.src.endsWith('biomes-v02.webp') || picture.src.endsWith('beauties-v03.webp'))
          Object.assign(image, { width: 1774, height: 887, naturalWidth: 1774 })
        if (fallback && picture.src.endsWith('biomes-v02.webp'))
          Object.assign(image, { complete: false, naturalWidth: 0 })
      }
      s.frame(40)
      const tree = s.spriteDraws.find(
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
      const { scale } = vegetation.vegetationPose('public', point.x - 0.5, point.y - 0.5, true)
      expect(a[6]! / a[2]!).toBeCloseTo(
        (64 * 1.65 * scale) / (family === 'nature' ? 1514 / 4 : 1774 / 4),
      )
      expect(a[7]! / a[3]!).toBeCloseTo(
        (64 * 2.55 * scale) / (family === 'nature' ? 1039 / 2 : 887 / 2),
      )
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
        (image as HTMLImageElement).src.endsWith('living-trees-v01.webp'),
      )!
      Object.assign(sheet, { width: 1536, height: 1024, naturalWidth: 1536 })
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
        const tree = s.spriteDraws
            .filter((draw) => draw.src.endsWith('living-trees-v01.webp') && draw.args[1]! < 300)
            .at(-1)!,
          a = tree.args,
          m = tree.matrix,
          project = (px: number, py: number) => {
            const x = a[4]! + ((px - a[0]!) / a[2]!) * a[6]!,
              y = a[5]! + ((py - a[1]!) / a[3]!) * a[7]!
            return { x: m[0]! * x + m[2]! * y + m[4]!, y: m[1]! * x + m[3]! * y + m[5]! }
          }
        const trunkX = a[0]! + a[2]! / 2
        contacts.push(project(trunkX, 488))
        canopies.push(project(trunkX, 40))
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
      const rock = s.spriteDraws.find((draw) => draw.src.endsWith('biomes-v02.webp'))!,
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
      // A circular falloff clipped to an entire terrain cell still projects as
      // a visible square/diamond when its radius reaches the cell boundary.
      expect(
        s.gradients.some((gradient) =>
          gradient.stops.some(([, colour]) => colour === 'rgba(51,56,53,.18)'),
        ),
      ).toBe(false)
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
    s.renderer.update({
      ...s.view,
      sectors: [...s.view.sectors],
      atlas: (s.view.atlas ?? []).map((sector, index) =>
        index ? sector : { ...sector, charted: !sector.charted },
      ),
    })
    expect(build).toHaveBeenCalledTimes(initialCalls + 2)
    s.renderer.dispose()
    build.mockRestore()
    vi.unstubAllGlobals()
  })
  it('progressively refines a delayed wide public overview and finishes with motion disabled', () => {
    const base = projectWorld(newWorldState(), [], 1000)
    const home = base.sectors.find((sector) => sector.id === base.position.sectorId)!
    const dry = (sector: typeof home) => ({
      ...sector,
      landmarks: [],
      buildings: [],
      cells: sector.cells.map((cell) => ({ ...cell, terrain: '.', walkable: true })),
    })
    const sectors = worldRenderTerrain(base).map(dry)
    const partial = { ...base, sectors: [dry(home)], scenery: [] }
    const s = scene(true, partial)
    try {
      Object.assign(s.canvas, { clientWidth: 1920, clientHeight: 1080 })
      s.resize()
      s.renderer.settings({ animate: false, zoom: 0.35 })
      s.canvas.dataset.renderDiagnostics = 'timing'
      s.frame(300)
      s.renderer.update({ ...base, sectors, scenery: [] })
      const counts: number[] = []
      for (let at = 340; at < 5400 && s.frames.size; at += 40) {
        s.frame(at)
        counts.push(JSON.parse(s.canvas.dataset.renderTiming!).groundBuilds)
        s.draws.length = 0
      }
      expect(counts.filter((count) => count > 0).length).toBeGreaterThan(8)
      expect(Math.max(...counts)).toBe(1)
      expect(s.frames.size).toBe(0)
      // A late specialty sheet has no material to replace on the dry terrain.
      s.images.find((image) =>
        (image as HTMLImageElement).src.endsWith('water-materials-v01.webp'),
      )!.onload!()
      s.frame(5500)
      expect(JSON.parse(s.canvas.dataset.renderTiming!).groundBuilds).toBe(0)
      expect(s.frames.size).toBe(0)
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  })
  it('retains visible ground rasters when movement only changes distant supplied neighbours', () => {
    const build = vi.spyOn(biomes, 'buildBiomeTransitions')
    const state = { ...newWorldState(), position: { sectorId: 'atlas:58:28', x: 12, y: 4 } }
    const initial = projectWorld(state, [], 1000)
    const next = projectWorld(
      { ...state, position: { sectorId: 'atlas:59:28', x: 3, y: 4 } },
      [],
      1200,
    )
    const s = scene(true, initial)
    try {
      Object.assign(s.canvas, { clientWidth: 1296, clientHeight: 944 })
      s.resize()
      s.canvas.dataset.renderDiagnostics = 'timing'
      s.frame(40)
      expect(JSON.parse(s.canvas.dataset.renderTiming!).groundBuilds).toBeGreaterThan(0)
      const indexed = build.mock.calls.length
      // Hold the camera still to isolate receipt invalidation from newly visible ground.
      s.renderer.update(next)
      expect(build).toHaveBeenCalledTimes(indexed)
      s.frame(80)
      expect(JSON.parse(s.canvas.dataset.renderTiming!)).toMatchObject({
        groundBuilds: 0,
        groundResamples: 0,
      })
    } finally {
      s.renderer.dispose()
      build.mockRestore()
      vi.unstubAllGlobals()
    }
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
  it('renders late RAF callbacks on the same monotonic clock as intervening peer receipts', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
    const base = projectWorld(newWorldState(), [], 1000)
    const position = { ...base.position, x: 1, y: 1 }
    const route = [2, 3, 4].map((x) => ({ position: { ...position, x }, durationMs: 200 }))
    const peer = {
      characterId: 'clock-peer',
      name: 'Clock Peer',
      level: 1,
      portraitRef: '',
      imageUrl: '/clock-peer.png',
      online: true,
      attackable: false,
      position,
      movement: { version: 1, serverNow: 1000, nextStepAt: 1200, route },
    }
    const view = {
      ...base,
      atlas: undefined,
      scenery: [],
      sectors: base.sectors.map((sector) => ({
        ...sector,
        cells: sector.cells.map((cell) => ({ ...cell, terrain: '.', walkable: true })),
      })),
      players: [peer],
    }
    const s = scene(true, view)
    const anchor = () =>
      s.draws
        .filter((draw) => draw.src === '/clock-peer.png')
        .at(-1)!
        .args.at(-4)!
    try {
      s.renderer.settings({ animate: false, zoom: 1 })
      clock.mockReturnValue(100)
      s.frame(100)
      const before = anchor()
      clock.mockReturnValue(160)
      s.renderer.update({
        ...view,
        players: [
          {
            ...peer,
            position: { ...position, x: 2 },
            movement: { version: 2, serverNow: 1250, nextStepAt: 1400, route: route.slice(1) },
          },
        ],
      })
      // The browser's scheduled RAF stamp predates a receipt already processed.
      clock.mockReturnValue(170)
      s.frame(116.7)
      expect(Math.abs((anchor() - before) / (64 * 0.85) - 0.35)).toBeLessThan(0.02)
      expect(s.canvas.dataset.frameNow).toBe('170')
      const first = anchor()
      clock.mockReturnValue(186.7)
      s.frame(133.4)
      expect(Math.abs((anchor() - first) / (64 * 0.85) - 0.0835)).toBeLessThan(0.02)
      expect(view.players[0]!.position).toEqual(position)
    } finally {
      s.renderer.dispose()
      clock.mockRestore()
      vi.unstubAllGlobals()
    }
  })
  it('keeps held motion advancing while the next key timer is dispatched late', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
    const s = scene()
    s.select.mockImplementation((destination, _direction, preview = destination) => {
      const now = performance.now()
      const route = localRoute(s.view, s.motion.sample(now).position, preview)
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
  it('maintains a held walk from Gildtide through a dry sector seam over a slow connection', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    let state = revealNearby({
      ...newWorldState(),
      position: { sectorId: 'atlas:4:15', x: 6, y: 4 },
    })
    const clock = () => 10_000 + performance.now()
    const s = scene(true, projectWorld(state, [], clock()))
    const failures: string[] = []
    let version = s.view.version
    const controller: WorldController = new WorldController(s.view, {
      command: async (intent) => {
        if (intent.kind !== 'walk' && intent.kind !== 'stop') throw new Error(intent.kind)
        await new Promise((resolve) => setTimeout(resolve, 275))
        const serverNow = clock()
        state = resolveWorldIntent(state, intent, serverNow)
        const next = projectWorld({ ...state, version: ++version }, [], serverNow)
        await new Promise((resolve) => setTimeout(resolve, 275))
        return next
      },
      refresh: async () => controller.view,
      accept: (view, reconcile) => {
        if (reconcile) s.motion.reconcile(view, performance.now())
        else s.motion.approveReceipt(view, performance.now())
        s.renderer.update(view)
      },
      error: (message) => failures.push(message),
      busy: () => {},
    })
    s.select.mockImplementation((destination, direction, previewDestination, continuing) => {
      const turn = s.motion.planDirectional(
        previewDestination ?? destination,
        direction,
        controller.view.sectors,
        performance.now(),
        controller.movementPending,
        continuing,
      )
      void controller.send({ kind: 'walk', destination, direction }).then(({ applied, view }) => {
        if (applied && view && turn) s.motion.confirmDirectional(view, turn, performance.now())
      })
    })
    try {
      s.listeners.get('keydown')!({ key: 'w', preventDefault() {} } as unknown as Event)
      const trail: number[] = []
      for (let elapsed = 100; elapsed <= 2800; elapsed += 100) {
        await vi.advanceTimersByTimeAsync(100)
        trail.push(s.motion.sample(performance.now()).point.y)
      }
      s.listeners.get('keyup')!({ key: 'w' } as unknown as Event)
      await vi.advanceTimersByTimeAsync(650)
      expect(failures).toEqual([])
      expect(trail.map((y, index) => (index === 0 ? 0.5 : trail[index - 1]! - y))).toEqual(
        Array(28).fill(0.5),
      )
    } finally {
      controller.dispose()
      s.renderer.dispose()
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })
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
  it('resumes the earlier held key immediately on release and stops on a blocked turn', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    const s = scene()
    const position = s.view.position
    const view = {
      ...s.view,
      sectors: s.view.sectors.map((sector) => ({
        ...sector,
        cells: sector.cells.map((cell) => {
          const blocked = sector.id === position.sectorId && cell.y === position.y + 1
          return { ...cell, walkable: !blocked, terrain: blocked ? '~' : '.' }
        }),
      })),
    }
    s.renderer.update(view)
    s.select.mockImplementation((destination, direction) => {
      s.motion.planDirectional(destination, direction, view.sectors, performance.now())
    })
    const key = (event: string, key: string, repeat = false) =>
      s.listeners.get(event)!({ key, repeat, preventDefault() {} } as unknown as Event)
    try {
      key('keydown', 'w')
      key('keydown', 'd')
      key('keydown', 'w', true)
      expect(s.select.mock.calls.at(-1)?.[1]).toBe('east')
      key('keyup', 'd')
      expect(s.select.mock.calls.at(-1)?.[1]).toBe('north')
      key('keydown', 's')
      expect(s.onStop).toHaveBeenCalledOnce()
      vi.advanceTimersByTime(1000)
      expect(s.onStop).toHaveBeenCalledOnce()
      key('keyup', 's')
      expect(s.select.mock.calls.at(-1)?.[1]).toBe('north')
      key('keyup', 'w')
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
    expect(s.select).toHaveBeenCalledExactlyOnceWith(
      { ...view.position, x: view.position.x + 1 },
      'east',
    )
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
  it('consumes configured cycles in the actual map night tint without movement input', () => {
    const s = scene()
    const settings = { ...DEFAULT_WORLD_ENVIRONMENT_SETTINGS, dayLengthMinutes: 120 }
    const time = Date.UTC(2026, 9, 10)
    const nightOpacity = (now: number) => {
      s.rectangles.length = 0
      s.renderer.update({ ...s.view, environment: resolveWorldEnvironment(now, settings) })
      s.frame(40)
      const colour = s.rectangles.find(
        (fill) => typeof fill.colour === 'string' && fill.colour.startsWith('rgba(12,27,65,'),
      )?.colour
      return colour ? Number(colour.slice('rgba(12,27,65,'.length, -1)) : null
    }
    const firstNight = nightOpacity(time)
    const noon = nightOpacity(time + 60 * 60_000)
    const nextNight = nightOpacity(time + 120 * 60_000)
    expect(firstNight).not.toBeNull()
    expect(noon).not.toBeNull()
    expect(nextNight).not.toBeNull()
    expect(firstNight!).toBeGreaterThan(noon!)
    expect(nextNight).toBeCloseTo(firstNight!, 3)
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
    for (const text of s.texts.filter(
      (text) => text.text === 'Wayfarer' || text.text === 'Other',
    )) {
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
  it('uses the painted projection when native click delivery follows a newer frame', () => {
    const s = scene()
    s.renderer.settings({ animate: false, zoom: 1 })
    s.frame(40)
    s.renderer.settings({ animate: false, zoom: 0.5 })
    s.frame(80)
    expect(Number(s.canvas.dataset.tileSize)).toBe(32)
    s.event('pointerdown', 563.2, 384.48, 40)
    s.event('pointerup', 563.2, 384.48, 40)
    expect(s.select).toHaveBeenCalledExactlyOnceWith({ sectorId: 'verdant-expanse', x: 8, y: 4 })
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('does not pick a frame that was still painting when the native click was issued', () => {
    const s = scene()
    s.renderer.settings({ animate: false, zoom: 1 })
    vi.mocked(performance.now).mockReturnValue(40)
    s.frame(40)
    s.renderer.settings({ animate: false, zoom: 0.5 })
    // The second frame starts at 80 but cannot be seen until 160. Input
    // issued at 100 still refers to the completed full-scale frame at 40.
    vi.mocked(performance.now).mockReturnValue(160).mockReturnValueOnce(80)
    s.frame(80)
    s.event('pointerdown', 563.2, 384.48, 100)
    s.event('pointerup', 563.2, 384.48, 100)
    expect(s.select).toHaveBeenCalledExactlyOnceWith({ sectorId: 'verdant-expanse', x: 8, y: 4 })
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
    const s = scene(true, legacyTownView('verdant-expanse'))
    for (const image of s.images as HTMLImageElement[])
      if (image.src.endsWith('grand-bridges-v01.webp')) Object.assign(image, { complete: false })
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
    // The two painted tread thresholds meet the ground centres on opposite banks.
    for (const [sourceX, sourceY, tileX] of [
      [415, 145, 9],
      [91, 404, 11],
    ] as const) {
      const contact = paintedPoint(950 + (460 * sourceX) / 512, 60 + (380 * sourceY) / 512)
      const expected = projectMapPoint(
        mapPoint({ sectorId: s.view.position.sectorId, x: tileX, y: 4 }, s.view.sectors),
        mapPoint(s.view.position, s.view.sectors),
        { x: 0, y: 0 },
        64,
        800,
        600,
      )
      expect(contact.x).toBeCloseTo(expected.x * 1.5, 1)
      expect(contact.y).toBeCloseTo(expected.y * 1.5, 1)
    }
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
      const s = scene(true, legacyTownView(sectorId))
      for (const image of s.images as HTMLImageElement[])
        if (image.src.endsWith('grand-bridges-v01.webp')) Object.assign(image, { complete: false })
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
        for (const image of s.images as HTMLImageElement[])
          if (image.src.endsWith('grand-bridges-v01.webp'))
            Object.assign(image, { complete: false })
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
            // The two full-resolution beds belong to the tested crossing;
            // the surrounding overview can also paint its own distant rivers.
            gradient.coordinates[2]! - gradient.coordinates[0]! === WORLD_MAP_WIDTH * 64 &&
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
      const view = legacyTownView(sectorId, 9, 4)
      const own = view.sectors.find((sector) => sector.id === sectorId)!
      const s = scene(mode === 'reduced', { ...view, players: [], sectors: [own] })
      try {
        for (const image of s.images as HTMLImageElement[])
          if (image.src.endsWith('grand-bridges-v01.webp'))
            Object.assign(image, { complete: false })
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
    // Two rebuilt grounds and their projections, plus one 2x2 depth scratch raster.
    expect(s.layerCount() - layers).toBe(5)
    const warmed = s.layerCount()
    s.frame(120)
    expect(s.layerCount()).toBe(warmed)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('feathers loaded biome materials over four tiles and retains the cached result while moving', () => {
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
      expect(Math.abs(gradient.coordinates[2]! - gradient.coordinates[0]!)).toBe(4 * 64)
      expect(gradient.stops).toEqual([
        [0, 'rgba(0,0,0,.5)'],
        [0.35, 'rgba(0,0,0,.37)'],
        [0.75, 'rgba(0,0,0,.08)'],
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
  it('mixes both native tree silhouettes at their supplied snowline anchors', () => {
    const position = { sectorId: 'atlas:56:14', x: 5, y: 7 }
    const view = projectWorld({ ...newWorldState(), position }, [], 1000)
    const s = scene(true, view)
    try {
      for (const image of s.images as HTMLImageElement[]) {
        if (image.src.endsWith('living-trees-v01.webp'))
          Object.assign(image, { width: 1536, height: 1024, naturalWidth: 1536 })
        if (image.src.endsWith('biomes-v02.webp'))
          Object.assign(image, { width: 1774, height: 887, naturalWidth: 1774 })
      }
      s.frame(40)
      const camera = mapPoint(position, view.sectors)
      for (const [sectorId, x, y, sheet, cropX, floorX, floorY] of [
        ['atlas:56:14', 5, 8, 'living-trees', 1152, 1344, 488],
        ['atlas:56:15', 0, 0, 'living-trees', 768, 960, 488],
      ] as const) {
        const sector = view.sectors.find((sector) => sector.id === sectorId)!
        expect(sector.cells.find((cell) => cell.x === x && cell.y === y)?.terrain).toBe('t')
        const point = mapPoint({ sectorId, x, y }, view.sectors)
        const anchor = projectMapPoint(
          { x: point.x, y: point.y + 0.25 },
          camera,
          { x: 0, y: 0 },
          64,
          800,
          600,
        )
        expect(
          s.spriteDraws.some(({ src, args, matrix: m }) => {
            if (
              !src.endsWith(`${sheet}-v01.webp`) ||
              args.length !== 8 ||
              Math.abs(args[0]! - cropX) > 0.001
            )
              return false
            const [sx, sy, sw, sh, dx, dy, dw, dh] = args as [
              number,
              number,
              number,
              number,
              number,
              number,
              number,
              number,
            ]
            const ax = dx + ((floorX - sx) / sw) * dw
            const ay = dy + ((floorY - sy) / sh) * dh
            return (
              Math.abs(m[0]! * ax + m[2]! * ay + m[4]! - anchor.x * 1.5) < 0.1 &&
              Math.abs(m[1]! * ax + m[3]! * ay + m[5]! - anchor.y * 1.5) < 0.1
            )
          }),
          `expected ${sheet} tree at ${sectorId} (${x}, ${y})`,
        ).toBe(true)
      }
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
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
        expect(Number(s.canvas.dataset.cachedGroundProjectionPixels)).toBeLessThanOrEqual(8_000_000)
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
        expect(s.select).toHaveBeenLastCalledWith(
          target,
          dx > 0 ? 'east' : dx < 0 ? 'west' : dy < 0 ? 'north' : 'south',
        )
        expect(s.motion.sample(201).position).toEqual(target)
        expect(preventDefault).toHaveBeenCalledOnce()
      } finally {
        s.renderer.dispose()
        clock.mockRestore()
        vi.unstubAllGlobals()
      }
    }
  })
  it('keeps a tap to one authoritative tile when the release waits two steps for the first receipt', () => {
    const origin = { sectorId: 'atlas:58:28', x: 6, y: 4 }
    const first = { ...origin, x: 7 }
    const state = { ...newWorldState(), position: origin }
    const view = projectWorld(state, [], 1000)
    const s = scene(false, view)
    try {
      s.listeners.get('keydown')!({ key: 'ArrowRight', preventDefault() {} } as unknown as Event)
      const [destination, direction, preview] = s.select.mock.calls[0]!
      expect(preview).toEqual({ ...origin, x: 9 })
      const started = resolveWorldIntent(state, { kind: 'walk', direction, destination }, 1000)
      expect(started.route.map((step) => step.position)).toEqual([first])

      s.listeners.get('keyup')!({ key: 'ArrowRight' } as unknown as Event)
      const [released, heading] = s.select.mock.calls.at(-1)!
      expect(released).toEqual(first)
      const stopped = resolveWorldIntent(
        started,
        { kind: 'walk', direction: heading, destination: released },
        1430,
      )
      expect(stopped.position).toEqual(first)
      expect(stopped.route).toEqual([])
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  })

  it('takes one visible tile on a fresh key reversal while the previous approval trails', () => {
    const position = { sectorId: 'hollow-coast', x: 10, y: 6 }
    const view = projectWorld({ ...newWorldState(), position }, [], 1000)
    const s = scene(false, view)
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
    try {
      const east = { ...position, x: position.x + 1 }
      const route = localRoute(view, position, east)!
      s.motion.plan(route, view.sectors, 0)
      clock.mockReturnValue(201)
      expect(s.motion.sample(201).position).toEqual(east)
      expect(s.motion.approvedPosition(201)).toEqual(position)

      s.listeners.get('keydown')!({ key: 'a', preventDefault() {} } as unknown as Event)
      expect(s.select.mock.calls[0]?.[0]).toEqual(position)
      expect(s.select.mock.calls[0]?.[1]).toBe('west')
    } finally {
      s.renderer.dispose()
      clock.mockRestore()
      vi.unstubAllGlobals()
    }
  })
  it.each([450, 550])(
    'does not cancel a held-key route when approval leads its %ims visual landing',
    (now) => {
      const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
      const s = scene()
      const view = {
        ...s.view,
        sectors: s.view.sectors.map((sector) => ({
          ...sector,
          cells: sector.cells.map((cell) => ({ ...cell, terrain: '.', walkable: true })),
        })),
      }
      const origin = view.position
      const approved = { ...origin, x: origin.x + 3 }
      const route = localRoute(view, origin, approved)!
      s.renderer.update(view)
      s.motion.plan(route, view.sectors, 0)
      try {
        // A rapid click route is already approved at x+3 while its canvas is
        // still crossing from x+2. The held key must extend from the approved
        // tile instead of submitting that tile again and cancelling the route.
        clock.mockReturnValue(now)
        expect(s.motion.sample(now).position).toEqual({ ...origin, x: origin.x + 2 })
        expect(s.motion.nextLanding(now)).toEqual(approved)
        const authoritative = {
          ...view,
          position: approved,
          route: [],
          version: view.version + 1,
        }
        s.motion.approveReceipt(authoritative, now)
        s.renderer.update(authoritative)

        s.listeners.get('keydown')!({
          key: 'ArrowRight',
          preventDefault() {},
        } as unknown as Event)
        expect(s.select).toHaveBeenCalledWith({ ...approved, x: approved.x + 1 }, 'east', {
          ...approved,
          x: approved.x + 3,
        })
        s.listeners.get('keyup')!({ key: 'ArrowRight' } as unknown as Event)
        expect(s.select).toHaveBeenLastCalledWith({ ...approved, x: approved.x + 1 }, 'east')
        expect(s.select).not.toHaveBeenCalledWith(approved, 'east')
      } finally {
        s.renderer.dispose()
        clock.mockRestore()
        vi.unstubAllGlobals()
      }
    },
  )
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
    expect(Number(s.canvas.dataset.travellerX)).toBeCloseTo(origin.x + 0.08, 8)
    expect(Number(s.canvas.dataset.travellerY)).toBe(origin.y)
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
  it.each([390, 800])('zooms out to 64%% at width %i without moving the camera', (width) => {
    const s = scene()
    Object.assign(s.canvas, { clientWidth: width })
    s.resize()
    s.renderer.settings({ animate: false, zoom: 1 })
    s.frame(40)
    const camera = [s.canvas.dataset.cameraX, s.canvas.dataset.cameraY]
    s.listeners.get('wheel')!({ deltaY: 10000, preventDefault() {} } as unknown as Event)
    s.frame(80)
    expect(s.onZoom).toHaveBeenLastCalledWith(0.64)
    expect(Number(s.canvas.dataset.tileSize)).toBeCloseTo((width < 600 ? 48 : 64) * 0.64)
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
  it.each(
    [390, 800].flatMap((width) =>
      ['wheel', 'pinch', 'settings'].map((input) => ({ width, input })),
    ),
  )(
    'reuses terrain during $input zoom at $width px and paints the final resolution after input settles',
    ({ width, input }) => {
      let now = 0
      const clock = vi.spyOn(performance, 'now').mockImplementation(() => now)
      const view = projectWorld(newWorldState(), [], 1000)
      const s = scene(true, {
        ...view,
        sectors: view.sectors.filter((sector) => sector.id === view.position.sectorId),
        scenery: [],
      })
      try {
        Object.assign(s.canvas, { clientWidth: width })
        s.resize()
        s.canvas.dataset.renderDiagnostics = 'timing'
        s.frame(now)
        expect(JSON.parse(s.canvas.dataset.renderTiming!).groundBuilds).toBeGreaterThan(0)
        const layers = s.layerCount()
        const camera = [s.canvas.dataset.cameraX, s.canvas.dataset.cameraY]
        const touch = (name: string, id: number, x: number) =>
          s.listeners.get(name)!({
            pointerType: 'touch',
            pointerId: id,
            clientX: x,
            clientY: 300,
          } as unknown as Event)
        if (input === 'pinch') {
          touch('pointerdown', 1, 100)
          touch('pointerdown', 2, 200)
        }
        for (let step = 1; step <= 10; step++) {
          now = step * 20
          if (input === 'wheel')
            s.listeners.get('wheel')!({ deltaY: -4, preventDefault() {} } as unknown as Event)
          else if (input === 'pinch') touch('pointermove', 2, 200 + step)
          else s.renderer.settings({ animate: false, zoom: 1 + step / 100, zoomLocked: true })
          s.frame(now)
          expect(s.layerCount()).toBe(layers)
          expect(JSON.parse(s.canvas.dataset.renderTiming!).groundBuilds).toBe(0)
          expect(Number(s.canvas.dataset.tileSize)).toBeCloseTo(
            (width < 600 ? 48 : 64) * (1 + step / 100),
          )
        }
        if (input === 'pinch') {
          touch('pointerup', 2, 210)
          touch('pointerup', 1, 100)
        }
        now += 100
        s.frame(now)
        expect(s.layerCount()).toBe(layers)
        now += 40
        s.frame(now)
        expect(s.layerCount()).toBeGreaterThan(layers)
        const timing = JSON.parse(s.canvas.dataset.renderTiming!)
        expect(timing.frameAt).toBe(now)
        expect(timing.groundBuilds).toBeGreaterThan(0)
        expect(timing.callbackDelayMs).toBe(0)
        expect(
          timing.prepareMs +
            timing.terrainMs +
            timing.sceneryMs +
            timing.atmosphereMs +
            timing.identityMs,
        ).toBeCloseTo(timing.completedAt - timing.startedAt)
        const settledLayers = s.layerCount()
        const tile = width < 600 ? 52.8 : 70.4
        const finalGround = s.draws
          .filter(
            (draw) =>
              draw.src === '' &&
              draw.args.length === 4 &&
              Math.abs(draw.args[2]! - 13 * tile) < 1e-6,
          )
          .at(-1)!
        expect(finalGround.image.width).toBe(13 * Math.ceil(tile * 1.5))
        expect(finalGround.image.height).toBe(9 * Math.ceil(tile * 1.5))
        expect([s.canvas.dataset.cameraX, s.canvas.dataset.cameraY]).toEqual(camera)
        expect(s.select).not.toHaveBeenCalled()
        expect(s.frames.size).toBe(0)
        s.renderer.update(s.view)
        now += 300
        s.frame(now)
        expect(s.layerCount()).toBe(settledLayers)
      } finally {
        s.renderer.dispose()
        clock.mockRestore()
        vi.unstubAllGlobals()
      }
    },
  )
  it.each(['hidden', 'paused', 'disposed'] as const)(
    'suspends a pending zoom raster while %s without leaving a late frame',
    (mode) => {
      let now = 0
      const clock = vi.spyOn(performance, 'now').mockImplementation(() => now)
      const s = scene(true)
      try {
        s.frame(now)
        const layers = s.layerCount()
        now = 20
        s.listeners.get('wheel')!({ deltaY: -4, preventDefault() {} } as unknown as Event)
        s.frame(now)
        expect(s.layerCount()).toBe(layers)
        if (mode === 'hidden') s.visibility('hidden')
        else if (mode === 'paused')
          s.renderer.settings({ animate: false, zoom: 1.01, paused: true })
        else s.renderer.dispose()
        expect(s.frames.size).toBe(0)
        now = 1000
        s.frame(now)
        expect(s.layerCount()).toBe(layers)
        if (mode === 'hidden') s.visibility('visible')
        else if (mode === 'paused')
          s.renderer.settings({ animate: false, zoom: 1.01, paused: false })
        s.frame(now)
        if (mode !== 'disposed') expect(s.layerCount()).toBeGreaterThan(layers)
        else expect(s.layerCount()).toBe(layers)
        expect(s.frames.size).toBe(0)
        expect(s.select).not.toHaveBeenCalled()
      } finally {
        s.renderer.dispose()
        clock.mockRestore()
        vi.unstubAllGlobals()
      }
    },
  )
  it('keeps terrain pixels bounded while a zoom-out exposes more sectors before the final raster', () => {
    let now = 0
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now)
    const s = scene(true)
    try {
      s.renderer.settings({ animate: false, zoom: 1.4 })
      s.frame(now)
      for (let step = 1; step <= 60; step++) {
        now = step * 20
        s.renderer.settings({ animate: false, zoom: 1.4 - step * 0.0175 })
        s.frame(now)
      }
      expect(Number(s.canvas.dataset.cachedPixels)).toBeGreaterThan(0)
      expect(Number(s.canvas.dataset.cachedPixels)).toBeLessThanOrEqual(8_000_000)
      now += 140
      s.frame(now)
      expect(Number(s.canvas.dataset.tileSize)).toBeCloseTo(22.4)
      // At minimum zoom a large public surface can finish across several frames.
      for (let i = 0; i < 128 && s.frames.size; i++) {
        now += 16
        s.frame(now)
      }
      expect(s.frames.size).toBe(0)
    } finally {
      s.renderer.dispose()
      clock.mockRestore()
      vi.unstubAllGlobals()
    }
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
    const regionId = initial.sectors.find(
      (sector) => sector.id === initial.position.sectorId,
    )!.regionId
    const driftPerMs = worldWindTarget(initial.environment.weather, regionId) / 120
    expect(first.length).toBeGreaterThan(0)
    for (let i = 1; i <= 30; i++) {
      s.draws.length = 0
      s.frame(36066.66666663011 + i * 34)
      const next = shadows()
      expect(next.length).toBe(first.length)
      for (let j = 0; j < next.length; j++) {
        expect(next[j]!.image).toBe(first[j]!.image)
        expect(next[j]!.args[0]! - first[j]!.args[0]!).toBeCloseTo(i * 34 * 64 * MAP_X * driftPerMs)
        expect(next[j]!.args[1]! - first[j]!.args[1]!).toBeCloseTo(i * 34 * 64 * MAP_Y * driftPerMs)
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
    const view = projectWorld(newWorldState(), [], 1000)
    const forest = view.sectors.find((sector) => sector.id === view.position.sectorId)!
    const s = scene(false, {
      ...view,
      sectors: [
        {
          ...forest,
          buildings: [],
          landmarks: [],
          cells: forest.cells.map((cell) => ({ ...cell, terrain: 't' })),
        },
      ],
    })
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
    const s = scene(false, legacyTownView('verdant-expanse'))
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
  it('an offline retained fixture consumes its ground click until the fixture leaves the scene', () => {
    const s = scene()
    const destination = { sectorId: 'verdant-expanse', x: 8, y: 4 }
    s.renderer.update({
      ...s.view,
      players: [
        {
          characterId: 'old-fixture',
          name: 'Previous repeat',
          level: 1,
          portraitRef: '',
          imageUrl: '/old-fixture.webp',
          online: false,
          attackable: false,
          position: destination,
        },
      ],
    })
    s.frame(40)
    s.event('pointerdown', 563.2, 384.48)
    s.event('pointerup', 563.2, 384.48)
    expect(s.selectPlayer).toHaveBeenCalledWith('old-fixture')
    expect(s.select).not.toHaveBeenCalled()
    s.renderer.update({ ...s.view, players: [] })
    s.frame(80)
    s.event('pointerdown', 563.2, 384.48)
    s.event('pointerup', 563.2, 384.48)
    expect(s.select).toHaveBeenCalledExactlyOnceWith(destination)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('inverts a ground click exactly and never walks on the river or after dragging', () => {
    const s = scene(false, legacyTownView('verdant-expanse', 5, 4))
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
  it.each([
    [390, 850],
    [1296, 944],
    [3840, 2160],
  ])(
    'keeps every supplied visible tree painted while walking at minimum zoom in a %i by %i stage',
    (width, height) => {
      const base = projectWorld(newWorldState(), [], 1000)
      const own = base.sectors.find((sector) => sector.id === base.position.sectorId)!
      const sectors = Array.from({ length: 16 }, (_, index) => ({
        ...own,
        id: `forest:${index % 4}:${Math.floor(index / 4)}`,
        regionId: 'verdant-expanse',
        atlasColumn: index % 4,
        atlasRow: Math.floor(index / 4),
        landscape: undefined,
        landmarks: [],
        buildings: [],
        cells: own.cells.map((cell) => ({ ...cell, terrain: 't', walkable: true })),
      }))
      const position = { sectorId: 'forest:1:1', x: 6, y: 4 }
      const view = { ...base, position, sectors, scenery: [], atlas: [] }
      const s = scene(true, view)
      try {
        Object.assign(s.canvas, { clientWidth: width, clientHeight: height })
        s.resize()
        s.renderer.settings({ animate: false, zoom: 0.35 })
        s.motion.reconcile(
          {
            ...view,
            version: view.version + 1,
            nextStepAt: 1200,
            route: [7, 8, 9, 10].map((x) => ({ position: { ...position, x }, durationMs: 200 })),
          },
          0,
        )
        for (const now of [0, 500, 800]) {
          s.draws.length = 0
          s.ellipses.length = 0
          s.frame(now)
          const tile = width < 600 ? 16.8 : 22.4
          const camera = {
            x: Number(s.canvas.dataset.cameraX),
            y: Number(s.canvas.dataset.cameraY),
          }
          const key = (x: number, y: number) => `${x.toFixed(5)}:${y.toFixed(5)}`
          const painted = new Set(
            s.draws
              .filter(
                (draw) =>
                  draw.src.endsWith('living-trees-v01.webp') ||
                  (draw.src === '' &&
                    draw.args.length === 4 &&
                    s.composites.get(draw.image)?.length === 1 &&
                    (s.composites.get(draw.image)![0] as HTMLImageElement).src?.endsWith(
                      'living-trees-v01.webp',
                    )),
              )
              .map((draw) => {
                const [x, y, width, height] = draw.args.slice(-4)
                const rootX = x! + width! * 0.5
                const rootY = y! + height! * (488 / 512)
                return key(
                  (draw.matrix[0]! * rootX + draw.matrix[2]! * rootY + draw.matrix[4]!) / 1.5,
                  (draw.matrix[1]! * rootX + draw.matrix[3]! * rootY + draw.matrix[5]!) / 1.5,
                )
              }),
          )
          const expected = sectors
            .flatMap((sector) =>
              sector.cells.map((cell) => ({
                x:
                  width / 2 +
                  (sector.atlasColumn * 13 +
                    cell.x +
                    0.5 -
                    camera.x -
                    (sector.atlasRow * 9 + cell.y + 0.75 - camera.y)) *
                    tile *
                    0.85,
                y:
                  height / 2 +
                  (sector.atlasColumn * 13 +
                    cell.x +
                    0.5 -
                    camera.x +
                    (sector.atlasRow * 9 + cell.y + 0.75 - camera.y)) *
                    tile *
                    0.44,
              })),
            )
            .filter(
              (point) =>
                point.x > 20 && point.x < width - 20 && point.y > 60 && point.y < height - 20,
            )
          expect(expected.length).toBeGreaterThan(180)
          expect(expected.filter((point) => !painted.has(key(point.x, point.y)))).toHaveLength(0)
          // Far sprites keep their bodies without one shadow/path per tree.
          expect(s.ellipses.length).toBeLessThan(40)
        }
      } finally {
        s.renderer.dispose()
        vi.unstubAllGlobals()
      }
    },
  )
  it.each([
    ['desktop', 800, 1],
    ['phone overview', 414, 0.35],
  ] as const)(
    'reuses %s projected ground during movement with native-density translations',
    (_label, width, zoom) => {
      const base = projectWorld(newWorldState(), [], 1000)
      const view = {
        ...base,
        scenery: [],
        sectors: [
          {
            ...base.sectors.find((sector) => sector.id === base.position.sectorId)!,
            buildings: [],
            landmarks: [],
            cells: base.sectors
              .find((sector) => sector.id === base.position.sectorId)!
              .cells.map((cell) => ({ ...cell, terrain: '.', walkable: true })),
          },
        ],
      }
      const s = scene(true, view)
      try {
        Object.assign(s.canvas, { clientWidth: width })
        s.resize()
        s.renderer.settings({ animate: false, zoom })
        s.frame(40)
        const projection = s.draws.find(
          ({ src, args, matrix }) =>
            !src && args.length === 2 && matrix.join(',') === '1,0,0,1,0,0',
        )!
        expect(projection).toBeDefined()
        const layers = s.layerCount()
        s.motion.plan(
          [{ position: { ...view.position, x: view.position.x + 1 }, durationMs: 200 }],
          view.sectors,
          40,
        )
        s.renderer.update(view)
        s.draws.length = 0
        s.frame(80)
        s.frame(120)
        const blits = s.draws.filter(({ image }) => image === projection.image)
        expect(blits.length).toBeGreaterThan(0)
        expect(
          blits.every(
            ({ matrix, args }) => matrix.join(',') === '1,0,0,1,0,0' && args.length === 2,
          ),
        ).toBe(true)
        expect(blits.at(-1)!.args).not.toEqual(projection.args)
        expect(s.layerCount()).toBe(layers)
      } finally {
        s.renderer.dispose()
        vi.unstubAllGlobals()
      }
    },
  )
  it('defers a new desktop terrain projection while a route is being painted', () => {
    const base = projectWorld(newWorldState(), [], 1000)
    const position = { sectorId: 'dry-4', x: 6, y: 4 }
    const sector = base.sectors.find(({ id }) => id === base.position.sectorId)!
    const view = {
      ...base,
      position,
      atlas: undefined,
      scenery: [],
      sectors: Array.from({ length: 9 }, (_, index) => ({
        ...sector,
        id: `dry-${index}`,
        atlasColumn: index % 3,
        atlasRow: Math.floor(index / 3),
        buildings: [],
        landmarks: [],
        cells: sector.cells.map((cell) => ({ ...cell, terrain: '.', walkable: true })),
      })),
    }
    const s = scene(true, view)
    try {
      Object.assign(s.canvas, { clientWidth: 800 })
      s.resize()
      s.renderer.settings({ animate: false, zoom: 1 })
      s.canvas.dataset.renderDiagnostics = 'timing'
      s.frame(40)
      expect(JSON.parse(s.canvas.dataset.renderTiming!).projectedGroundSectors).toBeGreaterThan(0)

      s.motion.plan(
        [{ position: { ...view.position, x: view.position.x + 1 }, durationMs: 200 }],
        view.sectors,
        40,
      )
      // A decoded image invalidates existing raster layers while a route is active.
      s.images[0]!.onload?.()
      s.draws.length = 0
      s.frame(80)
      expect(JSON.parse(s.canvas.dataset.renderTiming!).projectedGroundSectors).toBe(0)
      expect(s.draws.some(({ matrix }) => matrix[1] === 1.5 * MAP_Y)).toBe(true)
      for (let at = 120; at <= 1800; at += 40) s.frame(at)
      expect(JSON.parse(s.canvas.dataset.renderTiming!).projectedGroundSectors).toBeGreaterThan(0)
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  })
  it('retains padded scenery without building a ground raster clipped by the viewport', () => {
    const base = projectWorld(newWorldState(), [], 1000)
    const sector = base.sectors.find(({ id }) => id === base.position.sectorId)!
    const dry = {
      ...sector,
      buildings: [],
      landmarks: [],
      cells: sector.cells.map((cell) => ({ ...cell, terrain: '.' as const, walkable: true })),
    }
    const s = scene(true, {
      ...base,
      position: { sectorId: 'centre', x: 6, y: 4 },
      atlas: undefined,
      scenery: [],
      sectors: [
        { ...dry, id: 'centre', atlasColumn: 1, atlasRow: 1 },
        { ...dry, id: 'outside', atlasColumn: 2, atlasRow: 0 },
      ],
    })
    try {
      s.canvas.dataset.renderDiagnostics = 'timing'
      s.frame(40)
      expect(JSON.parse(s.canvas.dataset.paintedGroundIds!)).toContain('outside')
      expect(JSON.parse(s.canvas.dataset.renderTiming!).groundBuilds).toBe(1)
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  })
  it('reuses the settled desktop sector bitmaps when movement outgrows the viewport composite', () => {
    const base = projectWorld(newWorldState(), [], 1000)
    const position = { sectorId: 'dry-4', x: 6, y: 4 }
    const sector = base.sectors.find(({ id }) => id === base.position.sectorId)!
    const view = {
      ...base,
      position,
      atlas: undefined,
      scenery: [],
      sectors: Array.from({ length: 9 }, (_, index) => ({
        ...sector,
        id: `dry-${index}`,
        atlasColumn: index % 3,
        atlasRow: Math.floor(index / 3),
        buildings: [],
        landmarks: [],
        cells: sector.cells.map((cell) => ({ ...cell, terrain: '.', walkable: true })),
      })),
    }
    const s = scene(true, view)
    try {
      window.devicePixelRatio = 1
      s.resize()
      s.renderer.settings({ animate: false, zoom: 1 })
      s.canvas.dataset.renderDiagnostics = 'timing'
      s.frame(40)
      expect(JSON.parse(s.canvas.dataset.renderTiming!).projectedGroundSectors).toBeGreaterThan(0)
      const layers = s.layerCount()
      s.motion.plan(
        [7, 8, 9, 10].map((x) => ({ position: { ...position, x }, durationMs: 200 })),
        view.sectors,
        40,
      )
      s.renderer.update(view)
      let usedSectorBitmaps = false
      for (let at = 80; at <= 920; at += 40) {
        s.frame(at)
        if (JSON.parse(s.canvas.dataset.renderTiming!).projectedGroundSectors === 0) {
          expect(s.layerCount()).toBe(layers)
          usedSectorBitmaps = true
        }
      }
      expect(usedSectorBitmaps).toBe(true)
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  })
  it('reuses the settled wide-zoom phone terrain projection without repainting its affine border', () => {
    const base = projectWorld(newWorldState(), [], 1000)
    const sector = base.sectors.find((candidate) => candidate.id === base.position.sectorId)!
    const view = {
      ...base,
      scenery: [],
      players: [],
      sectors: [{ ...sector, buildings: [], landmarks: [] }],
    }
    const s = scene(true, view)
    try {
      Object.assign(s.canvas, { clientWidth: 414, clientHeight: 630 })
      window.devicePixelRatio = 2.625
      s.canvas.dataset.renderDiagnostics = 'timing'
      s.resize()
      s.renderer.settings({ animate: false, zoom: 0.35, quality: 'balanced' })
      s.frame(40)
      const projection = s.draws.find(
        ({ src, args, matrix }) => !src && args.length === 2 && matrix.join(',') === '1,0,0,1,0,0',
      )
      expect(projection).toBeDefined()
      const layers = s.layerCount()
      s.draws.length = 0
      for (let n = 1; n <= 60; n++) {
        s.renderer.update(view)
        s.frame(40 + n * 40)
      }
      expect(s.draws.some(({ image }) => image === projection!.image)).toBe(true)
      expect(s.layerCount()).toBe(layers)
      expect(s.canvas.width).toBe(Math.round(414 * 1.5))
      expect(s.identityCanvas.width).toBe(Math.round(414 * 2.625))
      expect(Number(s.canvas.dataset.cachedPixels)).toBeLessThanOrEqual(8_000_000)
      expect(Number(s.canvas.dataset.cachedGroundProjectionPixels)).toBeGreaterThan(0)
      expect(Number(s.canvas.dataset.cachedGroundProjectionPixels)).toBeLessThanOrEqual(8_000_000)
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  })
  it('reuses the painted town building crop across wide-zoom phone frames', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
    const s = scene(false, legacyTownView('verdant-expanse', 5, 4))
    const isTownArt = ({ src }: { src: string }) =>
      src.endsWith('town-ordinary-architecture-v01.webp')
    try {
      Object.assign(s.canvas, { clientWidth: 389, clientHeight: 669 })
      window.devicePixelRatio = 2.625
      s.resize()
      s.renderer.settings({ animate: true, zoom: 0.64 })
      clock.mockReturnValue(200)
      s.frame(200)
      const initial = s.spriteDraws.filter(isTownArt).map(({ args }) => args)
      expect(initial.length).toBeGreaterThan(0)
      s.draws.length = 0
      clock.mockReturnValue(250)
      s.frame(250)
      expect(s.spriteDraws.filter(isTownArt).map(({ args }) => args)).toEqual(initial)
      expect(s.draws.filter(isTownArt)).toHaveLength(0)
    } finally {
      s.renderer.dispose()
      clock.mockRestore()
      vi.unstubAllGlobals()
    }
  })
  it('repaints only the watch officer footprint when its idle pose advances', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
    const view = legacyTownView('verdant-expanse', 5, 4)
    const look = compileAppearanceManifest(APPEARANCE_PRESETS[0]!.blueprint)
    const s = scene(false, {
      ...view,
      npcs: [
        {
          id: 'eastern-watch-officer',
          name: 'Tamsin Reed (Watch Officer)',
          imageUrl: look.portraits.neutral,
          motionImageUrl: look.portraits.neutral,
          position: { ...view.position, x: 2 },
        },
      ],
      players: [
        {
          characterId: 'distant-peer',
          name: 'Distant peer',
          level: 1,
          portraitRef: '',
          imageUrl: '/distant-peer.webp',
          online: true,
          attackable: false,
          position: { ...view.position, x: 8, y: 2 },
        },
      ],
    })
    try {
      const isMotion = ({ src }: { src: string }) => src === look.motionAtlas
      s.frame(40)
      const source = s.draws.find(isMotion)
      const pose = s.identityDraws.find(({ image }) =>
        s.composites.get(image)?.some((part) => 'src' in part && part.src === look.motionAtlas),
      )
      const peer = s.identitySprites.find(({ src }) => src === '/distant-peer.webp')
      expect(source).toBeDefined()
      expect(pose).toBeDefined()
      expect(peer).toBeDefined()
      s.identityClear.mockClear()
      s.draws.length = 0
      clock.mockReturnValue(300)
      s.frame(300)
      const next = s.draws.find(isMotion)
      expect(next).toBeDefined()
      expect(next!.args[0]).not.toBe(source!.args[0])
      expect(s.identityClear).toHaveBeenCalledTimes(1)
      const [left, top, width, height] = s.identityClear.mock.calls[0]!
      const [poseX, poseY, , poseHeight] = pose!.args.slice(-4)
      expect(left).toBeLessThanOrEqual(poseX!)
      expect(top).toBeLessThanOrEqual(poseY!)
      expect(left + width).toBeLessThan(peer!.args[4]!)
      expect(top + height).toBeGreaterThanOrEqual(poseY! + poseHeight!)
    } finally {
      s.renderer.dispose()
      clock.mockRestore()
      vi.unstubAllGlobals()
    }
  })
  it('caps high-DPI resolution and reports bounded terrain memory', () => {
    const s = scene()
    expect(s.canvas.width).toBe(1200)
    s.frame(40)
    const layers = s.layerCount()
    for (let i = 1; i <= 61; i++) s.frame(i * 40)
    expect(Number(s.canvas.dataset.cachedPixels)).toBeLessThanOrEqual(8_000_000)
    expect(Number(s.canvas.dataset.detailedScenery)).toBeLessThanOrEqual(180)
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
  it('keeps oversized visible portrait working sets stable across frames', () => {
    const s = scene()
    try {
      const sector = s.view.sectors.find(({ id }) => id === s.view.position.sectorId)!
      const players = sector.cells.map(({ x, y }, index) => ({
        characterId: `crowd-${index}`,
        name: `Crowd ${index}`,
        level: 1,
        portraitRef: '',
        imageUrl: `/crowd-${index}.webp`,
        online: true,
        attackable: false,
        position: { sectorId: sector.id, x, y },
      }))
      s.renderer.update({ ...s.view, players })
      s.renderer.settings({ animate: true, zoom: 0.35 })
      s.frame(40)
      const requests = s.images.length
      s.frame(100)
      expect(s.images.length).toBe(requests)
      expect(
        s.identitySprites.filter(({ src }) => src.startsWith('/crowd-')).length,
      ).toBeGreaterThan(100)
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  })
  it('indexes scenery occlusion instead of comparing every traveller with every body', () => {
    const s = scene()
    try {
      const sector = s.view.sectors.find(({ id }) => id === s.view.position.sectorId)!
      const players = sector.cells.slice(0, 80).map(({ x, y }, index) => ({
        characterId: `indexed-${index}`,
        name: `Indexed ${index}`,
        level: 1,
        portraitRef: '',
        imageUrl: '/indexed.webp',
        online: true,
        attackable: false,
        position: { sectorId: sector.id, x, y },
      }))
      s.renderer.update({ ...s.view, players })
      s.renderer.settings({ animate: true, zoom: 0.35 })
      s.canvas.dataset.renderDiagnostics = 'timing'
      s.frame(40)
      const timing = JSON.parse(s.canvas.dataset.renderTiming!)
      expect(timing.identityOccluderChecks).toBeLessThan(
        timing.identityOccluders * (players.length + 1),
      )
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  })
  it('keeps dense nameplates readable without removing visible players', () => {
    const s = scene()
    const players = Array.from({ length: 25 }, (_, index) => ({
      characterId: `neighbor-${index}`,
      name: `Neighbour ${index}`,
      level: 1,
      portraitRef: '',
      imageUrl: '/peer.webp',
      online: true,
      attackable: false,
      position: {
        ...s.view.position,
        x: 2 + (index % 6),
        y: 2 + Math.floor(index / 6),
      },
    }))
    s.renderer.update({ ...s.view, players })
    s.renderer.settings({ animate: true, zoom: 0.65 })
    s.frame(40)

    const labels = s.texts.filter(({ text }) => text === 'Wayfarer' || text.startsWith('Neighbour'))
    expect(labels.some(({ text }) => text === 'Wayfarer')).toBe(true)
    expect(labels.length).toBeLessThanOrEqual(12)
    expect(s.identitySprites.filter(({ src }) => src === '/peer.webp').length).toBeGreaterThan(12)
    for (const [index, label] of labels.entries()) {
      const fontSize = Number(/(\d+)px/.exec(label.font)![1])
      const width = label.text.length * 7 + 12
      expect(
        labels.slice(0, index).some((other) => {
          const otherWidth = other.text.length * 7 + 12
          return (
            Math.abs(label.y - other.y) < fontSize + 6 &&
            label.x < other.x + otherWidth &&
            label.x + width > other.x
          )
        }),
      ).toBe(false)
    }

    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
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
      const self = s.texts.findLast((text) => text.text === 'Wayfarer')!
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
    expect(s.select).toHaveBeenCalledWith({ sectorId: s.view.position.sectorId, x: 5, y: 4 })
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it('clears only the prior native identity footprint while travellers move', () => {
    const s = scene()
    try {
      s.canvas.dataset.portrait = '/moving-native.webp'
      s.frame(40)
      const portrait = s.identityDraws.find((entry) => entry.src === '/moving-native.webp')!
      const [portraitX, portraitY, portraitWidth, portraitHeight] = portrait.args.slice(-4)
      const priorLabel = s.texts.findLast(({ text }) => text === 'Wayfarer')!
      const destination = { ...s.view.position, x: s.view.position.x + 1 }
      s.identityClear.mockClear()
      s.motion.plan([{ position: destination, durationMs: 200 }], s.view.sectors, 40)
      s.frame(80)

      expect(s.identityClear).toHaveBeenCalledTimes(1)
      const [left, top, clearWidth, clearHeight] = s.identityClear.mock.calls[0]!
      expect(clearWidth).toBeLessThan(800)
      expect(clearHeight).toBeLessThan(600)
      expect(left).toBeLessThanOrEqual(portraitX)
      expect(top).toBeLessThanOrEqual(portraitY)
      expect(left + clearWidth).toBeGreaterThanOrEqual(portraitX + portraitWidth)
      expect(top + clearHeight).toBeGreaterThanOrEqual(portraitY + portraitHeight)
      expect(left).toBeLessThanOrEqual(priorLabel.x - 6)
      expect(top + clearHeight).toBeGreaterThan(priorLabel.y)
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
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
      const draw = s.identitySprites.find((entry) => entry.src === '/scaled-peer.webp')!
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
  it('reuses stationary phone terrain without freezing water or reusing a stale camera projection', () => {
    const position = { sectorId: 'aureth-crown', x: 6, y: 4 }
    const view = projectWorld({ ...newWorldState(), position }, [], 1000)
    const s = scene(false, view)
    try {
      Object.assign(s.canvas, { clientWidth: 393, clientHeight: 851 })
      s.resize()
      s.renderer.settings({ animate: true, zoom: 0.35 })
      const projectedGround = () =>
        s.draws.find(
          ({ image, args }) => image.width === 590 && image.height === 1277 && args.length === 2,
        )
      const liquidStrokes = () =>
        s.strokes.filter(({ colour }) => colour === '#bbded0' || colour === '#82c6c7')
      s.frame(40)
      const firstGround = projectedGround()?.image
      expect(firstGround).toBeDefined()
      const firstWater = liquidStrokes()
      expect(firstWater.length).toBeGreaterThan(0)
      s.draws.length = 0
      s.strokes.length = 0
      s.frame(80)
      expect(projectedGround()?.image).toBe(firstGround)
      expect(liquidStrokes()).not.toEqual(firstWater)
      expect(liquidStrokes().length).toBe(firstWater.length)
      s.images[0]!.onload?.()
      s.draws.length = 0
      s.frame(120)
      expect(projectedGround()?.image).toBeDefined()
      expect(projectedGround()?.image).not.toBe(firstGround)
      s.motion.plan([{ position: { ...position, x: 7 }, durationMs: 200 }], view.sectors, 120)
      s.draws.length = 0
      s.frame(160)
      expect(projectedGround()).toBeUndefined()
      expect(s.draws.some(({ matrix }) => matrix[1] === 1.5 * MAP_Y)).toBe(true)
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  })
  it('reuses finished native terrain snapshots and closes every owned image on disposal', () => {
    const position = { sectorId: 'verdant-expanse', x: 5, y: 4 }
    const s = scene(false, projectWorld({ ...newWorldState(), position }, [], 1000))
    const snapshots: {
      src: string
      width: number
      height: number
      close: ReturnType<typeof vi.fn>
    }[] = []
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        constructor(
          public width: number,
          public height: number,
        ) {}
        getContext() {
          return { drawImage() {} }
        }
        transferToImageBitmap() {
          const image = {
            src: 'immutable-static-terrain',
            width: this.width,
            height: this.height,
            close: vi.fn(),
          }
          snapshots.push(image)
          return image
        }
      },
    )
    try {
      Object.assign(s.canvas, { clientWidth: 389, clientHeight: 669 })
      window.devicePixelRatio = 2.625
      s.resize()
      s.renderer.settings({ animate: true, zoom: 0.35 })
      s.canvas.dataset.renderDiagnostics = 'timing'
      s.frame(40)
      const painted = () => s.draws.filter(({ src }) => src === 'immutable-static-terrain')
      const initial = painted().map(({ image }) => image)
      expect(initial.length).toBeGreaterThan(0)
      const water = s.strokes.filter(({ colour }) => colour === '#bbded0' || colour === '#82c6c7')
      expect(water.length).toBeGreaterThan(0)
      const layers = s.layerCount()
      s.draws.length = 0
      s.strokes.length = 0
      s.frame(100)
      expect(painted().every(({ image }) => initial.includes(image))).toBe(true)
      expect(s.layerCount()).toBe(layers)
      const movingWater = s.strokes.filter(
        ({ colour }) => colour === '#bbded0' || colour === '#82c6c7',
      )
      expect(movingWater).toHaveLength(water.length)
      expect(movingWater).not.toEqual(water)
      expect(JSON.parse(s.canvas.dataset.renderTiming!).groundBuilds).toBe(0)
      expect(JSON.parse(s.canvas.dataset.renderTiming!)).toMatchObject({
        staticRasterBuilds: 0,
        staticRasterTransfers: 0,
        immutableStaticImages: expect.any(Number),
      })
      const resized = [...snapshots]
      s.resize()
      expect(resized.every(({ close }) => close.mock.calls.length === 1)).toBe(true)
      s.frame(160)
      expect(snapshots.length).toBeGreaterThan(resized.length)
    } finally {
      s.renderer.dispose()
      expect(snapshots.length).toBeGreaterThan(0)
      expect(snapshots.every(({ close }) => close.mock.calls.length === 1)).toBe(true)
      vi.unstubAllGlobals()
    }
  })
  it('reuses compact scenery at rest and discards its pixels after art or camera changes', () => {
    const position = { sectorId: 'aureth-crown', x: 6, y: 4 }
    const view = projectWorld({ ...newWorldState(), position }, [], 1000)
    const s = scene(false, view)
    try {
      Object.assign(s.canvas, { clientWidth: 393, clientHeight: 851 })
      s.resize()
      const settings = { animate: false, zoom: 0.35 }
      s.renderer.settings(settings)
      const batches = () => {
        const ground = new Set(
          [...s.composites]
            .filter(([, sources]) =>
              sources.some((source) =>
                (source as HTMLImageElement).src?.endsWith('regional-ground-v02.webp'),
              ),
            )
            .map(([layer]) => layer),
        )
        return s.draws.filter(
          ({ image, args, matrix }) =>
            args.length === 2 &&
            matrix[0] === 1 &&
            // A terrain projection can also be a compact translated bitmap.
            !s.composites.get(image)?.some((source) => ground.has(source)) &&
            (image.width < s.canvas.width || image.height < s.canvas.height),
        )
      }
      s.frame(40)
      const first = batches().map(({ image }) => image)
      expect(first.length).toBeGreaterThan(0)
      expect(
        first.reduce((pixels, image) => pixels + image.width * image.height, 0),
      ).toBeLessThanOrEqual(800_000)

      s.draws.length = 0
      s.renderer.settings(settings)
      s.frame(80)
      expect(batches().map(({ image }) => image)).toEqual(first)
      expect(batches().every(({ image }, index) => image === first[index])).toBe(true)

      s.draws.length = 0
      s.images
        .find((image) => (image as HTMLImageElement).src.endsWith('nature-v02.webp'))
        ?.onload?.()
      s.frame(120)
      expect(batches().length).toBeGreaterThan(0)
      expect(batches().some(({ image }) => first.includes(image))).toBe(false)

      s.draws.length = 0
      s.motion.plan([{ position: { ...position, x: 7 }, durationMs: 200 }], view.sectors, 120)
      s.renderer.settings(settings)
      s.frame(160)
      expect(batches()).toEqual([])
      expect(s.draws.some(({ src }) => src.endsWith('nature-v02.webp'))).toBe(true)
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  })
  it('reuses immutable fog pixels on moving Night redraws without changing paused painting', () => {
    const s = scene()
    // The shared recorder retains transforms only. This compositing regression
    // also needs the native alpha save/restore contract.
    const context = s.canvas.getContext('2d')!
    const save = context.save.bind(context),
      restore = context.restore.bind(context)
    const alphas: number[] = []
    context.save = () => {
      alphas.push(context.globalAlpha)
      save()
    }
    context.restore = () => {
      restore()
      context.globalAlpha = alphas.pop() ?? 1
    }
    const close = vi.fn()
    const transfer = vi.fn(function (this: { width: number; height: number }) {
      return { src: 'immutable-weather-veil', width: this.width, height: this.height, close }
    })
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        constructor(
          public width: number,
          public height: number,
        ) {}
        getContext() {
          return {
            setTransform: vi.fn(),
            fillStyle: '',
            fillRect: vi.fn(),
            createRadialGradient: () => ({ addColorStop: vi.fn() }),
          }
        }
        transferToImageBitmap = transfer
      },
    )
    try {
      s.renderer.update({
        ...s.view,
        environment: { ...s.view.environment, minuteOfDay: 116.65333333333334, weather: 'fog' },
      })
      s.frame(40)
      const fog = () => s.draws.filter(({ src }) => src === 'immutable-weather-veil')
      expect(fog()).toHaveLength(1)
      const image = fog()[0]!.image
      s.motion.plan(
        [{ position: { ...s.view.position, x: s.view.position.x + 1 }, durationMs: 1000 }],
        s.view.sectors,
        40,
      )
      for (let i = 1; i <= 12; i++) s.frame(40 + i * 40)
      expect(transfer).toHaveBeenCalledOnce()
      expect(fog().every((draw) => draw.image === image)).toBe(true)
      s.draws.length = 0
      s.renderer.settings({ animate: false, zoom: 1 })
      s.frame(600)
      expect(fog()).toHaveLength(0)
      s.renderer.dispose()
      expect(close).toHaveBeenCalledOnce()
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
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
  it('freezes gradual world lighting across redraws while ambient effects are disabled', () => {
    const s = scene()
    const lighting = () =>
      s.rectangles.find(
        ({ colour }) => typeof colour === 'string' && colour.startsWith('rgba(12,27,65,'),
      )?.colour
    s.renderer.settings({ animate: false, zoom: 1 })
    s.frame(40)
    const frozen = lighting()
    s.rectangles.length = 0
    s.renderer.update({
      ...s.view,
      environment: { ...s.view.environment, minuteOfDay: s.view.environment.minuteOfDay + 600 },
    })
    s.frame(80)
    expect(lighting()).toBe(frozen)
    s.rectangles.length = 0
    s.renderer.settings({ animate: true, zoom: 1 })
    s.frame(120)
    expect(lighting()).not.toBe(frozen)
    s.renderer.dispose()
    vi.unstubAllGlobals()
  })
  it.each(['effects off', 'reduced motion'])(
    'freezes weather drift on presence redraws with %s and resumes only when enabled',
    (mode) => {
      const veil = vi.spyOn(weatherPainting, 'paintWeatherVeil')
      const s = scene(mode === 'reduced motion')
      try {
        s.renderer.update({
          ...s.view,
          environment: { ...s.view.environment, weather: 'overcast' },
        })
        s.frame(40)
        s.frame(80)
        const frozen = veil.mock.calls.at(-1)![4]
        if (mode === 'effects off') s.renderer.settings({ animate: false, zoom: 1 })
        s.frame(120)
        expect(veil.mock.calls.at(-1)![4]).toBe(frozen)
        // A real receipt still changes weather while its visual drift remains paused.
        s.renderer.update({ ...s.view, environment: { ...s.view.environment, weather: 'fog' } })
        s.frame(160)
        expect(veil.mock.calls.at(-1)![3]).toBe('fog')
        expect(veil.mock.calls.at(-1)![4]).toBe(frozen)
        if (mode === 'effects off') {
          s.renderer.settings({ animate: true, zoom: 1 })
          s.frame(200)
          expect(veil.mock.calls.at(-1)![4]).not.toBe(frozen)
        }
      } finally {
        s.renderer.dispose()
        veil.mockRestore()
        vi.unstubAllGlobals()
      }
    },
  )
  it('keeps the idle paint cadence when a previous animation callback entered late', () => {
    const s = scene()
    const clock = vi.mocked(performance.now)
    try {
      clock.mockReturnValue(104)
      s.frame(100)
      expect(s.canvas.dataset.frameNow).toBe('104')

      clock.mockReturnValue(117)
      s.frame(100 + 1000 / 60)
      expect(s.canvas.dataset.frameNow).toBe('104')

      clock.mockReturnValue(134)
      s.frame(100 + 1000 / 30)
      expect(s.canvas.dataset.frameNow).toBe('134')
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
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

it('reduces cosmetic storm work in the Low tier while retaining movement input', () => {
  const initial = projectWorld(newWorldState(), [], 1000)
  const s = scene(false, { ...initial, environment: { ...initial.environment, weather: 'storm' } })
  try {
    s.frame(40)
    expect(s.canvas.dataset.precipitationParticles).toBe('160')
    s.renderer.settings({ animate: true, zoom: 1, quality: 'low' })
    s.frame(100)
    expect(Number(s.canvas.dataset.precipitationParticles)).toBeLessThan(64)
    expect(s.canvas.dataset.clouds).toBe('0')
    s.event('pointerdown', 400, 313)
    s.event('pointerup', 400, 313)
    expect(s.select).toHaveBeenCalledTimes(1)
    expect(s.canvas.dataset.precipitation).toBe('rain')
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it('reduces phone cloud compositing by default and keeps Low identity sharp', () => {
  const s = scene()
  try {
    Object.assign(s.canvas, { clientWidth: 393, clientHeight: 851 })
    window.devicePixelRatio = 2.75
    s.resize()
    s.frame(40)
    expect(s.canvas.dataset.clouds).toBe('0')
    expect(s.canvas.width).toBe(Math.round(393 * 1.5))

    s.renderer.settings({ animate: true, zoom: 1, quality: 'high' })
    s.frame(100)
    expect(Number(s.canvas.dataset.clouds)).toBeGreaterThan(0)

    s.renderer.settings({ animate: true, zoom: 1, quality: 'low' })
    s.frame(160)
    expect(s.canvas.width).toBe(393)
    expect(s.identityCanvas.width).toBe(Math.round(393 * 2.75))
    expect(s.canvas.dataset.clouds).toBe('0')
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it('transfers reusable native canopy crops and closes them when density changes', () => {
  const position = { sectorId: 'atlas:59:28', x: 4, y: 4 }
  const s = scene(false, projectWorld({ ...newWorldState(), position }, [], 1000))
  const transferred: {
    src: string
    width: number
    height: number
    close: ReturnType<typeof vi.fn>
  }[] = []
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      private source?: object
      constructor(
        public width: number,
        public height: number,
      ) {}
      getContext() {
        return { drawImage: (source: object) => (this.source = source) }
      }
      transferToImageBitmap() {
        const contents = this.source ? s.composites.get(this.source) : undefined
        const canopy =
          contents?.length === 1 &&
          String((contents[0] as HTMLImageElement | undefined)?.src).endsWith('beauties-v03.webp')
        const image = {
          src: canopy ? 'immutable-biome-canopy' : 'immutable-static-raster',
          width: this.width,
          height: this.height,
          close: vi.fn(),
        }
        transferred.push(image)
        return image
      }
    },
  )
  try {
    for (const image of s.images)
      if ((image as HTMLImageElement).src.endsWith('beauties-v03.webp'))
        Object.assign(image, { width: 1774, height: 887, naturalWidth: 1774 })
    Object.assign(s.canvas, { clientWidth: 1280, clientHeight: 720 })
    window.devicePixelRatio = 3
    s.resize()
    s.renderer.settings({ animate: true, zoom: 1 })
    s.frame(40)
    const canopies = transferred.filter(({ src }) => src === 'immutable-biome-canopy')
    expect(canopies.length).toBeGreaterThan(0)

    s.motion.plan(
      [{ position: { ...position, x: position.x + 1 }, durationMs: 200 }],
      s.view.sectors,
      40,
    )
    s.draws.length = 0
    s.frame(80)
    expect(s.draws.some(({ src }) => src === 'immutable-biome-canopy')).toBe(true)

    s.resize()
    expect(canopies.every(({ close }) => close.mock.calls.length === 1)).toBe(true)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it.each(
  [1, 3].flatMap((dpr) =>
    ['living-trees-v01.webp', 'beauties-v03.webp'].map((sheet) => ({ dpr, sheet })),
  ),
)(
  'reuses native desktop $sheet crops at DPR $dpr while retaining canopy motion',
  ({ dpr, sheet }) => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
    const state = newWorldState()
    state.position = { sectorId: 'atlas:59:28', x: 4, y: 4 }
    const s = scene(false, projectWorld(state, [], 1000))
    try {
      for (const image of s.images)
        if ((image as HTMLImageElement).src.endsWith('beauties-v03.webp'))
          Object.assign(image, { width: 1774, height: 887, naturalWidth: 1774 })
      Object.assign(s.canvas, { clientWidth: 1280, clientHeight: 720 })
      window.devicePixelRatio = dpr
      s.resize()
      s.renderer.settings({ animate: true, zoom: 1 })
      s.canvas.dataset.renderDiagnostics = 'timing'
      s.frame(40)
      const treeSource = (src: string) => src.endsWith(sheet)
      const crops = s.draws.filter(
        ({ src, args }) => treeSource(src) && args[4] === 0 && args[5] === 0,
      )
      expect(crops.length).toBeGreaterThan(0)
      if (sheet === 'beauties-v03.webp')
        for (const crop of crops)
          expect(crop.args.slice(0, 4)).toEqual([(893 / 1774) * 1774, 29, 430, 426])
      const cached = new Set(
        crops.flatMap((crop) =>
          [...s.composites.entries()]
            .filter(([layer, contents]) => {
              const canvas = layer as HTMLCanvasElement
              return (
                contents.length === 1 &&
                contents[0] === crop.image &&
                canvas.width === crop.args[6] &&
                canvas.height === crop.args[7]
              )
            })
            .map(([layer]) => layer),
        ),
      )
      expect(cached.size).toBeGreaterThan(0)
      const cold = JSON.parse(s.canvas.dataset.renderTiming!)
      expect(cold.biomeRasters).toBeLessThanOrEqual(64)
      expect(cold.biomeRasterPixels).toBeLessThanOrEqual(4_000_000)
      const before = s.draws.filter(({ image }) => cached.has(image))
      const layers = s.layerCount()
      s.draws.length = 0
      s.frame(100)
      // The high-resolution source must not be resampled for every swaying tree.
      expect(s.draws.filter(({ src }) => treeSource(src))).toHaveLength(0)
      expect(JSON.parse(s.canvas.dataset.renderTiming!).biomeRasterBuilds).toBe(0)
      expect(s.layerCount()).toBe(layers)
      const after = s.draws.filter(({ image }) => cached.has(image))
      expect(after.length).toBe(before.length)
      expect(after.map(({ args }) => args)).toEqual(before.map(({ args }) => args))
      expect(after.some((draw, index) => draw.matrix[2] !== before[index]!.matrix[2])).toBe(true)
      for (const draw of after) {
        expect(draw.image.width).toBeGreaterThanOrEqual(draw.args[2]! * Math.min(dpr, 1.5))
        expect(draw.image.height).toBeGreaterThanOrEqual(draw.args[3]! * Math.min(dpr, 1.5))
      }
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
      clock.mockRestore()
    }
  },
)

it('reuses articulated deer artwork during dusk without replaying live clipping', () => {
  const state = newWorldState()
  state.position = { sectorId: 'atlas:59:28', x: 4, y: 4 }
  const initial = projectWorld(state, [], 1000)
  const s = scene(false, {
    ...initial,
    environment: { ...initial.environment, minuteOfDay: 1100, weather: 'rain' },
  })
  try {
    s.renderer.settings({ animate: true, zoom: 1 })
    s.canvas.dataset.renderDiagnostics = 'timing'
    s.frame(40)
    const deerBodyClips = () =>
      s.clips.filter(({ points }) => points[0]?.[0] === 29 && points[0]?.[1] === 237)
    expect(deerBodyClips().length).toBeGreaterThan(0)
    const animals = Number(s.canvas.dataset.wildlife)
    expect(animals).toBeGreaterThan(0)
    s.clips.length = 0
    const layers = s.layerCount()
    s.frame(140)
    expect(Number(s.canvas.dataset.wildlife)).toBe(animals)
    expect(deerBodyClips()).toEqual([])
    expect(s.layerCount()).toBe(layers)
    const costs = JSON.parse(s.canvas.dataset.renderTiming!)
    expect(costs.wildlifePartBuilds).toBe(0)
    expect(costs.wildlifePartPixels).toBeGreaterThan(0)
    expect(costs.wildlifePartPixels).toBeLessThanOrEqual(512_000)
    s.images.find((image) => (image as HTMLImageElement).src.endsWith('nature-v02.webp'))!.onload!()
    s.frame(240)
    expect(JSON.parse(s.canvas.dataset.renderTiming!).wildlifePartBuilds).toBeGreaterThan(0)
    s.frame(340)
    expect(JSON.parse(s.canvas.dataset.renderTiming!).wildlifePartBuilds).toBe(0)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it('reuses cropped scenery rasters across zoomed-out phone frames', () => {
  const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
  const state = newWorldState()
  state.position = { sectorId: 'aureth-crown', x: 6, y: 4 }
  const s = scene(false, projectWorld(state, [], 1000))
  try {
    Object.assign(s.canvas, { clientWidth: 393, clientHeight: 851 })
    window.devicePixelRatio = 2.75
    s.resize()
    s.renderer.settings({ animate: true, zoom: 0.35 })
    s.frame(40)
    const crop = s.draws.find(
      (draw) =>
        draw.src.endsWith('living-trees-v01.webp') && draw.args[4] === 0 && draw.args[5] === 0,
    )
    expect(crop).toBeDefined()
    const cachedDraw = s.draws.find(
      ({ src, image, args }) =>
        src === '' &&
        args.length === 4 &&
        image.width === crop!.args[6] &&
        image.height === crop!.args[7],
    )
    expect(cachedDraw).toBeDefined()
    expect(cachedDraw!.image.width).toBe(Math.ceil(cachedDraw!.args[2]! * 1.5))
    expect(cachedDraw!.image.height).toBe(Math.ceil(cachedDraw!.args[3]! * 1.5))

    s.draws.length = 0
    s.frame(100)
    expect(s.draws.some(({ src }) => src.endsWith('living-trees-v01.webp'))).toBe(false)
    const reusesRaster = (image: object): boolean =>
      image === cachedDraw!.image || (s.composites.get(image) ?? []).some(reusesRaster)
    expect(s.draws.some(({ image }) => reusesRaster(image))).toBe(true)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
    clock.mockRestore()
  }
})

it.each([
  ['Hayward Farmstead', 0],
  ["Millers' Rest", 1],
  ['Thistledown Farm', 2],
  ['Brookside Steading', 3],
] as const)('renders %s as its own substantial hamlet building', (name, index) => {
  const initial = projectWorld(newWorldState(), [], 1000)
  const root = initial.sectors.find(({ id }) => id === initial.position.sectorId)!
  const landmark = { id: 'hamlet-art-test', name, kind: 'hamlet' as const, x: 6, y: 4 }
  const s = scene(false, {
    ...initial,
    sectors: [{ ...root, buildings: [], landmarks: [landmark] }],
  })
  try {
    const atlas = s.images.find((image) =>
      (image as HTMLImageElement).src.endsWith('hamlet-buildings-v01.webp'),
    )
    expect(atlas).toBeDefined()
    Object.assign(atlas!, { width: 768, height: 672, naturalWidth: 768 })
    s.frame(40)
    const building = s.draws.find(({ image }) => image === atlas)!
    expect(building).toBeDefined()
    expect(building.args.slice(0, 4)).toEqual([
      (index % 2) * 384,
      Math.floor(index / 2) * 336,
      384,
      336,
    ])
    expect(building.args[6]).toBeGreaterThanOrEqual(64 * 3)
    const center = mapPoint({ sectorId: root.id, x: 6, y: 4 }, initial.sectors)
    const foot = projectMapPoint(
      { x: center.x, y: center.y + 0.17 },
      mapPoint(initial.position, initial.sectors),
      { x: 0, y: 0 },
      64,
      800,
      600,
    )
    expect(building.matrix[4]).toBeCloseTo(foot.x * 1.5, 1)
    expect(building.matrix[5]).toBeCloseTo(foot.y * 1.5, 1)

    Object.assign(atlas!, { complete: false, naturalWidth: 0 })
    s.renderer.update({ ...initial, sectors: [{ ...root, buildings: [], landmarks: [landmark] }] })
    s.draws.length = 0
    s.frame(80)
    expect(s.draws.some(({ src }) => src.endsWith('props-v02.webp'))).toBe(true)
    expect(s.draws.some(({ image }) => image === atlas)).toBe(false)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it.each([
  [false, 'Hayward Farmstead'],
  [true, 'Unrecognized settlement'],
] as const)('keeps the hamlet building sheet off unsupported scenes (%s, %s)', (charted, name) => {
  const initial = projectWorld(newWorldState(), [], 1000)
  const root = initial.sectors.find(({ id }) => id === initial.position.sectorId)!
  const s = scene(false, {
    ...initial,
    sectors: [
      {
        ...root,
        charted,
        buildings: [],
        landmarks: [{ id: 'fallback', kind: 'hamlet', name, x: 6, y: 4 }],
      },
    ],
  })
  try {
    s.frame(40)
    expect(
      s.images.some((image) =>
        (image as HTMLImageElement).src.endsWith('hamlet-buildings-v01.webp'),
      ),
    ).toBe(false)
    expect(s.draws.some(({ src }) => src.endsWith('props-v02.webp'))).toBe(true)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it('keeps distinct Frostmere legacy art at its captured public footprint anchors', () => {
  const state = newWorldState()
  state.position = { sectorId: 'frostmere', x: 6, y: 4 }
  const initial = legacyTownView('frostmere')
  const s = scene(false, initial)
  try {
    const atlas = s.images.find((image) =>
      (image as HTMLImageElement).src.endsWith('frostmere-v01.webp'),
    )
    expect(atlas).toBeDefined()
    Object.assign(atlas!, { width: 1536, height: 336, naturalWidth: 1536 })
    s.frame(40)
    const buildings = s.draws.filter((draw) => draw.src.endsWith('frostmere-v01.webp'))
    expect(buildings.some((draw) => draw.args[0] === 0)).toBe(true)
    expect(buildings.some((draw) => draw.args[0] === 384)).toBe(true)
    expect(buildings.some((draw) => draw.args[0] === 1152)).toBe(true)
    const forge = buildings.find((draw) => draw.args[0] === 384)!
    const foot = projectMapPoint(
      {
        x: mapPoint(state.position, initial.sectors).x + 2.5,
        y: mapPoint(state.position, initial.sectors).y - 1.5,
      },
      mapPoint(state.position, initial.sectors),
      { x: 0, y: 0 },
      64,
      800,
      600,
    )
    expect(forge.matrix[4]).toBeCloseTo(foot.x * 1.5, 1)
    expect(forge.matrix[5]).toBeCloseTo(foot.y * 1.5, 1)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it.each([
  ['frostmere', 'settlement-dressing', 8, 4],
  ['uncharted-belfry', 'void-dressing', 5, 4],
] as const)(
  'draws loaded dressing on the projected %s canvas without town wildlife',
  (sectorId, sheet, x, y) => {
    const state = newWorldState()
    state.position = { sectorId, x, y }
    if (sectorId.startsWith('uncharted-')) state.warpedPhase = 0
    const initial = projectWorld(revealNearby(state), [], 1000)
    const s = scene(false, initial)
    try {
      s.frame(40)
      expect(s.draws.some(({ src }) => src.endsWith(`${sheet}-v01.webp`))).toBe(true)
      expect(s.canvas.dataset.wildlife).toBe('0')
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  },
)

it('carries smoke from the painted Frostmere forge flue without removing the building in Low quality', () => {
  const state = newWorldState()
  state.position = { sectorId: 'frostmere', x: 6, y: 4 }
  const initial = legacyTownView('frostmere')
  const s = scene(false, { ...initial, environment: { ...initial.environment, weather: 'storm' } })
  try {
    const atlas = s.images.find((image) =>
      (image as HTMLImageElement).src.endsWith('frostmere-v01.webp'),
    )!
    Object.assign(atlas, { width: 1536, height: 336, naturalWidth: 1536 })
    s.frame(40)
    const forge = s.draws.find(({ image, args }) => image === atlas && args[0] === 384)!
    const wisps = s.draws.filter(
      ({ image, args, order }) =>
        order > forge.order && image.width === 64 && image.height === 64 && args.length === 4,
    )
    expect(wisps).toHaveLength(5)
    const puff = wisps[0]!.image
    // Source cell x222/y96 is the flue, not the forge doorway or building centre.
    const chimneyX = forge.args[4]! + (222 / 384) * forge.args[6]!
    const chimneyY = forge.args[5]! + (96 / 336) * forge.args[7]!
    expect(wisps.every(({ args }) => args[1]! < chimneyY)).toBe(true)
    expect(wisps.some(({ args }) => Math.abs(args[0]! + args[2]! / 2 - chimneyX) < 8)).toBe(true)

    s.draws.length = 0
    s.renderer.settings({ animate: true, zoom: 1, quality: 'low' })
    s.frame(100)
    expect(s.draws.some(({ image, args }) => image === atlas && args[0] === 384)).toBe(true)
    expect(s.draws.some(({ image }) => image === puff)).toBe(false)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it('uses projected walkability for staff inspection without a player marker', () => {
  const s = scene()
  try {
    s.renderer.settings({ animate: false, zoom: 1, preview: true, authorityOverlay: true })
    s.frame(40)
    expect(s.fills.some((fill) => fill.colour === 'rgba(129,38,122,.56)')).toBe(true)
    expect(s.rectangles.some((rect) => rect.colour === '#f1ca62')).toBe(true)
    expect(s.texts.some((text) => text.text === 'Wayfarer')).toBe(false)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it('draws the new regional material and focal asset at normal zoom', () => {
  const state = newWorldState()
  state.position = { sectorId: 'frostmere', x: 6, y: 4 }
  const s = scene(true, projectWorld(state, [], 1000))
  try {
    s.frame(40)
    const material = s.draws.filter(({ src }) => src.endsWith('regional-ground-v02.webp'))
    expect(material.length).toBeGreaterThan(0)
    expect(material.some(({ matrix }) => matrix[0]! < 0 || matrix[3]! < 0)).toBe(true)
    expect(s.draws.some(({ src }) => src.endsWith('town-centres-north-v01.webp'))).toBe(true)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it('keeps mirrored snow material inside the clean atlas interior without gaps between quarters', () => {
  const state = { ...newWorldState(), position: { sectorId: 'frostmere', x: 6, y: 4 } }
  const view = projectWorld(state, [], 1000)
  const sector = view.sectors.find((candidate) => candidate.id === 'frostmere')!
  const s = scene(true, { ...view, sectors: [sector], scenery: [], players: [] })
  try {
    const atlas = s.images.find((image) =>
      (image as HTMLImageElement).src.endsWith('regional-ground-v02.webp'),
    )!
    Object.assign(atlas, { width: 1024, height: 512, naturalWidth: 1024 })
    s.frame(40)
    const samples = s.draws.filter(({ image }) => image === atlas).map(({ args }) => args)
    expect(samples.length).toBeGreaterThan(0)
    // The decoded sheet has discoloured compression pixels at biome borders.
    // Reflection repeats that single border into a long visible grid line.
    for (const [x, y, width, height] of samples) {
      expect(x).toBeGreaterThanOrEqual(514)
      expect(y).toBeGreaterThanOrEqual(2)
      expect(x! + width!).toBeLessThanOrEqual(766)
      expect(y! + height!).toBeLessThanOrEqual(254)
    }
    for (const axis of [0, 1]) {
      const intervals = [
        ...new Map(samples.map((args) => [args[axis]!, args[axis + 2]!])).entries(),
      ].sort(([a], [b]) => a - b)
      expect(intervals).toHaveLength(4)
      for (let i = 1; i < intervals.length; i++)
        expect(intervals[i]![0]).toBe(intervals[i - 1]![0] + intervals[i - 1]![1])
    }
    expect(s.draws.some(({ image, matrix }) => image === atlas && matrix[0]! < 0)).toBe(true)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it('replaces ordinary Ember trees with living foliage and keeps decoded old-art fallback', () => {
  const state = { ...newWorldState(), position: { sectorId: 'emberreach', x: 6, y: 4 } }
  const view = projectWorld(state, [], 1000)
  const sector = {
    ...view.sectors[0]!,
    landmarks: [],
    buildings: [],
    cells: [{ x: 6, y: 3, terrain: 't', walkable: true, safe: false }],
  }
  const source = { ...view, sectors: [sector], scenery: undefined }
  const s = scene(true, source)
  try {
    s.frame(40)
    expect(s.draws.some(({ src }) => src.endsWith('living-trees-v01.webp'))).toBe(true)
    const living = (s.images as HTMLImageElement[]).find((image) =>
      image.src.endsWith('living-trees-v01.webp'),
    )!
    Object.assign(living, { complete: false, naturalWidth: 0 })
    s.draws.length = 0
    s.renderer.update({ ...source, sectors: [{ ...sector }] })
    s.frame(80)
    expect(s.draws.some(({ src }) => src.endsWith('living-trees-v01.webp'))).toBe(false)
    expect(s.draws.some(({ src }) => src.endsWith('biomes-v02.webp'))).toBe(true)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it.each([
  ['fracture', '#e6d451', '#665176'],
  ['ashen', '#eeeaf5', '#736b91'],
  ['amber', '#e9bc48', '#793d27'],
] as const)(
  'paints %s Void ground and water without mainland colouring',
  (theme, ground, water) => {
    const view = projectWorld(newWorldState(), [], 1000)
    const sector = {
      ...view.sectors[0]!,
      charted: false,
      warpedTheme: theme,
      landmarks: [],
      buildings: [],
      cells: [
        { x: 6, y: 4, terrain: '.', walkable: true, safe: false },
        { x: 7, y: 4, terrain: '.', walkable: true, safe: false },
        { x: 8, y: 4, terrain: '~', walkable: false, safe: false },
      ],
    }
    const s = scene(true, { ...view, sectors: [sector], scenery: undefined })
    try {
      s.frame(40)
      const groundTint = s.fills.filter(({ colour }) => colour === ground)
      expect(groundTint).toHaveLength(1)
      expect(groundTint[0]).toMatchObject({ alpha: 0.68 })
      const points = groundTint[0]!.points
      expect(points).toHaveLength(8)
      expect(points[1]).toEqual(points[4])
      expect(points[2]).toEqual(points[7])
      expect(s.rectangles.some(({ colour }) => colour === ground)).toBe(false)
      expect(s.gradients.some(({ stops }) => stops.some(([, colour]) => colour === water))).toBe(
        true,
      )
      expect(s.draws.some(({ src }) => src.endsWith('void-ground-v01.webp'))).toBe(true)
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  },
)

it('uses dedicated Void ground only for supplied private scenery', () => {
  const view = projectWorld(newWorldState(), [], 1000)
  const sector = {
    ...view.sectors[0]!,
    charted: false,
    warpedTheme: 'haven' as const,
    landmarks: [],
    buildings: [],
    cells: [{ x: 6, y: 4, terrain: '.', walkable: true, safe: false }],
  }
  const s = scene(true, { ...view, sectors: [sector], scenery: undefined })
  try {
    s.frame(40)
    expect(s.draws.some(({ src }) => src.endsWith('void-ground-v01.webp'))).toBe(true)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it.each([
  ['private', true, 2],
  ['ordinary', false, 3],
] as const)(
  'retains surrounding trees while clearing only %s landmark foregrounds',
  (_name, privateScene, expectedTrees) => {
    const state = newWorldState()
    state.position = { sectorId: 'uncharted-tarn', x: 6, y: 4 }
    state.warpedPhase = 7
    state.discoveries[state.position.sectorId] = Array.from({ length: 117 }, (_, i) => i)
    const view = projectWorld(state, [], 1000)
    const sector = view.sectors.find(({ id }) => id === state.position.sectorId)!
    const initial = {
      ...view,
      // This case authors exactly three trees; canonical landscape is tested separately.
      unchartedTerrain: undefined,
      sectors: [
        {
          ...sector,
          regionId: 'aureth-crown',
          landscape: undefined,
          warpedTheme: privateScene ? sector.warpedTheme : undefined,
          cells: sector.cells.map((cell) => ({
            ...cell,
            terrain:
              (cell.x === 8 && cell.y === 6) ||
              (cell.x === 3 && cell.y === 1) ||
              (cell.x === 7 && cell.y === 4)
                ? 't'
                : '.',
          })),
        },
      ],
    }
    const s = scene(false, initial)
    try {
      s.frame(40)
      expect(
        s.spriteDraws.filter(({ src }) =>
          src.endsWith(privateScene ? 'forest-variety-v01.webp' : 'living-trees-v01.webp'),
        ),
      ).toHaveLength(expectedTrees)
      expect(s.draws.some(({ src }) => src.endsWith('warped-landmarks-v01.webp'))).toBe(true)
      expect(initial.sectors[0]!.cells.find(({ x, y }) => x === 8 && y === 6)?.terrain).toBe('t')
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  },
)

it('uses the decoded snowy hamlet sheet only in Frostmere and falls back while it loads', () => {
  const initial = projectWorld(newWorldState(), [], 1000)
  const root = initial.sectors.find((s) => s.id === initial.position.sectorId)!
  const cold = {
    ...root,
    regionId: 'frostmere',
    buildings: [],
    landmarks: [
      { id: 'winter-hamlet', kind: 'hamlet' as const, name: 'Hayward Farmstead', x: 6, y: 4 },
    ],
  }
  const s = scene(false, { ...initial, sectors: [cold] })
  try {
    const winter = s.images.find((image) =>
      (image as HTMLImageElement).src.endsWith('hamlet-buildings-winter-v01.webp'),
    )
    expect(winter).toBeDefined()
    Object.assign(winter!, { width: 768, height: 672, naturalWidth: 768 })
    s.frame(40)
    expect(s.draws.some(({ image }) => image === winter)).toBe(true)
    Object.assign(winter!, { complete: false, naturalWidth: 0 })
    s.renderer.update({ ...initial, sectors: [{ ...cold }] })
    s.draws.length = 0
    s.frame(80)
    expect(s.draws.some(({ src }) => src.endsWith('hamlet-buildings-v01.webp'))).toBe(true)
    expect(s.draws.some(({ image }) => image === winter)).toBe(false)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
  const warm = scene(false, { ...initial, sectors: [{ ...cold, regionId: 'aureth-crown' }] })
  try {
    expect(
      warm.images.some((image) =>
        (image as HTMLImageElement).src.includes('hamlet-buildings-winter'),
      ),
    ).toBe(false)
  } finally {
    warm.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it('draws the moving camera past The Fallen Arch from its pre-scaled art after the first frame', () => {
  const initial = projectWorld(newWorldState(), [], 1000)
  const own = initial.sectors.find((s) => s.id === initial.position.sectorId)!
  const view = {
    ...initial,
    scenery: [],
    sectors: [
      {
        ...own,
        buildings: [],
        cells: own.cells.map((c) => ({ ...c, terrain: '.', walkable: true })),
        landmarks: [
          { id: 'fallen-arch', name: 'The Fallen Arch', kind: 'ruin' as const, x: 7, y: 4 },
        ],
      },
    ],
  }
  const s = scene(false, view)
  try {
    s.frame(40)
    const source = s.draws.find(
      (draw) => draw.src.endsWith('props-v02.webp') && draw.args[4] === 0 && draw.args[5] === 0,
    )!
    expect(source).toBeDefined()
    const baked = [...s.composites].find(
      ([layer, contents]) =>
        contents.length === 1 &&
        contents[0] === source.image &&
        (layer as HTMLCanvasElement).width === source.args[6],
    )![0]
    s.motion.plan(
      [{ position: { ...view.position, x: view.position.x + 1 }, durationMs: 200 }],
      view.sectors,
      40,
    )
    for (const now of [80, 120]) {
      s.draws.length = 0
      s.frame(now)
      expect(s.draws.some((draw) => draw.src.endsWith('props-v02.webp'))).toBe(false)
      expect(s.draws.some((draw) => draw.image === baked)).toBe(true)
    }
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it('reuses authored canopy geometry while walking in wind and refreshes it when the assets load', () => {
  const initial = projectWorld(newWorldState(), [], 1000)
  const own = initial.sectors.find((sector) => sector.id === initial.position.sectorId)!
  const view = {
    ...initial,
    scenery: [],
    atlas: [],
    players: [],
    environment: { ...initial.environment, weather: 'wind' as const },
    sectors: [
      {
        ...own,
        regionId: 'emberreach',
        townId: undefined,
        buildings: [],
        landmarks: [],
        cells: own.cells.map((cell) => ({ ...cell, terrain: 't', walkable: true })),
      },
    ],
  }
  const growth = vi.spyOn(vegetation, 'vegetationPose')
  const s = scene(false, view)
  try {
    s.frame(40)
    expect(growth).toHaveBeenCalledTimes(own.cells.length)
    growth.mockClear()
    const next = { ...view.position, x: view.position.x + 1 }
    s.motion.plan([{ position: next, durationMs: 200 }], view.sectors, 40)
    s.renderer.update({ ...view, players: [] })
    s.frame(80)
    s.frame(120)
    expect(growth).not.toHaveBeenCalled()
    const sheet = s.images.find((image) =>
      (image as HTMLImageElement).src.endsWith('living-trees-v01.webp'),
    )!
    sheet.onload!()
    s.frame(160)
    expect(growth).toHaveBeenCalledTimes(own.cells.length)
  } finally {
    growth.mockRestore()
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it('renders young and mature trees throughout both the wild and settled districts', () => {
  const initial = projectWorld(newWorldState(), [], 1000)
  const root = initial.sectors.find((s) => s.id === initial.position.sectorId)!
  const forest = {
    ...root,
    regionId: 'frostmere',
    townId: undefined,
    landmarks: [],
    buildings: [],
    cells: root.cells.map((c) => ({ ...c, terrain: 't', walkable: true, safe: false })),
  }
  const run = (townId?: string) => {
    const s = scene(false, { ...initial, sectors: [{ ...forest, townId }] })
    try {
      s.frame(40)
      return new Set(
        s.spriteDraws
          .filter((d) => d.src.endsWith('living-trees-v01.webp') && d.args.length === 8)
          .map((d) => Number(d.args[6]!.toFixed(3))),
      )
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  }
  expect(run().size).toBeGreaterThan(5)
  expect(run(root.id).size).toBe(6)
})

it('softens the winter marketplace pavement perimeter, not just roads outside the square', () => {
  const state = newWorldState()
  state.position = { sectorId: 'frostmere', x: 6, y: 4 }
  const view = projectWorld(state, [], 1000)
  const sector = view.sectors.find(({ id }) => id === 'frostmere')!
  const s = scene(true, {
    ...view,
    sectors: [
      {
        ...sector,
        regionId: 'frostmere',
        buildings: [],
        landmarks: [{ id: 'square', kind: 'marketplace', name: 'Square', x: 6, y: 4 }],
        cells: [
          { x: 6, y: 4, terrain: 's', safe: true, walkable: true },
          { x: 6, y: 3, terrain: '.', safe: false, walkable: true },
        ],
      },
    ],
    scenery: undefined,
  })
  try {
    s.frame(40)
    expect(
      s.gradients.some(({ stops }) =>
        stops.some(([, colour]) => colour === 'rgba(211,220,224,.72)'),
      ),
    ).toBe(true)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it('keeps all sixteen packed scenic sprites isolated with complete opaque artwork and transparent margins', async () => {
  for (const [name, columns, size] of [
    ['regional-scenery', 4, 384],
    ['regional-scenery-extra', 2, 384],
    ['rare-scenery', 2, 512],
  ] as const) {
    const { data, info } = await sharp(
      await readFile(
        new URL(`../../../public/media/art/world/runtime/${name}-v01.webp`, import.meta.url),
      ),
    )
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    expect(info.width).toBe(columns * size)
    expect(info.height).toBe(2 * size)
    for (let cell = 0; cell < columns * 2; cell++) {
      const ox = (cell % columns) * size,
        oy = Math.floor(cell / columns) * size
      let opaque = 0,
        clear = 0,
        edgeInk = 0
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const alpha = data[((oy + y) * info.width + ox + x) * 4 + 3]!
          if (alpha > 240) opaque++
          if (alpha === 0) clear++
          if ((x < 8 || y < 8 || x >= size - 8 || y >= size - 8) && alpha > 20) edgeInk++
        }
      expect(opaque).toBeGreaterThan(size * size * 0.1)
      expect(clear).toBeGreaterThan(size * size * 0.15)
      expect(edgeInk).toBe(0)
    }
  }
})

it('joins depth colours between supplied open water and a proven bridge underpass', () => {
  const base = projectWorld(newWorldState(), [], 1000)
  const sector = base.sectors[0]!
  const cells = Array.from({ length: 49 }, (_, i) => {
    const x = i % 7,
      y = Math.floor(i / 7)
    const terrain = x === 0 || y === 0 || x === 6 || y === 6 ? '.' : x === 3 ? '=' : '~'
    return { x, y, terrain, safe: false, walkable: terrain !== '~' }
  })
  const before = JSON.stringify(cells)
  const paint = vi.spyOn(waterPainting, 'paintWaterGround')
  const s = scene(true, {
    ...base,
    scenery: undefined,
    sectors: [
      {
        ...sector,
        atlasColumn: 0,
        atlasRow: 0,
        cells,
        townId: undefined,
        buildings: [],
        landmarks: [{ id: 'pond-bridge', kind: 'bridge', name: 'Bridge', x: 3, y: 3 }],
      },
    ],
  })
  try {
    s.frame(40)
    const ordinary = paint.mock.calls.find((c) => c[5] === 2 && c[6] === 3)![1]
    const beneath = paint.mock.calls.find((c) => c[5] === 3 && c[6] === 3)![1]
    expect(ordinary.cornerDepths![1]).toBe(beneath.cornerDepths![0])
    expect(ordinary.cornerDepths![2]).toBe(beneath.cornerDepths![3])
    expect(JSON.stringify(cells)).toBe(before)
  } finally {
    s.renderer.dispose()
    paint.mockRestore()
    vi.unstubAllGlobals()
  }
})

it('clips the base lava material to its rounded bank before painting an isolated lava cell', () => {
  const base = projectWorld(newWorldState(), [], 1000)
  const original = base.sectors.find((sector) => sector.id === base.position.sectorId)!
  const material = vi.spyOn(waterPainting, 'liquidMaterial')
  const s = scene(true, {
    ...base,
    scenery: [],
    atlas: [],
    publicGrandDiscoveries: [],
    sectors: [
      {
        ...original,
        atlasColumn: 0,
        atlasRow: 0,
        townId: undefined,
        buildings: [],
        landmarks: [],
        cells: Array.from({ length: 9 }, (_, index) => ({
          x: index % 3,
          y: Math.floor(index / 3),
          terrain: index === 4 ? 'l' : '.',
          walkable: index !== 4,
          safe: false,
        })),
      },
    ],
  })
  try {
    s.frame(40)
    const lavaIndex = material.mock.calls.findIndex((call) => call[1] === 'lava')
    expect(lavaIndex).toBeGreaterThanOrEqual(0)
    const lavaMaterial = material.mock.results[lavaIndex]!.value
    const baseFill = s.rectangles.find((rectangle) => rectangle.colour === lavaMaterial)!
    expect(baseFill).toBeDefined()
    expect(s.groundCurves.length).toBeGreaterThan(0)
    expect(
      s.clips.some(
        (clip) =>
          clip.order < baseFill.order &&
          clip.path.some(
            (part) => part.operation === 'M' && part.points[0]! > 0 && part.points[0]! < 64,
          ),
      ),
    ).toBe(true)
  } finally {
    s.renderer.dispose()
    material.mockRestore()
    vi.unstubAllGlobals()
  }
})

it('keeps private lava colours continuous across sector edges and beneath the Blackglass Span', () => {
  const sectorId = 'void:cinder-choir:8:8'
  const neighborId = 'void:cinder-choir:9:8'
  const supplied = [sectorId, neighborId]
  for (let row = 7; row <= 9; row++)
    for (let column = 7; column <= 9; column++) {
      const id = `void:cinder-choir:${column}:${row}`
      if (!supplied.includes(id)) supplied.push(id)
    }
  const state = {
    ...newWorldState(),
    position: { sectorId, x: 4, y: 3 },
    discoveries: Object.fromEntries(
      supplied.map((id) => [id, Array.from({ length: 117 }, (_, i) => i)]),
    ),
  }
  const view = projectWorld(state, [], 1000)
  const sectors = supplied.map((id) => view.sectors.find((s) => s.id === id)!)
  expect(sectors.every(Boolean)).toBe(true)
  const material = vi.spyOn(waterPainting, 'liquidMaterial')
  const s = scene(true, { ...view, sectors, scenery: undefined })
  try {
    Object.assign(s.canvas, { clientWidth: 2000, clientHeight: 1400 })
    s.resize()
    s.frame(40)
    const colours = ['#702f25', '#bd5b2e', '#4d2526']
    const gradients = s.gradients.filter(
      (g) => g.stops.length === 3 && g.stops.every((stop, i) => stop[1] === colours[i]),
    )
    const calls = material.mock.calls.filter((call) => call[1] === 'lava')
    expect(
      gradients.length,
      JSON.stringify(calls.map((call) => call.slice(1))),
    ).toBeGreaterThanOrEqual(3)
    expect(calls.length).toBe(gradients.length)
    // Sample actual renderer-created gradients at the same physical world point.
    // Sector8:8 starts at104,72; its eastern neighbor starts at117,72.
    const rgb = (gradient: (typeof gradients)[number], x: number, y: number) => {
      const [x1, y1, x2, y2] = gradient.coordinates as [number, number, number, number]
      const dx = x2 - x1,
        dy = y2 - y1
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
      const pair = t <= 0.5 ? 0 : 1
      const amount = (t - pair * 0.5) * 2
      const colour = (hex: string) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16))
      const a = colour(gradient.stops[pair]![1]),
        b = colour(gradient.stops[pair + 1]![1])
      return a.map((value, i) => value + (b[i]! - value) * amount)
    }
    const neighborIndex = calls.findIndex((call) => call[3] === 117 && call[4] === 72)
    expect(neighborIndex).toBeGreaterThanOrEqual(0)
    const ground = gradients[0]!,
      underpass = gradients[1]!,
      neighbor = gradients[neighborIndex]!
    const underpassOrigin = calls[1]!
    const onGround = rgb(ground, 4.5 * 64, 3.5 * 64)
    const belowBridge = rgb(
      underpass,
      (108.5 - underpassOrigin[3]) * 64,
      (75.5 - underpassOrigin[4]) * 64,
    )
    const westEdge = rgb(ground, 13 * 64, 3 * 64)
    const eastEdge = rgb(neighbor, 0, 3 * 64)
    for (let channel = 0; channel < 3; channel++) {
      expect(onGround[channel]).toBeCloseTo(belowBridge[channel]!, 8)
      expect(westEdge[channel]).toBeCloseTo(eastEdge[channel]!, 8)
    }
  } finally {
    s.renderer.dispose()
    material.mockRestore()
    vi.unstubAllGlobals()
  }
})

it.each([
  'aureth-crown',
  'verdant-expanse',
  'frostmere',
  'starfall-highlands',
  'emberreach',
  'glasswind-desert',
  'hollow-coast',
  'umbral-march',
])('paints dedicated %s settlement floor art on existing paving', (sectorId) => {
  const state = { ...newWorldState(), position: { sectorId, x: 6, y: 4 } }
  const view = projectWorld(state, [], 1000)
  const s = scene(true, view)
  try {
    s.frame(40)
    expect(s.draws.some((d) => d.src.endsWith('settlement-floors-v01.webp'))).toBe(true)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it('retains paving fallback until dedicated floors decode, then rebuilds cached ground once', () => {
  const s = scene(true)
  try {
    const floor = (s.images as HTMLImageElement[]).find((i) =>
      i.src.endsWith('settlement-floors-v01.webp'),
    )!
    expect(floor).toBeDefined()
    Object.assign(floor, { complete: false, naturalWidth: 0 })
    s.frame(40)
    expect(s.draws.some((d) => d.src.endsWith('settlement-floors-v01.webp'))).toBe(false)
    Object.assign(floor, { complete: true, naturalWidth: 1200 })
    floor.onload!(new Event('load'))
    s.frame(80)
    expect(s.draws.some((d) => d.src.endsWith('settlement-floors-v01.webp'))).toBe(true)
    const layers = s.layerCount()
    s.frame(120)
    expect(s.layerCount()).toBe(layers)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it('uses decoded grand art for town crossings while preserving original-art fallback', () => {
  const s = scene(true, legacyTownView('verdant-expanse'))
  try {
    const art = (s.images as HTMLImageElement[]).find((i) =>
      i.src.endsWith('grand-bridges-v01.webp'),
    )!
    expect(art).toBeDefined()
    Object.assign(art, { complete: false, naturalWidth: 0 })
    s.frame(40)
    expect(s.draws.some((d) => d.src.endsWith('props-v02.webp'))).toBe(true)
    Object.assign(art, { complete: true, naturalWidth: 1536, width: 1536, height: 512 })
    art.onload!(new Event('load'))
    s.draws.length = 0
    s.frame(80)
    const bridge = s.draws.find((d) => d.image === art)!
    expect(bridge).toBeDefined()
    expect(bridge.args.slice(0, 4)).toEqual([512, 0, 512, 512])
    expect(bridge.args[6]).toBeGreaterThan(64 * 2)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})
it('draws an anchored animated lava cascade only on the real Emberreach lava channel', () => {
  const state = { ...newWorldState(), position: { sectorId: 'emberreach', x: 9, y: 7 } }
  const s = scene(false, projectWorld(state, [], 1000))
  const motion = vi.spyOn(waterPainting, 'paintWaterfallMotion')
  try {
    s.frame(40)
    expect(s.draws.some((d) => d.src.endsWith('lavafalls-v01.webp'))).toBe(true)
    expect(motion.mock.calls.some((c) => c[8] === 'lava')).toBe(true)
    motion.mockClear()
    s.renderer.settings({ animate: false, zoom: 1 })
    s.frame(80)
    expect(motion).not.toHaveBeenCalled()
  } finally {
    motion.mockRestore()
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it('registers travellers, NPCs and clicks on the painted East Moat Bridge deck', () => {
  const sector = atlasSectors().find((sector) =>
    sector.landmarks.some((site) => site.name === 'East Moat Bridge'),
  )!
  const at = (x: number) => ({ sectorId: sector.id, x, y: 4 })
  const view = projectWorld({ ...newWorldState(), position: at(7) }, [], 1000)
  const s = scene(true, {
    ...view,
    scenery: [],
    sectors: [view.sectors.find((candidate) => candidate.id === sector.id)!],
    players: [
      {
        characterId: 'deck-peer',
        name: 'Peer',
        level: 1,
        portraitRef: '',
        imageUrl: '/deck-peer.png',
        position: at(9),
        online: true,
        attackable: false,
      },
    ],
    npcs: [{ id: 'deck-npc', name: 'NPC', imageUrl: '/deck-npc.png', position: at(8) }],
  })
  try {
    s.canvas.dataset.portrait = '/deck-self.png'
    const img = (s.images as HTMLImageElement[]).find((i) =>
      i.src.endsWith('grand-bridges-v01.webp'),
    )!
    Object.assign(img, { complete: true, width: 1536, height: 512, naturalWidth: 1536 })
    s.frame(40)
    const bridge = s.draws.find((draw) => draw.image === img)!
    const { args, matrix: m } = bridge
    const treadPoint = (fraction: number, depth: number) => {
      const x = args[4]! + ((425 + (107 - 425) * fraction) / 512) * args[6]!
      const y = args[5]! + (depth / 512) * args[7]!
      return { x: (m[0]! * x + m[2]! * y + m[4]!) / 1.5, y: (m[1]! * x + m[3]! * y + m[5]!) / 1.5 }
    }
    for (const [src, fraction, depth] of [
      ['self', 0.25, 153],
      ['npc', 0.5, 195],
      ['peer', 0.75, 247],
    ] as const) {
      const foot = treadPoint(fraction, depth)
      const portrait = s.identityDraws.find((draw) => draw.src === '/deck-' + src + '.png')!
      expect(Math.abs(portrait.args[4]! + portrait.args[6]! / 2 - foot.x)).toBeLessThan(0.5)
      expect(Math.abs(portrait.args[5]! + portrait.args[7]! - foot.y)).toBeLessThan(0.5)
      expect(portrait.filter).not.toContain('grayscale')
    }
    const peer = treadPoint(0.75, 247)
    s.event('pointerdown', peer.x, peer.y - 17)
    s.event('pointerup', peer.x, peer.y - 17)
    expect(s.selectPlayer).toHaveBeenCalledWith('deck-peer')
    const target = treadPoint(0.5, 195)
    s.event('pointerdown', target.x, target.y)
    s.event('pointerup', target.x, target.y)
    expect(s.select).toHaveBeenCalledWith(at(8))
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it('draws the approved grand bridge over the offshore channel', () => {
  const position = { sectorId: OFFSHORE_DISCOVERY.bridgeSectorId, x: 4, y: 4 }
  const s = scene(true, projectWorld({ ...newWorldState(), position }, [], 1000))
  try {
    s.frame(40)
    expect(
      s.draws.some(
        (draw) => draw.src.endsWith('grand-discoveries-v01.webp') && draw.args[6] > 64 * 7,
      ),
    ).toBe(true)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})
it('draws the grounded tower at a grand scale on Lanternward Isle', () => {
  const position = { sectorId: OFFSHORE_DISCOVERY.islandSectorId, x: 6, y: 4 }
  const s = scene(true, projectWorld({ ...newWorldState(), position }, [], 1000))
  try {
    s.frame(40)
    expect(
      s.draws.some((draw) => draw.src.endsWith('buildings-v02.webp') && draw.args[6] >= 64 * 5),
    ).toBe(true)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})
it('bakes the public impact basin into cached known ground after its art decodes', () => {
  const state = { ...newWorldState(), position: { sectorId: 'atlas:45:9', x: 9, y: 6 } }
  const s = scene(true, projectWorld(state, [], 1000))
  try {
    const art = (s.images as HTMLImageElement[]).find((i) =>
      i.src.endsWith('impact-basins-v01.webp'),
    )!
    expect(art).toBeDefined()
    Object.assign(art, {
      complete: true,
      naturalWidth: 1536,
      naturalHeight: 512,
      width: 1536,
      height: 512,
    })
    art.onload!(new Event('load'))
    s.frame(40)
    expect(s.draws.some((d) => d.image === art && d.args[6] === 3 * 64)).toBe(true)
    const count = s.draws.filter((d) => d.image === art).length
    s.frame(80)
    expect(s.draws.filter((d) => d.image === art)).toHaveLength(count)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it.each([
  ['void:ivory-veil:12:11', 'waterfalls-v01.webp', 'grand'],
  ['void:cinder-choir:17:12', 'lavafalls-v01.webp', 'lava'],
] as const)(
  'uses actual supplied %s cascade geography with matching animated material',
  (sectorId, sheet, style) => {
    const state = {
      ...newWorldState(),
      position: { sectorId, x: 6, y: 4 },
      discoveries: { [sectorId]: Array.from({ length: 117 }, (_, i) => i) },
    }
    const s = scene(false, projectWorld(state, [], 1000))
    const motion = vi.spyOn(waterPainting, 'paintWaterfallMotion')
    try {
      s.frame(40)
      expect(s.draws.some((d) => d.src.endsWith(sheet))).toBe(true)
      expect(motion.mock.calls.some((c) => c[8] === style)).toBe(true)
    } finally {
      motion.mockRestore()
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  },
)
it('uses the fallen-firmament impact stamp only after all nine real footprint cells are supplied', () => {
  const sectorId = 'void:starfall-basin:16:10'
  const state = {
    ...newWorldState(),
    position: { sectorId, x: 6, y: 4 },
    discoveries: { [sectorId]: Array.from({ length: 117 }, (_, i) => i) },
  }
  const view = projectWorld(state, [], 1000)
  const s = scene(true, view)
  try {
    const art = (s.images as HTMLImageElement[]).find((i) =>
      i.src.endsWith('impact-basins-v01.webp'),
    )!
    expect(art).toBeDefined()
    Object.assign(art, { naturalWidth: 1536, naturalHeight: 512, width: 1536, height: 512 })
    art.onload!(new Event('load'))
    s.frame(40)
    expect(s.draws.some((d) => d.image === art && d.args[0] === 1024)).toBe(true)
    s.draws.length = 0
    s.renderer.update({
      ...view,
      sectors: view.sectors.map((sector) => ({
        ...sector,
        cells: sector.cells.filter((cell) => cell.x !== 5 || cell.y !== 3),
      })),
    })
    s.frame(80)
    expect(s.draws.some((d) => d.image === art)).toBe(false)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it('enlarges a clear-ground shrine without moving its visual foot as nearby ground is revealed', () => {
  const base = projectWorld(newWorldState(), [], 1000)
  const root = base.sectors.find((s) => s.id === base.position.sectorId)!
  const cells = Array.from({ length: 117 }, (_, i) => ({
    x: i % 13,
    y: Math.floor(i / 13),
    terrain: '.',
    walkable: true,
    safe: false,
  }))
  const paint = (known: typeof cells) => {
    const s = scene(true, {
      ...base,
      scenery: undefined,
      sectors: [
        {
          ...root,
          buildings: [],
          cells: known,
          landmarks: [{ id: 'shrine', name: 'Moonpetal Shrine', kind: 'shrine', x: 6, y: 4 }],
        },
      ],
    })
    try {
      s.frame(40)
      const shrine = s.draws.find(
        (d) => d.src.endsWith('props-v02.webp') && d.args[0] === 0 && d.args[1] === 600,
      )!
      expect(shrine).toBeDefined()
      return {
        width: shrine.args[6]!,
        // The painted shrine's opaque floor lies inside its source padding.
        footX: shrine.args[4]! + shrine.args[6]! * 0.56,
        footY: shrine.args[5]! + shrine.args[7]! * 0.898,
      }
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  }
  const ordinary = paint(cells.filter((c) => c.x !== 5 || c.y !== 3))
  const grand = paint(cells)
  expect(grand.width).toBeGreaterThan(ordinary.width * 1.9)
  expect(grand.footX).toBeCloseTo(ordinary.footX, 5)
  expect(grand.footY).toBeCloseTo(ordinary.footY, 5)
})

it.each([
  ['East Moat Bridge', 1.4],
  ['West Moat Bridge', 0.65],
] as const)('continues the painted moat through the walkable %s at zoom %s', (name, zoom) => {
  const sector = atlasSectors().find((s) => s.landmarks.some((l) => l.name === name))!
  const bridge = sector.landmarks.find((l) => l.name === name)!
  const view = projectWorld(
    { ...newWorldState(), position: { sectorId: sector.id, x: bridge.x, y: bridge.y } },
    [],
    1000,
  )
  const own = view.sectors.find((s) => s.id === sector.id)!
  const before = JSON.stringify(own.cells)
  const water = vi.spyOn(waterPainting, 'paintWaterGround')
  const lavaMotion = vi.spyOn(waterPainting, 'paintLavaMotion')
  const s = scene(false, { ...view, sectors: [own], scenery: [], players: [] })
  try {
    s.renderer.settings({ animate: true, zoom })
    s.frame(40)
    const wx = own.atlasColumn! * GRID_WIDTH + bridge.x
    const wy = own.atlasRow! * GRID_HEIGHT + bridge.y
    const cell = (y: number) => water.mock.calls.find((call) => call[5] === wx && call[6] === y)
    const under = cell(wy)
    expect(under, 'paint the same textured bed beneath the stone avenue').toBeDefined()
    for (const [mouthY, side] of [
      [wy - 1, 2],
      [wy + 1, 0],
    ] as const) {
      const mouth = cell(mouthY)!
      expect(mouth[1].banks.some((bank) => bank.side === side)).toBe(false)
      expect(under![4]).toBe(mouth[4])
      expect(under![7]).toBe(mouth[7])
    }
    expect(under![4]?.src).toContain('water-materials')
    expect(lavaMotion).not.toHaveBeenCalled()
    const paints = water.mock.calls.length
    s.frame(120)
    expect(water.mock.calls).toHaveLength(paints)
    expect(JSON.stringify(own.cells)).toBe(before)
  } finally {
    s.renderer.dispose()
    water.mockRestore()
    lavaMotion.mockRestore()
    vi.unstubAllGlobals()
  }
})

it('renders the canonical moat crossing while blocking the channel', () => {
  const canonical = atlasSectors().find(
    (sector) =>
      sector.townId === 'umbral-march' &&
      sector.landmarks.some((landmark) => landmark.kind === 'bridge'),
  )!
  expect(canonical).toBeDefined()
  const bridge = canonical.landmarks.find((landmark) => landmark.kind === 'bridge')!
  const view = projectWorld(
    { ...newWorldState(), position: { sectorId: canonical.id, x: bridge.x, y: bridge.y } },
    [],
    1000,
  )
  const own = view.sectors.find((sector) => sector.id === canonical.id)!
  expect(own.cells.some((cell) => cell.terrain === '~' && !cell.walkable)).toBe(true)
  expect(own.cells.find((cell) => cell.x === bridge.x && cell.y === bridge.y)).toMatchObject({
    walkable: true,
  })
  expect(['=', 's']).toContain(
    own.cells.find((cell) => cell.x === bridge.x && cell.y === bridge.y)!.terrain,
  )
  const s = scene(true, view)
  try {
    s.frame(40)
    expect(s.draws.some((draw) => draw.src.endsWith('grand-bridges-v01.webp'))).toBe(true)
    expect(view.sectors.find((sector) => sector.id === canonical.id)!.cells).toEqual(own.cells)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it('retains at least one working canonical Frostmere forge across its nine reconfigured districts', () => {
  let forgeDraws = 0,
    workingFlues = 0
  const districts = atlasSectors().filter((sector) => sector.townId === 'frostmere')
  expect(districts).toHaveLength(9)
  for (const sector of districts) {
    const state = { ...newWorldState(), position: { sectorId: sector.id, x: 6, y: 4 } }
    const view = projectWorld(state, [], 1000)
    const own = view.sectors.find((s) => s.id === sector.id)!
    const s = scene(false, {
      ...view,
      sectors: [own],
      scenery: [],
      players: [],
      environment: { ...view.environment, weather: 'storm' },
    })
    try {
      const atlas = s.images.find((image) =>
        (image as HTMLImageElement).src.endsWith('frostmere-v01.webp'),
      )!
      Object.assign(atlas, { width: 1536, height: 336, naturalWidth: 1536 })
      s.frame(40)
      const forge = s.draws.find((draw) => draw.image === atlas && draw.args[0] === 384)
      if (forge) {
        forgeDraws++
        if (
          s.draws.some(
            (draw) =>
              draw.order > forge.order &&
              draw.image.width === 64 &&
              draw.image.height === 64 &&
              draw.args.length === 4,
          )
        )
          workingFlues++
      }
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  }
  expect(
    forgeDraws,
    'New town topology must retain a real forge, rather than only a compatibility fixture.',
  ).toBeGreaterThan(0)
  expect(workingFlues).toBeGreaterThan(0)
})

it.each(
  (['elemental-valley', 'remote-colosseum'] as const).flatMap((id) =>
    [-1, 0, 1].map((laps) => ({ id, laps })),
  ),
)(
  'draws the giant canonical $id inside its public footprint after $laps longitude wraps',
  ({ id, laps }) => {
    const site = GRAND_DISCOVERY_SITES.find((site) => site.id === id)!
    const gx = Math.floor(site.left + site.width / 2),
      gy = Math.floor(site.top + site.height / 2)
    const sector = atlasSectors().find(
      (s) => s.atlasColumn === Math.floor(gx / 13) && s.atlasRow === Math.floor(gy / 9),
    )!
    const view = projectWorld(
      { ...newWorldState(), position: { sectorId: sector.id, x: gx % 13, y: gy % 9 } },
      [],
      1000,
    )
    expect(view.publicGrandDiscoveries).toContain(id)
    // Continuous seam travel retains an unwrapped camera while geography stays canonical.
    const sample = WorldMotion.prototype.sample
    const sampling = vi.spyOn(WorldMotion.prototype, 'sample').mockImplementation(function (
      this: WorldMotion,
      now,
    ) {
      const current = sample.call(this, now)
      return {
        ...current,
        point: { ...current.point, x: current.point.x + laps * WORLD_MAP_WIDTH },
      }
    })
    const s = scene(false, view)
    try {
      const sheet = id === 'elemental-valley' ? 'elemental-waterfall-valley' : 'remote-colosseum'
      const art = s.images.find((image) =>
        (image as HTMLImageElement).src.endsWith(`${sheet}-v01.webp`),
      )!
      expect(art).toBeDefined()
      s.frame(40)
      const drawn = s.draws.find((draw) => draw.image === art)
      expect(drawn).toBeDefined()
      expect(drawn!.args[6]).toBeGreaterThan(64 * 40)
      expect(drawn!.args[4]).toBeLessThan(800)
      expect(drawn!.args[4]! + drawn!.args[6]!).toBeGreaterThan(0)
    } finally {
      s.renderer.dispose()
      sampling.mockRestore()
      vi.unstubAllGlobals()
    }
  },
)

it.each(['animated', 'off', 'reduced'] as const)(
  'links giant valley waterfall motion to the %s ambient setting',
  (mode) => {
    const site = GRAND_DISCOVERY_SITES.find((site) => site.id === 'elemental-valley')!
    const gx = Math.floor(site.left + site.width / 2),
      gy = Math.floor(site.top + site.height / 2)
    const sector = atlasSectors().find(
      (s) => s.atlasColumn === Math.floor(gx / 13) && s.atlasRow === Math.floor(gy / 9),
    )!
    const view = projectWorld(
      { ...newWorldState(), position: { sectorId: sector.id, x: gx % 13, y: gy % 9 } },
      [],
      1000,
    )
    const motion = vi.spyOn(waterPainting, 'paintWaterfallMotion')
    const s = scene(mode === 'reduced', view)
    try {
      s.renderer.settings({ animate: mode !== 'off', zoom: 1 })
      s.frame(40)
      expect(s.draws.some((draw) => draw.src.endsWith('elemental-waterfall-valley-v01.webp'))).toBe(
        true,
      )
      expect(motion.mock.calls.some((call) => call[8] === 'grand')).toBe(mode === 'animated')
    } finally {
      motion.mockRestore()
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  },
)

it('matches the native arena viewpoint identity expectations to the actual floor and rear wall', () => {
  const arena = correctionScenes().discoveries.find((site) => site.id === 'remote-colosseum')!
  for (const detail of [false, true]) {
    const position = detail ? arena.detailPosition! : arena.position
    const s = scene(true, projectWorld({ ...newWorldState(), position }, [], 1000))
    try {
      s.canvas.dataset.portrait = '/viewpoint-self.png'
      s.renderer.settings({ animate: false, zoom: 1 })
      s.frame(40)
      const identity = s.identityDraws.filter((draw) => draw.src === '/viewpoint-self.png')
      expect(identity.length).toBeGreaterThan(0)
      expect(
        identity.some((draw) => draw.filter === 'grayscale(1)'),
        detail ? 'rear wall' : 'arena floor',
      ).toBe(detail && arena.detailIdentity === 'occluded')
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  }
})

it.each(['left', 'right'] as const)(
  'matches the native %s colosseum detail viewpoint to its actual floor or occluder',
  (id) => {
    const arena = correctionScenes().discoveries.find((site) => site.id === 'remote-colosseum')!
    const side = arena.detailSides!.find((side) => side.id === id)!
    const s = scene(true, projectWorld({ ...newWorldState(), position: side.position }, [], 1000))
    try {
      s.canvas.dataset.portrait = '/lateral-viewpoint-self.png'
      s.renderer.settings({ animate: false, zoom: 1.4 })
      s.frame(40)
      const identity = s.identityDraws.filter((draw) => draw.src === '/lateral-viewpoint-self.png')
      expect(identity.length).toBeGreaterThan(0)
      expect(identity.some((draw) => draw.filter === 'grayscale(1)')).toBe(
        side.identity === 'occluded',
      )
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  },
)

it.each(['floor', 'wall'] as const)(
  'composes colosseum ground before identity and treats an actor on its %s correctly',
  (where) => {
    const site = GRAND_DISCOVERY_SITES.find((site) => site.id === 'remote-colosseum')!
    const geometry = grandDiscoveryPlacements(
      atlasSectors()
        .filter(
          (s) =>
            s.atlasColumn! * 13 < site.left + site.width &&
            s.atlasColumn! * 13 + 13 > site.left &&
            s.atlasRow! * 9 < site.top + site.height + 2 &&
            s.atlasRow! * 9 + 9 > site.top,
        )
        .map((s) => projectWorldSector(newWorldState(), s)),
    )[0]!
    expect(geometry.id).toBe(site.id)
    const floor = geometry.arenaFloor!
    const sx = (floor.cx - geometry.anchorX) * geometry.widthTiles
    // The front wall lies inside the ordinary occluder body, beyond the floor ellipse.
    const sy =
      ((where === 'floor' ? floor.cy : floor.cy + floor.ry + 0.035) - geometry.anchorY) *
      geometry.heightTiles
    const gx = Math.floor(geometry.worldx + (sx / MAP_X + sy / MAP_Y) / 2)
    const gy = Math.floor(geometry.worldy + (sy / MAP_Y - sx / MAP_X) / 2)
    const sector = atlasSectors().find(
      (s) => s.atlasColumn === Math.floor(gx / 13) && s.atlasRow === Math.floor(gy / 9),
    )!
    expect(sector).toBeDefined()
    const position = { sectorId: sector.id, x: gx % 13, y: gy % 9 }
    const view = projectWorld(
      { ...newWorldState(), position: { ...position, x: position.x === 12 ? 11 : position.x + 1 } },
      [],
      1000,
    )
    const s = scene(false, {
      ...view,
      players: [
        {
          characterId: 'arena-traveller',
          name: 'Arena traveller',
          level: 1,
          portraitRef: '',
          imageUrl: '/arena-traveller.png',
          online: true,
          attackable: false,
          position,
        },
      ],
    })
    try {
      s.frame(40)
      const arena = s.draws.filter((draw) => draw.src.endsWith('remote-colosseum-v01.webp'))
      expect(arena.length).toBeGreaterThanOrEqual(2)
      const actors = s.identityDraws.filter((draw) => draw.src === '/arena-traveller.png')
      expect(actors.length).toBeGreaterThan(0)
      expect(arena.every((draw) => draw.order < actors[0]!.order)).toBe(true)
      expect(actors.some((actor) => actor.filter === 'grayscale(1)')).toBe(where === 'wall')
      expect(
        s.clips.some((clip) =>
          clip.path.some(
            (part) => part.operation === 'E' && part.points[2]! > 0 && part.points[3]! > 0,
          ),
        ),
      ).toBe(true)
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  },
)

it.each([
  'verdant-expanse',
  'aureth-crown',
  'frostmere',
  'hollow-coast',
  'glasswind-desert',
  'emberreach',
  'starfall-highlands',
  'umbral-march',
])('grounds the new canonical %s architecture using its regional source cell', (sectorId) => {
  const state = { ...newWorldState(), position: { sectorId, x: 6, y: 4 } }
  const view = projectWorld(state, [], 1000)
  const sector = view.sectors.find((sector) => sector.id === sectorId)!
  const building = sector.buildings!.find(
    (building) => building.artIndex >= 10 && building.artIndex <= 17,
  )!
  expect(building).toBeDefined()
  const index = building.artIndex - 10
  const source = townGrandManifest.sprites[index]!
  const s = scene(true, view)
  try {
    const art = s.images.find((image) =>
      (image as HTMLImageElement).src.endsWith('town-grand-architecture-v01.webp'),
    )!
    expect(art).toBeDefined()
    Object.assign(art, { width: 2048, height: 1024, naturalWidth: 2048 })
    s.frame(40)
    const draw = s.draws.find(
      (draw) =>
        draw.image === art &&
        draw.args[0] === (index % 4) * 512 &&
        draw.args[1] === Math.floor(index / 4) * 512,
    )!
    expect(draw).toBeDefined()
    const foot = projectMapPoint(
      {
        x: sector.atlasColumn! * 13 + building.x + building.width / 2,
        y: sector.atlasRow! * 9 + building.y + building.height,
      },
      mapPoint(view.position, view.sectors),
      { x: 0, y: 0 },
      64,
      800,
      600,
    )
    const localX = draw.args[4]! + source.anchorX * draw.args[6]!
    const localY = draw.args[5]! + source.anchorY * draw.args[7]!
    expect(draw.matrix[0]! * localX + draw.matrix[2]! * localY + draw.matrix[4]!).toBeCloseTo(
      foot.x * 1.5,
      1,
    )
    expect(draw.matrix[1]! * localX + draw.matrix[3]! * localY + draw.matrix[5]!).toBeCloseTo(
      foot.y * 1.5,
      1,
    )
    expect(draw.args[0]! + draw.args[2]!).toBeLessThanOrEqual(2048)
    expect(draw.args[1]! + draw.args[3]!).toBeLessThanOrEqual(1024)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it.each([
  ['shrine', 4, 0.56, 0.898],
  ['camp', 5, 0.556, 0.837],
  ['waystone', 7, 0.632, 0.912],
] as const)(
  'grounds the actual legacy %s artwork at its supplied tile rather than its empty padding',
  (kind, index, floorX, floorY) => {
    const base = projectWorld(newWorldState(), [], 1000)
    const own = base.sectors.find((sector) => sector.id === base.position.sectorId)!
    const position = { ...base.position, x: base.position.x + 1 }
    const view = {
      ...base,
      scenery: [],
      sectors: [
        {
          ...own,
          townId: undefined,
          buildings: [],
          cells: own.cells.map((cell) => ({ ...cell, terrain: '.', walkable: true, safe: false })),
          landmarks: [{ id: 'grounded-site', kind, name: 'Site', x: position.x, y: position.y }],
        },
      ],
    }
    const s = scene(true, view)
    try {
      s.frame(40)
      const draw = s.draws.find(
        (d) =>
          d.src.endsWith('props-v02.webp') &&
          Math.abs(d.args[0]! - (index % 4) * 300) < 1 &&
          d.args[1] === Math.floor(index / 4) * 600,
      )!
      expect(draw).toBeDefined()
      const a = draw.args,
        m = draw.matrix
      const x = a[4]! + floorX * a[6]!,
        y = a[5]! + floorY * a[7]!
      const contact = { x: m[0]! * x + m[2]! * y + m[4]!, y: m[1]! * x + m[3]! * y + m[5]! }
      const expected = projectMapPoint(
        mapPoint(position, view.sectors),
        mapPoint(view.position, view.sectors),
        { x: 0, y: 0 },
        64,
        800,
        600,
      )
      expect(contact.x).toBeCloseTo(expected.x * 1.5, 1)
      expect(contact.y).toBeCloseTo(expected.y * 1.5, 1)
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  },
)

it('renders the remote grand crossing with its measured new bridge art rather than a reused town bridge', () => {
  const state = { ...newWorldState(), position: { sectorId: 'atlas:71:32', x: 6, y: 4 } }
  const view = projectWorld(state, [], 1000)
  const s = scene(true, view)
  try {
    s.frame(40)
    const draw = s.draws.find(
      (d) => d.src.endsWith('grand-discoveries-v01.webp') && d.args[0] === 0 && d.args[1] === 0,
    )
    expect(draw).toBeDefined()
    expect(
      s.view.sectors
        .find((sector) => sector.id === state.position.sectorId)!
        .cells.find((cell) => cell.x === 6 && cell.y === 4)?.walkable,
    ).toBe(true)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it('loads close-view valley details and arena ground material only for their own grand sites', () => {
  for (const [sectorId, required] of [
    ['atlas:71:17', ['valley-fire-detail', 'valley-ice-detail', 'valley-cascade-detail']],
    ['atlas:44:37', ['colosseum-arena-grain']],
  ] as const) {
    const view = projectWorld({ ...newWorldState(), position: { sectorId, x: 6, y: 4 } }, [], 1000)
    const s = scene(true, view)
    try {
      s.frame(40)
      for (const sheet of required)
        expect(
          s.images.some((image) => (image as HTMLImageElement).src.endsWith(sheet + '-v01.webp')),
        ).toBe(true)
      const unrelated =
        sectorId === 'atlas:71:17' ? ['colosseum-arena-grain'] : valleyDetailArt.map((d) => d.sheet)
      for (const sheet of unrelated)
        expect(
          s.images.some((image) => (image as HTMLImageElement).src.endsWith(sheet + '-v01.webp')),
        ).toBe(false)
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  }
})

it('paints context-preserving valley detail frames in the exact selected master coordinates', () => {
  const view = projectWorld(
    { ...newWorldState(), position: { sectorId: 'atlas:71:17', x: 6, y: 4 } },
    [],
    1000,
  )
  const s = scene(true, view)
  try {
    s.frame(40)
    const master = s.draws.find((draw) => draw.src.endsWith('elemental-waterfall-valley-v01.webp'))!
    expect(master).toBeDefined()
    for (const detail of valleyDetailArt) {
      const draw = s.draws.find((candidate) => candidate.src.endsWith(detail.sheet + '-v01.webp'))
      expect(draw, detail.sheet).toBeDefined()
      const [x, y, width, height] = detail.target
      expect(draw!.args.slice(4)).toEqual([
        master.args[4]! + x * master.args[6]!,
        master.args[5]! + y * master.args[7]!,
        width * master.args[6]!,
        height * master.args[7]!,
      ])
      expect(draw!.matrix).toEqual(master.matrix)
      expect(draw!.order).toBeGreaterThan(master.order)
    }
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it.each([
  [1, 'balanced', false],
  [3, 'balanced', true],
  [3, 'low', false],
] as const)(
  'selects close valley detail by backing pixels at mobile minimum zoom (%s DPR, %s)',
  (density, quality, expected) => {
    const view = projectWorld(
      { ...newWorldState(), position: { sectorId: 'atlas:71:17', x: 6, y: 4 } },
      [],
      1000,
    )
    const s = scene(true, view)
    try {
      window.devicePixelRatio = density
      Object.assign(s.canvas, { clientWidth: 390 })
      s.renderer.settings({ animate: false, zoom: WORLD_MIN_ZOOM, quality })
      s.resize()
      s.frame(40)
      for (const detail of valleyDetailArt) {
        expect(
          s.images.some((image) =>
            (image as HTMLImageElement).src.endsWith(detail.sheet + '-v01.webp'),
          ),
        ).toBe(expected)
        expect(s.draws.some((draw) => draw.src.endsWith(detail.sheet + '-v01.webp'))).toBe(expected)
      }
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  },
)

it('keeps three immutable cloud silhouettes across moving frames and releases them on disposal', () => {
  const images: { src: string; width: number; height: number; close: ReturnType<typeof vi.fn> }[] =
    []
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      constructor(
        public width: number,
        public height: number,
      ) {}
      getContext() {
        return { drawImage() {} }
      }
      transferToImageBitmap() {
        const image = {
          src: 'immutable-cloud-probe',
          width: this.width,
          height: this.height,
          close: vi.fn(),
        }
        images.push(image)
        return image
      }
    },
  )
  const s = scene(false)
  try {
    const clouds = images.filter(({ width, height }) => width === 384 && height === 192)
    expect(clouds).toHaveLength(3)
    s.renderer.settings({ animate: true, zoom: 1 })
    s.frame(50)
    const before = s.draws.filter(({ image }) =>
      clouds.includes(image as unknown as (typeof clouds)[number]),
    )
    expect(before.length).toBeGreaterThan(0)
    s.draws.length = 0
    s.frame(150)
    const after = s.draws.filter(({ image }) =>
      clouds.includes(image as unknown as (typeof clouds)[number]),
    )
    expect(after.length).toBeGreaterThan(0)
    expect(after.map(({ args }) => args)).not.toEqual(before.map(({ args }) => args))
    expect(images.filter(({ width, height }) => width === 384 && height === 192)).toHaveLength(3)
    expect(clouds.every(({ close }) => close.mock.calls.length === 0)).toBe(true)
    s.renderer.dispose()
    expect(clouds.every(({ close }) => close.mock.calls.length === 1)).toBe(true)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it('translates a bounded dry terrain composite through short desktop movement without rerasterizing', () => {
  const base = projectWorld(newWorldState(), [], 1000)
  const view: WorldView = {
    ...base,
    scenery: [],
    sectors: base.sectors.map((sector) => ({
      ...sector,
      buildings: [],
      landmarks: [],
      cells: sector.cells.map((cell) => ({ ...cell, terrain: '.', walkable: true })),
    })),
  }
  const s = scene(true, view)
  try {
    s.renderer.settings({ animate: false, zoom: 1 })
    s.canvas.dataset.renderDiagnostics = 'timing'
    s.frame(40)
    const timing = JSON.parse(s.canvas.dataset.renderTiming!)
    expect(timing.projectedGroundSectors).toBeGreaterThanOrEqual(4)
    expect(timing.projectedGroundPixels).toBeGreaterThan(s.canvas.width * s.canvas.height)
    expect(timing.projectedGroundPixels).toBeLessThanOrEqual(4_000_000)
    const initial = s.draws.find(
      ({ image, args, matrix }) =>
        image.width > s.canvas.width && args.length === 2 && matrix.join(',') === '1,0,0,1,0,0',
    )!
    expect(initial).toBeDefined()
    const before = s.layerCount()
    s.motion.plan(
      [{ position: { ...view.position, x: view.position.x + 1 }, durationMs: 200 }],
      view.sectors,
      40,
    )
    s.renderer.update(view)
    s.draws.length = 0
    s.frame(80)
    s.frame(120)
    const moved = s.draws.filter(({ image }) => image === initial.image)
    expect(moved.length).toBeGreaterThan(0)
    expect(moved.at(-1)!.args).not.toEqual(initial.args)
    expect(s.layerCount()).toBe(before)
    expect(JSON.parse(s.canvas.dataset.renderTiming!).groundBuilds).toBe(0)
    s.images.find((image) => (image as HTMLImageElement).src.endsWith('regional-ground-v02.webp'))!
      .onload!()
    s.draws.length = 0
    s.frame(160)
    expect(
      s.draws.some(
        ({ image, args }) =>
          image !== initial.image && image.width > s.canvas.width && args.length === 2,
      ),
    ).toBe(true)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it('loads registered colosseum detail only at useful backing density and paints it through both floor/wall clips', () => {
  const site = correctionScenes().discoveries.find((site) => site.id === 'remote-colosseum')!
  const state = { ...newWorldState(), position: site.detailPosition! }
  const s = scene(true, projectWorld(state, [], 1000))
  const isDetail = (src: string) =>
    colosseumDetailArt.some(({ sheet }) => src.endsWith(sheet + '-v01.webp'))
  try {
    s.renderer.settings({ animate: false, zoom: 0.35, quality: 'low' })
    s.frame(40)
    expect(s.images.filter((image) => isDetail((image as HTMLImageElement).src))).toHaveLength(0)
    s.renderer.settings({ animate: false, zoom: 1, quality: 'balanced' })
    s.frame(240)
    const detailImages = s.images.filter((image) => isDetail((image as HTMLImageElement).src))
    expect(detailImages.length).toBeGreaterThan(0)
    const details = s.draws.filter(({ src }) => isDetail(src))
    expect(details.length).toBeGreaterThanOrEqual(detailImages.length * 2)
    const floorClip = s.clips.filter(({ path }) => path.some((part) => part.operation === 'E'))
    expect(floorClip.length).toBeGreaterThanOrEqual(2)
    for (const image of detailImages) {
      const draws = details.filter((draw) => draw.image === image)
      expect(draws).toHaveLength(2)
      expect(draws.every(({ args }) => args.length === 4)).toBe(true)
      expect(draws[0]!.args.slice(-2)).toEqual(draws[1]!.args.slice(-2))
    }
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
  const ordinary = scene(true)
  try {
    ordinary.frame(40)
    expect(ordinary.images.some((image) => isDetail((image as HTMLImageElement).src))).toBe(false)
  } finally {
    ordinary.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it('keeps an obscured Old Waystone marker visible above major artwork when location labels are hidden', () => {
  const site = correctionScenes().discoveries.find(({ id }) => id === 'remote-colosseum')!
  const state = { ...newWorldState(), position: site.detailPosition! }
  const s = scene(true, projectWorld(state, [], 1000))
  try {
    s.renderer.settings({ animate: false, zoom: 0.35, showLocationLabels: false })
    s.frame(40)
    const source = worldRenderTerrain(s.view)
      .flatMap((sector) => sector.landmarks.map((landmark) => ({ sector, landmark })))
      .find(({ landmark }) => landmark.name === 'Old Waystone')!
    expect(source).toBeDefined()
    const origin = { x: source.sector.atlasColumn! * 13, y: source.sector.atlasRow! * 9 }
    const camera = mapPoint(s.view.position, s.view.sectors)
    const p = projectMapPoint(
      { x: origin.x + source.landmark.x + 0.5, y: origin.y + source.landmark.y + 0.5 },
      camera,
      { x: 0, y: 0 },
      64 * 0.35,
      800,
      600,
    )
    const markers = s.strokes.filter(({ colour }) => colour === '#ffe2a1')
    expect(
      markers.some(
        ({ path }) =>
          path[0]?.operation === 'M' &&
          Math.abs(path[0].points[0]! - p.x) < 0.01 &&
          Math.abs(path[0].points[1]! - (p.y - 9)) < 0.01,
      ),
    ).toBe(true)
    expect(s.texts.some(({ text }) => text === 'Old Waystone')).toBe(false)
    expect(s.view.position).toEqual(state.position)
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
  const ordinary = scene(true)
  try {
    ordinary.frame(40)
    expect(ordinary.strokes.some(({ colour }) => colour === '#ffe2a1')).toBe(false)
  } finally {
    ordinary.renderer.dispose()
    vi.unstubAllGlobals()
  }
})

it.each([1, 2.625].flatMap((density) => [0.35, 1, 1.4].map((zoom) => ({ density, zoom }))))(
  'aligns cached liquid tile boundaries to backing pixels at $zoom zoom/$density DPR',
  ({ density, zoom }) => {
    const state = { ...newWorldState(), position: { sectorId: 'atlas:71:32', x: 6, y: 4 } }
    const s = scene(true, projectWorld(state, [], 1000))
    try {
      Object.assign(s.canvas, { clientWidth: 414, clientHeight: 630 })
      window.devicePixelRatio = density
      s.resize()
      s.renderer.settings({ animate: false, zoom })
      s.frame(40)
      s.frame(240)
      const grounds = [...s.composites.entries()].filter(
        ([layer, sources]) =>
          (layer as HTMLCanvasElement).width > 100 &&
          sources.some((source) =>
            (source as HTMLImageElement).src?.endsWith('water-materials-v01.webp'),
          ) &&
          sources.some((source) =>
            (source as HTMLImageElement).src?.endsWith('regional-ground-v02.webp'),
          ),
      )
      expect(grounds.length).toBeGreaterThan(0)
      for (const [layer] of grounds) {
        expect((layer as HTMLCanvasElement).width % 13).toBe(0)
        expect((layer as HTMLCanvasElement).height % 9).toBe(0)
      }
      for (let frame = 0; frame < 60; frame++) {
        s.renderer.update(s.view)
        s.frame(280 + frame * 40)
      }
      expect(Number(s.canvas.dataset.cachedPixels)).toBeGreaterThan(0)
      expect(Number(s.canvas.dataset.cachedPixels)).toBeLessThanOrEqual(8_000_000)
      expect(s.identityCanvas.width).toBe(Math.round(414 * density))
    } finally {
      s.renderer.dispose()
      vi.unstubAllGlobals()
    }
  },
)

it('retains whole-cell backing pixels when visible terrain lowers cached density', () => {
  const state = newWorldState()
  const view = projectWorld(state, [], 1000)
  const root = atlasSectors().find((sector) => sector.id === state.position.sectorId)!
  const sectors = atlasSectors()
    .filter(
      (sector) =>
        sector.charted &&
        Math.abs(sector.atlasColumn! - root.atlasColumn!) <= 2 &&
        Math.abs(sector.atlasRow! - root.atlasRow!) <= 2,
    )
    .slice(0, 22)
    .map((sector) => ({
      ...projectWorldSector(state, sector),
      landmarks: [],
      buildings: [],
    }))
  expect(sectors).toHaveLength(22)
  const initial = {
    ...view,
    sectors: sectors.filter((sector) => sector.id === root.id),
    scenery: [],
    atlas: [],
  }
  const s = scene(true, initial)
  const resamples: { width: number; height: number }[] = []
  const create = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((...args) => {
    const layer = create(...args) as HTMLCanvasElement
    const target = layer.getContext('2d')!
    const draw = target.drawImage.bind(target)
    const context = new Proxy(target, {
      get(context, key) {
        if (key === 'drawImage')
          return (source: HTMLCanvasElement, ...args: number[]) => {
            if (
              source.width > 100 &&
              source.width / 13 === source.height / 9 &&
              args.length === 4 &&
              args[2] === layer.width &&
              args[3] === layer.height &&
              Math.abs(layer.width / layer.height - 13 / 9) < 0.01
            )
              resamples.push({ width: layer.width, height: layer.height })
            return draw(source, ...(args as [number, number, number, number]))
          }
        return Reflect.get(context, key)
      },
    })
    // This canvas test double supplies only the 2D context used by the renderer.
    layer.getContext = (() => context) as unknown as typeof layer.getContext
    return layer
  })
  try {
    Object.assign(s.canvas, { clientWidth: 5000, clientHeight: 3000 })
    s.resize()
    s.renderer.settings({ animate: false, zoom: 0.75 })
    s.frame(40)
    s.renderer.update({ ...initial, sectors })
    s.frame(80)
    expect(resamples.length).toBeGreaterThan(0)
    for (const raster of resamples) {
      expect(raster.width % 13).toBe(0)
      expect(raster.height % 9).toBe(0)
    }
  } finally {
    s.renderer.dispose()
    vi.unstubAllGlobals()
  }
})
