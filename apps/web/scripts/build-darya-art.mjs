import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const [, , manifestPath] = process.argv
assert(manifestPath, 'Pass a painted character art manifest.')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const poses = ['idle', 'left', 'right', 'cast']
const facings = ['south', 'east', 'north']
const moods = ['neutral', 'happy', 'angry', 'sad', 'surprised']
const blank = (width, height) => ({ create: { width, height, channels: 4, background: '#0000' } })
const webpUri = (bytes) => `data:image/webp;base64,${bytes.toString('base64')}`
const round = (value) => Number(value.toFixed(3))

async function cutout(source, region) {
  const { data, info } = await sharp(source)
    .extract(region)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let left = info.width
  let right = -1
  let top = info.height
  let bottom = -1
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] < 24) continue
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
    }
  }
  assert(right > left && bottom > top, 'Empty painted art cell')
  const width = right - left + 1
  const height = bottom - top + 1
  const bytes = await sharp(data, { raw: info })
    .extract({ left, top, width, height })
    .png()
    .toBuffer()
  return { bytes, left: region.left + left, top: region.top + top, width, height }
}

// Asta's olive cape separates from her copper-lit skin, chestnut hair and
// burgundy shirt by pigment. Restrict the matte to the fabric-bearing rows
// and feather the color thresholds so shading and woven edges survive dyes.
async function oliveCapeMatte(source, minY, maxY, portrait = false) {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const coverage = Buffer.alloc(data.length)
  const ramp = (n) => Math.max(0, Math.min(1, n))
  for (let y = Math.floor(minY * info.height); y < maxY * info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4
      const [red, green, blue, alpha] = data.subarray(i, i + 4)
      if (alpha < 12 || green < 10) continue
      const olives = ramp((green - 0.76 * red + 1.2) / 6.5)
      const chroma = ramp((green - blue - 4) / Math.max(6, green * 0.17))
      const nearClasp = portrait && ((x - 86) / 24) ** 2 + ((y - 203) / 22) ** 2 < 1
      const metal = nearClasp ? ramp((green - 98) / 32) * ramp((59 - red + blue) / 21) : 0
      const softness =
        ramp((y / info.height - minY) / 0.026) * ramp((maxY - y / info.height) / 0.036)
      coverage[i] = 255
      coverage[i + 1] = 255
      coverage[i + 2] = 255
      coverage[i + 3] = Math.round(alpha * olives * chroma * softness * (1 - metal))
    }
  }
  return webpUri(await sharp(coverage, { raw: info }).webp({ lossless: true }).toBuffer())
}

async function portrait(cell, [eyeX, eyeY], scale, fabric) {
  const width = Math.round(cell.width * scale)
  const height = Math.round(cell.height * scale)
  const left = Math.round(135 - (eyeX - cell.left) * scale)
  const top = Math.round(91 - (eyeY - cell.top) * scale)
  const x = Math.max(0, left)
  const y = Math.max(0, top)
  const visible = await sharp(cell.bytes).resize(width, height, { fit: 'fill' }).png().toBuffer()
  const frame = await sharp(visible)
    .extract({
      left: x - left,
      top: y - top,
      width: Math.min(width - (x - left), 256 - x),
      height: Math.min(height - (y - top), 256 - y),
    })
    .png()
    .toBuffer()
  const cutout = await sharp(blank(256, 256))
    .composite([{ input: frame, left: x, top: y }])
    .png()
    .toBuffer()
  const href = webpUri(await sharp(cutout).webp({ quality: 86, alphaQuality: 99 }).toBuffer())
  return fabric === 'olive-cape'
    ? { href, fabric: await oliveCapeMatte(cutout, 0.53, 1, true) }
    : href
}

async function sprite(cell, anchorX, scale, palm, material) {
  const width = round(cell.width * scale)
  const height = round(cell.height * scale)
  const centered = 24 - (anchorX - cell.left) * scale
  // Wide lunges and flowing hems can extend past the planted leg. Keep
  // the complete silhouette in the cell without scaling its anatomy.
  const x = round(Math.max(1, Math.min(47 - width, centered)))
  const y = round(58 - height)
  assert(x >= 0 && x + width <= 48 && y >= 1, 'Painted sprite overflows its frame')
  const fitted = await sharp(cell.bytes).resize({ height: 116 }).png().toBuffer()
  const bytes = await sharp(fitted).webp({ quality: 84, alphaQuality: 98 }).toBuffer()
  const focus = palm && [
    round(x + (palm[0] - cell.left) * scale),
    round(y + (palm[1] - cell.top) * scale),
  ]
  const fabric = material === 'olive-cape' ? await oliveCapeMatte(fitted, 0.21, 0.8) : undefined
  return {
    href: webpUri(bytes),
    x,
    y,
    width,
    height,
    ...(focus && { focus }),
    ...(fabric && { fabric }),
  }
}

async function passingSprites({ path, column, anchors, rows }) {
  const source = await readFile(path)
  const { width, height } = await sharp(source).metadata()
  const left = Math.round((width * column) / 2)
  const right = Math.round((width * (column + 1)) / 2)
  const frames = await Promise.all(
    anchors.map(async (anchor, row) => {
      const top = Math.round(height * rows[row])
      const cell = await cutout(source, {
        left,
        top,
        width: right - left,
        height: Math.round(height * rows[row + 1]) - top,
      })
      return sprite(cell, anchor, 52 / cell.height)
    }),
  )
  assert.equal(frames.length, facings.length)
  return { frames, digest: createHash('sha256').update(source).digest('hex') }
}

for (const item of manifest) {
  const { name, kind, path, rows, anchors } = item
  const darya = ['coils', 'low-pony'].includes(name)
  assert(/^[a-z]+(?:-[a-z]+)*$/.test(name) && ['portraits', 'sprites', 'actions'].includes(kind))
  const source = await readFile(path)
  const digest = createHash('sha256').update(source).digest('hex')
  const digests = [digest]
  const { width, height, hasAlpha } = await sharp(source).metadata()
  assert(hasAlpha, 'Painted art requires transparency')
  const columns = kind === 'sprites' ? 4 : 3
  const cells = await Promise.all(
    anchors.map((_, index) => {
      const row = Math.floor(index / columns)
      const column = index % columns
      const edges = item.columns?.[row]
      const left = Math.round(width * (edges?.[column] ?? column / columns))
      const top = Math.round(height * rows[row])
      return cutout(source, {
        left,
        top,
        width: Math.round(width * (edges?.[column + 1] ?? (column + 1) / columns)) - left,
        height: Math.round(height * rows[row + 1]) - top,
      })
    }),
  )
  let data
  if (kind === 'portraits') {
    assert.equal(cells.length, moods.length)
    data = Object.fromEntries(
      await Promise.all(
        cells.map(async (cell, i) => [
          moods[i],
          await portrait(cell, anchors[i], item.scale, item.fabric),
        ]),
      ),
    )
  } else {
    const framePoses =
      kind === 'actions'
        ? ['brace', 'attack', 'cast']
        : item.passing
          ? poses
          : ['idle', 'left', 'passing', 'right']
    assert.equal(cells.length, facings.length * framePoses.length)
    const scale = darya
      ? 53 / cells[0].height
      : Math.min(
          53 / Math.max(...cells.map((cell) => cell.height)),
          44 / Math.max(...cells.map((cell) => cell.width)),
        )
    const frames = await Promise.all(
      cells.map((cell, i) =>
        sprite(
          cell,
          anchors[i],
          scale,
          item.palms &&
            (item.poseRows?.[Math.floor(i / framePoses.length)] ?? framePoses)[
              i % framePoses.length
            ] === 'cast'
            ? item.palms[Math.floor(i / framePoses.length)]
            : undefined,
          item.fabric,
        ),
      ),
    )
    const passing = item.passing ? await passingSprites(item.passing) : null
    if (passing) digests.push(passing.digest)
    data = Object.fromEntries(
      facings.map((facing, row) => [
        facing,
        Object.fromEntries([
          ...(item.poseRows?.[row] ?? framePoses).map((pose, column) => [
            pose,
            frames[row * framePoses.length + column],
          ]),
          ...(passing ? [['passing', passing.frames[row]]] : []),
        ]),
      ]),
    )
  }
  const prefix = darya ? 'darya' : 'painted-study'
  const constant = `${prefix.toUpperCase().replace('-', '_')}_${name.toUpperCase().replace('-', '_')}_${kind.toUpperCase()}`
  const file = new URL(
    `../src/appearance/appearance-${prefix}-${name}-${kind}.generated.ts`,
    import.meta.url,
  )
  await writeFile(
    file,
    `// Generated by build-darya-art.mjs. Source sheet SHA-256:\n${digests.map((hash) => '// ' + hash).join('\n')}\nexport const ${constant} = ${JSON.stringify(data, null, 2)} as const\n`,
  )
}
