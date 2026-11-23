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
  let fringePixelsRemoved = 0
  let packedFringePixelsRemoved = 0
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
      // Generated transparent masters can retain fully saturated RGB in
      // effectively invisible alpha (typically alpha 1). Resampling those
      // pixels produces red/yellow/blue matte blocks around the runtime art.
      // Normalize only the imperceptible tail before resizing; source masters
      // remain untouched and meaningful translucent foam/spray stays intact.
      if (data[p] <= 8) {
        if (data[p] > 0) fringePixelsRemoved++
        data[p - 3] = 0
        data[p - 2] = 0
        data[p - 1] = 0
        data[p] = 0
      }
    }
    if (
      opaque < info.width * info.height * 0.1 ||
      (inset && clear < info.width * info.height * 0.15)
    )
      throw new Error(`Invalid alpha ${name}:${i}`)
    const packed = await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .resize(size - inset * 2, size - inset * 2)
      .raw()
      .toBuffer({ resolveWithObject: true })
    for (let p = 0; p < packed.data.length; p += 4) {
      const alpha = packed.data[p + 3],
        brightest = Math.max(packed.data[p], packed.data[p + 1], packed.data[p + 2]),
        darkest = Math.min(packed.data[p], packed.data[p + 1], packed.data[p + 2])
      if (alpha <= 32 && brightest > 190 && brightest - darkest > 130) {
        packedFringePixelsRemoved++
        packed.data[p] = 0
        packed.data[p + 1] = 0
        packed.data[p + 2] = 0
        packed.data[p + 3] = 0
      }
    }
    composites.push({
      input: await sharp(packed.data, {
        raw: {
          width: packed.info.width,
          height: packed.info.height,
          channels: 4,
        },
      })
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
      fringePixelsRemoved,
      packedFringePixelsRemoved,
    }),
  )
}
