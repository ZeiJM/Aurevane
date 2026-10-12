import { GRID_HEIGHT, GRID_WIDTH, STEP_MS } from '@/world/catalog'
import { ATLAS_COLUMNS, ATLAS_ROWS } from '@/world/atlas'
import { hashString } from '@/world/terrain-gen'
import type {
  WorldCell,
  WorldLandmark,
  WorldPosition,
  WorldSectorView,
  WorldView,
} from '@/world/types'
import { sectorMapOrigin, wrappedMapX, WORLD_MAP_WIDTH } from '@/world/topology'
import { type MapPoint, WorldMotion } from './world-motion'
import { WorldPlayerMotion } from './map-player-motion'
import { samePosition } from '@/world/travel'
import {
  createCloudTexture,
  createWildlife,
  wildlifePose,
  type Wildlife,
  type WildlifePose,
} from './map-ambient'
import {
  buildWaterField,
  paintWaterGround,
  paintWaterMotion,
  paintWaterfallMotion,
} from './map-water'
import { buildPublicCoasts, paintCoastSea } from './map-coast'
import {
  paintPrecipitation,
  paintTerrainAtmosphere,
  precipitationKind,
  terrainHeatEmitters,
} from './map-weather'
import { drawWildlife } from './map-wildlife'
import { buildBiomeTransitions } from './map-biome-transitions'

import { MAP_X, MAP_Y, projectMapPoint, unprojectMapPoint } from './map-projection'

const BASE = '/media/art/world/runtime/'
const landmarkProps: Partial<Record<WorldLandmark['kind'], number>> = {
  bridge: 2,
  ruin: 3,
  shrine: 4,
  camp: 5,
  spring: 6,
  waystone: 7,
  anchor: 3,
  hamlet: 0,
  grove: 6,
}
const palettes: Record<string, [string, number, number]> = {
  'verdant-expanse': ['#557748', 0, 0],
  'aureth-crown': ['#727254', 0, 2],
  frostmere: ['#a5b1b5', 2, 1],
  'hollow-coast': ['#73827b', 5, 3],
  'glasswind-desert': ['#ab956e', 3, 2],
  emberreach: ['#5c5150', 6, 3],
  'starfall-highlands': ['#7c7c77', 7, 1],
  'umbral-march': ['#384e48', 1, 0],
}
interface Scenery {
  x: number
  y: number
  width: number
  height: number
  image: HTMLImageElement
  index: number
  columns: number
  rows: number
  tree: boolean
  anchorX?: number
  anchorY?: number
  mirror?: boolean
  source?: readonly [number, number, number, number]
  underpass?: 'water' | 'lava'
  waterfall?: boolean
}
interface FeaturePlacement {
  point: MapPoint
  width: number
  height: number
  anchorX: number
  anchorY: number
  mirror: boolean
  source?: readonly [number, number, number, number]
  underpass?: 'water' | 'lava'
}
/** Positions are presentation-only and use exclusively supplied, known terrain. */
function indexFeaturePlacements(sectors: readonly WorldSectorView[]) {
  const fields = new Map<string, Map<string, FeaturePlacement | null>>()
  const known = new Map<string, WorldCell>()
  const namespace = (sector: WorldSectorView) =>
    sector.charted && sector.atlasColumn !== undefined && sector.atlasRow !== undefined
      ? 'atlas'
      : sector.id
  const address = (sector: WorldSectorView, x: number, y: number) =>
    `${namespace(sector)}:${namespace(sector) === 'atlas' ? ((x % WORLD_MAP_WIDTH) + WORLD_MAP_WIDTH) % WORLD_MAP_WIDTH : x}:${y}`
  const at = (sector: WorldSectorView, x: number, y: number) => known.get(address(sector, x, y))
  const liquid = (cell: WorldCell | undefined) => cell?.terrain === '~' || cell?.terrain === 'l'
  for (const sector of sectors) {
    const origin = sectorMapOrigin(sector)
    for (const cell of sector.cells)
      known.set(address(sector, origin.x + cell.x, origin.y + cell.y), cell)
  }
  for (const sector of sectors) {
    const placements = new Map<string, FeaturePlacement | null>()
    fields.set(sector.id, placements)
    const origin = sectorMapOrigin(sector)
    for (const landmark of sector.landmarks) {
      const x = origin.x + landmark.x,
        y = origin.y + landmark.y
      if (landmark.kind === 'bridge') {
        placements.set(landmark.id, null)
        if (at(sector, x, y)?.terrain !== '=' || !at(sector, x, y)?.walkable) continue
        for (const axis of [0, 1]) {
          const dx = axis === 0 ? 1 : 0,
            dy = axis === 1 ? 1 : 0
          const crossing = (cx: number, cy: number) => {
            const cell = at(sector, cx, cy)
            if (cell?.terrain !== '=' || !cell.walkable) return null
            const waterSide = (sign: number) => {
              for (let i = 1; i <= 4; i++) {
                const next = at(sector, cx + dy * sign * i, cy + dx * sign * i)
                if (liquid(next)) return next!.terrain
                if (next?.terrain !== '=' || !next.walkable) break
              }
              return null
            }
            const a = waterSide(-1),
              b = waterSide(1)
            return a !== null && a === b ? a : null
          }
          if (!crossing(x, y)) continue
          let before = 0,
            after = 0
          while (before < 5 && crossing(x - (before + 1) * dx, y - (before + 1) * dy)) before++
          while (after < 5 && crossing(x + (after + 1) * dx, y + (after + 1) * dy)) after++
          if (before === 5 || after === 5) continue
          const a = at(sector, x - (before + 1) * dx, y - (before + 1) * dy),
            b = at(sector, x + (after + 1) * dx, y + (after + 1) * dy)
          if (!a?.walkable || !b?.walkable || liquid(a) || liquid(b)) continue
          const span = before + after + 2
          // Inspected props-v02 bridge: painted bank-foot centres define the
          // span; the expanded crop includes the right foot beyond its grid cell.
          placements.set(landmark.id, {
            point: {
              x: x + 0.5 + ((after - before) * dx) / 2,
              y: y + 0.5 + ((after - before) * dy) / 2,
            },
            width: (span * MAP_X) / 0.694,
            height: (span * MAP_Y) / 0.411,
            anchorX: 0.532,
            anchorY: 0.653,
            mirror: axis === 0,
            source: [950 / 1774, 60 / 887, 460 / 1774, 380 / 887],
            underpass: crossing(x, y) === 'l' ? 'lava' : 'water',
          })
          break
        }
      } else if (
        landmark.sceneryIndex === 4 ||
        (landmark.sceneryIndex === undefined &&
          (landmark.kind === 'spring' || landmark.kind === 'grove'))
      ) {
        placements.set(landmark.id, null)
        if (!at(sector, x, y)?.walkable) continue
        let closest: MapPoint | null = null,
          distance = 3.25
        for (const candidate of sectors) {
          if (namespace(candidate) !== namespace(sector)) continue
          const o = sectorMapOrigin(candidate, namespace(sector) === 'atlas' ? x : undefined)
          for (const cell of candidate.cells) {
            if (cell.terrain !== '~' || cell.walkable) continue
            const wx = o.x + cell.x,
              wy = o.y + cell.y,
              d = Math.hypot(wx - x, wy - y)
            if (d < distance) {
              closest = { x: wx + 0.5, y: wy + 0.5 }
              distance = d
            }
          }
        }
        if (!closest) continue
        const waterfall = landmark.sceneryIndex === 4
        placements.set(landmark.id, {
          point: closest,
          width: waterfall ? 1.8 : 1.55,
          height: waterfall ? 1.8 : 1.55,
          anchorX: waterfall ? 0.48 : 0.53,
          anchorY: waterfall ? 0.78 : 0.66,
          mirror: false,
          ...(waterfall ? {} : { source: [975 / 1774, 480 / 887, 453 / 1774, 372 / 887] as const }),
        })
      }
    }
  }
  return fields
}
function sprite(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  index: number,
  columns: number,
  rows: number,
  x: number,
  y: number,
  width: number,
  height: number,
  source?: readonly [number, number, number, number],
) {
  const sw = image.width / columns,
    sh = image.height / rows
  context.drawImage(
    image,
    source ? source[0] * image.width : (index % columns) * sw,
    source ? source[1] * image.height : Math.floor(index / columns) * sh,
    source ? source[2] * image.width : sw,
    source ? source[3] * image.height : sh,
    x,
    y,
    width,
    height,
  )
}
export function createMapRenderer(
  canvas: HTMLCanvasElement,
  motion: WorldMotion,
  initial: WorldView,
  select: (position: WorldPosition) => void,
  selectPlayer: (id: string) => void,
  onZoom: (zoom: number) => void = () => {},
  onVisiblePlayers: (ids: string[]) => void = () => {},
  onStop: () => void = () => {},
) {
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) return null
  const ctx = context
  let view = initial,
    width = 0,
    height = 0,
    ratio = 1,
    groundScale = 1,
    tile = 64,
    zoom = 1,
    disposed = false,
    frame = 0,
    last = 0,
    drawn = 0,
    dirty = true,
    wasMoving = false,
    wasRemoteMoving = false,
    visiblePlayerKey: string | null = null
  const pan = { x: 0, y: 0 }
  const heldKeys = new Map<string, MapPoint>()
  let keyTimer: ReturnType<typeof setTimeout> | null = null
  function releaseHeldKeys() {
    heldKeys.clear()
    if (keyTimer !== null) clearTimeout(keyTimer)
    keyTimer = null
  }
  let camera = motion.sample(performance.now()).point
  const remoteMotion = new WorldPlayerMotion(initial, performance.now(), camera)
  let animate = true,
    zoomLocked = false,
    paused = false,
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let drag: {
    x: number
    y: number
    position: WorldPosition | null
    player: { id: string; self: boolean } | null
  } | null = null
  const images = new Map<string, HTMLImageElement>(),
    portraits = new Map<string, HTMLImageElement>()
  const cache = new Map<string, { key: string; ground: HTMLCanvasElement }>()
  let hitTargets: { id: string; self: boolean; x: number; y: number }[] = []
  const frameTimes: number[] = []
  const terrainKeys = new Map<string, string>()
  const wildlife = new Map<string, Wildlife[]>()
  let waterField = buildWaterField(view.sectors)
  let biomeField = buildBiomeTransitions(view.sectors)
  let featurePlacements = indexFeaturePlacements(view.sectors)
  let coastField = buildPublicCoasts(view)
  let heatEmitters = terrainHeatEmitters(view.sectors)
  const clouds = [0, 1, 2].map((i) => createCloudTexture('world-cloud:' + i))
  let cachedPixels = 0
  function indexTerrain() {
    waterField = buildWaterField(view.sectors)
    biomeField = buildBiomeTransitions(view.sectors)
    featurePlacements = indexFeaturePlacements(view.sectors)
    coastField = buildPublicCoasts(view)
    heatEmitters = terrainHeatEmitters(view.sectors)
    for (const sector of view.sectors) {
      terrainKeys.set(sector.id, sector.cells.map((c) => `${c.x},${c.y},${c.terrain}`).join(';'))
      if (!wildlife.has(sector.id)) wildlife.set(sector.id, createWildlife(sector))
    }
    for (const id of wildlife.keys())
      if (!view.sectors.some((s) => s.id === id)) wildlife.delete(id)
  }
  indexTerrain()
  const clearCache = () => {
    cache.clear()
    cachedPixels = 0
  }
  const load = (name: string, version = 'v02') => {
    const image = new Image()
    image.onload = () => {
      clearCache()
      requestDraw()
    }
    image.src = BASE + name + '-' + version + '.webp'
    images.set(name, image)
  }
  for (const name of ['terrain', 'buildings', 'nature', 'props', 'biomes']) load(name)
  load('beauties', 'v03')
  const resize = () => {
    width = canvas.clientWidth
    height = canvas.clientHeight
    ratio = Math.min(window.devicePixelRatio || 1, 1.5)
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    tile = (width < 600 ? 48 : 64) * zoom
    clearCache()
    requestDraw()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  resize()
  const screen = (point: MapPoint) => projectMapPoint(point, camera, pan, tile, width, height)
  const world = (x: number, y: number) =>
    unprojectMapPoint({ x, y }, camera, pan, tile, width, height)
  const sectorOrigin = (sector: WorldSectorView) => sectorMapOrigin(sector, camera.x)
  const pick = (point: MapPoint) => {
    // Prefer the current legacy/private sector over a public sector at the same address.
    const ordered = [...view.sectors].sort(
      (a, b) => Number(b.id === view.position.sectorId) - Number(a.id === view.position.sectorId),
    )
    for (const sector of ordered) {
      const origin = sectorOrigin(sector),
        x = Math.floor(point.x - origin.x),
        y = Math.floor(point.y - origin.y)
      const cell = sector.cells.find((c) => c.x === x && c.y === y)
      if (cell?.walkable) return { sectorId: sector.id, x, y }
    }
    return null
  }
  const ground = (sector: WorldSectorView) => {
    const key =
      terrainKeys.get(sector.id) +
      ':' +
      waterField.get(sector.id)?.key +
      ':' +
      biomeField.get(sector.id)?.key +
      ':' +
      tile +
      ':' +
      groundScale
    const previous = cache.get(sector.id)
    if (previous?.key === key) return previous.ground
    const layer = document.createElement('canvas')
    layer.width = Math.ceil(GRID_WIDTH * tile * groundScale)
    layer.height = Math.ceil(GRID_HEIGHT * tile * groundScale)
    const c = layer.getContext('2d')!
    c.scale(groundScale, groundScale)
    c.imageSmoothingEnabled = true
    c.imageSmoothingQuality = 'high'
    c.fillStyle = '#233d3c'
    c.fillRect(0, 0, layer.width, layer.height)
    const texture = images.get('terrain')
    // One world-anchored material gradient crosses every cell and sector without
    // resetting its colour at tile edges. Water/lava animation stays on the overlay.
    const originX = (sector.atlasColumn ?? 0) * GRID_WIDTH * tile,
      originY = (sector.atlasRow ?? 0) * GRID_HEIGHT * tile
    const materialGradient = (colours: readonly string[]) => {
      const gradient = c.createLinearGradient(
        -originX,
        -originY,
        ATLAS_COLUMNS * GRID_WIDTH * tile - originX,
        ATLAS_ROWS * GRID_HEIGHT * tile - originY,
      )
      colours.forEach((colour, i) => gradient.addColorStop(i / (colours.length - 1), colour))
      return gradient
    }
    const waterMaterial = materialGradient(['#245e67', '#3e7b82', '#244e60']),
      lavaMaterial = materialGradient(['#702f25', '#bd5b2e', '#4d2526'])
    const paintMaterial = (
      target: CanvasRenderingContext2D,
      cell: WorldCell,
      regionId: string,
      offsetX = 0,
      offsetY = 0,
    ) => {
      const material = palettes[regionId] ?? palettes['verdant-expanse']!,
        x = cell.x * tile - offsetX,
        y = cell.y * tile - offsetY
      target.fillStyle = material[0]
      target.fillRect(x, y, tile + 1, tile + 1)
      if (texture?.complete && texture.naturalWidth) {
        target.globalAlpha = 0.66
        const sw = texture.width / 4,
          sh = texture.height / 2,
          index = regionId === 'verdant-expanse' && cell.terrain === 't' ? 1 : material[1]
        target.drawImage(
          texture,
          (index % 4) * sw + ((((sector.atlasColumn ?? 0) * GRID_WIDTH + cell.x) % 4) * sw) / 4,
          Math.floor(index / 4) * sh +
            ((((sector.atlasRow ?? 0) * GRID_HEIGHT + cell.y) % 4) * sh) / 4,
          sw / 4,
          sh / 4,
          x,
          y,
          tile + 1,
          tile + 1,
        )
        target.globalAlpha = 1
      }
    }
    for (const cell of sector.cells) paintMaterial(c, cell, sector.regionId)
    const materialLayer = (
      x: number,
      y: number,
      width: number,
      height: number,
      regionId: string,
    ) => {
      const strip = document.createElement('canvas')
      strip.width = Math.ceil(width * groundScale)
      strip.height = Math.ceil(height * groundScale)
      const blend = strip.getContext('2d')!
      blend.scale(groundScale, groundScale)
      blend.imageSmoothingEnabled = true
      blend.imageSmoothingQuality = 'high'
      for (const cell of sector.cells)
        if (
          cell.x * tile < x + width &&
          (cell.x + 1) * tile > x &&
          cell.y * tile < y + height &&
          (cell.y + 1) * tile > y
        )
          paintMaterial(blend, cell, regionId, x, y)
      return { strip, blend }
    }
    const maskMaterial = (
      material: ReturnType<typeof materialLayer>,
      side: number,
      width: number,
      height: number,
    ) => {
      const { blend } = material,
        mask =
          side === 0
            ? blend.createLinearGradient(0, 0, 0, height)
            : side === 1
              ? blend.createLinearGradient(width, 0, 0, 0)
              : side === 2
                ? blend.createLinearGradient(0, height, 0, 0)
                : blend.createLinearGradient(0, 0, width, 0)
      mask.addColorStop(0, 'rgba(0,0,0,.5)')
      mask.addColorStop(1, 'rgba(0,0,0,0)')
      blend.globalCompositeOperation = 'destination-in'
      blend.fillStyle = mask
      blend.fillRect(0, 0, width, height)
      blend.globalCompositeOperation = 'source-over'
    }
    // Feather supplied public dry boundaries once in cached ground. The special
    // pavement/liquid/rock overlays below remain authoritative in every biome.
    for (const edge of biomeField.get(sector.id)?.edges ?? []) {
      const vertical = edge.side % 2 === 1,
        width = (vertical ? edge.width : edge.to - edge.from) * tile,
        height = (vertical ? edge.to - edge.from : edge.width) * tile,
        x = (edge.side === 1 ? GRID_WIDTH - edge.width : vertical ? 0 : edge.from) * tile,
        y = (edge.side === 2 ? GRID_HEIGHT - edge.width : vertical ? edge.from : 0) * tile,
        material = materialLayer(x, y, width, height, edge.regionId)
      maskMaterial(material, edge.side, width, height)
      c.drawImage(material.strip, x, y, width, height)
      material.strip.width = material.strip.height = 0
    }
    // Rebuild shared corners with separable weights, rather than overlapping
    // two 50% strips in local edge order. All four quadrants meet at the same
    // material mixture: own(1-u)(1-v), east/west u(1-v), north/south v(1-u), diagonal uv.
    for (const corner of biomeField.get(sector.id)?.corners ?? []) {
      const size = corner.width * tile,
        x = (corner.verticalSide === 1 ? GRID_WIDTH - corner.width : 0) * tile,
        y = (corner.horizontalSide === 2 ? GRID_HEIGHT - corner.width : 0) * tile,
        own = materialLayer(x, y, size, size, sector.regionId),
        vertical = materialLayer(x, y, size, size, corner.verticalRegionId),
        horizontal = materialLayer(x, y, size, size, corner.horizontalRegionId),
        diagonal = materialLayer(x, y, size, size, corner.diagonalRegionId)
      maskMaterial(vertical, corner.verticalSide, size, size)
      own.blend.drawImage(vertical.strip, 0, 0, size, size)
      maskMaterial(diagonal, corner.verticalSide, size, size)
      horizontal.blend.drawImage(diagonal.strip, 0, 0, size, size)
      maskMaterial(horizontal, corner.horizontalSide, size, size)
      own.blend.drawImage(horizontal.strip, 0, 0, size, size)
      c.drawImage(own.strip, x, y, size, size)
      for (const material of [own, vertical, horizontal, diagonal])
        material.strip.width = material.strip.height = 0
    }
    for (const cell of sector.cells) {
      const x = cell.x * tile,
        y = cell.y * tile
      if (cell.terrain === '=' || cell.terrain === 's') {
        c.fillStyle = sector.townId ? '#aa9d7b' : '#a49b77'
        c.globalAlpha = 0.72
        c.fillRect(x, y, tile + 1, tile + 1)
        c.globalAlpha = 1
        if (texture?.complete && texture.naturalWidth) {
          const sw = texture.width / 4,
            sh = texture.height / 2
          c.drawImage(
            texture,
            ((((sector.atlasColumn ?? 0) * GRID_WIDTH + cell.x) % 4) * sw) / 4,
            sh + ((((sector.atlasRow ?? 0) * GRID_HEIGHT + cell.y) % 4) * sh) / 4,
            sw / 4,
            sh / 4,
            x,
            y,
            tile + 1,
            tile + 1,
          )
        }
        c.fillStyle = 'rgba(192,180,146,.35)'
        c.fillRect(x, y, tile + 1, tile + 1)
      }
      if (cell.terrain === '~' || cell.terrain === 'l') {
        const water = cell.terrain === '~'
        c.fillStyle = water ? waterMaterial : lavaMaterial
        c.fillRect(x, y, tile, tile)
        if (water) {
          const profile = waterField.get(sector.id)?.cells.get(`${cell.x}:${cell.y}`)
          if (profile) paintWaterGround(c, profile, tile)
        } else {
          c.strokeStyle = '#6b5140'
          c.lineWidth = 5
          for (const [dx, dy] of [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ]) {
            const neighbor = sector.cells.find((n) => n.x === cell.x + dx! && n.y === cell.y + dy!)
            if (neighbor && neighbor.terrain !== cell.terrain) {
              c.beginPath()
              if (dx) c.moveTo(x + (dx > 0 ? tile : 0), y)
              else c.moveTo(x, y + (dy! > 0 ? tile : 0))
              if (dx) c.lineTo(x + (dx > 0 ? tile : 0), y + tile)
              else c.lineTo(x + tile, y + (dy! > 0 ? tile : 0))
              c.stroke()
            }
          }
        }
      }
      if (cell.terrain === '#') {
        c.fillStyle = '#4f5350'
        c.fillRect(x + 4, y + 4, tile - 8, tile - 8)
      }
    }
    const stale = cache.get(sector.id)
    if (stale) {
      cachedPixels -= stale.ground.width * stale.ground.height
      cache.delete(sector.id)
    }
    const pixels = layer.width * layer.height
    while (cache.size && cachedPixels + pixels > 8_000_000) {
      const oldest = cache.keys().next().value!
      const entry = cache.get(oldest)!
      cachedPixels -= entry.ground.width * entry.ground.height
      cache.delete(oldest)
    }
    cache.set(sector.id, { key, ground: layer })
    cachedPixels += pixels
    return layer
  }
  const portrait = (src: string | null) => {
    if (!src) return null
    let image = portraits.get(src)
    if (!image) {
      image = new Image()
      image.onload = requestDraw
      image.src = src
      portraits.set(src, image)
      while (portraits.size > 110) portraits.delete(portraits.keys().next().value!)
    }
    return image.complete && image.naturalWidth ? image : null
  }
  function draw(now: number) {
    hitTargets = []
    const start = performance.now(),
      sample = motion.sample(now),
      delta = Math.min(sample.moving && !wasMoving ? 16 : 64, now - last || 16)
    last = now
    camera = {
      x: camera.x + (sample.point.x - camera.x) * (1 - Math.exp(-delta / 90)),
      y: camera.y + (sample.point.y - camera.y) * (1 - Math.exp(-delta / 90)),
    }
    if (Math.hypot(sample.point.x - camera.x, sample.point.y - camera.y) < 0.001)
      camera = sample.point
    const visibleIds = view.players
      .filter((player) => {
        const point = remoteMotion.sample(player.characterId, now, camera)
        if (!point) return false
        const p = screen(point)
        return p.x > -21 && p.x < width + 21 && p.y > -4 && p.y < height + 38
      })
      .map((player) => player.characterId)
      .sort()
    const nextPlayerKey = JSON.stringify(visibleIds)
    if (visiblePlayerKey !== nextPlayerKey) {
      visiblePlayerKey = nextPlayerKey
      onVisiblePlayers(visibleIds)
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.fillStyle = view.sectors.find((s) => s.id === view.position.sectorId)?.charted
      ? '#284b57'
      : '#233d3c'
    ctx.fillRect(0, 0, width, height)
    const visible = view.sectors.filter((sector) => {
      const p = screen(sectorOrigin(sector))
      return (
        p.x - GRID_HEIGHT * tile * MAP_X < width + tile * 4 &&
        p.y < height + tile * 4 &&
        p.x + GRID_WIDTH * tile * MAP_X > -tile * 4 &&
        p.y + (GRID_WIDTH + GRID_HEIGHT) * tile * MAP_Y > -tile * 4
      )
    })
    // All visible layers must fit together. Otherwise higher-resolution terrain
    // evicts the next visible layer and rebuilds the entire scene every frame.
    const budgetScale = Math.sqrt(
      7_800_000 / (Math.max(1, visible.length) * GRID_WIDTH * GRID_HEIGHT * tile * tile),
    )
    groundScale = Math.min(ratio, Math.floor(budgetScale * 10) / 10)
    const scenery: Scenery[] = []
    const addScenery = (item: Scenery) => {
      const p = screen(item)
      if (
        scenery.length < 180 &&
        p.x + item.width / 2 > 0 &&
        p.x - item.width / 2 < width &&
        p.y + item.height * (1 - (item.anchorY ?? 1)) > 0 &&
        p.y - item.height * (item.anchorY ?? 1) < height
      )
        scenery.push(item)
    }
    const nature = images.get('nature'),
      buildings = images.get('buildings'),
      props = images.get('props'),
      biomes = images.get('biomes'),
      beauties = images.get('beauties')
    let waterCells = 0,
      wildlifeCount = 0,
      coastEdges = 0,
      wildlifeWalking = 0
    for (const sector of visible) {
      const origin = sectorOrigin(sector),
        p = screen(origin)
      ctx.save()
      ctx.transform(MAP_X, MAP_Y, -MAP_X, MAP_Y, p.x, p.y)
      coastEdges += paintCoastSea(
        ctx,
        coastField.get(sector.id) ?? [],
        tile,
        now,
        animate && !reduced,
        16 - coastEdges,
      )
      ctx.drawImage(ground(sector), 0, 0, GRID_WIDTH * tile, GRID_HEIGHT * tile)
      ctx.restore()
      const palette = palettes[sector.regionId] ?? palettes['verdant-expanse']!
      if (nature?.complete && nature.naturalWidth)
        for (const cell of sector.cells) {
          if (
            sector.landscape === 'wildflowers' &&
            cell.terrain === '.' &&
            beauties?.complete &&
            beauties.naturalWidth &&
            hashString(`${sector.id}:${cell.x}:${cell.y}`) % 5 === 0
          ) {
            addScenery({
              x: origin.x + cell.x + 0.5,
              y: origin.y + cell.y + 0.75,
              width: tile * 1.15,
              height: tile * 1.1,
              image: beauties,
              index: 7,
              columns: 4,
              rows: 2,
              tree: false,
            })
          }
          if (cell.terrain !== 't' && cell.terrain !== '#') continue
          const variant: Record<string, number> = {
            'aureth-crown': 6,
            'hollow-coast': 5,
            'glasswind-desert': 0,
            emberreach: 4,
            'starfall-highlands': 4,
            'umbral-march': 7,
          }
          const rock = cell.terrain === '#'
          const special = rock
            ? sector.regionId === 'emberreach'
              ? 2
              : 3
            : sector.landscape === 'willow'
              ? 5
              : variant[sector.regionId]
          const scenicTree =
            !rock && beauties?.complete && beauties.naturalWidth
              ? sector.landscape === 'sakura'
                ? hashString(`${origin.x + cell.x}:${origin.y + cell.y}`) % 3 === 0
                  ? 1
                  : 0
                : sector.landscape === 'autumn'
                  ? 2
                  : sector.landscape === 'wisteria'
                    ? 3
                    : undefined
              : undefined
          const asset =
            scenicTree !== undefined
              ? beauties!
              : special !== undefined && biomes?.complete && biomes.naturalWidth
                ? biomes
                : nature
          addScenery({
            x: origin.x + cell.x + 0.5,
            y: origin.y + cell.y + 0.75,
            width: tile * (rock ? 1.8 : 1.65),
            height: tile * (rock ? 1.7 : 2.55),
            image: asset,
            index: scenicTree ?? (asset === biomes ? special! : palette[2]),
            columns: 4,
            rows: 2,
            tree: !rock,
          })
        }
      for (const building of sector.buildings ?? []) {
        const asset = building.propIndex === undefined ? buildings : props
        if (!asset?.complete || !asset.naturalWidth) continue
        addScenery({
          x: origin.x + building.x + building.width / 2,
          y: origin.y + building.y + building.height,
          width: tile * (building.width + building.height) * 0.85,
          height:
            building.propIndex === undefined
              ? tile * (building.height + 2)
              : tile * (building.width + building.height) * 0.85,
          image: asset,
          index: building.propIndex ?? building.artIndex,
          columns: building.propIndex === undefined ? 3 : 4,
          rows: building.propIndex === undefined ? 3 : 2,
          tree: false,
        })
      }
      // Landmark structures share scenery depth/culling and identity occlusion.
      // Painting them after the character pass would hide someone on a bridge/anchor.
      if (props?.complete && props.naturalWidth)
        for (const landmark of sector.landmarks) {
          const scenic =
            landmark.sceneryIndex !== undefined && beauties?.complete && beauties.naturalWidth
          const asset = scenic ? beauties! : props
          const index = scenic ? landmark.sceneryIndex : landmarkProps[landmark.kind]
          if (index === undefined) continue
          const placement = featurePlacements.get(sector.id)?.get(landmark.id)
          if (placement === null || (landmark.sceneryIndex === 4 && !scenic)) continue
          const size = tile * (landmark.kind === 'bridge' ? 2.7 : scenic ? 2.4 : 1.55)
          addScenery({
            x: placement
              ? sector.charted
                ? wrappedMapX(placement.point.x, camera.x)
                : placement.point.x
              : origin.x + landmark.x + 0.5,
            y: placement?.point.y ?? origin.y + landmark.y + 0.5 + (size / tile) * 0.25,
            width: placement ? placement.width * tile : size,
            height: placement ? placement.height * tile : size,
            ...(placement
              ? {
                  anchorX: placement.anchorX,
                  anchorY: placement.anchorY,
                  mirror: placement.mirror,
                  source: placement.source,
                  underpass: placement.underpass,
                }
              : {}),
            image: asset,
            index,
            columns: 4,
            rows: 2,
            tree: false,
            waterfall: Boolean(scenic && index === 4),
          })
        }
      if (animate && !reduced)
        for (const cell of sector.cells)
          if ((cell.terrain === '~' || cell.terrain === 'l') && waterCells < 60) {
            const point = screen({ x: origin.x + cell.x, y: origin.y + cell.y })
            if (
              point.x < -tile * 2 ||
              point.x > width + tile * 2 ||
              point.y < -tile ||
              point.y > height + tile
            )
              continue
            waterCells++
            const at = screen({ x: origin.x + cell.x, y: origin.y + cell.y }),
              q = { x: 0, y: 0 }
            ctx.save()
            ctx.transform(MAP_X, MAP_Y, -MAP_X, MAP_Y, at.x, at.y)
            if (cell.terrain === '~') {
              const profile = waterField.get(sector.id)?.cells.get(`${cell.x}:${cell.y}`)
              if (profile) paintWaterMotion(ctx, profile, tile, now)
              ctx.restore()
              continue
            }
            ctx.beginPath()
            ctx.rect(q.x, q.y, tile, tile)
            ctx.clip()
            ctx.strokeStyle = 'rgba(255,196,95,.44)'
            ctx.lineWidth = 1.8
            for (let i = 0; i < 3; i++) {
              const phase =
                (now / 3200 + i * 0.33 + (origin.x + cell.x) * 0.17 + (origin.y + cell.y) * 0.11) %
                1
              const shift = phase * tile
              ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.85
              ctx.beginPath()
              ctx.moveTo(q.x - 12 + shift, q.y + tile * (0.23 + i * 0.27))
              ctx.quadraticCurveTo(
                q.x + shift,
                q.y + tile * (0.25 + i * 0.27),
                q.x + shift + 28,
                q.y + tile * (0.23 + i * 0.27),
              )
              ctx.stroke()
            }
            ctx.restore()
          }
    }
    // Wildlife shares depth with scenery. Wandering never changes collision or authority.
    const animals: {
      y: number
      type: 'animal'
      animal: Wildlife
      point: MapPoint
      bob: number
      facing: number
      pose: WildlifePose
    }[] = []
    if (nature?.complete && nature.naturalWidth)
      for (const sector of visible) {
        const origin = sectorOrigin(sector)
        for (const animal of wildlife.get(sector.id) ?? []) {
          const pose = wildlifePose(animal, now, animate && !reduced)
          const point = { x: origin.x + pose.x, y: origin.y + pose.y },
            p = screen(point)
          if (p.x < -40 || p.x > width + 40 || p.y < 0 || p.y > height || wildlifeCount >= 12)
            continue
          wildlifeCount++
          if (!animal.flying && pose.moving) wildlifeWalking++
          animals.push({
            y: point.x + point.y + (animal.flying ? 5 : 0),
            type: 'animal',
            animal,
            point,
            bob: pose.bob,
            facing: pose.facing,
            pose,
          })
        }
      }
    const stacks = new Map<
      string,
      {
        point: MapPoint
        people: { id: string; name: string; image: string | null; self: boolean }[]
      }
    >()
    for (const player of view.players) {
      const point = remoteMotion.sample(player.characterId, now, camera)
      if (!point) continue
      const key = `${point.x}:${point.y}`,
        stack = stacks.get(key) ?? { point, people: [] }
      stack.people.push({
        id: player.characterId,
        name: player.name,
        image: player.imageUrl,
        self: false,
      })
      stacks.set(key, stack)
    }
    const selfPoint = sample.point,
      selfKey = `${selfPoint.x}:${selfPoint.y}`,
      selfStack = stacks.get(selfKey) ?? { point: selfPoint, people: [] }
    selfStack.people.unshift({
      id: view.characterId,
      name: 'You',
      image: canvas.dataset.portrait ?? null,
      self: true,
    })
    stacks.set(selfKey, selfStack)
    const objects = [
      ...animals,
      ...scenery.map((item) => ({ y: item.x + item.y, type: 'scenery' as const, item })),
    ].sort((a, b) => a.y - b.y)
    const drawPerson = (stack: typeof selfStack, ghost = false) => {
      const projected = screen(stack.point),
        point = {
          x: Math.round(projected.x * ratio) / ratio,
          y: Math.round(projected.y * ratio) / ratio,
        }
      if (point.x < -40 || point.x > width + 40 || point.y < -60 || point.y > height + 60) return
      const people = stack.people,
        selfIndex = people.findIndex((person) => person.self),
        index =
          selfIndex >= 0
            ? selfIndex
            : reduced || !animate
              ? 0
              : Math.floor(now / 3600) % people.length,
        person = people[index]!,
        radius = 17
      if (!ghost)
        hitTargets.push({ id: person.id, self: person.self, x: point.x, y: point.y - radius })
      ctx.save()
      ctx.globalAlpha = 1
      ctx.fillStyle = ghost ? '#a6b1b0' : '#182e32'
      ctx.strokeStyle = person.self ? '#ead399' : '#c6cbc0'
      ctx.lineWidth = 1
      ctx.shadowColor = 'rgba(0,0,0,.45)'
      ctx.shadowBlur = 10
      ctx.shadowOffsetY = 5
      ctx.beginPath()
      ctx.arc(point.x, point.y - radius, radius + 0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.shadowOffsetY = 0
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(point.x, point.y - radius, radius, 0, Math.PI * 2)
      ctx.clip()
      const image = portrait(person.image)
      const drawPortrait = (picture: HTMLImageElement) => {
        // Match battle's centered cover crop; wide/tall uploads keep their proportions.
        const w = picture.naturalWidth || picture.width,
          h = picture.naturalHeight || picture.height,
          side = Math.min(w, h)
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(
          picture,
          (w - side) / 2,
          (h - side) / 2,
          side,
          side,
          point.x - radius,
          point.y - radius * 2,
          radius * 2,
          radius * 2,
        )
      }
      if (image) {
        if (ghost) ctx.filter = 'grayscale(1)'
        const fade =
          selfIndex < 0 && people.length > 1 && animate && !reduced
            ? Math.min(1, (now % 3600) / 500)
            : 1
        const previous =
          fade < 1 ? portrait(people[(index + people.length - 1) % people.length]!.image) : null
        if (previous && fade < 1) {
          ctx.globalAlpha = 1 - fade
          drawPortrait(previous)
        }
        ctx.globalAlpha = fade
        drawPortrait(image)
      } else {
        ctx.fillStyle = ghost ? '#c2c9c7' : '#bcac84'
        ctx.font = '16px Georgia'
        ctx.textAlign = 'center'
        ctx.fillText(person.name[0] ?? '?', point.x, point.y - radius + 6)
      }
      ctx.restore()
      if (people.length > 1) {
        ctx.fillStyle = '#e8d7a3'
        ctx.font = 'bold 10px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(String(people.length), point.x + 19, point.y - 26)
      }
      if (!ghost) {
        ctx.font = '600 12px Georgia'
        ctx.textAlign = 'center'
        const nameWidth = Math.min(180, ctx.measureText(person.name).width + 14)
        ctx.fillStyle = 'rgba(6,28,35,.92)'
        ctx.strokeStyle = person.self ? '#d0ac66' : 'rgba(176,192,186,.7)'
        ctx.lineWidth = 0.7
        ctx.beginPath()
        ctx.roundRect(point.x - nameWidth / 2, point.y + 2, nameWidth, 18, 3)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = person.self ? '#f5dda5' : '#f1ebda'
        ctx.fillText(
          person.name,
          point.x,
          Math.round((point.y + 15) * ratio) / ratio,
          nameWidth - 12,
        )
      }
    }
    for (const object of objects) {
      if (object.type === 'animal') {
        const p = screen(object.point)
        drawWildlife(ctx, nature!, object.animal, object.pose, p.x, p.y, tile)
        continue
      }
      const item = object.item,
        p = screen({ x: item.x, y: item.y })
      ctx.save()
      ctx.fillStyle = 'rgba(20,32,25,.2)'
      ctx.beginPath()
      ctx.ellipse(p.x, p.y - 4, item.width * 0.36, 10, 0, 0, Math.PI * 2)
      ctx.fill()
      // Stable individual phase, pace, strength and sheltered pauses. The base
      // stays fixed while the canopy bends, rather than sliding the whole tree.
      const movingTree = animate && !reduced && item.tree
      if (movingTree) {
        const seed = hashString(`${item.x}:${item.y}`),
          phase = (seed % 6283) / 1000,
          period = 1700 + (seed % 2600),
          strength = seed % 7 === 0 ? 0 : 0.9 + (seed % 160) / 100,
          gust = 0.65 + 0.35 * Math.sin(now / 7500 + phase * 0.7),
          sway =
            (Math.sin(now / period + phase) + 0.2 * Math.sin(now / (period * 0.43) + phase * 1.8)) *
            strength *
            gust
        ctx.transform(1, 0, sway / item.height, 1, p.x, p.y)
      }
      const anchored = item.anchorY !== undefined
      if (anchored) {
        ctx.translate(p.x, p.y)
        if (item.mirror) ctx.scale(-1, 1)
      }
      if (item.underpass) {
        // The exposed opening belongs beneath the supported deck. Its inset
        // mask stays within the inspected arch, leaving every uncovered road dry.
        const ax = item.anchorX ?? 0.5,
          ay = item.anchorY ?? 1
        const opening = (x: number, y: number) =>
          [(x - ax) * item.width, (y - ay) * item.height] as const
        const a = opening(0.4, 0.86),
          b = opening(0.46, 0.74),
          c = opening(0.65, 0.49),
          d = opening(0.81, 0.61),
          e = opening(0.83, 0.78),
          f = opening(0.46, 0.96)
        ctx.beginPath()
        ctx.moveTo(...a)
        ctx.bezierCurveTo(...b, ...c, ...d)
        ctx.lineTo(...e)
        ctx.lineTo(...f)
        ctx.closePath()
        ctx.fillStyle = item.underpass === 'lava' ? 'rgba(183,79,40,.96)' : 'rgba(48,108,118,.96)'
        ctx.fill()
      }
      sprite(
        ctx,
        item.image,
        item.index,
        item.columns,
        item.rows,
        (movingTree || anchored ? 0 : p.x) - item.width * (item.anchorX ?? 0.5),
        (movingTree || anchored ? 0 : p.y) - item.height * (item.anchorY ?? 1),
        item.width,
        item.height,
        item.source,
      )
      if (item.waterfall && animate && !reduced)
        paintWaterfallMotion(
          ctx,
          -item.width * (item.anchorX ?? 0.5),
          -item.height * (item.anchorY ?? 1),
          item.width,
          item.height,
          now,
        )
      ctx.restore()
    }
    const labelBounds: { x: number; y: number; width: number; height: number }[] = []
    for (const sector of visible) {
      const origin = sectorOrigin(sector)
      for (const landmark of sector.landmarks) {
        const p = screen({ x: origin.x + landmark.x + 0.5, y: origin.y + landmark.y + 0.5 })
        if (p.x < 20 || p.x > width - 20 || p.y < 20 || p.y > height - 20) continue
        ctx.font = '13px Georgia'
        ctx.textAlign = 'center'
        const bounds = {
          x: p.x - ctx.measureText(landmark.name).width / 2 - 9,
          y: p.y + 25,
          width: ctx.measureText(landmark.name).width + 18,
          height: 21,
        }
        if (
          labelBounds.some(
            (b) =>
              bounds.x < b.x + b.width &&
              bounds.x + bounds.width > b.x &&
              bounds.y < b.y + b.height &&
              bounds.y + bounds.height > b.y,
          )
        )
          continue
        labelBounds.push(bounds)
        ctx.fillStyle = 'rgba(6,28,35,.88)'
        ctx.strokeStyle = 'rgba(208,172,102,.7)'
        ctx.lineWidth = 0.7
        ctx.beginPath()
        ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, 3)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#f3dca6'
        ctx.fillText(landmark.name, p.x, p.y + 40)
      }
    }
    // Time changes light gradually. Night never removes the ability to read terrain.
    const hour = view.environment.minuteOfDay / 60,
      night = Math.max(0, Math.cos(((hour - 1) * Math.PI) / 12)) * 0.24
    ctx.fillStyle = `rgba(16,28,50,${night})`
    ctx.fillRect(0, 0, width, height)
    let cloudCount = 0
    const current = view.sectors.find((s) => s.id === view.position.sectorId)
    const regionId = current?.regionId ?? 'verdant-expanse'
    canvas.dataset.precipitation = precipitationKind(view.environment.weather, regionId) ?? 'none'
    canvas.dataset.precipitationParticles = '0'
    canvas.dataset.terrainMotes = '0'
    if (animate && !reduced) {
      const weather = view.environment.weather
      // Keep integer lattice identities separate from floating-point drift.
      // Subtracting drift back out of a centre and flooring can round down to
      // the previous identity, flickering between silhouettes on successive frames.
      const spacing = 18,
        drift = now / 18000,
        w = tile * 11,
        h = tile * 5
      // Expand the viewport by the full shadow extent before unprojecting.
      // Cull offscreen shadows, never truncate visible ones by iteration order.
      const corners = [
        world(-w / 2, -h / 2),
        world(width + w / 2, -h / 2),
        world(-w / 2, height + h / 2),
        world(width + w / 2, height + h / 2),
      ]
      const fromX = Math.ceil((Math.min(...corners.map((p) => p.x)) - drift) / spacing),
        toX = Math.floor((Math.max(...corners.map((p) => p.x)) - drift) / spacing),
        fromY = Math.ceil(Math.min(...corners.map((p) => p.y)) / spacing),
        toY = Math.floor(Math.max(...corners.map((p) => p.y)) / spacing)
      for (let y = fromY; y <= toY; y++)
        for (let x = fromX; x <= toX; x++) {
          const p = screen({ x: x * spacing + drift, y: y * spacing })
          if (p.x + w / 2 < 0 || p.x - w / 2 > width || p.y + h / 2 < 0 || p.y - h / 2 > height)
            continue
          ctx.save()
          ctx.globalAlpha = weather === 'clear' ? 0.5 : 0.8
          const cloudIndex = (((x + y) % 3) + 3) % 3
          ctx.drawImage(clouds[cloudIndex]!, p.x - w / 2, p.y - h / 2, w, h)
          ctx.restore()
          cloudCount++
        }
      canvas.dataset.precipitationParticles = String(
        paintPrecipitation(ctx, width, height, now, weather, regionId),
      )
      canvas.dataset.terrainMotes = String(
        paintTerrainAtmosphere(ctx, width, height, now, regionId, heatEmitters, (point) =>
          screen({ x: wrappedMapX(point.x, camera.x), y: point.y }),
        ),
      )
      if (weather === 'fog' || weather === 'overcast' || weather === 'storm') {
        ctx.fillStyle = weather === 'fog' ? 'rgba(207,217,201,.07)' : 'rgba(25,39,47,.08)'
        for (let i = 0; i < 5; i++) {
          const x = ((now * 0.003 + (i * width) / 4) % (width + 400)) - 200
          ctx.beginPath()
          ctx.ellipse(x, height * (0.12 + i * 0.21), 250, 85, 0.1, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      const petals = current?.landscape === 'sakura' || current?.landscape === 'wisteria'
      const temperate = !['glasswind-desert', 'emberreach', 'frostmere'].includes(regionId)
      ctx.fillStyle = petals ? 'rgba(245,189,213,.75)' : 'rgba(214,195,124,.56)'
      for (let i = 0; i < (temperate ? 14 : 0); i++) {
        const phase = (now / (11000 + i * 370) + i * 0.13) % 1
        const x = phase * (width + 160) - 80,
          y = (i * 101 + Math.sin(now / 2400 + i) * 26 + phase * 70) % height
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(Math.sin(now / 900 + i) * 0.8)
        ctx.beginPath()
        ctx.ellipse(0, 0, petals ? 3.4 : 2.6, 1.4, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
      if (temperate && (weather === 'wind' || weather === 'clear' || petals)) {
        ctx.strokeStyle = 'rgba(232,238,215,.22)'
        ctx.lineWidth = 1
        for (let i = 0; i < 3; i++) {
          const phase = (now / 7000 + i * 0.31) % 1
          const x = phase * (width + 200) - 100,
            y = height * (0.2 + i * 0.27)
          ctx.globalAlpha = Math.sin(phase * Math.PI)
          ctx.beginPath()
          ctx.moveTo(x - 55, y)
          ctx.bezierCurveTo(x - 15, y - 9, x + 15, y + 10, x + 55, y)
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }
    }
    canvas.dataset.clouds = String(cloudCount)
    canvas.dataset.cloudPhase = animate && !reduced ? String(Math.round(now / 100)) : '0'
    canvas.dataset.wildlife = String(wildlifeCount)
    canvas.dataset.wildlifeWalking = String(wildlifeWalking)
    canvas.dataset.coastEdges = String(coastEdges)
    // Identity is interface: weather and nighttime tint scenery, not portraits
    // or nameplates. Retain the gray identity cue for travellers behind foliage.
    for (const stack of Array.from(stacks.values()).sort(
      (a, b) => a.point.x + a.point.y - b.point.x - b.point.y,
    )) {
      drawPerson(stack)
      if (
        scenery.some((item) => {
          const p = screen(stack.point),
            s = screen({ x: item.x, y: item.y })
          return (
            stack.point.x + stack.point.y < item.x + item.y &&
            p.x > s.x - item.width * 0.35 &&
            p.x < s.x + item.width * 0.35 &&
            p.y > s.y - item.height * (item.anchorY ?? 0.8) &&
            p.y < s.y + item.height * (1 - (item.anchorY ?? 1))
          )
        })
      )
        drawPerson(stack, true)
    }
    canvas.dataset.cameraX = String(camera.x + pan.x)
    canvas.dataset.cameraY = String(camera.y + pan.y)
    canvas.dataset.tileSize = String(tile)
    frameTimes.push(performance.now() - start)
    if (frameTimes.length > 120) frameTimes.shift()
    if (++drawn % 60 === 0) {
      const sorted = [...frameTimes].sort((a, b) => a - b)
      canvas.dataset.frameP95 = String(Math.round(sorted[Math.floor(sorted.length * 0.95)] ?? 0))
      canvas.dataset.cachedSectors = String(cache.size)
      canvas.dataset.cachedPixels = String(cachedPixels)
      canvas.dataset.visibleScenery = String(scenery.length)
      canvas.dataset.waterCells = String(waterCells)
      canvas.dataset.renderFrames = String(drawn)
      canvas.dataset.visiblePlayers = String(view.players.length + 1)
    }
  }
  function loop(now: number) {
    frame = 0
    if (disposed || paused || document.visibilityState !== 'visible') return
    const sample = motion.sample(now),
      remoteMoving = remoteMotion.moving(now),
      settling = sample.point.x !== camera.x || sample.point.y !== camera.y,
      interval =
        sample.moving || remoteMoving || settling
          ? 1000 / 60
          : animate && !reduced
            ? 1000 / 30
            : 250
    // Finishing motion must paint its endpoint before switching to the idle cadence.
    if (
      dirty ||
      (wasMoving && !sample.moving) ||
      (wasRemoteMoving && !remoteMoving) ||
      now - last >= interval - 1
    ) {
      draw(now)
      dirty = false
    }
    wasMoving = sample.moving
    wasRemoteMoving = remoteMoving
    if (
      sample.moving ||
      remoteMoving ||
      sample.point.x !== camera.x ||
      sample.point.y !== camera.y ||
      (animate && !reduced)
    )
      frame = requestAnimationFrame(loop)
  }
  function requestDraw() {
    dirty = true
    if (!disposed && !paused && !frame && document.visibilityState === 'visible')
      frame = requestAnimationFrame(loop)
  }
  const visibility = () => {
    if (document.visibilityState !== 'visible') releaseHeldKeys()
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    if (!disposed && !paused && document.visibilityState === 'visible') {
      last = 0
      dirty = true
      frame = requestAnimationFrame(loop)
    }
  }
  document.addEventListener('visibilitychange', visibility)
  visibility()
  const pointers = new Map<number, { x: number; y: number }>()
  let pinch: { distance: number; zoom: number } | null = null,
    gestured = false
  const distance = () => {
    const [a, b] = [...pointers.values()]
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  }
  const changeZoom = (next: number) => {
    next = Math.max(0.6, Math.min(1.4, Math.round(next * 100) / 100))
    if (zoomLocked || next === zoom) return
    zoom = next
    tile = (width < 600 ? 48 : 64) * zoom
    clearCache()
    requestDraw()
    onZoom(zoom)
  }
  const wheel = (event: WheelEvent) => {
    event.preventDefault()
    if (zoomLocked) return
    changeZoom(zoom * Math.exp(-event.deltaY * (event.ctrlKey ? 0.006 : 0.0015)))
  }
  const down = (event: PointerEvent) => {
    canvas.setPointerCapture(event.pointerId)
    if (event.pointerType === 'touch') {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pointers.size === 2) {
        pinch = { distance: distance(), zoom }
        gestured = true
        drag = null
        return
      }
    }
    const bounds = canvas.getBoundingClientRect(),
      x = event.clientX - bounds.left,
      y = event.clientY - bounds.top
    drag = {
      x: event.clientX,
      y: event.clientY,
      position: pick(world(x, y)),
      player: hitTargets.find((target) => Math.hypot(target.x - x, target.y - y) < 21) ?? null,
    }
  }
  const move = (event: PointerEvent) => {
    if (pointers.has(event.pointerId))
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pinch && pointers.size >= 2) {
      if (pinch.distance > 0) changeZoom((pinch.zoom * distance()) / pinch.distance)
      return
    }
    if (gestured) return
  }
  const up = (event: PointerEvent) => {
    pointers.delete(event.pointerId)
    if (gestured) {
      if (pointers.size < 2) pinch = null
      if (!pointers.size) gestured = false
      drag = null
      return
    }
    const start = drag
    drag = null
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7) return
    const hit = start.player
    if (hit) {
      if (!hit.self) selectPlayer(hit.id)
      return
    }
    const position = start.position
    if (position) {
      select(position)
      requestDraw()
    }
  }
  const cancel = (event: PointerEvent) => {
    pointers.delete(event.pointerId)
    if (pointers.size < 2) pinch = null
    if (!pointers.size) gestured = false
    drag = null
  }
  const offsets: Record<string, MapPoint> = {
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    w: { x: 0, y: -1 },
    a: { x: -1, y: 0 },
    s: { x: 0, y: 1 },
    d: { x: 1, y: 0 },
  }
  function walkHeldKey() {
    keyTimer = null
    const offset = [...heldKeys.values()].at(-1)
    if (!offset || disposed || paused || document.visibilityState !== 'visible') return
    if (view.movementBlocked || view.battleSessionId) {
      releaseHeldKeys()
      return
    }
    const now = performance.now(),
      sample = motion.sample(now),
      p = sample.point,
      position = pick({ x: Math.floor(p.x) + 0.5 + offset.x, y: Math.floor(p.y) + 0.5 + offset.y })
    let cadence = STEP_MS
    if (position) {
      const sector = view.sectors.find((sector) => sector.id === sample.position.sectorId)
      const crossing = sector?.exits.find(
        (exit) => samePosition(exit.from, sample.position) && samePosition(exit.to, position),
      )
      cadence = Math.max(STEP_MS, crossing?.durationMs ?? sector?.stepMs ?? STEP_MS)
      select(position)
      requestDraw()
    }
    // Browser key-repeat never owns cadence or creates extra RPCs. The legal
    // terrain/exit duration controls the next intent; the server still commits it.
    keyTimer = setTimeout(walkHeldKey, cadence)
  }
  const key = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      releaseHeldKeys()
      if (!event.repeat) onStop()
      return
    }
    const name = event.key.toLowerCase(),
      offset = offsets[event.key] ?? offsets[name]
    if (!offset) return
    event.preventDefault()
    if (event.repeat || heldKeys.has(name)) return
    heldKeys.set(name, offset)
    if (keyTimer !== null) clearTimeout(keyTimer)
    walkHeldKey()
  }
  const keyUp = (event: KeyboardEvent) => {
    heldKeys.delete(event.key.toLowerCase())
    if (!heldKeys.size) releaseHeldKeys()
  }
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', cancel)
  canvas.addEventListener('keydown', key)
  canvas.addEventListener('keyup', keyUp)
  canvas.addEventListener('blur', releaseHeldKeys)
  window.addEventListener('blur', releaseHeldKeys)
  canvas.addEventListener('wheel', wheel, { passive: false })
  const media = window.matchMedia('(prefers-reduced-motion: reduce)'),
    onReduced = () => {
      reduced = media.matches
      requestDraw()
    }
  media.addEventListener('change', onReduced)
  return {
    update(next: WorldView) {
      const terrainChanged = next.sectors !== view.sectors || next.atlas !== view.atlas
      view = next
      remoteMotion.update(next, performance.now(), camera)
      if (terrainChanged) indexTerrain()
      requestDraw()
    },
    settings(value: { animate: boolean; zoom: number; paused?: boolean; zoomLocked?: boolean }) {
      animate = value.animate
      zoomLocked = value.zoomLocked ?? false
      paused = value.paused ?? false
      if (paused) releaseHeldKeys()
      if (paused && frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
      if (zoom !== value.zoom) {
        zoom = value.zoom
        resize()
      }
      requestDraw()
    },
    dispose() {
      disposed = true
      remoteMotion.dispose()
      releaseHeldKeys()
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', visibility)
      clearCache()
      for (const image of images.values()) image.onload = null
      for (const image of portraits.values()) image.onload = null
      media.removeEventListener('change', onReduced)
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', cancel)
      canvas.removeEventListener('keydown', key)
      canvas.removeEventListener('keyup', keyUp)
      canvas.removeEventListener('blur', releaseHeldKeys)
      window.removeEventListener('blur', releaseHeldKeys)
      canvas.removeEventListener('wheel', wheel)
      pointers.clear()
      cache.clear()
      portraits.clear()
      for (const image of images.values()) image.onload = null
    },
  }
}
