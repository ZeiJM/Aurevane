import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const [, , repository, destination] = process.argv
assert(
  repository && destination,
  'Usage: node apps/web/scripts/appearance-catalog-review.mjs REPO OUTPUT',
)
const repo = resolve(repository)
const output = resolve(destination)
const web = resolve(repo, 'apps/web')
const require = createRequire(resolve(web, 'package.json'))
const sharp = require('sharp')
const { createServer } = await import(
  pathToFileURL(require.resolve('vite', { paths: [require.resolve('vitest')] }))
)
const { chromium } = require(
  require.resolve('playwright', { paths: [require.resolve('@playwright/test')] }),
)
const fixtureModule = '/__appearance-builder.js'
const server = await createServer({
  root: web,
  configFile: false,
  appType: 'custom',
  resolve: { alias: { '@': resolve(web, 'src') } },
  plugins: [
    {
      name: 'appearance-builder-review',
      resolveId(id) {
        return id === fixtureModule ? fixtureModule : null
      },
      load(id) {
        if (id !== fixtureModule) return null
        return `import { createElement, useState } from 'react'
        import { createRoot } from 'react-dom/client'
        import { AppearanceBuilderDialog } from '/src/components/character/appearance-builder-dialog.tsx'
        function Fixture() {
          const [value, setValue] = useState(null)
          return createElement(AppearanceBuilderDialog, {
            label: 'Open appearance', confirmLabel: 'Confirm outfit', value, onConfirm: setValue,
          })
        }
        createRoot(document.querySelector('#root')).render(createElement(Fixture))`
      },
    },
  ],
  server: { port: 0, host: '127.0.0.1', fs: { allow: [repo] } },
})

const {
  APPEARANCE_CATALOG: catalog,
  APPEARANCE_PRESETS,
  APPEARANCE_EXPRESSIONS,
  APPEARANCE_FRAME: frame,
  appearanceFrameIndex,
  compileAppearanceManifest,
  parseAppearanceBlueprint,
  varyAppearanceOutfit,
} = await server.ssrLoadModule('/src/appearance/appearance-manifest.ts')
const { WARDROBE_CUTS, WARDROBE_CUT_LABELS } = await server.ssrLoadModule(
  '/src/appearance/appearance-wardrobe-catalog.ts',
)
const { renderAppearanceAsset } = await server.ssrLoadModule('/src/appearance/appearance-svg.ts')
const { GET } = await server.ssrLoadModule(
  '/src/app/api/media/appearance/1/[blueprint]/[asset]/route.ts',
)

const seed = 0x41565245
const fields = Object.keys(catalog)
const outfitFields = ['coat', 'collar', 'sleeves', 'closure', 'hem', 'textile', 'accessory']
const views = [
  { name: 'Field walk', width: frame.width * 0.95, ...appearanceFrameIndex('east', 'walk', 1) },
  { name: 'Battle cast', width: 72 * 0.85 * 0.94, ...appearanceFrameIndex('south', 'cast', 2) },
].map((view) => ({ ...view, height: (view.width * frame.height) / frame.width }))
const structuralBase = {
  v: 1,
  body: 'average',
  complexion: 'brown',
  hair: 'swept',
  hairColor: 'onyx',
  coat: 'tunic',
  collar: 'open',
  sleeves: 'close',
  closure: 'clasps',
  hem: 'plain',
  textile: 'linen',
  accessory: 'none',
  palette: 'slate',
}
const row = (name, blueprint) => {
  assert(blueprint, `Incompatible recipe: ${name}`)
  return { name, blueprint, manifest: compileAppearanceManifest(blueprint) }
}
const controlled = WARDROBE_CUTS.map((coat) =>
  row(WARDROBE_CUT_LABELS[coat], parseAppearanceBlueprint({ ...structuralBase, coat })),
)

function sampleLooks() {
  let state = seed
  const random = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 4294967296
  }
  const rows = []
  while (rows.length < 120) {
    const blueprint = parseAppearanceBlueprint({
      v: 1,
      ...Object.fromEntries(
        fields.map((field) => {
          const choices = catalog[field]
          return [field, choices[Math.floor(random() * choices.length)]]
        }),
      ),
    })
    // Reject only incompatible recipes. Keep duplicate/near matches to measure their incidence.
    if (blueprint) rows.push(row(`Seed ${String(rows.length + 1).padStart(3, '0')}`, blueprint))
  }
  return rows
}

const samples = sampleLooks()
assert.deepEqual(
  samples.map(({ manifest }) => manifest.id),
  sampleLooks().map(({ manifest }) => manifest.id),
)
const escape = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

function gallery(subset, title, description, controlledComparison = false) {
  const cards = subset
    .map(
      ({ name, manifest, blueprint }) => `
  <article><header><strong>${escape(name)}</strong>${controlledComparison ? '' : `<small>${escape(WARDROBE_CUT_LABELS[blueprint.coat] ?? blueprint.coat)}</small>`}</header>
    <div class="preview">
      <figure><img class="portrait" src="${manifest.portraits.neutral}" alt=""><figcaption>Portrait · 120 px</figcaption></figure>
      ${views.map((view) => `<figure><div class="sprite" style="width:${view.width}px;height:${view.height}px"><img src="${manifest.atlas}" alt="" style="width:${view.width * frame.columns}px;height:${view.height * frame.rows}px;left:${-view.width * view.column}px;top:${-view.height * view.row}px"></div><figcaption>${view.name}</figcaption></figure>`).join('')}
    </div>
    <p>${outfitFields
      .slice(1)
      .map((field) => escape(blueprint[field]))
      .join(' · ')}</p>
  </article>`,
    )
    .join('')
  return `<!DOCTYPE html><html lang="en"><meta charset="utf-8"><title>Aurevane wardrobe review</title>
  <style>
    *{box-sizing:border-box}body{margin:0;padding:26px;background:#192428;color:#f5e9d1;font:14px system-ui}
    h1{font:600 27px Georgia;margin:0 0 8px}body>p{color:#d4c6ac;margin:0 0 18px}
    main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
    article{min-width:0;min-height:174px;border:1px solid #796d51;border-radius:7px;background:#233034;padding:9px}
    article header{display:flex;justify-content:space-between;gap:4px}small{color:#d8c49b}
    figure{margin:0;display:grid;align-content:end;justify-items:center;gap:3px}
    figcaption{font-size:10px;color:#e0d2b3}
    .preview{display:flex;justify-content:space-around;gap:6px;align-items:end;padding-top:7px}
    .portrait{display:block;width:120px;height:120px;border-radius:5px}
    .sprite{position:relative;overflow:hidden;background:#a5afa4;border-radius:4px}
    .sprite img{position:absolute;max-width:none}
    article p{font-size:11px;line-height:1.25;color:#e5d8bf;margin:6px 0 0}
  </style><h1>${escape(title)}</h1><p>${escape(description)}</p><main>${cards}</main></html>`
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
    if (url.pathname === '/builder') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(
        `<!DOCTYPE html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Appearance builder review</title><div id="root"></div><script type="module" src="${fixtureModule}"></script></html>`,
      )
      return
    }
    if (url.pathname === '/comparison' || url.pathname === '/review') {
      const start = Number(url.searchParams.get('start') ?? 0)
      const comparison = url.pathname === '/comparison'
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(
        comparison
          ? gallery(
              controlled,
              'Twenty wardrobe cuts',
              'One identity, one palette, one set of fittings. Only the garment construction changes.',
              true,
            )
          : gallery(
              samples.slice(start, start + 20),
              `Aurevane appearance catalog · ${start + 1}–${start + 20} / ${samples.length}`,
              'Seed AVRE · 120 accepted recipes · 64 px field tile · 72 px battle cell.',
            ),
      )
      return
    }
    next()
  } catch (error) {
    next(error)
  }
})

async function spritePixels(blueprint, clothingOnly) {
  const atlas = renderAppearanceAsset(blueprint, 'atlas')
  const definitions = atlas.match(/^<svg[^>]*>(<defs>.*?<\/defs>)/s)?.[1] ?? ''
  return Buffer.concat(
    await Promise.all(
      views.map(async (view) => {
        const start = `<svg x="${view.column * frame.width}" y="${view.row * frame.height}"`
        const position = atlas.indexOf(start)
        assert(position > 0, `Missing atlas frame: ${view.name}`)
        const contents = atlas.slice(
          atlas.indexOf('>', position) + 1,
          atlas.indexOf('</svg>', position),
        )
        const top = clothingOnly ? 19 : 0
        const height = clothingOnly ? 38 : frame.height
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${view.width}" height="${(view.width * height) / frame.width}" viewBox="0 ${top} ${frame.width} ${height}">${definitions}${contents}</svg>`
        return sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer()
      }),
    ),
  )
}

const pixelKey = (pixels) => createHash('sha256').update(pixels).digest('hex')
const minimumStructuralDistance = 16
const channelThreshold = 34
function differingPixels(left, right, stopAt = Infinity, silhouette = false) {
  assert.equal(left.length, right.length)
  let count = 0
  for (let i = 0; i < left.length; i += 4) {
    const alphaDelta = Math.abs(left[i + 3] - right[i + 3])
    if (silhouette) {
      if (left[i + 3] >= 160 !== right[i + 3] >= 160) count++
    } else if (
      alphaDelta >= channelThreshold ||
      (left[i + 3] >= 160 &&
        right[i + 3] >= 160 &&
        (Math.abs(left[i] - right[i]) >= channelThreshold ||
          Math.abs(left[i + 1] - right[i + 1]) >= channelThreshold ||
          Math.abs(left[i + 2] - right[i + 2]) >= channelThreshold))
    )
      count++
    if (count >= stopAt) break
  }
  return count
}

async function enumerateStructure() {
  const raw = []
  for (const coat of catalog.coat)
    for (const collar of catalog.collar) {
      for (const sleeves of catalog.sleeves)
        for (const hem of catalog.hem) {
          raw.push({ ...structuralBase, coat, collar, sleeves, hem })
        }
    }
  const valid = raw.map(parseAppearanceBlueprint).filter(Boolean)
  const exact = new Set()
  const counted = []
  // A stable greedy lower bound: every retained pair clears the pixel threshold.
  // Putting the canonical cuts first ensures that small fitting variants cannot crowd them out.
  const ordered = [...controlled.map(({ blueprint }) => blueprint), ...valid]
  for (const blueprint of ordered) {
    const pixels = await spritePixels(blueprint, true)
    const key = pixelKey(pixels)
    if (exact.has(key)) continue
    exact.add(key)
    if (
      counted.every(
        (entry) =>
          differingPixels(pixels, entry.pixels, minimumStructuralDistance) >=
          minimumStructuralDistance,
      )
    ) {
      counted.push({ blueprint, pixels })
    }
  }
  return {
    attempted: raw.length,
    compatible: valid.length,
    uniquePixelOutputs: exact.size,
    counted: counted.length,
    countedByCut: Object.fromEntries(
      catalog.coat.map((coat) => [
        coat,
        counted.filter((entry) => entry.blueprint.coat === coat).length,
      ]),
    ),
    minimumStructuralDistance,
    channelThreshold,
    target: 10000,
  }
}

const featureWeights = { coat: 4, hair: 3, palette: 3, textile: 1, accessory: 2 }
const nearFeatureThreshold = 2
const featureDistance = (left, right) =>
  Object.entries(featureWeights).reduce(
    (sum, [field, weight]) => sum + (left[field] === right[field] ? 0 : weight),
    0,
  )

async function measureDiversity() {
  const pixels = await Promise.all(samples.map(({ blueprint }) => spritePixels(blueprint, false)))
  const exactRecipes = new Set(samples.map(({ manifest }) => manifest.id)).size
  const exactVisuals = new Set(pixels.map(pixelKey)).size
  const nearPairs = []
  const nearLooks = new Set()
  const visualNearPairs = []
  for (let left = 0; left < samples.length; left++)
    for (let right = left + 1; right < samples.length; right++) {
      const distance = featureDistance(samples[left].blueprint, samples[right].blueprint)
      if (distance <= nearFeatureThreshold) {
        nearPairs.push({ left: left + 1, right: right + 1, distance })
        nearLooks.add(left)
        nearLooks.add(right)
      }
      if (
        differingPixels(pixels[left], pixels[right], minimumStructuralDistance) <
        minimumStructuralDistance
      ) {
        visualNearPairs.push({ left: left + 1, right: right + 1 })
      }
    }
  const example = nearPairs[0]
  const variation = example
    ? (() => {
        const reference = samples[example.left - 1].blueprint
        const before = samples[example.right - 1].blueprint
        const after = varyAppearanceOutfit(before)
        return {
          ...example,
          before: before.coat,
          after: after.coat,
          afterDistance: featureDistance(reference, after),
          changedGameplayPixels: null,
          blueprint: after,
        }
      })()
    : null
  if (variation) {
    variation.changedGameplayPixels = differingPixels(
      pixels[variation.right - 1],
      await spritePixels(variation.blueprint, false),
    )
    assert(variation.afterDistance > nearFeatureThreshold)
    assert(variation.changedGameplayPixels >= minimumStructuralDistance)
  }
  return {
    exactRecipeDuplicates: samples.length - exactRecipes,
    exactGameplayPixelDuplicates: samples.length - exactVisuals,
    totalPairs: (samples.length * (samples.length - 1)) / 2,
    featureWeights,
    nearFeatureThreshold,
    featureNearPairs: nearPairs,
    looksWithFeatureNearMatch: nearLooks.size,
    visualNearPairs,
    variation,
  }
}

async function compareCuts() {
  const pixels = await Promise.all(controlled.map(({ blueprint }) => spritePixels(blueprint, true)))
  let closest = { pixels: Infinity }
  let closestSilhouette = { pixels: Infinity }
  for (let left = 0; left < controlled.length; left++)
    for (let right = left + 1; right < controlled.length; right++) {
      const pair = { left: controlled[left].name, right: controlled[right].name }
      const distance = differingPixels(pixels[left], pixels[right])
      const outlineDistance = differingPixels(pixels[left], pixels[right], Infinity, true)
      if (distance < closest.pixels) closest = { ...pair, pixels: distance }
      if (outlineDistance < closestSilhouette.pixels)
        closestSilhouette = { ...pair, pixels: outlineDistance }
    }
  assert(closest.pixels >= minimumStructuralDistance)
  assert(closestSilhouette.pixels >= 8)
  return { total: controlled.length, closest, closestSilhouette }
}

async function reviewBuilder(browser, origin) {
  const receipts = []
  for (const [mode, viewport] of [
    ['desktop', { width: 1280, height: 860 }],
    ['mobile', { width: 390, height: 844 }],
  ]) {
    const page = await browser.newPage({
      viewport,
      deviceScaleFactor: 1,
      isMobile: mode === 'mobile',
      hasTouch: mode === 'mobile',
    })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(origin + '/builder')
    const open = page.getByRole('button', { name: 'Open appearance' })
    await open.click()
    const dialog = page.getByRole('dialog')
    const silhouette = dialog.getByLabel('Silhouette')
    const portrait = dialog.getByAltText('Neutral appearance portrait')
    const src = () => portrait.getAttribute('src')
    const initial = await src()
    assert(
      await silhouette.locator('option[value="greatcloak"]').evaluate((option) => option.disabled),
    )
    await silhouette.selectOption('bolero')
    assert.notEqual(await src(), initial)
    await dialog.getByRole('button', { name: 'Vary silhouette' }).click()
    assert.equal(await silhouette.inputValue(), 'gown')
    await silhouette.selectOption('cuirass')
    assert(
      await dialog
        .getByLabel('Sleeves')
        .locator('option[value="puffed"]')
        .evaluate((option) => option.disabled),
    )
    assert(
      await dialog
        .getByText('These shoulder guards need close or split sleeves.', { exact: false })
        .isVisible(),
    )
    await dialog.getByLabel('Accessory').selectOption('none')
    await silhouette.selectOption('greatcloak')
    await dialog.getByRole('button', { name: 'Undo' }).click()
    assert.equal(await silhouette.inputValue(), 'cuirass')
    await silhouette.selectOption('greatcloak')
    const chosen = await src()
    const bounds = await dialog.evaluate((element) => {
      const box = element.getBoundingClientRect()
      return {
        left: box.left,
        right: box.right,
        overflow: element.scrollWidth - element.clientWidth,
      }
    })
    assert(
      bounds.left >= 0 && bounds.right <= viewport.width && bounds.overflow <= 1,
      JSON.stringify(bounds),
    )
    const silhouetteBounds = await silhouette.boundingBox()
    const collarBounds = await dialog.getByLabel('Collar').boundingBox()
    assert(
      silhouetteBounds.x + silhouetteBounds.width < collarBounds.x,
      `Overlapping controls at ${viewport.width}px`,
    )

    await page.waitForFunction(() =>
      Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
    )
    await page.screenshot({ path: resolve(output, `builder-${mode}.png`) })
    await dialog.getByRole('button', { name: 'Confirm outfit' }).click()
    await dialog.waitFor({ state: 'hidden' })
    await open.click()
    assert.equal(await src(), chosen)
    assert.deepEqual(errors, [])
    await page.close()
    receipts.push({
      mode,
      viewport,
      rules: 'incompatible options, variation, undo, asset validation, confirm and reopen',
    })
  }
  return receipts
}

let browser
try {
  await mkdir(output, { recursive: true })
  await server.listen()
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({
    executablePath: process.env.AV_CHROMIUM_EXECUTABLE,
    args: ['--no-sandbox'],
  })
  const page = await browser.newPage({
    viewport: { width: 1320, height: 1140 },
    deviceScaleFactor: 1,
  })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  async function capture(path, filename) {
    await page.goto(origin + path)
    await page.waitForFunction(() =>
      Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
    )
    await page.screenshot({ path: resolve(output, filename), fullPage: true })
  }
  await capture('/comparison', 'wardrobe-comparison.png')
  for (let start = 0; start < samples.length; start += 20) {
    await capture(`/review?start=${start}`, `catalog-${String(start + 1).padStart(3, '0')}.png`)
  }
  assert.deepEqual(errors, [])
  let validAssets = 0
  for (const { manifest } of [
    ...controlled,
    ...samples,
    ...APPEARANCE_PRESETS.map(({ name, blueprint }) => row(name, blueprint)),
  ]) {
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
  const [comparison, structure, diversity, builder] = await Promise.all([
    compareCuts(),
    enumerateStructure(),
    measureDiversity(),
    reviewBuilder(browser, origin),
  ])
  const report = {
    seed: `0x${seed.toString(16)}`,
    total: samples.length,
    validAssets,
    chromium: browser.version(),
    views,
    comparison,
    structure,
    diversity,
    builder,
    looks: samples.map(({ name, blueprint, manifest }) => ({
      name,
      blueprint,
      recipe: manifest.id,
    })),
  }
  await writeFile(resolve(output, 'catalog-samples.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ ...report, looks: undefined, output }, null, 2))
} finally {
  await browser?.close()
  await server.close()
}
