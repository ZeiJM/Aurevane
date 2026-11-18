import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../apps/web/package.json', import.meta.url))
const sharp = require('sharp'),
  prettier = require('prettier')
const root = new URL('../apps/web/public/media/art/world/', import.meta.url)
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const registration = JSON.parse(
  await readFile(new URL('./colosseum-detail-registration.json', import.meta.url)),
)
const master = await readFile(new URL('sources/remote-colosseum-v03.png', root))
const macro = JSON.parse(
  await readFile(new URL('runtime/remote-colosseum-v01.manifest.json', root)),
)
const { crop, runtimeBounds: bounds } = macro.sprites[0]
const mx = (x) =>
  (bounds.left + ((x - crop.left) * bounds.width) / crop.width) / macro.runtime.width
const my = (y) =>
  (bounds.top + ((y - crop.top) * bounds.height) / crop.height) / macro.runtime.height
const details = []
for (const entry of registration) {
  const sheet = `colosseum-${entry.name}-detail`,
    sourcePath = `sources/${sheet}-v01.png`,
    runtimePath = `runtime/${sheet}-v01.webp`
  const source = await readFile(new URL(sourcePath, root))
  const { data: input, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  if (info.width !== 1536 || info.height !== 1024)
    throw Error('Unexpected native detail resolution')
  const mask = await sharp(master)
    .extract({ left: entry.x, top: 0, width: 640, height: 426 })
    .resize(1536, 1024)
    .ensureAlpha()
    .raw()
    .toBuffer()
  const pixels = Buffer.alloc(input.length),
    [[a, b, tx], [c, d, ty]] = entry.matrix,
    sx = 1536 / 640,
    sy = 1024 / 426
  for (let y = 0; y < 1024; y++)
    for (let x = 0; x < 1536; x++) {
      const px = (x + 0.5) / sx,
        py = (y + 0.5) / sy,
        u = (a * px + b * py + tx) * sx - 0.5,
        v = (c * px + d * py + ty) * sy - 0.5
      const ix = Math.floor(u),
        iy = Math.floor(v),
        fx = u - ix,
        fy = v - iy,
        index = (y * 1536 + x) * 4
      for (let channel = 0; channel < 4; channel++) {
        let value = 0
        for (let j = 0; j < 2; j++)
          for (let i = 0; i < 2; i++) {
            if (ix + i < 0 || ix + i >= 1536 || iy + j < 0 || iy + j >= 1024) continue
            value +=
              input[((iy + j) * 1536 + ix + i) * 4 + channel] *
              (i ? fx : 1 - fx) *
              (j ? fy : 1 - fy)
          }
        pixels[index + channel] = Math.round(value)
      }
      let feather = Math.max(0, Math.min(1, x / 96, (1535 - x) / 96, y / 96, (1023 - y) / 96))
      feather = feather * feather * (3 - 2 * feather)
      pixels[index + 3] = Math.round(((pixels[index + 3] * mask[index + 3]) / 255) * feather)
      const brightest = Math.max(pixels[index], pixels[index + 1], pixels[index + 2])
      const darkest = Math.min(pixels[index], pixels[index + 1], pixels[index + 2])
      if (
        pixels[index + 3] < 2 ||
        (pixels[index + 3] <= 32 && brightest > 190 && brightest - darkest > 130)
      )
        pixels.fill(0, index, index + 4)
    }
  const runtime = await sharp(pixels, { raw: { width: 1536, height: 1024, channels: 4 } })
    .webp({ quality: 90, alphaQuality: 100 })
    .toBuffer()
  await writeFile(new URL(runtimePath, root), runtime)
  const detail = {
    sheet,
    source: [0, 0, 1, 1],
    target: [mx(entry.x), my(0), mx(entry.x + 640) - mx(entry.x), my(426) - my(0)],
    nativeWidth: 1536,
    nativeHeight: 1024,
    minProjectedMacroWidth: 1536,
  }
  details.push(detail)
  await writeFile(
    new URL(`runtime/${sheet}-v01.manifest.json`, root),
    await prettier.format(
      JSON.stringify(
        {
          requestId: 'ART-WORLD-CORRECTION-20261112',
          promptSpec: 'content/art-requests/ART-WORLD-CORRECTION-20261112.md',
          provider: 'OpenAI image generation',
          name: sheet,
          source: { path: sourcePath, sha256: hash(source), width: 1536, height: 1024 },
          master: {
            path: 'sources/remote-colosseum-v03.png',
            sha256: hash(master),
            bounds: [entry.x, 0, 640, 426],
          },
          registration: entry,
          featherNativePixels: 96,
          runtime: {
            path: runtimePath,
            sha256: hash(runtime),
            bytes: runtime.length,
            width: 1536,
            height: 1024,
            columns: 1,
            rows: 1,
            preserveFrame: true,
            cellWidth: 1536,
            cellHeight: 1024,
            encoding:
              'Bilinear affine registration; selected-master alpha; 96px smooth feather; WebP quality90 alpha100',
          },
          sprites: [{ index: 0, runtimeBounds: { left: 0, top: 0, width: 1536, height: 1024 } }],
          target: detail.target,
        },
        null,
        2,
      ),
      { parser: 'json', printWidth: 100 },
    ),
  )
}
await writeFile(
  new URL('../apps/web/src/components/world/map-colosseum-detail-art.ts', import.meta.url),
  await prettier.format(
    `// Generated by tools/pack-colosseum-details.mjs; exact selected-master geometry.\nexport const colosseumDetailArt=${JSON.stringify(details)} as const\n`,
    { parser: 'typescript', semi: false, singleQuote: true, trailingComma: 'all', printWidth: 100 },
  ),
)
