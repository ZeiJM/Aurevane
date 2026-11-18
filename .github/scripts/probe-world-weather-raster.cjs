// Controlled native Skia component probe. This is not hosted Chromium acceptance.
// No app dependency is added: point AUREVANE_NATIVE_CANVAS_MODULE at an installed
// @napi-rs/canvas module and run node --expose-gc this-file.cjs.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createHash } = require('node:crypto')
const sourceHashes = {}
const { createRequire } = require('node:module')
const root = path.resolve(__dirname, '../..')
const appRequire = createRequire(path.join(root, 'apps/web/package.json'))
const ts = appRequire('typescript')
const { createCanvas, Image } = require(
  process.env.AUREVANE_NATIVE_CANVAS_MODULE || '@napi-rs/canvas',
)
let transfers = 0
let closes = 0
let decodes = []
// The native library has no Web OffscreenCanvas API. Decode the transferred PNG
// into an immutable native Image, awaiting native decode before measured paints. This
// models immutable pixels, not browser transfer cost or browser GPU behaviour.
class NativeOffscreen {
  constructor(width, height) {
    this.canvas = createCanvas(width, height)
  }
  get width() {
    return this.canvas.width
  }
  set width(value) {
    this.canvas.width = value
  }
  get height() {
    return this.canvas.height
  }
  set height(value) {
    this.canvas.height = value
  }
  getContext(kind) {
    return this.canvas.getContext(kind)
  }
  transferToImageBitmap() {
    const image = new Image()
    image.src = this.canvas.toBuffer('image/png')
    assert.ok(image.complete && image.width === this.width && image.height === this.height)
    image.close = () => {
      closes++
    }
    transfers++
    decodes.push(image.decode())
    return image
  }
}
function source(name) {
  const filename = path.join(root, 'apps/web/src/components/world', name)
  const input = fs.readFileSync(filename, 'utf8')
  sourceHashes[name] = createHash('sha256').update(input).digest('hex')
  const compiled = ts.transpileModule(input, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  // Only the exported weather/lighting painters run; other world imports are
  // unused by them. No alternate copy of either painter is benchmarked.
  vm.runInNewContext(
    compiled,
    {
      exports: module.exports,
      require: () => ({}),
      OffscreenCanvas: NativeOffscreen,
    },
    { filename },
  )
  return module.exports
}
const { paintWeatherVeil, createWeatherVeilCache } = source('map-weather.ts')
const { paintWorldLighting } = source('map-daylight.ts')
const width = 903,
  height = 752,
  minute = 116.65333333333334
function paint(context, offset, weather, cache, density = 1) {
  context.fillStyle = '#547568'
  context.fillRect(0, 0, width, height)
  paintWorldLighting(context, width, height, minute, weather)
  paintWeatherVeil(context, width, height, weather, offset, 1, cache, density)
}
async function benchmark(cached) {
  const canvas = createCanvas(width, height),
    context = canvas.getContext('2d')
  const cache = cached ? createWeatherVeilCache() : undefined
  const times = []
  paint(context, 0, 'fog', cache)
  await Promise.all(decodes.splice(0))
  for (let frame = 0; frame < 36; frame++) {
    cache?.beginFrame()
    const started = performance.now()
    paint(context, frame * 2, 'fog', cache)
    context.getImageData(0, 0, width, height) // Force full native raster in both arms.
    const elapsed = performance.now() - started
    if (frame > 0 && cache) assert.equal(cache.builds, 0)
    if (frame >= 6) times.push(elapsed)
    if (frame % 6 === 0) global.gc?.()
  }
  times.sort((a, b) => a - b)
  const pixels = cache?.pixels || 0
  cache?.clear()
  return {
    mode: cached ? 'immutable-composite' : 'direct-gradient',
    samples: times.length,
    medianMs: times[15],
    p95Ms: times[28],
    maxMs: times.at(-1),
    retainedPixels: pixels,
  }
}
async function main() {
  const measurements = []
  for (
    let repeat = 0;
    repeat < (process.env.AUREVANE_WEATHER_PROBE_PIXELS_ONLY ? 0 : 3);
    repeat++
  ) {
    measurements.push(
      { repeat, ...(await benchmark(false)) },
      { repeat, ...(await benchmark(true)) },
    )
    global.gc?.()
  }
  const pixels = []
  for (const weather of ['fog', 'overcast', 'storm'])
    for (const offset of [-2000, -100, 0, 100, 2000])
      for (const drift of [-63, 0, 63, 65]) {
        const a = createCanvas(width, height),
          b = createCanvas(width, height)
        const cache = createWeatherVeilCache()
        const movingOffset = offset + drift / (weather === 'fog' ? 0.17 : 0.38)
        paint(a.getContext('2d'), movingOffset, weather)
        paint(b.getContext('2d'), offset, weather, cache)
        await Promise.all(decodes.splice(0))
        paint(b.getContext('2d'), movingOffset, weather, cache)
        await Promise.all(decodes.splice(0))
        paint(b.getContext('2d'), movingOffset, weather, cache)
        const direct = a.getContext('2d').getImageData(0, 0, width, height).data
        const cached = b.getContext('2d').getImageData(0, 0, width, height).data
        let maximum = 0,
          changed = 0,
          total = 0
        for (let i = 0; i < direct.length; i++) {
          const difference = Math.abs(direct[i] - cached[i])
          maximum = Math.max(maximum, difference)
          changed += difference > 0 ? 1 : 0
          total += difference
        }
        pixels.push({
          weather,
          offset,
          drift,
          maxChannelDifference: maximum,
          changedChannels: changed,
          meanChannelDifference: total / direct.length,
        })
        cache.clear()
        global.gc?.()
      }
  assert.equal(transfers, closes)
  console.log(
    JSON.stringify(
      {
        backend: 'native Skia immutable decoded Image shim; not Web ImageBitmap',
        sourceHashes,
        width,
        height,
        density: 1,
        minute,
        measurements,
        pixels,
        transfers,
        closes,
        limitations:
          'Includes full readback; omits terrain, peers and browser compositor. No native acceptance or exact pixel identity claimed.',
      },
      null,
      2,
    ),
  )
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
