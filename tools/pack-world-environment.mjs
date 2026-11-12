import { createHash } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../apps/web/package.json', import.meta.url))
const sharp = require('sharp')
const root = new URL('../apps/web/public/media/art/world/', import.meta.url)
await mkdir(new URL('sources/', root), { recursive: true })
const specifications = [
  ['ground', 4, 2, 1024, 512, 'regional-ground-v02.webp'],
  ['trees', 4, 2, 1536, 1024, 'living-trees-v01.webp'],
  ['water', 2, 2, 768, 768, 'water-materials-v01.webp'],
  ['void', 3, 2, 768, 512, 'void-ground-v01.webp'],
]
for (const [i, [name, columns, rows, width, height, file]] of specifications.entries()) {
  const path = process.argv[i + 2]
  if (!path)
    throw new Error('Pass original ground, transparent trees, water and Void master paths.')
  const bytes = await readFile(path)
  const metadata = await sharp(bytes).metadata()
  if (name === 'trees' && !metadata.hasAlpha) throw new Error('Tree source must preserve alpha.')
  const cellWidth = width / columns,
    cellHeight = height / rows,
    composites = []
  for (let cell = 0; cell < columns * rows; cell++) {
    const column = cell % columns,
      row = Math.floor(cell / columns),
      left = Math.round((metadata.width * column) / columns),
      top = Math.round((metadata.height * row) / rows),
      sourceWidth = Math.round((metadata.width * (column + 1)) / columns) - left,
      sourceHeight = Math.round((metadata.height * (row + 1)) / rows) - top
    let sprite = sharp(bytes).extract({ left, top, width: sourceWidth, height: sourceHeight })
    let offsetX = 0,
      offsetY = 0
    if (name === 'trees') {
      const { data, info } = await sprite
        .clone()
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      let x0 = info.width,
        y0 = info.height,
        x1 = -1,
        y1 = -1
      for (let y = 0; y < info.height; y++)
        for (let x = 0; x < info.width; x++) {
          if (data[(y * info.width + x) * 4 + 3] <= 20) continue
          x0 = Math.min(x0, x)
          y0 = Math.min(y0, y)
          x1 = Math.max(x1, x)
          y1 = Math.max(y1, y)
        }
      if (x1 < x0) throw new Error(`Empty tree ${cell}`)
      // Normalize complete source sprites into consistent padded cells. Retain alpha.
      sprite = sharp(await sprite.png().toBuffer())
        .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
        .resize({ width: cellWidth - 32, height: cellHeight - 64, fit: 'inside' })
      const packed = await sprite.png().toBuffer({ resolveWithObject: true })
      offsetX = Math.floor((cellWidth - packed.info.width) / 2)
      offsetY = cellHeight - 24 - packed.info.height
      composites.push({
        input: packed.data,
        left: column * cellWidth + offsetX,
        top: row * cellHeight + offsetY,
      })
    } else {
      composites.push({
        input: await sprite.resize(cellWidth, cellHeight).png().toBuffer(),
        left: column * cellWidth,
        top: row * cellHeight,
      })
    }
  }
  const output = new URL(`runtime/${file}`, root)
  await sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .webp({ quality: 88, alphaQuality: 100 })
    .toFile(output.pathname)
  const runtime = await readFile(output)
  console.log(
    JSON.stringify({
      name,
      sourceSha256: createHash('sha256').update(bytes).digest('hex'),
      runtimeSha256: createHash('sha256').update(runtime).digest('hex'),
      bytes: runtime.length,
      width,
      height,
    }),
  )
}
