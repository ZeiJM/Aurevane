import console from 'node:console'
import process from 'node:process'
import { URL } from 'node:url'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../apps/web/package.json', import.meta.url))
const sharp = require('sharp')
const names = [
  'highland-peaks',
  'highland-hills-pass',
  'alpine-peaks',
  'alpine-hills-pass',
  'void-peaks',
  'void-hills-pass',
]
const root = new URL('../content/art-requests/sources/mountains/', import.meta.url)
const defaultRuntime = new URL('../apps/web/public/media/art/world/runtime/', import.meta.url)
const runtime = process.argv[2]
  ? new URL(`${process.argv[2].replace(/\/$/, '')}/`, `file://${process.cwd()}/`)
  : defaultRuntime
await mkdir(runtime, { recursive: true })
const composites = [],
  sources = []
for (const [pair, name] of names.entries()) {
  const bytes = await readFile(new URL(`${name}.webp`, root))
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  // Generated matte noise must not make solid rock subtly translucent or
  // consume the HD budget with per-pixel near-opaque alpha variations.
  // Keep the genuine antialiased edge ramp between these two matte extremes.
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] >= 240) data[i] = 255
    else if (data[i] <= 20) data[i] = 0
  }
  if (info.width !== info.height * 2 || info.height < 768)
    throw new Error(`Insufficient native pair resolution: ${name}`)
  sources.push({
    name: `${name}.webp`,
    width: info.width,
    height: info.height,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  })
  for (let side = 0; side < 2; side++) {
    const cell = info.height
    let x0 = cell,
      y0 = cell,
      x1 = -1,
      y1 = -1
    // Match the established hamlet packer: ignore faint generation noise in
    // locating bounds, preserving source alpha within each selected crop.
    for (let y = 0; y < cell; y++)
      for (let x = 0; x < cell; x++) {
        if (data[(y * info.width + side * cell + x) * 4 + 3] <= 20) continue
        x0 = Math.min(x0, x)
        y0 = Math.min(y0, y)
        x1 = Math.max(x1, x)
        y1 = Math.max(y1, y)
      }
    if (x1 < x0) throw new Error(`Empty mountain: ${name}:${side}`)
    const sprite = await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .extract({ left: side * cell + x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
      .resize({ width: 736, height: 700, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer({ resolveWithObject: true })
    composites.push({
      input: sprite.data,
      left: ((pair % 2) * 2 + side) * 768 + Math.floor((768 - sprite.info.width) / 2),
      top: Math.floor(pair / 2) * 768 + 722 - sprite.info.height,
    })
  }
}
const master = await sharp({
  create: { width: 3072, height: 2304, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite(composites)
  .png()
  .toBuffer()
const outputs = []
for (const [name, width, height] of [
  ['mountains-v01.webp', 1536, 1152],
  ['mountains-hd-v01.webp', 3072, 2304],
]) {
  let packed
  let selectedQuality
  for (const quality of [88, 80, 72, 64, 56, 48, 40, 32, 24, 16, 8]) {
    const bytes = await sharp(master)
      .resize(width, height)
      .webp({ quality, alphaQuality: 100, effort: 4 })
      .toBuffer()
    console.log(`${name}: RGB quality ${quality}, ${bytes.length} bytes`)
    if (bytes.length < 500_000) {
      packed = bytes
      selectedQuality = quality
      break
    }
  }
  if (!packed) throw new Error(`Mountain atlas exceeds unchanged loading budget: ${name}`)
  await writeFile(new URL(name, runtime), packed)
  outputs.push({
    name,
    width,
    height,
    bytes: packed.length,
    quality: selectedQuality,
    alphaQuality: 100,
    sha256: createHash('sha256').update(packed).digest('hex'),
  })
}
const manifestUrl = new URL('mountains-v01.manifest.json', runtime)
const manifest = JSON.parse(
  await readFile(new URL('mountains-v01.manifest.json', defaultRuntime), 'utf8'),
)
manifest.origin = 'Original AI-assisted painterly art created for Aurevane; no third-party assets'
manifest.sources = sources
manifest.outputs = outputs
await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify({ sources, outputs }, null, 2))
