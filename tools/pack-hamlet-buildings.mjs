import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../apps/web/package.json', import.meta.url))
const sharp = require('sharp')
const source = process.argv[2]
if (!source) throw new Error('Pass the original transparent 2 x 2 hamlet atlas PNG.')
const output = process.argv[3]
  ? new URL(process.argv[3], `file://${process.cwd()}/`)
  : new URL('../apps/web/public/media/art/world/runtime/hamlet-buildings-v01.webp', import.meta.url)
const bytes = await readFile(source)
const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const halfWidth = Math.floor(info.width / 2),
  halfHeight = Math.floor(info.height / 2)
const composites = []
for (let i = 0; i < 4; i++) {
  const left = (i % 2) * halfWidth
  const top = Math.floor(i / 2) * halfHeight
  let x0 = halfWidth,
    y0 = halfHeight,
    x1 = -1,
    y1 = -1
  // Ignore near-transparent generation noise when locating the sprite bounds;
  // preserve the original alpha within the selected crop.
  for (let y = 0; y < halfHeight; y++) {
    for (let x = 0; x < halfWidth; x++) {
      if (data[((top + y) * info.width + left + x) * 4 + 3] <= 20) continue
      x0 = Math.min(x0, x)
      y0 = Math.min(y0, y)
      x1 = Math.max(x1, x)
      y1 = Math.max(y1, y)
    }
  }
  if (x1 < x0) throw new Error(`Empty quadrant ${i}`)
  const sprite = await sharp(bytes)
    .extract({ left: left + x0, top: top + y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .resize({ width: 360, height: 294, fit: 'inside' })
    .png()
    .toBuffer({ resolveWithObject: true })
  composites.push({
    input: sprite.data,
    left: (i % 2) * 384 + Math.floor((384 - sprite.info.width) / 2),
    top: Math.floor(i / 2) * 336 + 313 - sprite.info.height,
  })
}
await sharp({
  create: { width: 768, height: 672, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite(composites)
  .webp({ quality: 88, alphaQuality: 100 })
  .toFile(output.pathname)
const runtime = await readFile(output)
console.log(
  JSON.stringify({
    sourceSha256: createHash('sha256').update(bytes).digest('hex'),
    runtimeSha256: createHash('sha256').update(runtime).digest('hex'),
    bytes: runtime.length,
    width: 768,
    height: 672,
  }),
)
