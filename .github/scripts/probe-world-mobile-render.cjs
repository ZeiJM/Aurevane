// Exact-source native Skia diagnosis for a retained disposable mobile fixture.
// This does not replace hosted Chromium/CPU-throttle acceptance.
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const { execFileSync } = require('node:child_process')
const { createRequire } = require('node:module')
const { performance } = require('node:perf_hooks')
const { createHash } = require('node:crypto')
const root = path.resolve(__dirname, '../..')
const appRequire = createRequire(path.join(root, 'apps/web/package.json'))
const ts = appRequire('typescript')
const native = require(process.env.AUREVANE_NATIVE_CANVAS_MODULE || '@napi-rs/canvas')
const input = process.argv[2]
if (!input) throw new Error('Pass a downloaded World timing artifact ZIP.')
const outerEntries = execFileSync('unzip', ['-Z1', input], { encoding: 'utf8' }).split('\n')
const traceEntry = outerEntries.find((name) => name.endsWith('/trace.zip'))
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'world-native-probe-'))
const tracePath = path.join(temporary, 'trace.zip')
fs.writeFileSync(tracePath, execFileSync('unzip', ['-p', input, traceEntry], { maxBuffer: 150e6 }))
function readTrace(entry) {
  return execFileSync('unzip', ['-p', tracePath, entry], { maxBuffer: 20e6 })
}
const network = readTrace('0-trace.network').toString().split('\n').filter(Boolean).map(JSON.parse)
const snapshot = network
  .map((row) => row.snapshot)
  .find(
    (row) =>
      new URL(row.request.url).pathname === '/api/world' && row.response.content.size > 500000,
  )
const view = JSON.parse(readTrace(`resources/${snapshot.response.content._sha1}`))
view.characterId = 'native-probe-owner'
view.players = []
view.npcs = []
const pending = []
const placeholder = native.createCanvas(400, 400)
placeholder.getContext('2d').fillRect(0, 0, 400, 400)
const portraitBytes = placeholder.toBuffer('image/png')
let measured = false
const imageCosts = {}
const decodingSnapshots = new WeakMap()
let transfers = 0
let closes = 0
function NativeImage() {
  const image = new native.Image()
  const descriptor = Object.getOwnPropertyDescriptor(native.Image.prototype, 'src')
  let source = ''
  Object.defineProperty(image, 'src', {
    get: () => source,
    set: (value) => {
      source = value
      const filename = path.join(root, 'apps/web/public', value)
      descriptor.set.call(
        image,
        fs.existsSync(filename) ? fs.readFileSync(filename) : portraitBytes,
      )
      pending.push(image.decode().then(() => image.onload?.()))
    },
  })
  return image
}
function canvas(width = 300, height = 150) {
  const layer = native.createCanvas(width, height)
  const context = layer.getContext('2d')
  const draw = context.drawImage.bind(context)
  context.drawImage = (image, ...args) => {
    const decoding = decodingSnapshots.get(image)
    if (decoding && !decoding.ready) image = decoding.fallback
    const start = performance.now()
    draw(image, ...args)
    if (!measured) return
    const source =
      typeof image.src === 'string' ? image.src : `canvas:${image.width}x${image.height}`
    const row = (imageCosts[source] ??= { calls: 0, elapsed: 0, destination: args.slice(-4) })
    row.calls++
    row.elapsed += performance.now() - start
    const m = context.getTransform()
    const [x, y, width, height] =
      args.length === 2 ? [...args, image.width, image.height] : args.slice(-4)
    const corners = [
      [x, y],
      [x + width, y],
      [x, y + height],
      [x + width, y + height],
    ].map(([x, y]) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }))
    const outside =
      Math.max(...corners.map((p) => p.x)) < 0 ||
      Math.min(...corners.map((p) => p.x)) > layer.width ||
      Math.max(...corners.map((p) => p.y)) < 0 ||
      Math.min(...corners.map((p) => p.y)) > layer.height
    row.outside = (row.outside ?? 0) + Number(outside)
  }
  layer.style = {}
  layer.dataset = {}
  layer.addEventListener = layer.removeEventListener = () => {}
  return layer
}
class Offscreen {
  constructor(width, height) {
    return Object.assign(canvas(width, height), {
      transferToImageBitmap() {
        const image = new native.Image()
        image.src = this.toBuffer('image/png')
        transfers++
        image.close = () => {
          closes++
        }
        // Web transfer is synchronous; this native PNG shim decodes asynchronously.
        // Retain exact raw pixels for same-frame composition until decode completes.
        const fallback = native.createCanvas(this.width, this.height)
        fallback
          .getContext('2d')
          .putImageData(this.getContext('2d').getImageData(0, 0, this.width, this.height), 0, 0)
        const decoding = { fallback, ready: false }
        decodingSnapshots.set(image, decoding)
        pending.push(
          image.decode().then(() => {
            decoding.ready = true
          }),
        )
        return image
      },
    })
  }
}
const frames = new Map()
let frameId = 0
let visualNow = 0
const sandbox = {
  console,
  Math,
  Date,
  Map,
  Set,
  WeakMap,
  WeakSet,
  JSON,
  Uint8ClampedArray,
  Path2D: native.Path2D,
  performance: process.env.AUREVANE_PROBE_FIXED_TIME ? { now: () => visualNow } : performance,
  Image: NativeImage,
  OffscreenCanvas: Offscreen,
  setTimeout,
  clearTimeout,
  localStorage: { getItem: () => null },
  window: {
    devicePixelRatio: 2.625,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {},
    removeEventListener() {},
  },
  document: {
    visibilityState: 'visible',
    createElement: () => canvas(),
    addEventListener() {},
    removeEventListener() {},
  },
  ResizeObserver: class {
    observe() {}
    disconnect() {}
  },
  requestAnimationFrame: (callback) => {
    frames.set(++frameId, callback)
    return frameId
  },
  cancelAnimationFrame: (id) => frames.delete(id),
}
const modules = new Map()
const hashes = {}
const functionCosts = {}
function load(filename) {
  if (modules.has(filename)) return modules.get(filename).exports
  if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'))
  const text = process.env.AUREVANE_PROBE_SOURCE_REF
    ? execFileSync(
        'git',
        ['show', `${process.env.AUREVANE_PROBE_SOURCE_REF}:${path.relative(root, filename)}`],
        { cwd: root, encoding: 'utf8', maxBuffer: 2e6 },
      )
    : fs.readFileSync(filename, 'utf8')
  hashes[path.relative(root, filename)] = createHash('sha256').update(text).digest('hex')
  const compiled = ts.transpileModule(text, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  const module = { exports: {} }
  modules.set(filename, module)
  function resolve(name) {
    if (name === 'server-only') return {}
    let base = name.startsWith('@/')
      ? path.join(root, 'apps/web/src', name.slice(2))
      : name.startsWith('.')
        ? path.resolve(path.dirname(filename), name)
        : name.startsWith('@aurevane/')
          ? path.join(
              root,
              'packages',
              name.slice(10).split('/')[0],
              'src',
              ...name.slice(10).split('/').slice(1),
            )
          : null
    if (!base) return appRequire(name)
    const resolved = [base, `${base}.ts`, `${base}.json`, path.join(base, 'index.ts')].find(
      (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
    )
    if (!resolved) throw new Error(`Cannot resolve ${name} from ${filename}`)
    return load(resolved)
  }
  let code = compiled
  if (filename.endsWith('/map-renderer.ts') && process.env.AUREVANE_PROBE_FLUSH_STAGES) {
    code = code.replaceAll(
      'const ended = performance.now();',
      'ctx.getImageData(0, 0, canvas.width, canvas.height); const ended = performance.now();',
    )
  }
  vm.runInNewContext(code, { ...sandbox, exports: module.exports, require: resolve }, { filename })
  for (const name of [
    'paintWaterMotion',
    'paintLavaMotion',
    'paintOpenSea',
    'paintCoastSea',
    'drawWildlife',
    'paintWorldLighting',
    'paintWeatherVeil',
  ]) {
    const original = module.exports[name]
    if (typeof original !== 'function') continue
    module.exports[name] = (...args) => {
      const start = performance.now()
      const value = original(...args)
      const key =
        name === 'paintWaterMotion' ? `${name}:${args[1]?.channel ? 'channel' : 'pool'}` : name
      const row = (functionCosts[key] ??= { calls: 0, elapsed: 0 })
      row.calls++
      row.elapsed += performance.now() - start
      return value
    }
  }
  return module.exports
}
async function settle() {
  while (pending.length) await Promise.all(pending.splice(0))
}
async function main() {
  const { createMapRenderer } = load(
    path.join(root, 'apps/web/src/components/world/map-renderer.ts'),
  )
  const { WorldMotion } = load(path.join(root, 'apps/web/src/components/world/world-motion.ts'))
  const { mapPoint } = load(path.join(root, 'apps/web/src/components/world/world-motion.ts'))
  const { sectorMapOrigin } = load(path.join(root, 'apps/web/src/world/topology.ts'))
  const { projectMapPoint } = load(
    path.join(root, 'apps/web/src/components/world/map-projection.ts'),
  )
  const camera = mapPoint(view.position, view.sectors)
  const occupied = new Set([`${camera.x}:${camera.y}`])
  const positions = view.sectors
    .flatMap((sector) => {
      const origin = sectorMapOrigin(sector, camera.x)
      return sector.cells
        .filter((cell) => cell.walkable)
        .flatMap(({ x, y }) => {
          const world = { x: origin.x + x + 0.5, y: origin.y + y + 0.5 }
          const key = `${world.x}:${world.y}`
          const point = projectMapPoint(world, camera, { x: 0, y: 0 }, 16.8, 389, 669)
          if (
            occupied.has(key) ||
            point.x <= 20 ||
            point.x >= 369 ||
            point.y <= 40 ||
            point.y >= 647
          )
            return []
          occupied.add(key)
          return [{ sectorId: sector.id, x, y }]
        })
    })
    .slice(0, 100)
  if (positions.length !== 100)
    throw new Error('Fixture does not supply100 distinct visible positions.')
  view.players = positions.map((position, index) => ({
    characterId: `native-probe-${index}`,
    name: `Traveller ${index + 1}`,
    level: 10,
    portraitRef: '',
    imageUrl: `/api/probe-${index}`,
    online: true,
    attackable: false,
    position,
  }))
  const stage = canvas(),
    identity = canvas()
  Object.assign(stage, {
    clientWidth: 389,
    clientHeight: 669,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  })
  const renderer = createMapRenderer(
    stage,
    new WorldMotion(view),
    view,
    () => {},
    () => {},
    () => {},
    () => {},
    () => {},
    identity,
  )
  renderer.settings({ animate: true, zoom: 0.35 })
  stage.dataset.renderDiagnostics = 'timing'
  await settle()
  const costs = []
  for (let frame = 0; frame < 60; frame++) {
    measured = frame >= 10
    visualNow = 10000 + frame * 50
    const callbacks = [...frames.values()]
    frames.clear()
    const start = performance.now()
    for (const callback of callbacks)
      callback(process.env.AUREVANE_PROBE_FIXED_TIME ? visualNow : performance.now() + frame * 50)
    stage.getContext('2d').getImageData(0, 0, stage.width, stage.height)
    identity.getContext('2d').getImageData(0, 0, identity.width, identity.height)
    await settle()
    if (frame >= 10)
      costs.push({ elapsed: performance.now() - start, ...JSON.parse(stage.dataset.renderTiming) })
  }
  const summary = {}
  for (const key of [
    'elapsed',
    'prepareMs',
    'terrainMs',
    'sceneryMs',
    'atmosphereMs',
    'identityMs',
  ]) {
    const rows = costs.map((row) => row[key]).sort((a, b) => a - b)
    summary[key] = {
      median: rows[Math.floor(rows.length / 2)],
      p95: rows[Math.floor(rows.length * 0.95)],
    }
  }
  if (process.env.AUREVANE_PROBE_IMAGE)
    fs.writeFileSync(process.env.AUREVANE_PROBE_IMAGE, stage.toBuffer('image/png'))
  renderer.dispose()
  if (transfers !== closes)
    throw new Error(`Unclosed native snapshot model: ${closes}/${transfers}`)
  console.log(
    JSON.stringify(
      {
        backend: 'native Skia; no browser compositor or CPU throttle',
        sourceHashes: hashes,
        functionCosts,
        imageCosts,
        environment: view.environment,
        position: view.position,
        canvas: [stage.width, stage.height],
        transfers,
        closes,
        summary,
        final: costs.at(-1),
      },
      null,
      2,
    ),
  )
}
main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    fs.rmSync(temporary, { recursive: true, force: true })
  })
