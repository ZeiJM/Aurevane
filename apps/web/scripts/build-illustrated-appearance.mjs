import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

import { FITTED_ACCESSORY_ART } from '../src/appearance/appearance-fitted-accessories.generated.ts'
import { FITTED_ART_SOURCE } from '../src/appearance/appearance-fitted-source.generated.ts'
import { LANDSCAPE_PAINTINGS } from '../src/appearance/appearance-landscape-paintings.generated.ts'
import { PAINTED_SPRITE_HEADS } from '../src/appearance/appearance-painted-sprite-heads.generated.ts'
import { PAINTED_SPRITE_OUTFITS } from '../src/appearance/appearance-painted-sprite-outfits.generated.ts'
import { PAINTED_SPRITE_PARTS } from '../src/appearance/appearance-painted-sprite-parts.generated.ts'
import { PATTERN_PAINTINGS } from '../src/appearance/appearance-pattern-paintings.generated.ts'

const [, , input] = process.argv
assert(input, 'Pass an asset sheet manifest with paths, registrations and ordered slot IDs.')
const sheets = JSON.parse(await readFile(input, 'utf8'))
const source = { ...FITTED_ART_SOURCE }
const accessories = { ...FITTED_ACCESSORY_ART }
const heads = { ...PAINTED_SPRITE_HEADS }
const parts = { ...PAINTED_SPRITE_PARTS }
const outfits = { ...PAINTED_SPRITE_OUTFITS }
const patterns = { ...PATTERN_PAINTINGS }
const landscapes = { ...LANDSCAPE_PAINTINGS }
const digests = []
const outfitDigests = []

// Displacement maps sample the same painting in a different pose. Keep the
// effects local to facial features so hair, costume, and head outline stay fixed.
const expressionPatches = {
  happy: [
    [113, 134, 7, 7, 2, 6],
    [143, 134, 7, 7, -2, 6],
    [128, 144, 11, 7, 0, -5],
    [105, 103, 10, 4, 0, 2.5],
    [151, 103, 10, 4, 0, 2.5],
  ],
  angry: [
    [114, 89, 8, 6, -3, -6],
    [142, 89, 8, 6, 3, -6],
    [96, 84, 9, 5, 0, 3],
    [160, 84, 9, 5, 0, 3],
    [106, 98, 10, 4, 0, -2],
    [150, 98, 10, 4, 0, -2],
    [111, 137, 6, 5, -1, -2],
    [145, 137, 6, 5, 1, -2],
  ],
  sad: [
    [114, 82, 8, 5, -1, 5],
    [142, 82, 8, 5, 1, 5],
    [112, 141, 6, 6, 0, -5],
    [144, 141, 6, 6, 0, -5],
    [128, 138, 9, 5, 0, 2],
  ],
  surprised: [
    [106, 81, 14, 7, 0, 5],
    [150, 81, 14, 7, 0, 5],
    [105, 94, 11, 4, 0, 3],
    [151, 94, 11, 4, 0, 3],
    [105, 103, 10, 4, 0, -2],
    [151, 103, 10, 4, 0, -2],
    [116, 138, 7, 7, -4, 0],
    [140, 138, 7, 7, 4, 0],
    [128, 146, 10, 7, 0, -7],
    [128, 134, 10, 4, 0, 2.5],
  ],
}

async function faceDisplacementMap(patches) {
  const size = 128
  const pixels = Buffer.alloc(size * size * 3, 128)
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      let xShift = 0
      let yShift = 0
      for (const [x, y, w, h, dx, dy] of patches) {
        const influence = Math.exp(-0.5 * (((column * 2 - x) / w) ** 2 + ((row * 2 - y) / h) ** 2))
        xShift += dx * influence
        yShift += dy * influence
      }
      const offset = (row * size + column) * 3
      pixels[offset] = Math.max(0, Math.min(255, Math.round(127.5 + (xShift * 255) / 18)))
      pixels[offset + 1] = Math.max(0, Math.min(255, Math.round(127.5 + (yShift * 255) / 18)))
    }
  }
  const png = await sharp(pixels, { raw: { width: size, height: size, channels: 3 } })
    .png()
    .toBuffer()
  return `data:image/png;base64,${png.toString('base64')}`
}

function foreground(data, width, height) {
  let left = width
  let top = height
  let right = 0
  let bottom = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4
      const [red, green, blue, alpha] = data.subarray(offset, offset + 4)
      // The source sheets use saturated flat colors as transparency-key guides.
      if (alpha < 105 || (red > 200 && blue < 55 && (green < 48 || green > 194))) {
        data.fill(0, offset, offset + 4)
        continue
      }
      if (alpha < 160) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }
  assert(right > left && bottom > top, 'Empty art cell')
  return { left, top, width: right - left + 1, height: bottom - top + 1 }
}

function clearDetachedHairSpeckles(data, width, height) {
  const pixels = width * height
  const visited = new Uint8Array(pixels)
  const components = []
  for (let origin = 0; origin < pixels; origin++) {
    if (visited[origin] || data[origin * 4 + 3] === 0) continue
    visited[origin] = 1
    const component = [origin]
    for (let index = 0; index < component.length; index++) {
      const pixel = component[index]
      const x = pixel % width
      const y = Math.floor(pixel / width)
      for (let row = Math.max(0, y - 1); row <= Math.min(height - 1, y + 1); row++) {
        for (let col = Math.max(0, x - 1); col <= Math.min(width - 1, x + 1); col++) {
          const neighbor = row * width + col
          if (visited[neighbor] || data[neighbor * 4 + 3] === 0) continue
          visited[neighbor] = 1
          component.push(neighbor)
        }
      }
    }
    components.push(component)
  }
  // A hair sheet can contain dots and short cutout fragments from adjacent
  // cells. They must not participate in the silhouette or its fitting guides.
  const largest = components.reduce((size, component) => Math.max(size, component.length), 0)
  for (const component of components)
    if (component.length < largest * 0.014)
      for (const pixel of component) data.fill(0, pixel * 4, pixel * 4 + 4)
}

function hairOpening(data, width, bounds) {
  let consecutive = 0
  for (let y = bounds.top + 8; y < bounds.top + bounds.height * 0.72; y++) {
    let empty = 0
    for (let index = 0; index < 11; index++) {
      const x = bounds.left + Math.round(bounds.width * (0.39 + index * 0.022))
      if (data[(y * width + x) * 4 + 3] < 125) empty++
    }
    consecutive = empty >= 8 ? consecutive + 1 : 0
    if (consecutive === 4 && y > bounds.top + bounds.height * 0.13) return y - 3 - bounds.top
  }
  return bounds.height * 0.34
}

function registration(sheet, slot, data, width, bounds, region) {
  const { height, left, top, width: assetWidth } = bounds
  const sample = (x, y) =>
    [...data.subarray(((top + Math.round(y)) * width + left + Math.round(x)) * 4)].slice(0, 3)
  const measured = slot.guides && {
    left: slot.guides[0] * assetWidth,
    right: slot.guides[1] * assetWidth,
    top: slot.guides[2] * height,
    bottom: slot.guides[3] * height,
  }
  if (sheet.kind === 'face') {
    const face = slot.face
    const featureX = (x) => (x - region.left - left) / assetWidth
    const featureY = (y) => (y - region.top - top) / height
    const calibrated = face && {
      left: face.eyes[0] - region.left - left,
      right: face.eyes[1] - region.left - left,
      top: face.eyes[2] - region.top - top,
      bottom: face.chin - region.top - top,
    }
    return {
      anchors: calibrated ??
        measured ?? {
          left: assetWidth * 0.3,
          right: assetWidth * 0.7,
          top: height * 0.445,
          bottom: height * 0.865,
        },
      neckPigments: [
        sample(assetWidth * 0.58, height * 0.92),
        sample(assetWidth * 0.45, height * 0.92),
      ],
      ...(face && {
        facialGuides: {
          center: featureX(face.mouth[0]),
          nose: featureY(face.nose),
          lip: featureY(face.mouth[1]),
        },
      }),
    }
  }
  const facingHair = sheet.kind === 'sprite' && slot.id.endsWith('Hair')
  if (sheet.kind === 'hair' || facingHair) {
    const crown = []
    for (let y = 0.15; y < 0.43; y += 0.05) {
      for (let x = 0.28; x < 0.73; x += 0.065) {
        const offset =
          ((top + Math.round(y * height)) * width + left + Math.round(x * assetWidth)) * 4
        if (data[offset + 3] >= 180) crown.push([...data.subarray(offset, offset + 3)])
      }
    }
    crown.sort((a, b) => a[0] - b[0])
    const hairPigment = crown[Math.floor(crown.length / 2)] ?? [99, 71, 54]
    if (facingHair) return { hairPigment }
    const opening = hairOpening(data, width, bounds)
    return {
      anchors: measured ?? {
        left: assetWidth * 0.19,
        right: assetWidth * 0.81,
        top: opening - assetWidth * 0.065,
        bottom: opening + assetWidth * 0.075,
      },
      hairPigment,
    }
  }
  const ratios = {
    garment: [0.37, 0.63, 0.18, 0.34],
    gear: [0.11, 0.89, 0.08, 0.9],
    beard: [0.12, 0.88, 0.08, 0.89],
    cap: [0.13, 0.87, 0.68, 0.96],
    hood: [0.09, 0.91, 0.25, 0.48],
    circlet: [0.07, 0.93, 0.6, 0.85],
    lenses: [0.26, 0.74, 0.1, 0.9],
    mask: [0.29, 0.71, 0.2, 0.65],
    veil: [0.07, 0.93, 0.09, 0.91],
    patch: [0.07, 0.93, 0.11, 0.85],
  }[slot.kind ?? sheet.kind]
  if (measured) return { anchors: measured }
  if (!ratios) return {}
  const [l, r, t, b] = ratios
  return {
    anchors: { left: l * assetWidth, right: r * assetWidth, top: t * height, bottom: b * height },
  }
}

function clearLensCenters(data, width, bounds, [first, second, yCenter, xRadius, yRadius]) {
  for (let y = 0; y < bounds.height; y++) {
    for (let x = 0; x < bounds.width; x++) {
      const distanceY = (y / bounds.height - yCenter) / yRadius
      const distanceX =
        Math.min(Math.abs(x / bounds.width - first), Math.abs(x / bounds.width - second)) / xRadius
      const distance = Math.hypot(distanceX, distanceY)
      if (distance >= 1) continue
      const offset = ((bounds.top + y) * width + bounds.left + x) * 4 + 3
      data[offset] = Math.round(data[offset] * Math.max(0.045, (distance - 0.91) / 0.09))
    }
  }
}

async function encode(raw, region, registration, maxSize, quality) {
  const result = await raw
    .clone()
    .extract(region)
    .resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true })
    .webp({ quality, alphaQuality: 96 })
    .toBuffer({ resolveWithObject: true })
  const { anchors, ...metadata } = registration
  const { width, height } = result.info
  const href = `data:image/webp;base64,${result.data.toString('base64')}`
  if (!anchors) return { href, width, height, ...metadata }
  const x = width / region.width
  const y = height / region.height
  return {
    href,
    width,
    height,
    anchors: {
      left: anchors.left * x,
      right: anchors.right * x,
      top: anchors.top * y,
      bottom: anchors.bottom * y,
    },
    ...metadata,
  }
}

for (const sheet of sheets) {
  const bytes = await readFile(sheet.path)
  const outfitPart = { 'outfit-side': 'side', 'outfit-back': 'back', 'outfit-sleeve': 'sleeve' }[
    sheet.kind
  ]
  const provenance = outfitPart ? outfitDigests : digests
  provenance.push(`${sheet.kind} ${createHash('sha256').update(bytes).digest('hex')}`)
  const { width, height } = await sharp(bytes).metadata()
  const x = sheet.columns ?? [0, 0.25, 0.5, 0.75, 1]
  const y = sheet.rows
  for (const [index, item] of sheet.slots.entries()) {
    if (!item) continue
    const slot = typeof item === 'string' ? { id: item } : item
    const column = index % (x.length - 1)
    const row = Math.floor(index / (x.length - 1))
    const left = Math.round(width * x[column])
    const top = Math.round(height * y[row])
    const region = {
      left,
      top,
      width: Math.round(width * x[column + 1]) - left,
      height: Math.round(height * y[row + 1]) - top,
    }
    if (sheet.kind === 'pattern' || sheet.kind === 'landscape') {
      const painting = await sharp(bytes)
        .extract(region)
        .resize(256, 256, { fit: 'cover' })
        .webp({ quality: 85 })
        .toBuffer()
      const catalogue = sheet.kind === 'pattern' ? patterns : landscapes
      catalogue[slot.id] = `data:image/webp;base64,${painting.toString('base64')}`
      if (sheet.kind === 'landscape') delete patterns[slot.id]
      continue
    }
    const cutout = await sharp(bytes).extract(region).png().toBuffer()
    const oriented = sharp(cutout)
    if (slot.mirror) oriented.flop()
    if (slot.rotate) oriented.rotate(slot.rotate, { background: '#0000' })
    const { data, info } = await oriented.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    let bounds = foreground(data, info.width, info.height)
    if (sheet.kind === 'hair') {
      clearDetachedHairSpeckles(data, info.width, info.height)
      bounds = foreground(data, info.width, info.height)
    }
    if (slot.lensOpenings) clearLensCenters(data, info.width, bounds, slot.lensOpenings)
    if (sheet.kind === 'face')
      assert(bounds.height > bounds.width, `Invalid face proportions for ${slot.id}`)
    const guides = registration(sheet, slot, data, info.width, bounds, region)
    const raw = sharp(data, { raw: info })
    const small = await encode(raw, bounds, guides, 92, 86)
    if (outfitPart) {
      outfits[slot.id] = { ...outfits[slot.id], [outfitPart]: small.href }
      continue
    }
    if (sheet.kind === 'part') {
      parts[slot.id] = small.href
      continue
    }
    assert(
      sheet.kind === 'sprite' || Object.hasOwn(heads, slot.id),
      `Unknown sprite artwork ${slot.id}`,
    )
    heads[slot.id] = small
    if (sheet.kind === 'sprite') continue
    const catalogue = sheet.kind === 'accessory' ? accessories : source
    assert(Object.hasOwn(catalogue, slot.id), `Unknown portrait artwork ${slot.id}`)
    catalogue[slot.id] = await encode(raw, bounds, guides, 288, 87)
  }
}

if (sheets.some(({ kind }) => kind === 'face')) {
  // Expressions deform the registered neutral painting instead of swapping to
  // independently painted heads with a different face or outline.
  for (const key of Object.keys(source)) {
    if (/-(?:happy|angry|sad|surprised)$/.test(key)) delete source[key]
  }
}

const outputs = digests.length
  ? [
      ['appearance-fitted-source', 'FITTED_ART_SOURCE', source],
      ['appearance-fitted-accessories', 'FITTED_ACCESSORY_ART', accessories],
      ['appearance-painted-sprite-heads', 'PAINTED_SPRITE_HEADS', heads],
      ['appearance-painted-sprite-parts', 'PAINTED_SPRITE_PARTS', parts],
      ['appearance-pattern-paintings', 'PATTERN_PAINTINGS', patterns],
      ['appearance-landscape-paintings', 'LANDSCAPE_PAINTINGS', landscapes],
      [
        'appearance-portrait-expression-maps',
        'PORTRAIT_EXPRESSION_MAPS',
        Object.fromEntries(
          await Promise.all(
            Object.entries(expressionPatches).map(async ([mood, patches]) => [
              mood,
              await faceDisplacementMap(patches),
            ]),
          ),
        ),
      ],
    ]
  : []
if (outfitDigests.length)
  outputs.push([
    'appearance-painted-sprite-outfits',
    'PAINTED_SPRITE_OUTFITS',
    outfits,
    outfitDigests,
  ])

for (const [name, constant, catalogue, provenance = digests] of outputs) {
  await writeFile(
    new URL(`../src/appearance/${name}.generated.ts`, import.meta.url),
    `// Generated by build-illustrated-appearance.mjs. Source sheet SHA-256:\n${provenance.map((digest) => '// ' + digest).join('\n')}\nexport const ${constant} = ${JSON.stringify(catalogue, null, 2)} as const\n`,
  )
}
