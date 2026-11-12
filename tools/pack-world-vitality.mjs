import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../apps/web/package.json', import.meta.url))
const sharp = require('sharp')
for (const [name, columns, rows, cellSize] of [
  ['regional-scenery', 4, 2, 384],
  ['regional-scenery-extra', 2, 2, 384],
  ['rare-scenery', 2, 2, 512],
]) {
  const source = new URL(
    `../apps/web/public/media/art/world/sources/${name}-v01.png`,
    import.meta.url,
  )
  const destination = new URL(
    `../apps/web/public/media/art/world/runtime/${name}-v01.webp`,
    import.meta.url,
  )
  const bytes = await readFile(source)
  const meta = await sharp(bytes).metadata()
  if (!meta.hasAlpha) throw new Error('Scenic source must preserve transparency.')
  const composites = []
  for (let i = 0; i < columns * rows; i++) {
    const col = i % columns,
      row = Math.floor(i / columns)
    const left = Math.round((meta.width * col) / columns),
      top = Math.round((meta.height * row) / rows)
    const width = Math.round((meta.width * (col + 1)) / columns) - left
    const height = Math.round((meta.height * (row + 1)) / rows) - top
    const cell = sharp(bytes).extract({ left, top, width, height })
    const { data, info } = await cell
      .clone()
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    let x0 = width,
      y0 = height,
      x1 = -1,
      y1 = -1,
      clear = 0,
      opaque = 0
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3]
        if (alpha === 0) clear++
        if (alpha > 240) opaque++
        if (alpha <= 20) continue
        x0 = Math.min(x0, x)
        y0 = Math.min(y0, y)
        x1 = Math.max(x1, x)
        y1 = Math.max(y1, y)
      }
    if (
      x1 < x0 ||
      clear < width * height * 0.15 ||
      opaque < width * height * 0.1 ||
      info.channels !== 4
    )
      throw new Error(`Invalid isolated alpha sprite ${i}`)
    const isolated = await cell.png().toBuffer()
    const sprite = await sharp(isolated)
      .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
      .resize({ width: cellSize - 32, height: cellSize - 48, fit: 'inside' })
      .png()
      .toBuffer({ resolveWithObject: true })
    composites.push({
      input: sprite.data,
      left: col * cellSize + Math.floor((cellSize - sprite.info.width) / 2),
      top: row * cellSize + cellSize - 24 - sprite.info.height,
    })
  }
  await sharp({
    create: {
      width: cellSize * columns,
      height: cellSize * rows,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .webp({ quality: 88, alphaQuality: 100 })
    .toFile(destination.pathname)
  const runtime = await readFile(destination)
  console.log(
    JSON.stringify({
      source: source.pathname,
      sourceSha256: createHash('sha256').update(bytes).digest('hex'),
      runtime: destination.pathname,
      runtimeSha256: createHash('sha256').update(runtime).digest('hex'),
      bytes: runtime.length,
      width: cellSize * columns,
      height: cellSize * rows,
      columns,
      rows,
    }),
  )
}
