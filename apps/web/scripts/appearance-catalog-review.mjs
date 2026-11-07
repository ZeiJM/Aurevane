import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const repo = resolve(process.argv[2])
const output = resolve(process.argv[3])
const web = resolve(repo, 'apps/web')
const require = createRequire(resolve(web, 'package.json'))
const { createServer } = await import(
  pathToFileURL(require.resolve('vite', { paths: [require.resolve('vitest')] }))
)
const { chromium } = require(
  require.resolve('playwright', { paths: [require.resolve('@playwright/test')] }),
)
const server = await createServer({
  root: web,
  configFile: false,
  appType: 'custom',
  resolve: { alias: { '@': resolve(web, 'src') } },
  server: { port: 0, host: '127.0.0.1', fs: { allow: [repo] } },
})
await mkdir(output, { recursive: true })
const catalog = await server.ssrLoadModule('/src/appearance/appearance-manifest.ts')
const { GET } = await server.ssrLoadModule(
  '/src/app/api/media/appearance/1/[blueprint]/[asset]/route.ts',
)
const {
  APPEARANCE_CATALOG,
  APPEARANCE_PRESETS,
  APPEARANCE_EXPRESSIONS,
  compileAppearanceManifest,
  parseAppearanceBlueprint,
} = catalog
const fields = Object.keys(APPEARANCE_CATALOG)
const outfit = ['coat', 'collar', 'sleeves', 'closure', 'hem', 'textile', 'accessory']
let state = 0x41565245
function random() {
  state ^= state << 13
  state ^= state >>> 17
  state ^= state << 5
  return (state >>> 0) / 4294967296
}
const looks = APPEARANCE_PRESETS.map((preset) => ({ ...preset, painted: true }))
const structureKey = (blueprint) => outfit.map((field) => blueprint[field]).join('.')
const structures = new Set(looks.map(({ blueprint }) => structureKey(blueprint)))
// Spread the first sheet evenly across the four silhouettes before filling the wider sample.
const silhouettes = ['tunic', 'longcoat', 'mantle', 'plate']
while (looks.length < 120) {
  const values = Object.fromEntries(
    fields.map((field) => {
      const choices = APPEARANCE_CATALOG[field]
      return [field, choices[Math.floor(random() * choices.length)]]
    }),
  )
  if (looks.length < 20) values.coat = silhouettes[(looks.length - 3) % silhouettes.length]
  const blueprint = parseAppearanceBlueprint({ v: 1, ...values })
  if (!blueprint) continue
  const key = structureKey(blueprint)
  if (structures.has(key)) continue
  structures.add(key)
  looks.push({
    name: 'Manual ' + String(looks.length + 1).padStart(3, '0'),
    blueprint,
    painted: false,
  })
}
const rows = looks.map((look) => ({ ...look, manifest: compileAppearanceManifest(look.blueprint) }))
const escape = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
function gallery(start, end) {
  const subset = rows.slice(start, end)
  const cards = subset
    .map(
      ({ name, manifest, blueprint, painted }) => `
  <article><header><strong>${escape(name)}</strong><small>${painted ? 'Painted preset' : 'Manual rig'}</small></header>
    <div class="preview">
      <figure><img class="portrait" src="${manifest.portraits.neutral}" alt=""><figcaption>Portrait</figcaption></figure>
      <figure><div class="sprite field"><img src="${manifest.atlas}" alt=""></div><figcaption>Field</figcaption></figure>
      <figure><div class="sprite battle"><img src="${manifest.atlas}" alt=""></div><figcaption>Battle cast</figcaption></figure>
    </div>
    <p>${outfit.map((field) => escape(blueprint[field])).join(' · ')}</p>
  </article>`,
    )
    .join('')
  return `<!DOCTYPE html><html lang="en"><meta charset="utf-8"><title>Aurevane manual catalog review</title>
  <style>
    *{box-sizing:border-box}body{margin:0;padding:26px;background:#152125;color:#f5e9d1;font:14px system-ui}
    h1{font:600 27px Georgia;margin:0 0 8px}body>p{color:#d4c6ac;margin:0 0 18px}
    main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
    article{min-width:0;min-height:174px;border:1px solid #796d51;border-radius:7px;background:#233034;padding:9px}
    article header{display:flex;justify-content:space-between;gap:4px}small{color:#d8c49b}
    figure{margin:0;display:grid;align-content:end;justify-items:center;gap:3px}
    figcaption{font-size:10px;color:#e0d2b3}
    .preview{display:flex;justify-content:space-around;gap:6px;align-items:end;padding-top:7px}
    .portrait{display:block;width:65px;height:65px;border-radius:5px}
    .sprite{position:relative;overflow:hidden;background:#b0b8af;border-radius:4px}
    .sprite img{position:absolute;max-width:none}
    .field{width:46px;height:61px}.field img{width:552px;height:366px;left:0;top:-61px}
    .battle{width:57px;height:76px;background:#777f74}.battle img{width:684px;height:456px;left:-285px;top:-228px}
    article p{font-size:11px;line-height:1.25;color:#e5d8bf;margin:6px 0 0}
  </style><h1>Aurevane appearance catalog · ${start + 1}–${end} / ${rows.length}</h1>
  <p>Seed AVRE. Approximate default field and battle sprite scales. Structural samples of the current rig, not production painted wardrobe acceptance.</p>
  <main>${cards}</main></html>`
}
server.middlewares.use(async (req, res, next) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1')
    const match = url.pathname.match(/^\/api\/media\/appearance\/1\/([^/]+)\/([^/]+)$/)
    if (match) {
      const response = await GET(new Request(url), {
        params: Promise.resolve({ blueprint: match[1], asset: match[2] }),
      })
      res.writeHead(response.status, Object.fromEntries(response.headers))
      res.end(await response.text())
      return
    }
    if (url.pathname === '/review') {
      const start = Number(url.searchParams.get('start') ?? 0)
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(gallery(start, Math.min(rows.length, start + 20)))
      return
    }
    next()
  } catch (error) {
    next(error)
  }
})
let browser
try {
  await server.listen()
  const address = server.httpServer.address()
  browser = await chromium.launch({
    executablePath: process.env.AV_CHROMIUM_EXECUTABLE,
    args: ['--no-sandbox'],
  })
  const page = await browser.newPage({
    viewport: { width: 1240, height: 1100 },
    deviceScaleFactor: 1,
  })
  const origin = 'http://127.0.0.1:' + address.port
  for (let start = 0; start < rows.length; start += 20) {
    await page.goto(origin + '/review?start=' + start)
    await page.waitForFunction(() =>
      Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
    )
    await page.screenshot({
      path: resolve(output, 'catalog-' + String(start + 1).padStart(3, '0') + '.png'),
      fullPage: true,
    })
  }
  let validAssets = 0
  for (const { manifest } of rows) {
    for (const asset of [
      ...APPEARANCE_EXPRESSIONS.map((mood) => manifest.portraits[mood]),
      manifest.icon,
      manifest.atlas,
    ]) {
      const response = await GET(new Request(origin + asset), {
        params: Promise.resolve({
          blueprint: manifest.id.slice(2),
          asset: asset.split('/').at(-1),
        }),
      })
      assert.equal(response.status, 200)
      assert.match(await response.text(), /^<svg /)
      validAssets++
    }
  }
  await writeFile(
    resolve(output, 'catalog-samples.json'),
    JSON.stringify(
      {
        seed: '0x41565245',
        total: rows.length,
        painted: 3,
        manualRig: rows.length - 3,
        uniqueStructuralSamples: structures.size,
        validAssets,
        scope:
          'This is a sampled manual rig review. It neither counts production-quality garments nor demonstrates in-game capacity.',
        looks: rows.map(({ name, painted, blueprint, manifest }) => ({
          name,
          painted,
          blueprint,
          recipe: manifest.id,
        })),
      },
      null,
      2,
    ) + '\n',
  )
  console.log(
    JSON.stringify({
      looks: rows.length,
      uniqueStructuralSamples: structures.size,
      validAssets,
      output,
    }),
  )
} finally {
  await browser?.close()
  await server.close()
}
