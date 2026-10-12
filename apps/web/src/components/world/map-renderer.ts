import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { ATLAS_COLUMNS, ATLAS_ROWS } from '@/world/atlas'
import { seeded } from '@/world/terrain-gen'
import type { WorldLandmark, WorldPosition, WorldSectorView, WorldView } from '@/world/types'
import { mapPoint, type MapPoint, WorldMotion } from './world-motion'

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
  'verdant-expanse': ['#526849', 1, 0],
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
) {
  const sw = image.width / columns,
    sh = image.height / rows
  context.drawImage(
    image,
    (index % columns) * sw,
    Math.floor(index / columns) * sh,
    sw,
    sh,
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
) {
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) return null
  const ctx = context
  let view = initial,
    width = 0,
    height = 0,
    ratio = 1,
    tile = 64,
    zoom = 1,
    disposed = false,
    frame = 0,
    last = 0,
    drawn = 0,
    dirty = true
  let camera = mapPoint(view.position, view.sectors),
    pan = { x: 0, y: 0 },
    hover: MapPoint | null = null
  let animate = true,
    paused = false,
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let drag: { x: number; y: number; pan: MapPoint } | null = null
  const images = new Map<string, HTMLImageElement>(),
    portraits = new Map<string, HTMLImageElement>()
  const cache = new Map<string, { key: string; ground: HTMLCanvasElement }>()
  let hitTargets: { id: string; self: boolean; x: number; y: number }[] = []
  const frameTimes: number[] = []
  const terrainKeys = new Map<string, string>()
  let cachedPixels = 0
  function indexTerrain() {
    for (const sector of view.sectors)
      terrainKeys.set(sector.id, sector.cells.map((c) => `${c.x},${c.y},${c.terrain}`).join(';'))
  }
  indexTerrain()
  const clearCache = () => {
    cache.clear()
    cachedPixels = 0
  }
  const load = (name: string) => {
    const image = new Image()
    image.onload = () => {
      clearCache()
      requestDraw()
    }
    image.src = BASE + name + '-v02.webp'
    images.set(name, image)
  }
  for (const name of ['terrain', 'buildings', 'nature', 'props', 'biomes']) load(name)
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
  const sectorOrigin = (sector: WorldSectorView) => ({
    x: (sector.atlasColumn ?? 0) * GRID_WIDTH,
    y: (sector.atlasRow ?? 0) * GRID_HEIGHT,
  })
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
    const key = terrainKeys.get(sector.id) + ':' + tile
    const previous = cache.get(sector.id)
    if (previous?.key === key) return previous.ground
    const layer = document.createElement('canvas')
    layer.width = Math.ceil(GRID_WIDTH * tile)
    layer.height = Math.ceil(GRID_HEIGHT * tile)
    const c = layer.getContext('2d')!,
      palette = palettes[sector.regionId] ?? palettes['verdant-expanse']!
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
    const waterMaterial = materialGradient(['#315c62', '#427780', '#254f5b']),
      lavaMaterial = materialGradient(['#702f25', '#bd5b2e', '#4d2526'])
    for (const cell of sector.cells) {
      const x = cell.x * tile,
        y = cell.y * tile
      c.fillStyle = palette[0]
      c.fillRect(x, y, tile + 1, tile + 1)
      if (texture?.complete && texture.naturalWidth) {
        c.globalAlpha = 0.66
        // Material spans several tiles, avoiding a checkerboard of repeated tile borders.
        const sw = texture.width / 4,
          sh = texture.height / 2,
          index = palette[1]
        c.drawImage(
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
        c.globalAlpha = 1
      }
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
        c.fillRect(x, y, tile + 1, tile + 1)
        // Banks are fixed geometry; water highlights move independently above them.
        c.strokeStyle = water ? 'rgba(196,177,122,.55)' : '#6b5140'
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
      delta = Math.min(64, now - last || 16)
    last = now
    camera = {
      x: camera.x + (sample.point.x - camera.x) * (1 - Math.exp(-delta / 90)),
      y: camera.y + (sample.point.y - camera.y) * (1 - Math.exp(-delta / 90)),
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
    const scenery: Scenery[] = []
    const addScenery = (item: Scenery) => {
      const p = screen(item)
      if (
        scenery.length < 180 &&
        p.x + item.width / 2 > 0 &&
        p.x - item.width / 2 < width &&
        p.y > 0 &&
        p.y - item.height < height
      )
        scenery.push(item)
    }
    const nature = images.get('nature'),
      buildings = images.get('buildings'),
      props = images.get('props'),
      biomes = images.get('biomes')
    let waterCells = 0
    for (const sector of visible) {
      const origin = sectorOrigin(sector),
        p = screen(origin)
      ctx.save()
      ctx.transform(MAP_X, MAP_Y, -MAP_X, MAP_Y, p.x, p.y)
      ctx.drawImage(ground(sector), 0, 0)
      ctx.restore()
      const palette = palettes[sector.regionId] ?? palettes['verdant-expanse']!
      if (nature?.complete && nature.naturalWidth)
        for (const cell of sector.cells) {
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
            : variant[sector.regionId]
          const asset =
            special !== undefined && biomes?.complete && biomes.naturalWidth ? biomes : nature
          addScenery({
            x: origin.x + cell.x + 0.5,
            y: origin.y + cell.y + 0.75,
            width: tile * (rock ? 1.8 : 1.65),
            height: tile * (rock ? 1.7 : 2.55),
            image: asset,
            index: asset === biomes ? special! : palette[2],
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
          const index = landmarkProps[landmark.kind]
          if (index === undefined) continue
          const size = tile * (landmark.kind === 'bridge' ? 2.7 : 1.55)
          addScenery({
            x: origin.x + landmark.x + 0.5,
            y: origin.y + landmark.y + 0.5 + (size / tile) * 0.25,
            width: size,
            height: size,
            image: props,
            index,
            columns: 4,
            rows: 2,
            tree: false,
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
            ctx.beginPath()
            ctx.rect(q.x, q.y, tile, tile)
            ctx.clip()
            ctx.strokeStyle =
              cell.terrain === '~' ? 'rgba(178,216,208,.22)' : 'rgba(255,196,95,.32)'
            ctx.lineWidth = 1.3
            for (let i = 0; i < 3; i++) {
              const phase = (now / 2800 + i * 0.33 + cell.x * 0.17) % 1
              const shift = phase * tile
              ctx.globalAlpha = Math.sin(phase * Math.PI)
              ctx.beginPath()
              ctx.moveTo(q.x - 12 + shift, q.y + tile * (0.23 + i * 0.27))
              ctx.quadraticCurveTo(
                q.x + shift,
                q.y + tile * (0.25 + i * 0.27),
                q.x + shift + 18,
                q.y + tile * (0.23 + i * 0.27),
              )
              ctx.stroke()
            }
            ctx.restore()
          }
    }
    // Route is a quiet trail of dots, never sector/tile outlines.
    ctx.fillStyle = 'rgba(237,219,166,.65)'
    for (const step of view.route.slice(0, 30)) {
      const p = screen(mapPoint(step.position, view.sectors))
      if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) continue
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
      ctx.fill()
    }
    const stacks = new Map<
      string,
      {
        point: MapPoint
        people: { id: string; name: string; image: string | null; self: boolean }[]
      }
    >()
    for (const player of view.players) {
      const point = mapPoint(player.position, view.sectors),
        key = `${point.x}:${point.y}`,
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
      ...scenery.map((item) => ({ y: item.x + item.y, type: 'scenery' as const, item })),
      ...Array.from(stacks.values()).map((item) => ({
        y: item.point.x + item.point.y,
        type: 'player' as const,
        item,
      })),
    ].sort((a, b) => a.y - b.y)
    const drawPerson = (stack: typeof selfStack, ghost = false) => {
      const point = screen(stack.point)
      if (point.x < -40 || point.x > width + 40 || point.y < -60 || point.y > height + 60) return
      const people = stack.people,
        index = reduced || !animate ? 0 : Math.floor(now / 3600) % people.length,
        person = people[index]!,
        radius = 17
      if (!ghost)
        hitTargets.push({ id: person.id, self: person.self, x: point.x, y: point.y - radius })
      ctx.save()
      ctx.globalAlpha = 1
      ctx.fillStyle = ghost ? '#a6b1b0' : '#182e32'
      ctx.strokeStyle = person.self ? '#ead399' : '#c6cbc0'
      ctx.lineWidth = person.self ? 2.5 : 1.5
      ctx.beginPath()
      ctx.arc(point.x, point.y - radius, radius + 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(point.x, point.y - radius, radius, 0, Math.PI * 2)
      ctx.clip()
      const image = portrait(person.image)
      if (image) {
        if (ghost) ctx.filter = 'grayscale(1)'
        const fade = people.length > 1 && animate && !reduced ? Math.min(1, (now % 3600) / 500) : 1
        const previous = portrait(people[(index + people.length - 1) % people.length]!.image)
        if (previous && fade < 1) {
          ctx.globalAlpha = 1 - fade
          ctx.drawImage(previous, point.x - radius, point.y - radius * 2, radius * 2, radius * 2)
        }
        ctx.globalAlpha = fade
        ctx.drawImage(image, point.x - radius, point.y - radius * 2, radius * 2, radius * 2)
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
        ctx.font = '11px Georgia'
        ctx.textAlign = 'center'
        ctx.fillStyle = '#faf1dc'
        ctx.strokeStyle = 'rgba(24,38,34,.85)'
        ctx.lineWidth = 3
        ctx.strokeText(person.name, point.x, point.y + 13)
        ctx.fillText(person.name, point.x, point.y + 13)
      }
    }
    for (const object of objects) {
      if (object.type === 'player') {
        drawPerson(object.item)
        continue
      }
      const item = object.item,
        p = screen({ x: item.x, y: item.y })
      ctx.save()
      ctx.fillStyle = 'rgba(20,32,25,.2)'
      ctx.beginPath()
      ctx.ellipse(p.x, p.y - 4, item.width * 0.36, 10, 0, 0, Math.PI * 2)
      ctx.fill()
      const sway =
        animate && !reduced && item.tree && Math.floor(item.x + item.y) % 5 === 0
          ? Math.sin(now / 2800 + item.x) * 1.4
          : 0
      sprite(
        ctx,
        item.image,
        item.index,
        item.columns,
        item.rows,
        p.x - item.width / 2 + sway,
        p.y - item.height,
        item.width,
        item.height,
      )
      ctx.restore()
    }
    // Scenery never completely hides a character; the identity remains readable in gray.
    for (const stack of stacks.values())
      if (
        scenery.some((item) => {
          const p = screen(stack.point),
            s = screen({ x: item.x, y: item.y })
          return (
            stack.point.x + stack.point.y < item.x + item.y &&
            p.x > s.x - item.width * 0.35 &&
            p.x < s.x + item.width * 0.35 &&
            p.y > s.y - item.height * 0.8 &&
            p.y < s.y
          )
        })
      )
        drawPerson(stack, true)
    const labelBounds: { x: number; y: number; width: number; height: number }[] = []
    for (const sector of visible) {
      const origin = sectorOrigin(sector),
        random = seeded(sector.id)
      if (nature?.complete && nature.naturalWidth && !sector.townId) {
        const cells = sector.cells.filter((c) => c.walkable && c.terrain === '.')
        const cell = cells[Math.floor(random() * cells.length)]
        if (cell) {
          const p = screen({
            x:
              origin.x +
              cell.x +
              0.5 +
              (animate && !reduced ? Math.sin(now / 6000 + origin.x) * 0.22 : 0),
            y: origin.y + cell.y + 0.6,
          })
          sprite(ctx, nature, 4 + Math.floor(random() * 4), 4, 2, p.x - 16, p.y - 24, 32, 28)
        }
      }
      for (const landmark of sector.landmarks) {
        const p = screen({ x: origin.x + landmark.x + 0.5, y: origin.y + landmark.y + 0.5 })
        if (p.x < 20 || p.x > width - 20 || p.y < 20 || p.y > height - 20) continue
        ctx.font = 'italic 12px Georgia'
        ctx.textAlign = 'center'
        const bounds = {
          x: p.x - ctx.measureText(landmark.name).width / 2 - 5,
          y: p.y + 13,
          width: ctx.measureText(landmark.name).width + 10,
          height: 19,
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
        ctx.strokeStyle = 'rgba(35,49,39,.9)'
        ctx.lineWidth = 3
        ctx.strokeText(landmark.name, p.x, p.y + 25)
        ctx.fillStyle = '#f2e7c8'
        ctx.fillText(landmark.name, p.x, p.y + 25)
      }
    }
    // Time changes light gradually. Night never removes the ability to read terrain.
    const hour = view.environment.minuteOfDay / 60,
      night = Math.max(0, Math.cos(((hour - 1) * Math.PI) / 12)) * 0.24
    ctx.fillStyle = `rgba(16,28,50,${night})`
    ctx.fillRect(0, 0, width, height)
    if (animate && !reduced) {
      const weather = view.environment.weather
      if (weather === 'rain' || weather === 'storm') {
        ctx.strokeStyle = 'rgba(198,223,227,.32)'
        ctx.lineWidth = 1
        for (let i = 0; i < 40; i++) {
          const x = (i * 193 + now * 0.025) % width,
            y = (i * 113 + now * 0.18) % height
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(x - 3, y + 10)
          ctx.stroke()
        }
      }
      if (weather === 'fog' || weather === 'overcast' || weather === 'storm') {
        ctx.fillStyle = weather === 'fog' ? 'rgba(207,217,201,.07)' : 'rgba(25,39,47,.08)'
        for (let i = 0; i < 5; i++) {
          const x = ((now * 0.003 + (i * width) / 4) % (width + 400)) - 200
          ctx.beginPath()
          ctx.ellipse(x, height * (0.12 + i * 0.21), 250, 85, 0.1, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      if (weather === 'wind' || view.position.sectorId.includes('verdant')) {
        ctx.fillStyle = 'rgba(225,198,121,.38)'
        for (let i = 0; i < 10; i++) {
          const x = (now * 0.015 + i * 163) % width,
            y = (i * 101 + Math.sin(now / 2500 + i) * 15) % height
          ctx.fillRect(x, y, 3, 1)
        }
      }
    }
    if (hover) {
      const target = pick(hover)
      if (target) {
        const p = screen(mapPoint(target, view.sectors))
        ctx.strokeStyle = 'rgba(243,220,160,.7)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.ellipse(p.x, p.y, 14, 7, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
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
      interval = sample.moving ? 1000 / 60 : animate && !reduced ? 1000 / 30 : 250
    if (dirty || now - last >= interval - 1) {
      draw(now)
      dirty = false
    }
    if (sample.moving || (animate && !reduced)) frame = requestAnimationFrame(loop)
  }
  function requestDraw() {
    dirty = true
    if (!disposed && !paused && !frame && document.visibilityState === 'visible')
      frame = requestAnimationFrame(loop)
  }
  const visibility = () => {
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
  const down = (event: PointerEvent) => {
    canvas.setPointerCapture(event.pointerId)
    drag = { x: event.clientX, y: event.clientY, pan: { ...pan } }
  }
  const move = (event: PointerEvent) => {
    const bounds = canvas.getBoundingClientRect()
    hover = world(event.clientX - bounds.left, event.clientY - bounds.top)
    requestDraw()
    if (drag)
      pan = {
        x:
          drag.pan.x -
          ((event.clientX - drag.x) / (tile * MAP_X) + (event.clientY - drag.y) / (tile * MAP_Y)) /
            2,
        y:
          drag.pan.y -
          ((event.clientY - drag.y) / (tile * MAP_Y) - (event.clientX - drag.x) / (tile * MAP_X)) /
            2,
      }
  }
  const up = (event: PointerEvent) => {
    const start = drag
    drag = null
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7) return
    const bounds = canvas.getBoundingClientRect(),
      point = world(event.clientX - bounds.left, event.clientY - bounds.top)
    const hit = hitTargets.find(
      (target) =>
        Math.hypot(
          target.x - (event.clientX - bounds.left),
          target.y - (event.clientY - bounds.top),
        ) < 21,
    )
    if (hit) {
      if (!hit.self) selectPlayer(hit.id)
      return
    }
    const position = pick(point)
    if (position) {
      select(position)
      requestDraw()
    }
  }
  const cancel = () => {
    drag = null
  }
  const key = (event: KeyboardEvent) => {
    const offsets: Record<string, MapPoint> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    }
    const offset = offsets[event.key]
    if (!offset) return
    event.preventDefault()
    const p = motion.sample(performance.now()).point,
      position = pick({ x: Math.floor(p.x) + 0.5 + offset.x, y: Math.floor(p.y) + 0.5 + offset.y })
    if (position) {
      select(position)
      requestDraw()
    }
  }
  const leave = () => {
    hover = null
  }
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', cancel)
  canvas.addEventListener('pointerleave', leave)
  canvas.addEventListener('keydown', key)
  const media = window.matchMedia('(prefers-reduced-motion: reduce)'),
    onReduced = () => {
      reduced = media.matches
      requestDraw()
    }
  media.addEventListener('change', onReduced)
  return {
    update(next: WorldView) {
      view = next
      indexTerrain()
      requestDraw()
    },
    settings(value: { animate: boolean; zoom: number; paused?: boolean }) {
      animate = value.animate
      paused = value.paused ?? false
      if (paused && frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
      zoom = value.zoom
      resize()
      requestDraw()
    },
    center() {
      pan = { x: 0, y: 0 }
      requestDraw()
    },
    dispose() {
      disposed = true
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
      canvas.removeEventListener('pointerleave', leave)
      canvas.removeEventListener('keydown', key)
      cache.clear()
      portraits.clear()
      for (const image of images.values()) image.onload = null
    },
  }
}
