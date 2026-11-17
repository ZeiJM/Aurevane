// Offline source review, not hosted browser or physical-handset acceptance.
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const Module = require('node:module')
const { createRequire } = require('node:module')
const { createHash } = require('node:crypto')
const root = path.resolve(__dirname, '../..')
const app = createRequire(path.join(root, 'apps/web/package.json'))
const ts = app('typescript')
const sharp = app('sharp')
const resolve = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolve.call(
    this,
    request.startsWith('@/') ? path.join(root, 'apps/web/src', request.slice(2)) : request,
    ...args,
  )
}
require.extensions['.ts'] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  )
async function main() {
  const output = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'aurevane-town-extents-'))
  fs.mkdirSync(output, { recursive: true })
  const { atlasSectors, ATLAS_COLUMNS, ATLAS_ROWS } = require(
    path.join(root, 'apps/web/src/world/atlas.ts'),
  )
  const { globeAtlasDetailPixels, globeTowns } = require(
    path.join(root, 'apps/web/src/components/world/globe-atlas.ts'),
  )
  const sectors = atlasSectors()
  const atlas = sectors.map((sector) => ({
    id: sector.id,
    name: sector.name,
    coordinate: sector.coordinate,
    regionId: sector.regionId,
    column: sector.atlasColumn,
    row: sector.atlasRow,
    charted: sector.charted,
    townId: sector.townId,
    settlementOutskirtsOf: sector.settlementOutskirtsOf,
    waterTiles: sector.rows.join('').replace(/[^~lw]/g, '.'),
  }))
  // Use the real surface projection, including the retired fire/ice lakes.
  const { worldSurfaceRows } = require(path.join(root, 'apps/web/src/world/terrain.ts'))
  atlas.forEach((cell, i) => {
    cell.waterTiles = worldSurfaceRows(sectors[i])
      .join('')
      .replace(/[^~lw]/g, '.')
  })
  const { data, info } = await sharp(
    path.join(root, 'apps/web/public/media/art/world/runtime/globe-materials-v02.webp'),
  )
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const image = globeAtlasDetailPixels(atlas, ATLAS_COLUMNS, ATLAS_ROWS, {
    pixels: data,
    width: info.width,
    height: info.height,
  })
  const filename = path.join(output, 'town-extents-globe-texture.png')
  await sharp(Buffer.from(image.pixels), {
    raw: { width: image.width, height: image.height, channels: 4 },
  })
    .png()
    .toFile(filename)
  const report = {
    scope:
      'Actual shared globe texture generated offline from current public geometry/materials; not browser acceptance.',
    sources: Object.fromEntries(
      [
        'apps/web/src/world/atlas.ts',
        'apps/web/src/world/town-extents.ts',
        'apps/web/src/components/world/globe-atlas.ts',
      ].map((file) => [
        file,
        createHash('sha256')
          .update(fs.readFileSync(path.join(root, file)))
          .digest('hex'),
      ]),
    ),
    towns: globeTowns(atlas).map((town) => ({
      id: town.sector.id,
      safeCoreDistricts: town.districts.filter((cell) => cell.townId === town.sector.id).length,
      visibleDistricts: town.districts.length,
      offsets: town.districts.map((cell) => [
        cell.column - town.sector.column,
        cell.row - town.sector.row,
      ]),
    })),
    image: {
      width: image.width,
      height: image.height,
      sha256: createHash('sha256').update(fs.readFileSync(filename)).digest('hex'),
    },
  }
  fs.writeFileSync(
    path.join(output, 'town-extents-source-review.json'),
    JSON.stringify(report, null, 2) + '\n',
  )
  console.log(JSON.stringify({ output, ...report }, null, 2))
}
main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
