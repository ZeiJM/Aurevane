import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const [, , garmentSheet, accessorySheet, headwearSheet] = process.argv
if (!garmentSheet || !accessorySheet || !headwearSheet) {
  throw new Error('Provide the four-facing garment, accessory and headwear sheets.')
}

async function cutout(sheet, region) {
  const { data, info } = await sheet
    .clone()
    .extract(region)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const visited = new Uint8Array(width * height)
  let largest = []
  for (let pixel = 0; pixel < visited.length; pixel++) {
    if (visited[pixel] || data[pixel * 4 + 3] < 4) continue
    const cluster = [pixel]
    visited[pixel] = 1
    for (let index = 0; index < cluster.length; index++) {
      const at = cluster[index]
      const column = at % width
      for (const next of [
        column ? at - 1 : -1,
        column + 1 < width ? at + 1 : -1,
        at - width,
        at + width,
      ]) {
        if (next < 0 || next >= visited.length || visited[next] || data[next * 4 + 3] < 4) continue
        visited[next] = 1
        cluster.push(next)
      }
    }
    if (cluster.length > largest.length) largest = cluster
  }
  const clean = Buffer.alloc(data.length)
  for (const pixel of largest) data.copy(clean, pixel * 4, pixel * 4, pixel * 4 + 4)
  return sharp(clean, { raw: { width, height, channels: 4 } }).trim({
    background: '#00000000',
    threshold: 8,
  })
}

async function buildLayers(path, rows) {
  const sheet = sharp(path)
  const { width, height } = await sheet.metadata()
  const result = {}
  for (const [row, [id, top, frontWidth, sideWidth, maxHeight]] of rows.entries()) {
    const inputs = []
    for (let column = 0; column < 4; column++) {
      const left = Math.floor((column * width) / 4)
      const y = Math.floor((row * height) / 4)
      const region = {
        left,
        top: y,
        width: Math.floor(((column + 1) * width) / 4) - left,
        height: Math.floor(((row + 1) * height) / 4) - y,
      }
      const { data, info } = await (
        await cutout(sheet, region)
      )
        .resize(column % 2 ? sideWidth : frontWidth, maxHeight, { fit: 'inside' })
        .png()
        .toBuffer({ resolveWithObject: true })
      inputs.push({ input: data, left: column * 128 + Math.floor((128 - info.width) / 2), top })
    }
    const strip = await sharp({
      create: { width: 512, height: 176, channels: 4, background: '#00000000' },
    })
      .composite(inputs)
      .png({ palette: true, compressionLevel: 9 })
      .toBuffer()
    result[id] = `data:image/png;base64,${strip.toString('base64')}`
  }
  return result
}

const outerwear = await buildLayers(garmentSheet, [
  ['brigandine', 46, 77, 54, 56],
  ['brocade', 45, 77, 54, 65],
  ['hooded', 22, 70, 51, 98],
  ['quilted', 46, 75, 50, 70],
])
const gear = await buildLayers(accessorySheet, [
  ['journal', 89, 54, 40, 45],
  ['rope', 89, 55, 44, 48],
  ['sword', 87, 71, 49, 50],
  ['girdle', 89, 54, 43, 46],
])
const headwearSource = sharp(headwearSheet)
const { width, height } = await headwearSource.metadata()
const headwear = {}
for (const [row, id] of ['furcap', 'circlet', 'veil', 'mask'].entries()) {
  headwear[id] = {}
  for (const [column, facing] of ['south', 'east', 'north', 'west'].entries()) {
    const left = Math.floor((column * width) / 4)
    const top = Math.floor((row * height) / 4)
    const source = await cutout(headwearSource, {
      left,
      top,
      width: Math.floor(((column + 1) * width) / 4) - left,
      height: Math.floor(((row + 1) * height) / 4) - top,
    })
    const data = await source
      .resize(184, 160, { fit: 'inside' })
      .png({ palette: true, compressionLevel: 9 })
      .toBuffer()
    headwear[id][facing] = `data:image/png;base64,${data.toString('base64')}`
  }
}
await writeFile(
  new URL('../src/appearance/appearance-painted-wardrobe.generated.ts', import.meta.url),
  '// Original Aurevane garment and accessory strips. Four facings at 128 × 176.\n' +
    `export const WARDROBE_OUTER_LAYERS = ${JSON.stringify(outerwear, null, 2)} as const\n\n` +
    `export const WARDROBE_GEAR_LAYERS = ${JSON.stringify(gear, null, 2)} as const\n\n` +
    `export const WARDROBE_HEAD_LAYERS = ${JSON.stringify(headwear, null, 2)} as const\n`,
)
