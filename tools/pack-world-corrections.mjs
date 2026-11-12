import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../apps/web/package.json', import.meta.url))
const sharp = require('sharp')
const prettier = require('prettier')
const root = new URL('../apps/web/public/media/art/world/', import.meta.url)
const jobs = [
  { name: 'grand-discoveries', sourceVersion: 1, columns: 2, rows: 2, width: 512, height: 512 },
  { name: 'natural-lakes', sourceVersion: 1, columns: 2, rows: 2, width: 512, height: 512 },
  { name: 'ocean-features', sourceVersion: 1, columns: 3, rows: 2, width: 384, height: 384 },
  {
    name: 'elemental-waterfall-valley',
    sourceFile: 'elemental-waterfall-valley-owner-selected-v01.png',
    sourceVersion: 1,
    columns: 1,
    rows: 1,
    width: 1536,
    height: 1024,
  },
  { name: 'remote-colosseum', sourceVersion: 3, columns: 1, rows: 1, width: 1536, height: 1024 },
  {
    name: 'colosseum-arena-grain',
    sourceFile: 'remote-colosseum-v03.png',
    sourceVersion: 3,
    columns: 1,
    rows: 1,
    width: 256,
    height: 256,
    groundTexture: true,
    sourceCrop: { left: 640, top: 440, width: 256, height: 256 },
  },
  { name: 'ocean-grand-islet', sourceVersion: 1, columns: 1, rows: 1, width: 1536, height: 1024 },
  {
    name: 'valley-fire-detail',
    sourceFile: 'valley-fire-context-detail-v01.png',
    sourceVersion: 1,
    columns: 1,
    rows: 1,
    width: 1145,
    height: 1374,
    preserveFrame: true,
    featherPixels: 31,
    referenceBounds: [60, 0, 600, 720],
  },
  {
    name: 'valley-ice-detail',
    sourceFile: 'valley-ice-context-detail-v01.png',
    sourceVersion: 1,
    columns: 1,
    rows: 1,
    width: 1086,
    height: 1448,
    preserveFrame: true,
    featherPixels: 30,
    referenceBounds: [960, 80, 576, 768],
  },
  {
    name: 'valley-cascade-detail',
    sourceFile: 'valley-cascade-context-detail-v01.png',
    sourceVersion: 1,
    columns: 1,
    rows: 1,
    width: 1203,
    height: 1307,
    preserveFrame: true,
    featherPixels: 28,
    referenceBounds: [410, 0, 700, 760],
  },
  {
    name: 'town-grand-architecture',
    sourceVersion: 1,
    columns: 4,
    rows: 2,
    width: 512,
    height: 512,
    componentThreshold: 64,
  },
  {
    name: 'town-ordinary-architecture',
    sourceVersion: 1,
    columns: 4,
    rows: 2,
    width: 512,
    height: 512,
    componentThreshold: 64,
  },
  {
    name: 'crown-wall-kit',
    sourceVersion: 1,
    columns: 2,
    rows: 2,
    width: 512,
    height: 512,
    componentThreshold: 240,
  },
]
const selected = process.argv.slice(2)
for (const name of selected)
  if (!jobs.some((job) => job.name === name)) throw new Error(`Unknown sheet ${name}`)
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
// The grand master places two silhouettes slightly across nominal grid boundaries.
// Alpha components recover their complete authored outlines without copying neighbors.
function alphaComponents(data, width, height, rows, count, threshold = 20) {
  const labels = new Uint32Array(width * height),
    components = []
  let label = 0
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] || data[i * 4 + 3] <= threshold) continue
    label++
    const queue = [i]
    labels[i] = label
    let left = width,
      top = height,
      right = -1,
      bottom = -1
    for (let at = 0; at < queue.length; at++) {
      const p = queue[at],
        x = p % width,
        y = Math.floor(p / width)
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
      for (const next of [
        x > 0 ? p - 1 : -1,
        x < width - 1 ? p + 1 : -1,
        y > 0 ? p - width : -1,
        y < height - 1 ? p + width : -1,
      ])
        if (next >= 0 && !labels[next] && data[next * 4 + 3] > threshold) {
          labels[next] = label
          queue.push(next)
        }
    }
    if (queue.length > 10000)
      components.push({ label, left, top, right, bottom, area: queue.length })
  }
  if (components.length !== count)
    throw new Error(`Expected ${count} isolated complete silhouettes, found ${components.length}`)
  components.sort(
    (a, b) =>
      Math.floor(((a.top + a.bottom) * rows) / (height * 2)) -
        Math.floor(((b.top + b.bottom) * rows) / (height * 2)) || a.left - b.left,
  )
  return { labels, components }
}
const receipts = []
for (const job of jobs.filter((job) => !selected.length || selected.includes(job.name))) {
  const { name, columns, rows, width: cellWidth, height: cellHeight, sourceVersion } = job
  const sourcePath = `sources/${job.sourceFile ?? `${name}-v${String(sourceVersion).padStart(2, '0')}.png`}`
  const runtimePath = `runtime/${name}-v01.webp`
  const bytes = await readFile(new URL(sourcePath, root))
  const metadata = await sharp(bytes).metadata()
  if (!metadata.hasAlpha || !metadata.width || !metadata.height)
    throw new Error(`${sourcePath} must have true alpha`)
  if (job.groundTexture) {
    await sharp(bytes)
      .extract(job.sourceCrop)
      .removeAlpha()
      .webp({ quality: 92 })
      .toFile(new URL(runtimePath, root).pathname)
    const runtime = await readFile(new URL(runtimePath, root))
    const receipt = {
      requestId: 'ART-WORLD-CORRECTION-20261112',
      promptSpec: 'content/art-requests/ART-WORLD-CORRECTION-20261112.md',
      name,
      source: {
        path: sourcePath,
        sha256: sha256(bytes),
        width: metadata.width,
        height: metadata.height,
        crop: job.sourceCrop,
      },
      runtime: {
        path: runtimePath,
        sha256: sha256(runtime),
        bytes: runtime.length,
        width: cellWidth,
        height: cellHeight,
        columns: 1,
        rows: 1,
        cellWidth,
        cellHeight,
        encoding: 'Native256px opaque arena-ground crop; no resampling; Sharp WebP quality92',
      },
      groundTexture: true,
    }
    await writeFile(
      new URL(`runtime/${name}-v01.manifest.json`, root),
      JSON.stringify(receipt, null, 2) + '\n',
    )
    receipts.push(receipt)
    continue
  }
  const composites = [],
    sprites = []
  const whole =
    name === 'grand-discoveries' || job.componentThreshold
      ? await sharp(bytes).ensureAlpha().raw().toBuffer()
      : null
  const isolated = whole
    ? alphaComponents(
        whole,
        metadata.width,
        metadata.height,
        rows,
        columns * rows,
        job.componentThreshold ?? 20,
      )
    : null
  let fringePixelsRemoved = 0,
    packedFringePixelsRemoved = 0
  for (let index = 0; index < columns * rows; index++) {
    const column = index % columns,
      row = Math.floor(index / columns)
    const component = isolated?.components[index]
    const left = component
      ? Math.max(0, component.left - 3)
      : Math.round((metadata.width * column) / columns)
    const top = component
      ? Math.max(0, component.top - 3)
      : Math.round((metadata.height * row) / rows)
    const width = component
      ? Math.min(metadata.width, component.right + 4) - left
      : Math.round((metadata.width * (column + 1)) / columns) - left
    const height = component
      ? Math.min(metadata.height, component.bottom + 4) - top
      : Math.round((metadata.height * (row + 1)) / rows) - top
    const { data, info } = await sharp(bytes)
      .extract({ left, top, width, height })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    if (component) {
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const global = (top + y) * metadata.width + left + x,
            p = (y * width + x) * 4
          const owns = isolated.labels[global] === component.label
          const soft =
            !isolated.labels[global] &&
            data[p + 3] <= (job.componentThreshold ?? 20) &&
            [-1, 1, -metadata.width, metadata.width].some(
              (delta) => isolated.labels[global + delta] === component.label,
            )
          if (!owns && !soft) data[p] = data[p + 1] = data[p + 2] = data[p + 3] = 0
        }
    }
    let x0 = width,
      y0 = height,
      x1 = -1,
      y1 = -1,
      transparent = 0,
      opaque = 0
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const p = (y * width + x) * 4,
          alpha = data[p + 3]
        // Preserve every master. Remove only imperceptible RGB/alpha tails in derivatives.
        if (alpha <= 8) {
          if (alpha) fringePixelsRemoved++
          data[p] = data[p + 1] = data[p + 2] = data[p + 3] = 0
          transparent++
        }
        if (alpha > 240) opaque++
        if (alpha <= 20) continue
        x0 = Math.min(x0, x)
        y0 = Math.min(y0, y)
        x1 = Math.max(x1, x)
        y1 = Math.max(y1, y)
      }
    if (
      (!job.preserveFrame && transparent < width * height * 0.1) ||
      opaque < width * height * 0.08 ||
      x1 < x0
    )
      throw new Error(`Invalid isolated sprite ${sourcePath}:${index}`)
    const crop = job.preserveFrame
      ? { left: 0, top: 0, width: info.width, height: info.height }
      : { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }
    const packed = await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .extract(crop)
      .resize({
        width: cellWidth - (job.preserveFrame ? 0 : 32),
        height: cellHeight - (job.preserveFrame ? 0 : 40),
        fit: 'inside',
      })
      .raw()
      .toBuffer({ resolveWithObject: true })
    for (let p = 0; p < packed.data.length; p += 4) {
      if (job.featherPixels) {
        const x = (p / 4) % packed.info.width,
          y = Math.floor(p / 4 / packed.info.width)
        const factor = Math.max(
          0,
          Math.min(
            1,
            x / job.featherPixels,
            (packed.info.width - 1 - x) / job.featherPixels,
            y / job.featherPixels,
            (packed.info.height - 1 - y) / job.featherPixels,
          ),
        )
        packed.data[p + 3] = Math.round(packed.data[p + 3] * factor * factor * (3 - 2 * factor))
      }
      const alpha = packed.data[p + 3],
        brightest = Math.max(packed.data[p], packed.data[p + 1], packed.data[p + 2]),
        darkest = Math.min(packed.data[p], packed.data[p + 1], packed.data[p + 2])
      if (alpha <= 32 && brightest > 190 && brightest - darkest > 130) {
        packedFringePixelsRemoved++
        packed.data[p] = packed.data[p + 1] = packed.data[p + 2] = packed.data[p + 3] = 0
      }
    }
    const targetLeft = Math.floor((cellWidth - packed.info.width) / 2),
      targetTop = cellHeight - (job.preserveFrame ? 0 : 24) - packed.info.height
    let floorLast = -1,
      footX = 0,
      footMass = 0
    for (let y = 0; y < packed.info.height; y++)
      for (let x = 0; x < packed.info.width; x++)
        if (packed.data[(y * packed.info.width + x) * 4 + 3] > 200) floorLast = y
    for (
      let y = Math.max(0, floorLast - Math.round(packed.info.height * 0.03));
      y <= floorLast;
      y++
    )
      for (let x = 0; x < packed.info.width; x++) {
        const alpha = packed.data[(y * packed.info.width + x) * 4 + 3]
        if (alpha > 200) {
          footX += (x + 0.5) * alpha
          footMass += alpha
        }
      }
    const anchorX = Number(((targetLeft + footX / footMass) / cellWidth).toFixed(6))
    const anchorY = Number(((targetTop + floorLast + 1) / cellHeight).toFixed(6))
    composites.push({
      input: await sharp(packed.data, {
        raw: { width: packed.info.width, height: packed.info.height, channels: 4 },
      })
        .png()
        .toBuffer(),
      left: column * cellWidth + targetLeft,
      top: row * cellHeight + targetTop,
    })
    const baseContacts =
      name === 'crown-wall-kit' && index < 2
        ? index === 0
          ? [
              { x: 464 / 512, y: 292 / 512 },
              { x: 48 / 512, y: 486 / 512 },
            ]
          : [
              { x: 48 / 512, y: 293 / 512 },
              { x: 464 / 512, y: 486 / 512 },
            ]
        : undefined
    sprites.push({
      index,
      anchorX: baseContacts ? (baseContacts[0].x + baseContacts[1].x) / 2 : anchorX,
      anchorY: baseContacts ? (baseContacts[0].y + baseContacts[1].y) / 2 : anchorY,
      ...(baseContacts
        ? {
            baseContacts,
            contactMeasurement:
              'Selected512px runtime masonry base endpoints; excludes parapet and image background',
          }
        : {}),
      ...(component
        ? { isolation: 'dominant-alpha-component', componentArea: component.area }
        : {}),
      sourceCell: { left, top, width, height },
      crop,
      runtimeBounds: {
        left: targetLeft,
        top: targetTop,
        width: packed.info.width,
        height: packed.info.height,
      },
      floorY: (cellHeight - (job.preserveFrame ? 0 : 24)) / cellHeight,
    })
  }
  await sharp({
    create: {
      width: columns * cellWidth,
      height: rows * cellHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .webp({ quality: 88, alphaQuality: 100 })
    .toFile(new URL(runtimePath, root).pathname)
  const runtime = await readFile(new URL(runtimePath, root))
  const receipt = {
    requestId: 'ART-WORLD-CORRECTION-20261112',
    promptSpec: 'content/art-requests/ART-WORLD-CORRECTION-20261112.md',
    provider: 'OpenAI image generation',
    selection:
      name === 'elemental-waterfall-valley'
        ? 'Exact Owner re-uploaded and selected original elemental pair; revised figure variants rejected'
        : name === 'remote-colosseum'
          ? 'Version3 higher camera, vast open arena and low front wall'
          : 'Original generated sheet selected for runtime integration',
    name,
    source: {
      path: sourcePath,
      ...(name.startsWith('valley-')
        ? {
            method: 'generated-edit',
            reference: 'sources/elemental-waterfall-valley-owner-selected-v01.png',
            referenceSha256: '3970d259fd7aae25e2c75be3b8220bffcff4660b9236cd444fb39d37539da32a',
          }
        : { method: 'generated' }),
      sha256: sha256(bytes),
      width: metadata.width,
      height: metadata.height,
    },
    runtime: {
      path: runtimePath,
      sha256: sha256(runtime),
      bytes: runtime.length,
      width: columns * cellWidth,
      height: rows * cellHeight,
      columns,
      rows,
      cellWidth,
      cellHeight,
      ...(job.preserveFrame
        ? {
            preserveFrame: true,
            featherPixels: job.featherPixels,
            referenceBounds: job.referenceBounds,
          }
        : {}),
      encoding: job.preserveFrame
        ? 'Native full reference frame retained;16master-pixel smoothstep perimeter feather; Sharp WebP quality88 alphaQuality100'
        : 'Sharp WebP quality88 alphaQuality100; alpha-tail normalization; visible-bounds crop; aspect-preserving fit; 24px floor inset',
    },
    fringePixelsRemoved,
    packedFringePixelsRemoved,
    sprites,
  }
  await writeFile(
    new URL(`runtime/${name}-v01.manifest.json`, root),
    JSON.stringify(receipt, null, 2) + '\n',
  )
  receipts.push(receipt)
}
if (
  receipts.some((receipt) => receipt.name.startsWith('town-') || receipt.name === 'crown-wall-kit')
) {
  const pivotSets = {}
  for (const name of ['town-grand-architecture', 'town-ordinary-architecture', 'crown-wall-kit']) {
    const manifest = JSON.parse(
      await readFile(new URL(`runtime/${name}-v01.manifest.json`, root), 'utf8'),
    )
    pivotSets[name] = manifest.sprites.map(({ anchorX, anchorY, baseContacts }) => ({
      anchorX,
      anchorY,
      ...(baseContacts ? { baseContacts } : {}),
    }))
  }
  await writeFile(
    new URL('../apps/web/src/components/world/map-town-architecture-pivots.ts', import.meta.url),
    await prettier.format(
      `// Generated by tools/pack-world-corrections.mjs from selected runtime opaque contact pixels.\nexport const townArchitecturePivots = ${JSON.stringify(pivotSets, null, 2)} as const\n`,
      {
        parser: 'typescript',
        semi: false,
        singleQuote: true,
        trailingComma: 'all',
        printWidth: 100,
      },
    ),
  )
}
if (receipts.some((receipt) => receipt.name.startsWith('valley-'))) {
  const macro = JSON.parse(
    await readFile(new URL('runtime/elemental-waterfall-valley-v01.manifest.json', root), 'utf8'),
  )
  const sprite = macro.sprites[0],
    bounds = sprite.runtimeBounds
  const macroX = (x) =>
    (bounds.left + ((x - sprite.crop.left) * bounds.width) / sprite.crop.width) /
    macro.runtime.width
  const macroY = (y) =>
    (bounds.top + ((y - sprite.crop.top) * bounds.height) / sprite.crop.height) /
    macro.runtime.height
  const definitions = [
    { sheet: 'valley-cascade-detail', masterBounds: [410, 0, 700, 760] },
    { sheet: 'valley-fire-detail', masterBounds: [60, 0, 600, 720] },
    { sheet: 'valley-ice-detail', masterBounds: [960, 80, 576, 768] },
  ]
  const details = []
  for (const definition of definitions) {
    const detail = JSON.parse(
      await readFile(new URL(`runtime/${definition.sheet}-v01.manifest.json`, root), 'utf8'),
    )
    const body = detail.sprites[0].runtimeBounds,
      [x, y, width, height] = definition.masterBounds
    details.push({
      sheet: definition.sheet,
      source: [
        body.left / detail.runtime.width,
        body.top / detail.runtime.height,
        body.width / detail.runtime.width,
        body.height / detail.runtime.height,
      ],
      target: [macroX(x), macroY(y), macroX(x + width) - macroX(x), macroY(y + height) - macroY(y)],
      blend: 'feathered-rectangle',
      featherMasterPixels: 16,
      nativeWidth: detail.runtime.width,
      nativeHeight: detail.runtime.height,
      minProjectedMacroWidth: 1536,
    })
  }
  await writeFile(
    new URL('../apps/web/src/components/world/map-grand-detail-art.ts', import.meta.url),
    await prettier.format(
      `// Generated by tools/pack-world-corrections.mjs; registration uses the exact Owner-selected master.\nexport const valleyDetailArt = ${JSON.stringify(details, null, 2)} as const\nexport const colosseumArenaMaterial = {sheet:'colosseum-arena-grain',width:256,height:256,worldTileSize:4,opacity:.36} as const\n`,
      {
        parser: 'typescript',
        semi: false,
        singleQuote: true,
        trailingComma: 'all',
        printWidth: 100,
      },
    ),
  )
}
for (const receipt of receipts)
  console.log(
    JSON.stringify({
      name: receipt.name,
      source: receipt.source,
      runtime: receipt.runtime,
      fringePixelsRemoved: receipt.fringePixelsRemoved,
      packedFringePixelsRemoved: receipt.packedFringePixelsRemoved,
    }),
  )
