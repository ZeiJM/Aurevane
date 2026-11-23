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
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  )

const { createCanvas, Image, Path2D } = require(
  process.env.WORLD_SOURCE_REVIEW_CANVAS ||
    (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
      ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, '@napi-rs/canvas')
      : '@napi-rs/canvas'),
)
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
  matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  addEventListener() {},
  removeEventListener() {},
}
global.document = {
  visibilityState: 'visible',
  createElement: () => createCanvas(1, 1),
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
      'Usage: node render-world-source-review.cjs <output-dir> [region|landmark-detail|town-dry-town|town:region|sector:id:x:y] [zoom]',
    )
  const scene = process.argv[3] || 'verdant-expanse',
    zoom = Number(process.argv[4] || 1)
  if (!Number.isFinite(zoom) || zoom < 0.35 || zoom > 1.4)
    throw new Error('Zoom must be between0.35 and1.4')
  fs.mkdirSync(output, { recursive: true })

  const c = createCanvas(904, 754)
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
  if (scene.startsWith('town:') || scene.startsWith('sector:')) {
    const [, ...parts] = scene.split(':')
    const y = scene.startsWith('town:') ? 4 : Number(parts.pop())
    const x = scene.startsWith('town:') ? 6 : Number(parts.pop())
    const sectorId = parts.join(':')
    const sector = atlasSectors().find((candidate) => candidate.id === sectorId)
    const { isWalkable } = require(root + '/apps/web/src/world/travel.ts')
    if (!sector || !isWalkable(sector, { x, y }))
      throw new Error('No walkable viewpoint for ' + scene)
    state.position = { sectorId, x, y }
  } else if (scene.endsWith('-dry-town')) {
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
  view.environment = { ...view.environment, minuteOfDay: 720, weather: 'clear', frozen: true }
  const renderer = createMapRenderer(
    c,
    new WorldMotion(view),
    view,
    () => {},
    () => {},
  )
  renderer.settings({
    animate: false,
    quality: 'balanced',
    zoom,
    paused: false,
    zoomLocked: false,
    showLocationLabels: true,
  })
  for (let n = 0; n < 12; n++) {
    await Promise.all(pending)
    const before = pending.length
    const callbacks = [...frames.values()]
    frames.clear()
    for (const f of callbacks) f(performance.now() + n * 50)
    if (pending.length === before && !frames.size) break
  }
  await Promise.all(pending)
  const image = path.join(output, scene.replaceAll(':', '-') + '-' + zoom + '.png')
  fs.writeFileSync(image, c.toBuffer('image/png'))
  const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex')
  const report = {
    scope:
      'Real source renderer/assets on offline Skia Canvas2D; not native browser, auth, physical-device or timing acceptance',
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
    path.join(output, scene.replaceAll(':', '-') + '-' + zoom + '.json'),
    JSON.stringify(report, null, 2) + '\n',
  )
  console.log(JSON.stringify({ image, ...report }, null, 2))
  renderer.dispose()
}
main().catch((e) => {
  console.error(e.stack)
  process.exitCode = 1
})
