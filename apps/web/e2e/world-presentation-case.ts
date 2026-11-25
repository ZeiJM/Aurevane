import { openMapSettings, closeMapSettings } from './world-map-settings-helpers'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { GRID_WIDTH, GRID_HEIGHT, STEP_MS } from '../src/world/catalog'
import type { WorldView } from '../src/world/types'
import { worldRenderTerrain } from '../src/components/world/map-render-terrain'
import { mapPoint } from '../src/components/world/world-motion'
import { projectMapPoint } from '../src/components/world/map-projection'
import {
  GLOBE_MAX_ZOOM,
  WORLD_MIN_ZOOM,
  worldZoomFromPercent,
  worldZoomPercent,
} from '../src/components/world/world-zoom'
import { worldSceneCoversViewport } from '../src/components/world/world-scene-coverage'
import {
  installWorldGroundCoverage,
  missingPublicGround,
  type GroundCoverageFrame,
} from './world-ground-coverage'
import { installWorldRenderTiming } from './world-render-diagnostics'
import { wrappedMapX } from '../src/world/topology'
import { APPEARANCE_FRAME } from '../src/appearance/appearance-manifest'
import sharp from 'sharp'

function captureLocalNameplate(el: HTMLElement | SVGElement) {
  const context = document
    .querySelector<HTMLCanvasElement>('canvas[data-world-identity]')!
    .getContext('2d')!
  const draw = context.fillText.bind(context)
  context.fillText = (text, x, y, maxWidth) => {
    if (context.fillStyle === '#ffdb86') {
      const name = el.dataset.characterName!
      el.dataset.testNameplateDraw = JSON.stringify({
        text,
        fullNameWidth: context.measureText(name).width,
        textWidth: context.measureText(text).width,
        tileSize: Number(el.dataset.tileSize),
        font: context.font,
        align: context.textAlign,
        x,
        y,
        compressed: maxWidth !== undefined,
      })
    }
    if (maxWidth === undefined) draw(text, x, y)
    else draw(text, x, y, maxWidth)
  }
}

function captureLocalIdentity(el: HTMLElement | SVGElement, frame: typeof APPEARANCE_FRAME) {
  const context = document
    .querySelector<HTMLCanvasElement>('canvas[data-world-identity]')!
    .getContext('2d')!
  const draw = context.drawImage
  const ellipse = context.ellipse
  let anchor: { x: number; y: number } | undefined
  context.ellipse = function (x, y, ...args) {
    anchor = { x, y }
    return Reflect.apply(ellipse, this, [x, y, ...args])
  }
  context.drawImage = function (
    this: CanvasRenderingContext2D,
    image: CanvasImageSource,
    ...args: number[]
  ) {
    const position = anchor
    anchor = undefined
    const result = Reflect.apply(draw, this, [image, ...args])
    if (context.strokeStyle !== '#ead399') return result
    const [left, top, width, height] = args.slice(-4)
    const ratio = context.getTransform().a
    const cached = args.length === 4
    if (
      width &&
      height &&
      ((args.length === 8 && image instanceof HTMLImageElement && image.naturalWidth > 0) ||
        (cached && (image instanceof ImageBitmap || image instanceof HTMLCanvasElement)))
    ) {
      // The actor's marker is at the feet, above the padded raster's bottom edge.
      const actorScale = (Number(el.dataset.tileSize) / 64) * 1.22
      const actorEdge = (value: number) =>
        cached ? (Math.round(value * ratio) - 4) / ratio : value
      if (
        position &&
        (Math.abs(left! - actorEdge(position.x - frame.anchorX * actorScale)) > 1e-9 ||
          Math.abs(top! - actorEdge(position.y - frame.anchorY * actorScale)) > 1e-9)
      )
        return result
      el.dataset.testIdentityDraw = JSON.stringify({
        x: position?.x ?? left! + width / 2,
        y: position?.y ?? top! + height,
        actor: !!position,
        cached,
        width,
        height,
        ratio,
      })
    }
    return result
  } as typeof context.drawImage
}

async function readLocalNameplate(
  canvas: ReturnType<Page['locator']>,
  name: string,
  tileSize: number,
) {
  await expect
    .poll(() =>
      canvas.evaluate((el) => JSON.parse(el.dataset.testNameplateDraw ?? 'null')?.tileSize),
    )
    .toBeCloseTo(tileSize)
  const metrics = await canvas.evaluate((el) => {
    const identity = document.querySelector<HTMLCanvasElement>('canvas[data-world-identity]')!
    const bounds = identity.getBoundingClientRect()
    return {
      ...JSON.parse(el.dataset.testNameplateDraw!),
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
      backingWidth: identity.width,
      backingHeight: identity.height,
      density: devicePixelRatio || 1,
    }
  })
  const availableWidth = Math.max(112, (180 * metrics.tileSize) / 64) - 12
  if (metrics.fullNameWidth <= availableWidth) expect(metrics.text).toBe(name)
  else {
    expect(metrics.text).toMatch(/.+…$/)
    expect(name.startsWith(metrics.text.slice(0, -1))).toBe(true)
  }
  expect(metrics.textWidth).toBeLessThanOrEqual(availableWidth)
  expect(metrics.compressed).toBe(false)
  expect(metrics.align).toBe('left')
  expect(Number(/(\d+)px/.exec(metrics.font)![1])).toBeGreaterThanOrEqual(11)
  for (const value of [metrics.left, metrics.top, metrics.x, metrics.y])
    expect(value * metrics.density).toBeCloseTo(Math.round(value * metrics.density), 4)
  expect(metrics.width * metrics.density).toBeCloseTo(metrics.backingWidth, 1)
  expect(metrics.height * metrics.density).toBeCloseTo(metrics.backingHeight, 1)
  return metrics
}

export async function verifyWorldPresentation(
  page: Page,
  info: TestInfo,
  {
    enter,
    world,
    place,
    capture,
  }: {
    enter: (page: Page) => Promise<string>
    world: (page: Page) => Promise<WorldView>
    place: (characterId: string, sectorId: string, x: number, y: number) => void
    capture: (page: Page, info: TestInfo, name: string) => Promise<void>
  },
) {
  test.skip(info.project.name === 'laptop-chromium', 'Check mouse and touch layouts once each.')
  test.setTimeout(90000)
  if (info.project.name === 'desktop-chromium') {
    await page.goto('/')
    await expect(page.getByTestId('account-shell')).toBeVisible()
    const cursor = await page.locator('body').evaluate((el) => getComputedStyle(el).cursor)
    expect(cursor).toMatch(/url\(".*\/cursors\/stone-arrow\.png"\) 6 3, auto$/)
    const enterButton = page.getByRole('button', { name: 'Enter AUREVANE', exact: true })
    const handCursor = await enterButton.evaluate((el) => getComputedStyle(el).cursor)
    expect(handCursor).toMatch(/url\(".*\/cursors\/stone-hand\.png"\) 10 3, pointer$/)
    await expect(
      page.getByRole('link', { name: 'AUREVANE account entry home', exact: true }),
    ).toHaveCSS('cursor', handCursor)
    await expect(page.getByLabel('Email', { exact: true })).toHaveCSS('cursor', 'text')
    await expect(page.getByLabel('Password', { exact: true })).toHaveCSS('cursor', 'text')
    const recover = page.getByRole('button', { name: 'Forgot password?', exact: true })
    await expect(recover).toHaveCSS('cursor', handCursor)
    await recover.click()
    await expect(page.getByRole('button', { name: 'Send reset link', exact: true })).toHaveCSS(
      'cursor',
      handCursor,
    )
    await expect(page.getByLabel('Email', { exact: true })).toHaveCSS('cursor', 'text')
    for (const [style, hotspot] of [
      [cursor, { x: 6, y: 3 }],
      [handCursor, { x: 10, y: 3 }],
    ] as const) {
      const asset = await page.evaluate(
        async ({ style, hotspot }) => {
          const image = new Image()
          image.src = style.match(/url\("([^"]+)"\)/)![1]!
          await image.decode()
          const canvas = document.createElement('canvas')
          canvas.width = image.naturalWidth
          canvas.height = image.naturalHeight
          const context = canvas.getContext('2d')!
          context.drawImage(image, 0, 0)
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
          return {
            width: canvas.width,
            height: canvas.height,
            transparentPixels: pixels.filter((alpha, index) => index % 4 === 3 && alpha === 0)
              .length,
            hotspotAlpha: context.getImageData(hotspot.x, hotspot.y, 1, 1).data[3],
          }
        },
        { style, hotspot },
      )
      expect(asset.width).toBe(32)
      expect(asset.height).toBe(32)
      expect(asset.transparentPixels).toBeGreaterThan(0)
      expect(asset.hotspotAlpha).toBeGreaterThan(200)
    }
  }
  await enter(page)
  const initial = await world(page)
  if (info.project.name === 'mobile-chromium')
    await page.getByRole('button', { name: /Details/ }).click()
  await expect(page.getByRole('button', { name: 'View Town', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'View 360°', exact: true })).toHaveCount(0)
  place(initial.characterId, 'atlas:58:28', 6, 4)
  await page.reload()
  const canvas = page.locator('canvas[data-world-stage]'),
    workspace = page.locator('[data-world-workspace]'),
    panel = page.getByRole('complementary', { name: 'World details', exact: true })
  await expect(canvas).toHaveAttribute('data-camera-x', /\d/)
  if (info.project.name === 'mobile-chromium')
    await page.getByRole('button', { name: /Details/ }).click()
  const coordinates = workspace.locator('[data-world-coordinates]')
  await expect(coordinates).toHaveCount(1)
  await expect(panel.locator('[data-world-panel-foot] [data-world-coordinates]')).toHaveCount(1)
  await expect(coordinates).toContainText('Sector 817')
  await expect(coordinates).toContainText('X:6 · Y:4')
  await expect(page.getByRole('button', { name: 'View Town', exact: true })).toHaveCount(0)
  const labelsToggle = panel.getByRole('button', { name: 'Map location labels', exact: true })
  const ensureDetails = async () => {
    if (!(await labelsToggle.isVisible()))
      await page.getByRole('button', { name: 'Details', exact: true }).click()
  }
  await expect(labelsToggle).toHaveAttribute('aria-pressed', 'true')
  const labelsBox = (await labelsToggle.boundingBox())!
  const settingsBox = (await panel
    .getByRole('button', { name: 'Map settings', exact: true })
    .boundingBox())!
  expect(labelsBox.x + labelsBox.width).toBeLessThanOrEqual(settingsBox.x)
  expect(Math.abs(labelsBox.y - settingsBox.y)).toBeLessThan(2)
  await labelsToggle.click()
  await expect(labelsToggle).toHaveAttribute('aria-pressed', 'false')
  const mapSwitch = page.getByRole('button', { name: /Open world atlas/ })
  await expect(mapSwitch.locator('[data-world-map-switch]')).toBeVisible()
  await mapSwitch.click()
  await expect(workspace).toHaveAttribute('data-world-view', 'globe')
  // Opening the atlas uses the normal outside-click dismissal on phones.
  await ensureDetails()
  await expect(panel.locator('[data-world-position] [data-world-coordinates]')).toHaveCount(1)
  await expect(panel.locator('[data-world-panel-foot] [data-world-coordinates]')).toHaveCount(0)
  const closeDetails = page.getByRole('button', { name: 'Close details', exact: true })
  if (await closeDetails.isVisible()) await closeDetails.click()
  const currentPin = page.getByLabel('Your current position', { exact: true })
  await expect(currentPin).toBeVisible()
  const pinMetrics = await currentPin.evaluate((pin) => {
    const marker = pin.getBoundingClientRect()
    const label = pin.querySelector('span')!
    const style = getComputedStyle(label)
    const bounds = label.getBoundingClientRect()
    return {
      markerWidth: marker.width,
      markerHeight: marker.height,
      fontSize: parseFloat(style.fontSize),
      background: style.backgroundColor,
      insideViewport:
        bounds.left >= 0 &&
        bounds.top >= 0 &&
        bounds.right <= innerWidth &&
        bounds.bottom <= innerHeight,
    }
  })
  expect(pinMetrics.markerWidth).toBeGreaterThanOrEqual(12)
  expect(pinMetrics.markerHeight).toBeGreaterThanOrEqual(12)
  expect(pinMetrics.fontSize).toBeGreaterThanOrEqual(12)
  expect(pinMetrics.background).not.toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/)
  expect(pinMetrics.insideViewport).toBe(true)
  await capture(page, info, 'art-surfaces-world-current-position-globe')
  await ensureDetails()
  await expect(labelsToggle).toHaveAttribute('aria-pressed', 'false')
  const townMarkers = workspace.locator('[data-globe-town]')
  await expect(townMarkers.first()).toBeVisible()
  const townSymbols = townMarkers.locator('[data-globe-town-symbol]')
  await expect(townSymbols).toHaveCount(await townMarkers.count())
  const townIcons = await townSymbols.evaluateAll((markers) =>
    markers.map((marker) => {
      const style = getComputedStyle(marker)
      return {
        symbol: style.backgroundPosition,
        image: style.backgroundImage,
        width: marker.getBoundingClientRect().width,
        height: marker.getBoundingClientRect().height,
      }
    }),
  )
  expect(townIcons.length).toBeGreaterThan(1)
  expect(new Set(townIcons.map((icon) => icon.symbol)).size).toBe(townIcons.length)
  for (const icon of townIcons) {
    expect(icon.image).toContain('/media/art/world/runtime/atlas-markers-v01.webp')
    expect(icon.width).toBeGreaterThanOrEqual(20)
    expect(icon.width).toBeLessThanOrEqual(28)
    expect(icon.height).toBe(icon.width)
  }

  await expect(townMarkers.locator('span')).toHaveCount(0)
  await labelsToggle.click()
  await expect(townMarkers.locator('span').first()).toBeVisible()
  const returnSwitch = page.getByRole('button', { name: /Return to local map/ })
  await expect(returnSwitch.locator('[data-world-map-switch]')).toBeVisible()
  await returnSwitch.click()
  await expect(workspace).toHaveAttribute('data-world-view', 'sector')
  await ensureDetails()
  await expect(labelsToggle).toHaveAttribute('aria-pressed', 'true')
  expect((await world(page)).position).toEqual({ sectorId: 'atlas:58:28', x: 6, y: 4 })
  const verifyPlayerRows = async () => {
    // Presence can change between awaited locator calls. Measure the currently
    // rendered rows and their children in one DOM snapshot instead of retaining
    // positional locators that may refer to a different or removed player.
    const rows = await panel.locator('[data-world-player]').evaluateAll((elements) =>
      elements.map((row) => {
        const rect = (element: Element | null) => {
          if (!element?.getClientRects().length) return null
          const { x, y, width, height } = element.getBoundingClientRect()
          return { x, y, width, height }
        }
        return {
          identity: rect(row.querySelector('strong')),
          portrait: rect(row.querySelector('img, span')),
          actions: rect(row.querySelector('[data-world-player-actions]')),
          bounds: rect(row),
          buttons: Array.from(row.querySelectorAll('button'), rect),
        }
      }),
    )
    for (const { identity, portrait, actions, bounds, buttons } of rows) {
      if (!bounds) continue
      expect(identity).not.toBeNull()
      expect(portrait).not.toBeNull()
      expect(portrait!.width).toBeLessThanOrEqual(36)
      expect(portrait!.height).toBeLessThanOrEqual(36)
      expect(actions).not.toBeNull()
      // Common one/two-line identities must allow more rows in the same panel.
      // Narrow panels and longer names retain full readable wrapping.
      if (bounds.width >= 220 && identity!.height <= 45)
        expect(bounds.height).toBeLessThanOrEqual(info.project.name === 'mobile-chromium' ? 95 : 65)
      if (actions!.y < identity!.y + identity!.height - 1)
        expect(actions!.x).toBeGreaterThanOrEqual(identity!.x + identity!.width - 1)
      expect(actions!.x + actions!.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1)
      for (const box of buttons) {
        expect(box).not.toBeNull()
        expect(box!.x).toBeGreaterThanOrEqual(bounds.x)
        expect(box!.x + box!.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1)
        expect(box!.height).toBeGreaterThanOrEqual(
          info.project.name === 'mobile-chromium' ? 44 : 29,
        )
      }
    }
  }
  if (info.project.name === 'mobile-chromium') {
    await verifyPlayerRows()
    await expect(coordinates).toBeVisible()
    const bounds = (await panel.boundingBox())!,
      readout = (await coordinates.boundingBox())!,
      gear = (await panel.getByRole('button', { name: 'Map settings', exact: true }).boundingBox())!
    expect(readout.x).toBeGreaterThanOrEqual(bounds.x)
    expect(readout.x + readout.width).toBeLessThanOrEqual(gear.x)
    expect(readout.y + readout.height).toBeLessThanOrEqual(bounds.y + bounds.height)
    await page.getByRole('button', { name: /Close details/ }).click()
  }
  const cursor = await page.locator('body').evaluate((el) => getComputedStyle(el).cursor)
  expect(cursor).toMatch(/url\(".*\/cursors\/stone-arrow\.png"\) 6 3, auto$/)
  await expect(canvas).toHaveCSS('cursor', cursor)
  await expect(workspace.locator('footer')).toHaveCount(0)
  if (info.project.name === 'desktop-chromium') {
    for (const width of [800, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      const frame = (await workspace.boundingBox())!,
        bounds = (await panel.boundingBox())!
      expect(Math.abs(bounds.width - (frame.width - 2) / 4)).toBeLessThanOrEqual(1)
      for (const tab of await panel.getByRole('tab').all()) {
        const box = (await tab.boundingBox())!
        expect(box.x).toBeGreaterThanOrEqual(bounds.x)
        expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1)
      }
      await verifyPlayerRows()
      const map = (await canvas.boundingBox())!
      expect(Math.abs(map.y + map.height - (frame.y + frame.height - 1))).toBeLessThanOrEqual(1)
    }
    const gear = panel.getByRole('button', { name: 'Map settings', exact: true })
    await expect(gear).toHaveCSS('cursor', /url\(".*\/cursors\/stone-hand\.png"\) 10 3, pointer$/)
    await expect(gear.locator('svg')).toBeVisible()
    const bounds = (await panel.boundingBox())!,
      button = (await gear.boundingBox())!
    expect(button.y + button.height).toBeGreaterThan(bounds.y + bounds.height - 55)
    const readout = (await coordinates.boundingBox())!
    expect(readout.x).toBeGreaterThanOrEqual(bounds.x)
    expect(readout.x + readout.width).toBeLessThanOrEqual(button.x)
    expect(readout.y + readout.height).toBeLessThanOrEqual(bounds.y + bounds.height)
  }
  const before = await world(page),
    box = (await canvas.boundingBox())!,
    camera = await canvas.evaluate((el) => [el.dataset.cameraX, el.dataset.cameraY])
  // Real pointer drag must neither move the camera nor submit a route.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 75, box.y + box.height / 2 + 25, { steps: 6 })
  await page.mouse.up()
  expect(await canvas.evaluate((el) => [el.dataset.cameraX, el.dataset.cameraY])).toEqual(camera)
  expect((await world(page)).position).toEqual(before.position)
  expect((await world(page)).route).toHaveLength(0)
  await expect(workspace.locator('[data-world-travel-status]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Stop travel', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'View 360°', exact: true })).toHaveCount(0)
  await canvas.press('d')
  await expect
    .poll(
      async () => {
        // Movement may invalidate both bounded scene-read attempts. Wait for a
        // coherent snapshot; every other failed response remains a hard failure.
        const response = await page.request.get('/api/world')
        if (response.status() === 409) {
          expect((await response.json()).error?.code).toBe('STALE_VERSION')
          return null
        }
        expect(response.ok(), `World movement snapshot status ${response.status()}`).toBe(true)
        const { position, route } = (await response.json()) as WorldView
        return { position, remainingSteps: route.length }
      },
      { timeout: 12000 },
    )
    .toEqual({ position: { sectorId: 'atlas:58:28', x: 7, y: 4 }, remainingSteps: 0 })
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-camera-x')), { timeout: 5000 })
    .toBe(58 * GRID_WIDTH + 7.5)
  await expect(coordinates).toContainText('Sector 817')
  await expect(coordinates).toContainText('X:7 · Y:4')
  const after = (await canvas.boundingBox())!
  expect(after).toEqual(box)
  await capture(page, info, 'world-refined-controls')
  // Reject only the next command in this disposable session. No state is committed.
  await page.route('**/api/world', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 503,
          json: { error: { message: 'Travel is temporarily unavailable.' } },
        })
      : route.continue(),
  )
  await canvas.press('a')
  const notice = workspace.getByRole('alert')
  await expect(notice).toContainText('Travel is temporarily unavailable.')
  await expect(notice).toBeInViewport({ ratio: 1 })
  await capture(page, info, 'world-visible-travel-error')
}

export function registerWorldInputCases({
  enter,
  world,
  place,
  stageWalk,
  capture,
  openJournal,
}: {
  enter: (page: Page) => Promise<string>
  world: (page: Page) => Promise<WorldView>
  place: (characterId: string, sectorId: string, x: number, y: number) => void
  stageWalk: (page: Page, destination: { sectorId: string; x: number; y: number }) => Promise<void>
  capture: (page: Page, info: TestInfo, name: string) => Promise<void>
  openJournal: (page: Page) => Promise<void>
}) {
  test('the reported Emberreach position renders surrounding ground at normal and minimum zoom', async ({
    page,
  }, info) => {
    test.setTimeout(60000)
    test.skip(
      info.project.name === 'laptop-chromium',
      'Check the reported ground on desktop and phone.',
    )
    await enter(page)
    const initial = await world(page)
    place(initial.characterId, 'atlas:76:25', 9, 4)
    await page.reload()
    const canvas = page.locator('canvas[data-world-stage]')
    await expect(canvas).toHaveAttribute('data-camera-x', /\d/)
    const view = await world(page)
    expect(view.position).toEqual({ sectorId: 'atlas:76:25', x: 9, y: 4 })
    const baseTile = await canvas.evaluate((el) => (el.clientWidth < 600 ? 48 : 64))
    for (const zoom of [0, worldZoomPercent(1)]) {
      await openMapSettings(page)
      const slider = page.getByRole('slider', { name: 'Zoom level', exact: true })
      await slider.fill(String(zoom))
      await expect(slider).toHaveValue(String(zoom))
      await closeMapSettings(page)
      await expect(canvas).toHaveAttribute(
        'data-tile-size',
        String(baseTile * worldZoomFromPercent(zoom)),
      )
      await expect
        .poll(() => canvas.evaluate((el) => Number(el.dataset.cachedSectors)))
        .toBeGreaterThan(1)
      await capture(page, info, `emberreach-reported-ground-${zoom}`)
    }
  })
  test('a large map preloads its public viewport and accepts clicks beyond the peer scene', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'Exercise the larger mouse viewport once.')
    test.setTimeout(60000)
    await enter(page)
    const initial = await world(page)
    place(initial.characterId, 'atlas:62:28', 6, 4)
    await page.reload()
    const canvas = page.locator('canvas[data-world-stage]')
    await expect(canvas).toHaveAttribute('data-camera-x', /\d/)
    const expanded = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return (
        response.request().method() === 'GET' &&
        url.pathname === '/api/world' &&
        Number(url.searchParams.get('sceneWidth')) > 1296
      )
    })
    // At the new minimum zoom a 3200px window fits in the initial scene.
    // A larger window still requires an expanded public viewport receipt.
    await page.setViewportSize({ width: 3840, height: 2304 })
    const receipt = await expanded
    expect(receipt.ok()).toBe(true)
    const view = (await receipt.json()) as WorldView
    const size = await canvas.evaluate((el) => ({ width: el.clientWidth, height: el.clientHeight }))
    expect(size.width).toBeGreaterThan(1296)
    expect(new URL(receipt.url()).searchParams.get('sceneWidth')).toBe(String(size.width))
    const camera = mapPoint(view.position, view.sectors)
    expect(worldSceneCoversViewport(view, [camera], { ...size, tile: 64 * WORLD_MIN_ZOOM })).toBe(
      true,
    )
    expect(view.sectors.length).toBeLessThanOrEqual(25)
    await openMapSettings(page)
    const zoom = page.getByRole('slider', { name: 'Zoom level', exact: true })
    await zoom.focus()
    await zoom.press('Home')
    await expect(zoom).toHaveValue('0')
    await closeMapSettings(page)
    await expect(canvas).toHaveAttribute('data-tile-size', String(64 * WORLD_MIN_ZOOM))
    const target = worldRenderTerrain(view)
      .filter((sector) => !view.sectors.some((known) => known.id === sector.id))
      .flatMap((sector) =>
        sector.cells
          .filter((cell) => cell.walkable)
          .map((cell) => {
            const position = { sectorId: sector.id, x: cell.x, y: cell.y }
            return {
              position,
              point: projectMapPoint(
                mapPoint(position, [sector], camera),
                camera,
                { x: 0, y: 0 },
                64 * WORLD_MIN_ZOOM,
                size.width,
                size.height,
              ),
            }
          }),
      )
      .find(
        ({ point }) =>
          point.x > 40 && point.x < size.width * 0.7 && point.y > 80 && point.y < size.height - 80,
      )
    expect(target).toBeDefined()
    const approval = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/world' &&
        response.request().postDataJSON()?.intent?.kind === 'walk',
    )
    await canvas.click({ position: target!.point })
    const approved = await approval
    expect(approved.status()).toBe(200)
    const route = (await approved.json()) as WorldView
    expect(route.routeDestination ?? route.route.at(-1)?.position).toEqual(target!.position)
    await capture(page, info, 'large-viewport-public-ground-click-approved')
    const stopped = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/world' &&
        response.request().postDataJSON()?.intent?.kind === 'stop',
    )
    await canvas.press('Escape')
    expect((await stopped).status()).toBe(200)
    expect((await world(page)).route).toHaveLength(0)
  })
  test('snowy supplied ground survives a 25-sector movement replacement while scene loading waits', async ({
    page,
  }, info) => {
    test.skip(
      info.project.name === 'laptop-chromium',
      'Desktop and phone exercise the same receipt boundary.',
    )
    test.setTimeout(90000)
    await enter(page)
    const initial = await world(page)
    place(initial.characterId, 'frostmere', 6, 4)
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const reads: Promise<void>[] = []
    const requests: { method: string; at: number }[] = []
    const recordRequest = (request: import('@playwright/test').Request) => {
      if (new URL(request.url()).pathname === '/api/world')
        requests.push({ method: request.method(), at: Date.now() })
    }
    page.on('request', recordRequest)
    const holdScenes = (route: import('@playwright/test').Route) => {
      if (route.request().method() !== 'GET') return route.continue()
      const pending = gate.then(() => route.continue())
      reads.push(pending)
      return pending
    }
    await page.route('**/api/world*', holdScenes)
    try {
      // The server-rendered initial view supplies the canonical baseline. Only
      // subsequent scene reads wait; every movement command remains real.
      await page.reload()
      const canvas = page.locator('canvas[data-world-stage]')
      await expect(canvas).toHaveAttribute('data-camera-x', /\d/)
      const baseline = await world(page)
      const supplied = worldRenderTerrain(baseline)
      const displaced = baseline.sectors[24]!
      expect(displaced.charted).toBe(true)
      const destinationSector = supplied
        .filter(
          (sector) =>
            !baseline.sectors.some((known) => known.id === sector.id) &&
            sector.cells.some((cell) => cell.x === 6 && cell.y === 4 && cell.walkable),
        )
        .sort((a, b) => {
          const distance = (sector: typeof a) =>
            (sector.atlasColumn! - displaced.atlasColumn!) ** 2 +
            (sector.atlasRow! - displaced.atlasRow!) ** 2
          return distance(a) - distance(b)
        })[0]!
      expect(destinationSector).toBeDefined()
      const destination = { sectorId: destinationSector.id, x: 6, y: 4 }
      await openMapSettings(page)
      const zoom = page.getByRole('slider', { name: 'Zoom level', exact: true })
      await zoom.focus()
      await zoom.press('Home')
      await expect(zoom).toHaveValue('0')
      await closeMapSettings(page)
      await canvas.evaluate(installWorldRenderTiming)
      await canvas.evaluate(installWorldGroundCoverage)
      await expect.poll(() => canvas.getAttribute('data-painted-ground-ids')).not.toBeNull()
      const accepted = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/api/world' &&
          response.request().postDataJSON()?.intent?.kind === 'walk',
      )
      await stageWalk(page, destination)
      // Globe-based travel replaces the map canvas. Its new paint recorder must
      // be enabled before inspecting the fully approved movement across sectors.
      await expect(canvas).toHaveAttribute('data-test-ground-coverage', /^\[/)
      expect((await accepted).status()).toBe(200)
      await expect
        .poll(async () => (await world(page)).position, { timeout: 30000 })
        .toEqual(destination)
      const targetX = destinationSector.atlasColumn! * GRID_WIDTH + 6.5
      const targetY = destinationSector.atlasRow! * GRID_HEIGHT + 4.5
      await expect
        .poll(() =>
          canvas.evaluate((element) => ({
            x: Number(element.dataset.cameraX),
            y: Number(element.dataset.cameraY),
          })),
        )
        .toMatchObject({ x: expect.closeTo(targetX, 1), y: expect.closeTo(targetY, 1) })
      const frames = await canvas.evaluate((element) => {
        element.dataset.testGroundCoverageStopped = 'true'
        return JSON.parse(element.dataset.testGroundCoverage ?? '[]') as GroundCoverageFrame[]
      })
      expect(frames.length).toBeGreaterThan(20)
      const holes = frames.flatMap((frame) =>
        missingPublicGround(supplied, frame).map((id) => ({ at: frame.at, id })),
      )
      expect(
        holes,
        'Previously supplied canonical public ground must remain painted each frame.',
      ).toEqual([])
      const witnesses = frames.filter(
        (frame) =>
          Math.hypot(wrappedMapX(targetX, frame.x) - frame.x, targetY - frame.y) < 3 &&
          missingPublicGround([displaced], { ...frame, painted: [] }).length,
      )
      expect(
        witnesses.length,
        'The displaced 25th sector body must be on screen after the real crossing.',
      ).toBeGreaterThan(0)
      await capture(page, info, 'snowy-ground-after-authority-replacement')
      const timings = await canvas.getAttribute('data-test-render-timings')
      await info.attach('snowy-ground-coverage-and-timing.json', {
        body: JSON.stringify({ frames, timings: JSON.parse(timings ?? '[]'), requests }),
        contentType: 'application/json',
      })
    } finally {
      release()
      await Promise.allSettled(reads)
      await page.unroute('**/api/world*', holdScenes)
      page.off('request', recordRequest)
      place(initial.characterId, initial.position.sectorId, initial.position.x, initial.position.y)
    }
  })
  test('minimum-zoom public scenery stays painted while walking with delayed scene hydration', async ({
    page,
  }, info) => {
    test.skip(info.project.name === 'laptop-chromium', 'Check mouse and touch coverage once each.')
    test.setTimeout(60000)
    // Keep more than 25 sectors in the desktop field of view at the new minimum zoom.
    if (info.project.name === 'desktop-chromium')
      await page.setViewportSize({ width: 2400, height: 1500 })
    await enter(page)
    const initial = await world(page)
    place(initial.characterId, 'atlas:62:28', 6, 4)
    await page.reload()
    const canvas = page.locator('canvas[data-world-stage]')
    await expect(canvas).toHaveAttribute('data-camera-x', /\d/)
    await openMapSettings(page)
    const zoom = page.getByRole('slider', { name: 'Zoom level', exact: true })
    await zoom.focus()
    await zoom.press('Home')
    await expect(zoom).toHaveValue('0')
    await closeMapSettings(page)
    await canvas.evaluate(installWorldGroundCoverage)
    const delayedReads: Promise<void>[] = []
    let delayEnabled = true
    const delayScene = (route: import('@playwright/test').Route) => {
      if (delayEnabled && route.request().method() === 'GET') {
        const response = (async () => {
          const receipt = await route.fetch()
          await page.waitForTimeout(900)
          await route.fulfill({ response: receipt })
        })()
        delayedReads.push(response)
        void response.catch(() => {})
        return response
      }
      return route.continue()
    }
    await page.route('**/api/world*', delayScene)
    try {
      const dispatched = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/api/world' &&
          response.request().postDataJSON()?.intent?.kind === 'walk' &&
          response.request().postDataJSON()?.intent?.destination?.sectorId === 'atlas:63:28',
      )
      await stageWalk(page, { sectorId: 'atlas:63:28', x: 6, y: 4 })
      expect((await dispatched).status()).toBe(200)
      const minPainted = info.project.name === 'desktop-chromium' ? 25 : 0
      await expect
        .poll(async () => {
          const painted = await canvas.getAttribute('data-painted-ground-ids')
          return painted ? new Set<string>(JSON.parse(painted)).size : 0
        })
        .toBeGreaterThan(minPainted)
      // Check the composited result even when many sectors share one cached draw.
      const shot = await canvas.screenshot()
      const { width, height } = await sharp(shot).metadata()
      const side = Math.floor(Math.min(width!, height!) / 6)
      for (const left of [0, width! - side]) {
        for (const top of [0, height! - side]) {
          const { data, info: raster } = await sharp(shot)
            .extract({ left, top, width: side, height: side })
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true })
          const colours = new Set<number>()
          for (let i = 0; i < data.length; i += raster.channels * 3) {
            colours.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!)
          }
          expect(colours.size, 'Ground detail reaches every corner').toBeGreaterThan(48)
        }
      }
      await capture(page, info, 'minimum-zoom-scenery-during-walk')
      await expect
        .poll(async () => (await world(page)).position, { timeout: 12000 })
        .toEqual({ sectorId: 'atlas:63:28', x: 6, y: 4 })
      await capture(page, info, 'minimum-zoom-scenery-arrival')
    } finally {
      delayEnabled = false
      const reads = await Promise.allSettled(delayedReads)
      await page.unroute('**/api/world*', delayScene)
      const failure = reads.find((response) => response.status === 'rejected')
      if (failure?.status === 'rejected') throw failure.reason
      // A later viewport project must not click this fixture's portrait at
      // the same destination instead of the intended ground tile.
      place(initial.characterId, initial.position.sectorId, initial.position.x, initial.position.y)
    }
  })
  test('a distant click stays continuous when a delayed confirmation takes another legal route', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'Verify delayed route reconciliation once.')
    test.setTimeout(60000)
    await enter(page)
    const initial = await world(page)
    place(initial.characterId, 'atlas:58:28', 6, 4)
    await page.reload()
    const canvas = page.locator('canvas[data-world-stage]')
    await expect(canvas).toHaveAttribute('data-camera-x', /\d/)
    const destination = { sectorId: 'atlas:58:28', x: 9, y: 1 }
    const sector = (await world(page)).sectors.find((s) => s.id === destination.sectorId)!
    const alternative = [
      [7, 4],
      [7, 3],
      [8, 3],
      [8, 2],
      [8, 1],
      [9, 1],
    ].map(([x, y]) => ({
      position: { sectorId: destination.sectorId, x: x!, y: y! },
      durationMs: 200,
    }))
    expect(
      alternative.every((step) =>
        sector.cells.some(
          (cell) => cell.x === step.position.x && cell.y === step.position.y && cell.walkable,
        ),
      ),
    ).toBe(true)
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let intercepted = false
    // Rendering fixture only: retain the real command/version/destination, but
    // present an equally legal route as if the server's tie-breaking differed.
    // The projection/motion unit integration separately exercises real authority.
    await page.route('**/api/world', async (route) => {
      if (
        !intercepted &&
        route.request().method() === 'POST' &&
        route.request().postDataJSON()?.intent?.kind === 'walk'
      ) {
        intercepted = true
        const response = await route.fetch()
        expect(response.ok()).toBe(true)
        const receipt = (await response.json()) as WorldView
        expect(receipt.route.at(-1)!.position).toEqual(destination)
        await gate
        await route.fulfill({ response, json: { ...receipt, route: alternative } })
      } else await route.continue()
    })
    try {
      await stageWalk(page, destination)
      const expectedX = sector.atlasColumn! * GRID_WIDTH + destination.x + 0.5
      await expect
        .poll(() => canvas.evaluate((el) => Number(el.dataset.cameraX)), { timeout: 8000 })
        .toBeCloseTo(expectedX, 2)
      await canvas.evaluate((el) => {
        const samples = [Number(el.dataset.cameraX)],
          start = performance.now()
        const record = () => {
          samples.push(Number(el.dataset.cameraX))
          if (performance.now() - start < 2200) requestAnimationFrame(record)
          else el.dataset.testDistantCamera = JSON.stringify(samples)
        }
        requestAnimationFrame(record)
      })
      release()
      await expect(canvas).toHaveAttribute('data-test-distant-camera', /\[/, { timeout: 8000 })
      const samples = JSON.parse(
        (await canvas.getAttribute('data-test-distant-camera'))!,
      ) as number[]
      expect(Math.min(...samples)).toBeGreaterThanOrEqual(expectedX - 0.1)
      await expect
        .poll(
          async () => ({
            position: (await world(page)).position,
            remaining: (await world(page)).route.length,
          }),
          { timeout: 12000 },
        )
        .toEqual({ position: destination, remaining: 0 })
      await expect
        .poll(() => canvas.evaluate((el) => Number(el.dataset.cameraY)))
        .toBeCloseTo(sector.atlasRow! * GRID_HEIGHT + destination.y + 0.5, 2)
      await capture(page, info, 'distant-click-different-confirmed-path')
    } finally {
      release()
    }
  })
  test('a pointer direction change keeps moving past three tiles while approval is delayed', async ({
    page,
  }, info) => {
    test.skip(info.project.name === 'laptop-chromium', 'Check mouse and touch once each.')
    test.setTimeout(60000)
    await enter(page)
    const initial = await world(page)
    // Keep each layout away from the shared arrival fixtures and from the
    // other layout's traveller: a real touch on a peer opens its details.
    const origin = {
      sectorId: info.project.name === 'mobile-chromium' ? 'atlas:66:23' : 'atlas:20:33',
      x: 6,
      y: 4,
    }
    place(initial.characterId, origin.sectorId, origin.x, origin.y)
    await page.clock.install()
    await page.reload()
    const canvas = page.locator('canvas[data-world-stage]')
    await expect(canvas).toHaveAttribute('data-camera-x', /\d/)
    const scene = await world(page)
    expect(scene.players).toHaveLength(0)
    const destination = { ...origin, y: 0 }
    const point = (position: typeof origin) => mapPoint(position, scene.sectors)
    const clickGround = async (position: typeof origin) => {
      const metrics = await canvas.evaluate((el) => {
        const box = el.getBoundingClientRect()
        return {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          camera: { x: Number(el.dataset.cameraX), y: Number(el.dataset.cameraY) },
          travellerX: Number(el.dataset.travellerX),
          tile: Number(el.dataset.tileSize),
        }
      })
      const target = projectMapPoint(
        point(position),
        metrics.camera,
        { x: 0, y: 0 },
        metrics.tile,
        metrics.width,
        metrics.height,
      )
      expect(target.x).toBeGreaterThan(0)
      expect(target.x).toBeLessThan(metrics.width)
      expect(target.y).toBeGreaterThan(0)
      expect(target.y).toBeLessThan(metrics.height)
      if (position.y === destination.y) {
        expect(metrics.travellerX).toBeGreaterThan(point(origin).x)
        expect(metrics.travellerX).toBeLessThan(point(origin).x + 1)
      }
      if (info.project.name === 'mobile-chromium')
        await page.touchscreen.tap(metrics.x + target.x, metrics.y + target.y)
      else await page.mouse.click(metrics.x + target.x, metrics.y + target.y)
    }
    let delayed = false,
      firstHeld = false
    let releaseFirst!: () => void, releaseTurn!: () => void, turnReady!: () => void
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const turnGate = new Promise<void>((resolve) => {
      releaseTurn = resolve
    })
    const turnResponseReady = new Promise<void>((resolve) => {
      turnReady = resolve
    })
    await page.route('**/api/world', async (route) => {
      const request = route.request()
      const target =
        request.method() === 'POST' ? request.postDataJSON()?.intent?.destination : null
      if (!firstHeld && target?.x === 9 && target?.y === origin.y) {
        firstHeld = true
        const response = await route.fetch()
        expect(response.ok()).toBe(true)
        await firstGate
        await route.fulfill({ response })
      } else if (!delayed && request.method() === 'POST' && target?.y === destination.y) {
        delayed = true
        const response = await route.fetch()
        expect(response.ok()).toBe(true)
        // Keep the real receipt and route. Deliver at an exact visual-clock
        // phase so protocol/runner delays cannot miss the partial turn.
        turnReady()
        await turnGate
        await route.fulfill({ response })
      } else await route.continue()
    })
    await page.clock.pauseAt(new Date(Date.now() + 1000))
    const nextWalk = () =>
      page.waitForRequest(
        (request) =>
          request.method() === 'POST' &&
          new URL(request.url()).pathname === '/api/world' &&
          request.postDataJSON()?.intent?.kind === 'walk',
      )
    try {
      const firstRequest = nextWalk()
      await clickGround({ ...origin, x: 9 })
      expect((await firstRequest).postDataJSON().intent.destination).toEqual({ ...origin, x: 9 })
      await page.clock.runFor(75)
      const startPoint = point(origin)
      await expect
        .poll(() => canvas.evaluate((el) => Number(el.dataset.travellerX)), { intervals: [10] })
        .toBeGreaterThan(startPoint.x + 0.25)
      await canvas.evaluate((el) => {
        el.addEventListener(
          'pointerup',
          () => {
            const samples: { time: number; x: number; y: number }[] = []
            const start = performance.now()
            const record = () => {
              const time = performance.now() - start
              samples.push({
                time,
                x: Number(el.dataset.travellerX),
                y: Number(el.dataset.travellerY),
              })
              el.dataset.testTurnSamples = JSON.stringify(samples)
              if (time < 1100) requestAnimationFrame(record)
            }
            requestAnimationFrame(record)
          },
          { once: true },
        )
      })
      const turnRequest = nextWalk()
      await clickGround(destination)
      releaseFirst()
      expect((await turnRequest).postDataJSON().intent.destination).toEqual(destination)
      await turnResponseReady
      await page.clock.runFor(710)
      await expect(canvas).toHaveAttribute('data-test-turn-samples', /\[/)
      expect(delayed).toBe(true)
      const samples = JSON.parse((await canvas.getAttribute('data-test-turn-samples'))!) as {
        time: number
        x: number
        y: number
      }[]
      // Ignore initial pointer scheduling; the new route has four legal steps,
      // so it cannot have reached its destination during this observation.
      const during = samples.filter((sample) => sample.time >= 120 && sample.time <= 705)
      expect(during.length).toBeGreaterThan(10)
      let lastMove = during[0]!.time
      let longestPause = 0
      for (let i = 1; i < during.length; i++) {
        const previous = during[i - 1]!,
          current = during[i]!
        if (Math.hypot(current.x - previous.x, current.y - previous.y) > 0.001)
          lastMove = current.time
        else longestPause = Math.max(longestPause, current.time - lastMove)
      }
      await info.attach('pointer-turn-motion', {
        body: JSON.stringify({ samples, longestPause }),
        contentType: 'application/json',
      })
      expect(longestPause).toBeLessThan(60)
      const approval = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/api/world' &&
          response.request().postDataJSON()?.intent?.destination?.y === destination.y,
      )
      releaseTurn()
      await (await approval).finished()
      await page.clock.runFor(16)
      const afterApproval = await canvas.evaluate((el) => ({
        x: Number(el.dataset.travellerX),
        y: Number(el.dataset.travellerY),
      }))
      await page.clock.runFor(32)
      const continuing = await canvas.evaluate((el) => ({
        x: Number(el.dataset.travellerX),
        y: Number(el.dataset.travellerY),
      }))
      expect(continuing).not.toEqual(afterApproval)
      await page.clock.resume()
      await expect
        .poll(
          async () => {
            const current = await world(page)
            return { position: current.position, remaining: current.route.length }
          },
          { timeout: 12000 },
        )
        .toEqual({ position: destination, remaining: 0 })
      await capture(page, info, 'pointer-turn-delayed-approval-arrival')
    } finally {
      releaseFirst()
      releaseTurn()
      await page.clock.resume()
    }
  })
  for (const mode of ['effects off', 'reduced motion']) {
    test(`a ground click fully draws its arrival without further pointer input with ${mode}`, async ({
      page,
    }, info) => {
      test.skip(
        info.project.name !== 'desktop-chromium',
        'Verify the terminal drawing once per animation mode.',
      )
      test.setTimeout(60000)
      if (mode === 'reduced motion') await page.emulateMedia({ reducedMotion: 'reduce' })
      await enter(page)
      const initial = await world(page)
      place(initial.characterId, 'atlas:58:28', 6, 4)
      await page.reload()
      const canvas = page.locator('canvas[data-world-stage]')
      await expect(canvas).toBeVisible()
      if (mode === 'effects off') {
        await openMapSettings(page)
        await page.getByRole('checkbox', { name: 'Ambient animation', exact: true }).uncheck()
        await closeMapSettings(page)
      }
      await canvas.evaluate(captureLocalIdentity, APPEARANCE_FRAME)
      // Separate empty destinations keep a preceding case's token out of the click.
      const destination = { sectorId: 'atlas:58:28', x: mode === 'effects off' ? 9 : 8, y: 4 }
      await stageWalk(page, destination)
      // No pointer input may wake the renderer after this click.
      await expect
        .poll(
          async () => ({
            position: (await world(page)).position,
            remaining: (await world(page)).route.length,
          }),
          { timeout: 12000 },
        )
        .toEqual({ position: destination, remaining: 0 })
      const sector =
        initial.sectors.find((s) => s.id === destination.sectorId) ??
        (await world(page)).sectors.find((s) => s.id === destination.sectorId)!
      const target = {
        x: sector.atlasColumn! * GRID_WIDTH + destination.x + 0.5,
        y: sector.atlasRow! * GRID_HEIGHT + destination.y + 0.5,
      }
      await expect
        .poll(() =>
          canvas.evaluate((el, target) => {
            const x = Number(el.dataset.cameraX),
              y = Number(el.dataset.cameraY),
              tile = Number(el.dataset.tileSize)
            const expectedX = el.clientWidth / 2 + (target.x - x - (target.y - y)) * tile * 0.85,
              expectedY = el.clientHeight / 2 + (target.x - x + (target.y - y)) * tile * 0.44,
              draw = JSON.parse(el.dataset.testIdentityDraw ?? 'null'),
              tolerance = 0.5 / (draw?.ratio ?? 1) + 1e-9
            return {
              camera: { x, y },
              drawnAtTarget:
                !!draw &&
                Math.abs(draw.x - expectedX) <= tolerance &&
                Math.abs(draw.y - expectedY) <= tolerance,
            }
          }, target),
        )
        .toEqual({ camera: target, drawnAtTarget: true })
      await capture(page, info, `motionless-cursor-arrival-${mode.replaceAll(' ', '-')}`)
    })
  }

  test('player nameplates stay readable on native-density desktop and mobile at all terrain zooms', async ({
    page,
  }, info) => {
    test.skip(
      info.project.name === 'laptop-chromium',
      'Desktop and high-DPI touch layouts cover density.',
    )
    const name = await enter(page)
    const canvas = page.locator('canvas[data-world-stage]')
    await expect(canvas).toHaveAttribute('data-character-name', name)
    await canvas.evaluate(captureLocalNameplate)
    await openMapSettings(page)
    await page.getByRole('checkbox', { name: 'Ambient animation', exact: true }).uncheck()
    const slider = page.getByRole('slider', { name: 'Zoom level', exact: true })
    for (const zoom of [0, 100, worldZoomPercent(1)]) {
      await slider.fill(String(zoom))
      await expect(slider).toHaveValue(String(zoom))
      const baseTileSize = await canvas.evaluate((el) => (el.clientWidth < 600 ? 48 : 64))
      const metrics = await readLocalNameplate(
        canvas,
        name,
        baseTileSize * worldZoomFromPercent(zoom),
      )
      await info.attach(`nameplate-native-${zoom}`, {
        body: JSON.stringify({ zoom, ...metrics }, null, 2),
        contentType: 'application/json',
      })
      await capture(page, info, `portrait-zoom-nameplates-${zoom}`)
    }
    await closeMapSettings(page)
  })

  test('zoom controls live in Settings and the shared lock blocks map and globe wheel zoom', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'Exercise mouse/trackpad zoom once.')
    test.setTimeout(90000)
    const name = await enter(page)
    const canvas = page.locator('canvas[data-world-stage]')
    await expect(canvas).toHaveAttribute('data-character-name', name)
    await canvas.evaluate(captureLocalNameplate)
    await canvas.evaluate(captureLocalIdentity, APPEARANCE_FRAME)
    const verifyPortraitZoom = async (zoom: number) => {
      await expect(canvas).toHaveAttribute(
        'data-tile-size',
        String(64 * worldZoomFromPercent(zoom)),
      )
      await expect
        .poll(() =>
          canvas.evaluate((el, frame) => {
            if (!el.dataset.testIdentityDraw) return false
            const { width, height, ratio, actor, cached } = JSON.parse(
              el.dataset.testIdentityDraw,
            ) as {
              width: number
              height: number
              ratio: number
              actor: boolean
              cached: boolean
            }
            const tile = Number(el.dataset.tileSize)
            if (tile >= 42) {
              const scale = (tile / 64) * 1.22
              const expected = (side: number) =>
                cached ? (Math.ceil(side * (scale * ratio)) + 8) / ratio : side * scale
              return actor && width === expected(frame.width) && height === expected(frame.height)
            }
            if (actor) return false
            const expected = Math.round(((34 * tile) / 64) * ratio) / ratio
            return width === expected && height === expected
          }, APPEARANCE_FRAME),
        )
        .toBe(true)
      const nameplate = await readLocalNameplate(canvas, name, 64 * worldZoomFromPercent(zoom))
      const metrics = await canvas.evaluate((el) => ({
        tileSize: Number(el.dataset.tileSize),
        ...JSON.parse(el.dataset.testIdentityDraw!),
      }))
      await info.attach(`portrait-zoom-${zoom}`, {
        body: JSON.stringify({ zoom, ...metrics, nameplate }, null, 2),
        contentType: 'application/json',
      })
      await capture(page, info, `portrait-zoom-${zoom}`)
    }
    await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toHaveCount(0)
    await openMapSettings(page)
    const slider = page.getByRole('slider', { name: 'Zoom level', exact: true })
    await slider.press('Home')
    await expect(slider).toHaveValue('0')
    await page.getByRole('checkbox', { name: 'Ambient animation', exact: true }).uncheck()
    await expect(canvas).toHaveAttribute('data-tile-size', String(64 * WORLD_MIN_ZOOM))
    await verifyPortraitZoom(0)
    await slider.press('End')
    await expect(slider).toHaveValue('100')
    await verifyPortraitZoom(100)
    const normalZoom = worldZoomPercent(1)
    await slider.fill(String(normalZoom))
    await expect(slider).toHaveValue(String(normalZoom))
    await verifyPortraitZoom(normalZoom)
    await slider.press('Home')
    await expect(slider).toHaveValue('0')
    await expect(canvas).toHaveAttribute('data-tile-size', String(64 * WORLD_MIN_ZOOM))
    const beforeZoom = await canvas.screenshot()
    for (let i = 0; i < 5; i++) await slider.press('ArrowRight')
    await expect(slider).toHaveValue('5')
    await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Zoom out', exact: true })).toHaveCount(0)
    // The popup blocks input, not rendering: slider changes must paint while open.
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-tile-size')))
      .toBeCloseTo(64 * worldZoomFromPercent(5))
    // Browser screenshots remain readable when public avatars taint the canvas.
    expect((await canvas.screenshot()).equals(beforeZoom)).toBe(false)
    await page.getByRole('button', { name: 'Zoom lock Off', exact: true }).click()
    await capture(page, info, 'restored-map-settings')
    await closeMapSettings(page)
    await canvas.hover()
    const locked = await canvas.getAttribute('data-tile-size')
    const pageScale = await page.evaluate(() => ({
      width: innerWidth,
      ratio: devicePixelRatio,
      scale: visualViewport?.scale,
    }))
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -120)
    await page.keyboard.up('Control')
    await page.mouse.wheel(0, -160)
    await page.waitForTimeout(250)
    expect(await canvas.getAttribute('data-tile-size')).toBe(locked)
    expect(
      await page.evaluate(() => ({
        width: innerWidth,
        ratio: devicePixelRatio,
        scale: visualViewport?.scale,
      })),
    ).toEqual(pageScale)
    await page.getByRole('button', { name: /Open world atlas/ }).click()
    await expect(
      page.getByRole('button', { name: 'Isola · Return to local map', exact: true }),
    ).toBeVisible()
    const globe = page.getByRole('group', { name: /World globe/ })
    await globe.hover()
    const pin = page.getByLabel('Your current position', { exact: true }),
      oldPin = await pin.getAttribute('style')
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -120)
    await page.keyboard.up('Control')
    await page.mouse.wheel(0, -160)
    await page.waitForTimeout(250)
    expect(await pin.getAttribute('style')).toBe(oldPin)
    expect(
      await page.evaluate(() => ({
        width: innerWidth,
        ratio: devicePixelRatio,
        scale: visualViewport?.scale,
      })),
    ).toEqual(pageScale)
    await openMapSettings(page)
    await expect(page.getByRole('slider', { name: 'Zoom level', exact: true })).toHaveValue(
      String(worldZoomPercent(0.94, GLOBE_MAX_ZOOM)),
    )
    await slider.press('End')
    await expect(globe).toHaveAttribute('data-globe-zoom', String(GLOBE_MAX_ZOOM))
    await closeMapSettings(page)
    await globe.hover()
    await page.mouse.wheel(0, 600)
    await expect(globe).toHaveAttribute('data-globe-zoom', String(GLOBE_MAX_ZOOM))
    await openMapSettings(page)
    await page.getByRole('button', { name: 'Zoom lock On', exact: true }).click()
    await closeMapSettings(page)
    await globe.hover()
    await page.mouse.wheel(0, 600)
    await expect
      .poll(async () => Number(await globe.getAttribute('data-globe-zoom')))
      .toBeLessThan(GLOBE_MAX_ZOOM)
    await page.getByRole('button', { name: /Return to local map/ }).click()
    await canvas.hover()
    await page.mouse.wheel(0, -160)
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-tile-size')))
      .toBeGreaterThan(Number(locked))
  })

  test('outside settings dismissal consumes the click and focused map Escape preserves Stop authority', async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== 'desktop-chromium',
      'Exercise pointer dismissal and focused map keys once.',
    )
    await enter(page)
    const canvas = page.locator('canvas[data-world-stage]')
    const before = await world(page),
      commands: string[] = []
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/world' && request.method() === 'POST')
        commands.push(request.postDataJSON()?.intent?.kind)
    })
    await openMapSettings(page)
    await expect(page.getByRole('dialog', { name: 'Map settings', exact: true })).toBeVisible()
    await page.getByRole('slider', { name: 'Zoom level', exact: true }).press('Escape')
    await expect(page.getByRole('dialog', { name: 'Map settings', exact: true })).toBeHidden()
    expect(commands).not.toContain('stop')
    await openMapSettings(page)
    const box = (await canvas.boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.getByRole('dialog', { name: 'Map settings', exact: true })).toBeHidden()
    await page.waitForTimeout(250)
    expect(commands.filter((kind) => ['walk', 'stop'].includes(kind))).toEqual([])
    expect((await world(page)).position).toEqual(before.position)
    const stop = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/world' &&
        response.request().method() === 'POST' &&
        response.request().postDataJSON()?.intent?.kind === 'stop',
    )
    await canvas.press('Escape')
    expect((await stop).status()).toBe(200)
    expect((await world(page)).route).toHaveLength(0)
    await capture(page, info, 'settings-dismissal-without-map-command')
  })

  test('holding WASD walks repeatedly from a focused World sidebar tab until release', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'Exercise real held keyboard input once.')
    await enter(page)
    const initial = await world(page)
    place(initial.characterId, 'atlas:58:28', 6, 4)
    await page.reload()
    const canvas = page.locator('canvas[data-world-stage]')
    await expect(canvas).toHaveAttribute('data-camera-x', /\d/)
    let walks = 0,
      walkConflicts = 0
    const walkDestinations: WorldView['position'][] = []
    const approvalTimings: { status: number; responseMs: number; serverTiming: string }[] = []
    const timingReads: Promise<void>[] = []
    page.on('request', (request) => {
      if (
        new URL(request.url()).pathname === '/api/world' &&
        request.method() === 'POST' &&
        request.postDataJSON()?.intent?.kind === 'walk'
      ) {
        walks++
        walkDestinations.push(request.postDataJSON().intent.destination)
      }
    })
    page.on('response', (response) => {
      const request = response.request()
      if (
        new URL(response.url()).pathname === '/api/world' &&
        request.method() === 'POST' &&
        request.postDataJSON()?.intent?.kind === 'walk'
      ) {
        if (response.status() === 409) walkConflicts++
        const timing = (async () => {
          await response.finished()
          approvalTimings.push({
            status: response.status(),
            responseMs: request.timing().responseEnd,
            serverTiming: response.headers()['server-timing'] ?? '',
          })
        })()
        timingReads.push(timing)
        void timing.catch(() => {})
      }
    })
    await canvas.evaluate((element) => {
      const stage = element as HTMLCanvasElement
      document.addEventListener(
        'keydown',
        (event) => {
          if (event.key.toLowerCase() === 'd' && !event.repeat)
            stage.dataset.heldDownAt = String(performance.now())
        },
        { capture: true },
      )
      document.addEventListener(
        'keyup',
        (event) => {
          if (event.key.toLowerCase() === 'd') stage.dataset.heldUpAt = String(performance.now())
        },
        { capture: true },
      )
    })
    const sidebarTab = page.getByRole('tab', { name: /Nearby/ })
    await sidebarTab.focus()
    await expect(sidebarTab).toBeFocused()
    await page.keyboard.down('d')
    await page.waitForTimeout(700)
    await page.keyboard.up('d')
    await expect.poll(async () => (await world(page)).route.length, { timeout: 12000 }).toBe(0)
    // A pre-release intent already queued behind authority may still finish.
    // Once that settles, key-up must create no further walking requests.
    const settledWalks = walks
    const heldMs = await canvas.evaluate(
      (element) =>
        Number((element as HTMLCanvasElement).dataset.heldUpAt) -
        Number((element as HTMLCanvasElement).dataset.heldDownAt),
    )
    expect(Number.isFinite(heldMs)).toBe(true)
    expect(heldMs).toBeGreaterThanOrEqual(700)
    // The driver delay excludes keyboard round trips; measure the actual browser
    // key window and exclude authoritative retries from the input cadence count.
    const maximumWalks = 1 + Math.ceil(heldMs / STEP_MS)
    // Release has one intentional terminal retarget to the unfinished landing.
    // Identify that shorter target rather than relaxing held-input cadence.
    const shortening = walkDestinations.filter((target, index) => {
      const previous = walkDestinations[index - 1]
      return previous && target.sectorId === previous.sectorId && target.x < previous.x
    })
    expect(shortening.length).toBeLessThanOrEqual(1)
    if (shortening.length) expect(walkDestinations.at(-1)).toEqual(shortening[0])
    console.info('held-world-key-window', {
      heldMs,
      settledWalks,
      walkConflicts,
      maximumWalks,
      terminalRetargets: shortening.length,
    })
    expect(settledWalks - walkConflicts - shortening.length).toBeGreaterThanOrEqual(2)
    expect(settledWalks - walkConflicts - shortening.length).toBeLessThanOrEqual(maximumWalks)
    const arrived = (await world(page)).position
    expect(arrived.sectorId).toBe('atlas:58:28')
    expect(arrived.x).toBeGreaterThanOrEqual(8)
    expect(arrived).toEqual(walkDestinations.at(-1))
    await page.waitForTimeout(600)
    expect(walks).toBe(settledWalks)
    expect((await world(page)).position).toEqual(arrived)
    await Promise.all(timingReads)
    await info.attach('held-walk-approval-timings', {
      body: JSON.stringify(approvalTimings, null, 2),
      contentType: 'application/json',
    })
    await capture(page, info, 'held-walk-key-release')
  })

  test('two-finger map pinch zooms without walking and respects zoom lock', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'mobile-chromium', 'Exercise actual touch input once.')
    test.setTimeout(90000)
    await enter(page)
    const initial = await world(page),
      canvas = page.locator('canvas[data-world-stage]')
    const box = (await canvas.boundingBox())!,
      session = await page.context().newCDPSession(page)
    const pinch = async (spread: number) => {
      const points = (distance: number) => [
        { x: box.x + box.width / 2 - distance, y: box.y + box.height / 2, id: 1 },
        { x: box.x + box.width / 2 + distance, y: box.y + box.height / 2, id: 2 },
      ]
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: points(45),
      })
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: points(spread),
      })
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }
    const before = Number(await canvas.getAttribute('data-tile-size'))
    await pinch(60)
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-tile-size')))
      .toBeGreaterThan(before)
    const camera = [
      await canvas.getAttribute('data-camera-x'),
      await canvas.getAttribute('data-camera-y'),
    ]
    await pinch(10)
    await expect(canvas).toHaveAttribute('data-tile-size', String(48 * WORLD_MIN_ZOOM))
    expect([
      await canvas.getAttribute('data-camera-x'),
      await canvas.getAttribute('data-camera-y'),
    ]).toEqual(camera)
    await capture(page, info, 'mobile-map-max-zoom-out')
    await openMapSettings(page)
    await expect(page.getByRole('slider', { name: 'Zoom level', exact: true })).toHaveValue('0')
    await page.getByRole('button', { name: 'Zoom lock Off', exact: true }).click()
    await closeMapSettings(page)
    const locked = await canvas.getAttribute('data-tile-size')
    await pinch(60)
    await page.waitForTimeout(300)
    expect(await canvas.getAttribute('data-tile-size')).toBe(locked)
    const final = await world(page)
    expect(final.position).toEqual(initial.position)
    expect(final.route).toHaveLength(0)
  })

  test('long auto-path travel replenishes saved route windows and reaches the actual final destination', async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== 'desktop-chromium',
      'Elapsed-time continuation authority is shared.',
    )
    test.setTimeout(120000)
    await enter(page)
    const receipts: WorldView[] = []
    const requests: Promise<void>[] = []
    let plans = 0
    page.on('response', (response) => {
      if (
        new URL(response.url()).pathname !== '/api/world' ||
        response.request().method() !== 'POST'
      )
        return
      const request = (async () => {
        expect(response.ok()).toBe(true)
        if (response.request().postDataJSON()?.intent?.kind === 'autopath') plans++
        receipts.push(await response.json())
      })()
      requests.push(request)
      void request.catch(() => {})
    })
    await openJournal(page)
    await page.getByRole('button', { name: /Start Auto-path/ }).click()
    await expect
      .poll(async () => (await world(page)).routeDestination)
      .toEqual({ sectorId: 'umbral-march', x: 6, y: 0 })
    await expect
      .poll(async () => (await world(page)).position, { timeout: 90000, intervals: [1000] })
      .toEqual({ sectorId: 'umbral-march', x: 6, y: 0 })
    await Promise.all(requests)
    expect(receipts.every((receipt) => receipt.route.length <= 256)).toBe(true)
    expect(plans).toBeGreaterThanOrEqual(2)
    const arrived = await world(page)
    expect(arrived.route).toEqual([])
    expect(arrived.routeDestination).toBeNull()
    await capture(page, info, 'long-journey-arrived')
  })
}
