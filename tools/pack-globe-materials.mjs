import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const require = createRequire(new URL('../apps/web/package.json', import.meta.url))
const sharp = require('sharp')
const source = 'apps/web/public/media/art/world/sources/globe-terrain-materials-v02.png'
const uncharted = 'apps/web/public/media/art/world/sources/globe-uncharted-material-v02.png'
const runtime = 'apps/web/public/media/art/world/runtime/globe-materials-v02.webp'
const [biomes, unknown] = await Promise.all([
  sharp(source).resize(2048, 1024, { fit: 'fill' }).png().toBuffer(),
  sharp(uncharted).resize(2048, 1024, { fit: 'fill' }).png().toBuffer(),
])
await sharp({ create: { width: 2048, height: 2048, channels: 3, background: '#776f55' } })
  .composite([
    { input: biomes, top: 0, left: 0 },
    { input: unknown, top: 1024, left: 0 },
  ])
  .webp({ quality: 91, effort: 6 })
  .toFile(runtime)
const records = await Promise.all(
  [source, uncharted, runtime].map(async (path) => {
    const data = await readFile(path),
      metadata = await sharp(data).metadata()
    return {
      path,
      sha256: createHash('sha256').update(data).digest('hex'),
      width: metadata.width,
      height: metadata.height,
      bytes: data.length,
    }
  }),
)

await writeFile(
  'apps/web/public/media/art/world/runtime/globe-materials-v02.provenance.json',
  JSON.stringify(
    {
      generator: 'Built-in image generation',
      purpose: 'Illustrative ground materials only; geometry and water remain code-authoritative',
      layout:
        '2048×2048: upper half 4×2 public biome panels; lower half one generic Uncharted ground material',
      files: records,
    },
    null,
    2,
  ) + '\n',
)
console.log(records)
