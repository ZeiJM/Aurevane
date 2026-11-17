// Offline Skia rendering of the real map/terrain/assets. No browser, auth, live DB
// or performance acceptance. Uses an existing optional canvas binding only.
// Offline source review, not hosted browser or physical-handset acceptance.
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { createRequire } = require('node:module')
const { createHash } = require('node:crypto')
const root = path.resolve(__dirname, '../..')
const app = createRequire(path.join(root, 'apps/web/package.json'))
const ts = app('typescript')
const resolve = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolve.call(
    this,
    request.startsWith('@/') ? path.join(root, 'apps/web/src', request.slice(2)) : request,
    ...args,
  )
}
require.extensions['.ts'] = (module, filename) =>
  module._compile(
    ts.transpileModule(
      (() => {
        let source = fs.readFileSync(filename, 'utf8')
        if (filename.endsWith('/map-renderer.ts')) {
          if (process.env.AUREVANE_PROBE_DIRECT_GROUND)
            source = source.replace(
              '    const cacheStationaryGround =',
              '    const cacheStationaryGround = false &&',
            )
          // Force native raster at the existing phase boundaries, equally in both arms.
          source = source.replaceAll(
            'const ended = performance.now()',
            'ctx.getImageData(0,0,canvas.width,canvas.height); const ended = performance.now()',
          )
        }
        return source
      })(),
      {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      },
    ).outputText,
    filename,
  )

const { createCanvas, Image, Path2D } = require(
  process.env.WORLD_SOURCE_REVIEW_CANVAS ||
    (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
      ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, '@napi-rs/canvas')
      : '@napi-rs/canvas'),
)
const nativeFallbacks = new WeakMap()
function probeCanvas(w, h) {
  const c = createCanvas(w, h),
    ctx = c.getContext('2d'),
    draw = ctx.drawImage.bind(ctx)
  ctx.drawImage = (image, ...args) => {
    const pending = nativeFallbacks.get(image)
    return draw(pending && !pending.ready ? pending.canvas : image, ...args)
  }
  return c
}
const oldLoad = Module._load
Module._load = function (name, ...args) {
  return name === 'server-only' ? {} : oldLoad.call(this, name, ...args)
}
const frames = new Map()
let next = 0
global.Path2D = Path2D
global.requestAnimationFrame = (cb) => {
  frames.set(++next, cb)
  return next
}
global.cancelAnimationFrame = (id) => frames.delete(id)
global.window = {
  devicePixelRatio: 1,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  addEventListener() {},
  removeEventListener() {},
}
global.document = {
  visibilityState: 'visible',
  createElement: () => probeCanvas(1, 1),
  addEventListener() {},
  removeEventListener() {},
}
global.ResizeObserver = class {
  constructor(cb) {
    this.cb = cb
  }
  observe() {
    this.cb()
  }
  disconnect() {}
}
global.OffscreenCanvas = class {
  constructor(w, h) {
    this.canvas = probeCanvas(w, h)
  }
  get width() {
    return this.canvas.width
  }
  set width(v) {
    this.canvas.width = v
  }
  get height() {
    return this.canvas.height
  }
  set height(v) {
    this.canvas.height = v
  }
  getContext() {
    return this.canvas.getContext('2d')
  }
  transferToImageBitmap() {
    const image = new Image()
    image.src = this.canvas.toBuffer('image/png')
    image.close = () => {}
    const fallback = probeCanvas(this.width, this.height)
    fallback
      .getContext('2d')
      .putImageData(this.canvas.getContext('2d').getImageData(0, 0, this.width, this.height), 0, 0)
    const state = { canvas: fallback, ready: false }
    nativeFallbacks.set(image, state)
    pending.push(
      image.decode().then(() => {
        state.ready = true
        fallback.width = fallback.height = 0
      }),
    )
    return image
  }
}
const loaded = []
const missed = []
const pending = []
global.Image = class extends Image {
  ready = false
  get complete() {
    return this.ready
  }
  set src(v) {
    this.ready = false
    this.url = v
    if (!v.startsWith('/media/')) {
      missed.push(v)
      return
    }
    const filename = path.resolve(root, 'apps/web/public', '.' + v)
    if (!filename.startsWith(path.join(root, 'apps/web/public') + path.sep))
      throw new Error('Invalid local image path')
    const previous = this.onload
    pending.push(
      new Promise((resolve, reject) => {
        this.onload = (...args) => {
          try {
            this.ready = true
            previous?.(...args)
            resolve()
          } catch (error) {
            reject(error)
          }
        }
        this.onerror = reject
        try {
          super.src = fs.readFileSync(filename)
          loaded.push(filename)
        } catch (error) {
          reject(error)
        }
      }),
    )
  }
  get src() {
    return this.url
  }
}
const { newWorldState } = require(root + '/apps/web/src/world/travel.ts')
const { projectWorld } = require(root + '/apps/web/src/server/world/world-service.ts')
const { createMapRenderer } = require(root + '/apps/web/src/components/world/map-renderer.ts')
const { WorldMotion } = require(root + '/apps/web/src/components/world/world-motion.ts')
const { atlasSectors } = require(root + '/apps/web/src/world/atlas.ts')
const { waterReviewCandidate } = require(root + '/apps/web/e2e/world-art-water.ts')
async function main() {
  const output = process.argv[2]
  if (!output)
    throw new Error(
      'Usage: node render-world-source-review.cjs <output-dir> [region|landmark-detail|town-dry-town] [zoom]',
    )
  const scene = process.argv[3] || 'verdant-expanse',
    zoom = Number(process.argv[4] || 1)
  if (!Number.isFinite(zoom) || zoom < 0.35 || zoom > 1.4)
    throw new Error('Zoom must be between0.35 and1.4')
  fs.mkdirSync(output, { recursive: true })

  const c = probeCanvas(904, 754)
  Object.assign(c, {
    clientWidth: 904,
    clientHeight: 754,
    dataset: {},
    style: {},
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 904, height: 754 }
    },
  })
  const state = newWorldState()
  if (scene === 'timing-route') state.position = { sectorId: 'atlas:59:28', x: 0, y: 4 }
  else if (scene.endsWith('-dry-town')) {
    const townId = scene.slice(0, -9)
    const sector = atlasSectors().find(
      (candidate) => candidate.townId === townId && candidate.rows.some((row) => row.includes('w')),
    )
    if (!sector) throw new Error('No saved former-lake town position for ' + townId)
    const y = sector.rows.findIndex((row) => row.includes('w'))
    state.position = { sectorId: sector.id, x: sector.rows[y].indexOf('w'), y }
  } else if (scene.endsWith('-detail')) {
    const { correctionScenes } = require(root + '/apps/web/e2e/world-map-correction-scenes.ts')
    const candidate = correctionScenes().discoveries.find((item) => item.id === scene.slice(0, -7))
    if (!candidate?.detailPosition) throw new Error('No legal detail viewpoint for ' + scene)
    state.position = candidate.detailPosition
  } else {
    const candidate = waterReviewCandidate(atlasSectors(), scene)
    if (!candidate) throw new Error('No public water viewpoint for ' + scene)
    state.position = { sectorId: candidate.sector.id, ...candidate.ground[0] }
  }
  const view = projectWorld(state, [], 1000)
  view.environment = { ...view.environment, minuteOfDay: 1120, weather: 'fog', frozen: true }
  const motion = new WorldMotion(view)
  const renderer = createMapRenderer(
    c,
    motion,
    view,
    () => {},
    () => {},
  )
  renderer.settings({
    animate: true,
    quality: 'balanced',
    zoom,
    paused: false,
    zoomLocked: false,
    showLocationLabels: true,
  })
  c.dataset.renderDiagnostics = 'timing'
  const phases = []
  const costs = []
  for (let n = 0; n < 24; n++) {
    await Promise.all(pending)
    if (n === 8) {
      motion.plan(
        [1, 2, 3].map((x) => ({
          position: { ...view.position, x: view.position.x + x },
          durationMs: 200,
        })),
        view.sectors,
        10400,
      )
      renderer.update(view)
    }
    global.gc?.()
    const before = pending.length
    const callbacks = [...frames.values()]
    frames.clear()
    const started = performance.now()
    for (const f of callbacks) f(10000 + n * 50)
    c.getContext('2d').getImageData(0, 0, c.width, c.height)
    if (n > 5) {
      costs.push(performance.now() - started)
      phases.push(JSON.parse(c.dataset.renderTiming))
    }
  }
  costs.sort((a, b) => a - b)
  await Promise.all(pending)
  const image = path.join(output, scene + '-' + zoom + '.png')
  fs.writeFileSync(image, c.toBuffer('image/png'))
  const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex')
  const report = {
    dataset: c.dataset,
    phases,
    arm: process.env.AUREVANE_PROBE_DIRECT_GROUND
      ? 'separate-sector-projections'
      : 'translated-consecutive-dry-run',
    medianPaintWithReadbackMs: costs[Math.floor(costs.length / 2)],
    p95PaintWithReadbackMs: costs[Math.floor(costs.length * 0.95)],
    scope:
      'Real source renderer/terrain/assets on native Skia with synchronous-pixel fallback during the immutable Image shim decode. Controlled3-step route; phase readback and GC outside measured frames. Not Web ImageBitmap, browser, auth, physical-device or frame-cadence acceptance.',
    scene,
    zoom,
    position: view.position,
    width: c.width,
    height: c.height,
    loaded: loaded.length,
    missed,
    imageHash: hash(image),
    sources: Object.fromEntries(
      [
        'apps/web/src/components/world/map-renderer.ts',
        'apps/web/src/components/world/map-water.ts',
        'apps/web/e2e/world-map-correction-scenes.ts',
      ].map((file) => [file, hash(path.join(root, file))]),
    ),
    assets: Object.fromEntries(
      [...new Set(loaded)].map((file) => [path.relative(root, file), hash(file)]),
    ),
  }
  fs.writeFileSync(
    path.join(output, scene + '-' + zoom + '.json'),
    JSON.stringify(report, null, 2) + '\n',
  )
  console.log(JSON.stringify({ image, ...report }, null, 2))
  renderer.dispose()
}
main().catch((e) => {
  console.error(e.stack)
  process.exitCode = 1
})
