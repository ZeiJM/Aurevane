import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../apps/web/package.json', import.meta.url))
const sharp = require('sharp')
for (const [name, columns, rows, size, inset] of [
  ['settlement-floors', 4, 3, 384, 0],
  ['grand-bridges', 3, 1, 512, 16],
  ['waterfalls', 3, 1, 512, 16],
  ['lavafalls', 2, 1, 512, 16],
  ['impact-basins', 3, 1, 512, 16],
]) {
  const source = new URL(
    `../apps/web/public/media/art/world/sources/${name}-v01.png`,
    import.meta.url,
  )
  const output = new URL(
    `../apps/web/public/media/art/world/runtime/${name}-v01.webp`,
    import.meta.url,
  )
  const bytes = await readFile(source),
    meta = await sharp(bytes).metadata(),
    composites = []
  if (inset && !meta.hasAlpha) throw new Error(`${name} requires true transparency`)
  for (let i = 0; i < columns * rows; i++) {
    const col = i % columns,
      row = Math.floor(i / columns),
      left = Math.round((meta.width * col) / columns),
      top = Math.round((meta.height * row) / rows)
    const width = Math.round((meta.width * (col + 1)) / columns) - left,
      height = Math.round((meta.height * (row + 1)) / rows) - top
    const cell = sharp(bytes).extract({ left, top, width, height })
    const { data, info } = await cell
      .clone()
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    let clear = 0,
      opaque = 0
    for (let p = 3; p < data.length; p += 4) {
      if (data[p] === 0) clear++
      if (data[p] > 240) opaque++
    }
    if (
      opaque < info.width * info.height * 0.1 ||
      (inset && clear < info.width * info.height * 0.15)
    )
      throw new Error(`Invalid alpha ${name}:${i}`)
    composites.push({
      input: await cell
        .resize(size - inset * 2, size - inset * 2)
        .png()
        .toBuffer(),
      left: col * size + inset,
      top: row * size + inset,
    })
  }
  await sharp({
    create: {
      width: columns * size,
      height: rows * size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: inset ? 0 : 1 },
    },
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
      width: columns * size,
      height: rows * size,
      columns,
      rows,
      inset,
    }),
  )
}
