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
  const base = path.join(root, 'apps/web/public/media/art/world')
  const { grandDiscoveryPlacements } = require(
    path.join(root, 'apps/web/src/components/world/map-grand-discoveries.ts'),
  )
  const { atlasSectors } = require(path.join(root, 'apps/web/src/world/atlas.ts'))
  const { WORLD_MIN_ZOOM, WORLD_MAX_ZOOM } = require(
    path.join(root, 'apps/web/src/components/world/world-zoom.ts'),
  )
  const { terrainWalkable } = require(path.join(root, 'apps/web/src/world/terrain.ts'))
  const sites = grandDiscoveryPlacements(
    atlasSectors().map((sector) => ({
      ...sector,
      cells: sector.rows.flatMap((row, y) =>
        [...row].map((terrain, x) => ({
          x,
          y,
          terrain,
          walkable: terrainWalkable(terrain),
          safe: false,
        })),
      ),
    })),
  )
  const result = []
  for (const site of sites.filter((s) => ['elemental-valley', 'remote-colosseum'].includes(s.id))) {
    const manifestPath = path.join(base, 'runtime', site.sheet + '-v01.manifest.json')
    const manifest = JSON.parse(fs.readFileSync(manifestPath))
    const source = fs.readFileSync(path.join(base, manifest.source.path))
    const runtime = fs.readFileSync(path.join(base, manifest.runtime.path))
    const sourceHash = createHash('sha256').update(source).digest('hex')
    const runtimeHash = createHash('sha256').update(runtime).digest('hex')
    if (sourceHash !== manifest.source.sha256 || runtimeHash !== manifest.runtime.sha256)
      throw new Error('Art identity mismatch')
    const metadata = await sharp(source).metadata()
    result.push({
      id: site.id,
      source: manifest.source.path,
      sourceHash,
      runtimeHash,
      sourcePixels: [metadata.width, metadata.height],
      runtimePixels: [manifest.runtime.width, manifest.runtime.height],
      runtimeBytes: runtime.length,
      display: [48, 64].flatMap((tile) =>
        [WORLD_MIN_ZOOM, 1, WORLD_MAX_ZOOM].map((zoom) => ({
          tile,
          zoom,
          cssWidth: site.widthTiles * tile * zoom,
          cssHeight: site.heightTiles * tile * zoom,
          sourceToBackingScaleAt1_5: (site.widthTiles * tile * zoom * 1.5) / manifest.runtime.width,
        })),
      ),
    })
  }
  if (result.length !== 2) throw new Error('Both canonical major sites must be measured')
  const receipt = {
    method:
      'Decoded original-source identity and exact renderer placement scale; not native browser acceptance',
    source: require('node:child_process')
      .execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' })
      .trim(),
    sites: result,
  }
  const output = process.argv[2]
  if (output) fs.writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n')
  console.log(JSON.stringify(receipt, null, 2))
}
main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
