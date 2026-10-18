import { openMapSettings, closeMapSettings } from './world-map-settings-helpers'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { GRID_WIDTH, GRID_HEIGHT, STEP_MS } from '../src/world/catalog'
import type { WorldView } from '../src/world/types'
import { worldRenderTerrain } from '../src/components/world/map-render-terrain'
import { mapPoint } from '../src/components/world/world-motion'
import { projectMapPoint } from '../src/components/world/map-projection'
import { worldSceneCoversViewport } from '../src/components/world/world-scene-coverage'

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
  await expect(coordinates).toContainText('Sector S59-29')
  await expect(coordinates).toContainText('E760 · N320')
  await expect(page.getByRole('button', { name: 'View Town', exact: true })).toHaveCount(0)
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
    .poll(async () => (await world(page)).position, { timeout: 12000 })
    .toEqual({ sectorId: 'atlas:58:28', x: 7, y: 4 })
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-camera-x')), { timeout: 5000 })
    .toBe(58 * GRID_WIDTH + 7.5)
  await expect(coordinates).toContainText('E761 · N320')
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
    for (const zoom of [100, 35]) {
      await openMapSettings(page)
      const slider = page.getByRole('slider', { name: 'Zoom level', exact: true })
      await slider.focus()
      await slider.press('Home')
      if (zoom === 100) for (let step = 35; step < 100; step++) await slider.press('ArrowRight')
      await expect(slider).toHaveValue(String(zoom))
      await closeMapSettings(page)
      await expect(canvas).toHaveAttribute('data-tile-size', String(baseTile * (zoom / 100)))
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
    await page.setViewportSize({ width: 2560, height: 1440 })
    const receipt = await expanded
    expect(receipt.ok()).toBe(true)
    const view = (await receipt.json()) as WorldView
    const size = await canvas.evaluate((el) => ({ width: el.clientWidth, height: el.clientHeight }))
    expect(size.width).toBeGreaterThan(1296)
    expect(new URL(receipt.url()).searchParams.get('sceneWidth')).toBe(String(size.width))
    const camera = mapPoint(view.position, view.sectors)
    expect(worldSceneCoversViewport(view, [camera], { ...size, tile: 64 * 0.35 })).toBe(true)
    expect(view.sectors.length).toBeLessThanOrEqual(25)
    await openMapSettings(page)
    const zoom = page.getByRole('slider', { name: 'Zoom level', exact: true })
    await zoom.focus()
    await zoom.press('Home')
    await expect(zoom).toHaveValue('35')
    await closeMapSettings(page)
    await expect(canvas).toHaveAttribute('data-tile-size', '22.4')
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
                64 * 0.35,
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
  test('minimum-zoom public scenery stays painted while walking with delayed scene hydration', async ({
    page,
  }, info) => {
    test.skip(info.project.name === 'laptop-chromium', 'Check mouse and touch coverage once each.')
    test.setTimeout(60000)
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
    await expect(zoom).toHaveValue('35')
    await closeMapSettings(page)
    await canvas.evaluate((el) => {
      const stage = el as HTMLCanvasElement
      const context = stage.getContext('2d')!,
        original = context.drawImage.bind(context)
      const originalFill = context.fillRect.bind(context)
      let groundLayers = 0
      context.fillRect = (x, y, width, height) => {
        if (x === 0 && y === 0 && width === stage.clientWidth && height === stage.clientHeight)
          groundLayers = 0
        originalFill(x, y, width, height)
      }
      context.drawImage = ((image: CanvasImageSource, ...args: number[]) => {
        const tile = Number(stage.dataset.tileSize)
        if (
          image instanceof HTMLCanvasElement &&
          args.length === 4 &&
          args[0] === 0 &&
          args[1] === 0 &&
          args[2] === 13 * tile &&
          args[3] === 9 * tile
        ) {
          groundLayers++
          stage.dataset.testGroundLayers = String(groundLayers)
        }
        Reflect.apply(original, context, [image, ...args])
      }) as typeof context.drawImage
    })
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
      await expect
        .poll(() => canvas.evaluate((el) => Number(el.dataset.testGroundLayers)))
        .toBeGreaterThan(0)
      if (info.project.name === 'desktop-chromium')
        await expect
          .poll(() => canvas.evaluate((el) => Number(el.dataset.testGroundLayers)))
          .toBeGreaterThan(25)
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
  test('a pointer direction change keeps moving through a timely delayed approval', async ({
    page,
  }, info) => {
    test.skip(info.project.name === 'laptop-chromium', 'Check mouse and touch once each.')
    test.setTimeout(60000)
    await enter(page)
    const initial = await world(page)
    const origin = { sectorId: 'atlas:58:28', x: 6, y: 4 }
    place(initial.characterId, origin.sectorId, origin.x, origin.y)
    await page.clock.install()
    await page.reload()
    const canvas = page.locator('canvas[data-world-stage]')
    await expect(canvas).toHaveAttribute('data-camera-x', /\d/)
    const scene = await world(page)
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
    try {
      await clickGround({ ...origin, x: 9 })
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
      await clickGround(destination)
      releaseFirst()
      await turnResponseReady
      await page.clock.runFor(550)
      await expect(canvas).toHaveAttribute('data-test-turn-samples', /\[/)
      expect(delayed).toBe(true)
      const samples = JSON.parse((await canvas.getAttribute('data-test-turn-samples'))!) as {
        time: number
        x: number
        y: number
      }[]
      // Ignore initial pointer scheduling; the new route has four legal steps,
      // so it cannot have reached its destination during this observation.
      const during = samples.filter((sample) => sample.time >= 120 && sample.time <= 545)
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
      await page.clock.runFor(100)
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
      await canvas.evaluate((el) => {
        const ctx = document
            .querySelector<HTMLCanvasElement>('canvas[data-world-identity]')!
            .getContext('2d')!,
          draw = ctx.drawImage.bind(ctx)
        const portrait = new URL(el.dataset.portrait!, location.href).href
        ctx.drawImage = ((image: CanvasImageSource, ...args: number[]) => {
          if (
            image instanceof HTMLImageElement &&
            image.src === portrait &&
            ctx.strokeStyle === '#ead399' &&
            args.length === 8
          ) {
            el.dataset.testDrawnX = String(args.at(-4)! + 17)
            el.dataset.testDrawnY = String(args.at(-3)! + 34)
          }
          ;(draw as (...args: unknown[]) => void)(image, ...args)
        }) as typeof ctx.drawImage
      })
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
              tolerance = 0.5 / Math.min(devicePixelRatio || 1, 1.5) + 1e-9
            return {
              camera: { x, y },
              drawnAtTarget:
                Math.abs(Number(el.dataset.testDrawnX) - expectedX) <= tolerance &&
                Math.abs(Number(el.dataset.testDrawnY) - expectedY) <= tolerance,
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
    await enter(page)
    const canvas = page.locator('canvas[data-world-stage]')
    await canvas.evaluate((el) => {
      const context = document
        .querySelector<HTMLCanvasElement>('canvas[data-world-identity]')!
        .getContext('2d')!
      const draw = context.fillText.bind(context)
      context.fillText = ((text: string, x: number, y: number, maxWidth?: number) => {
        if (text === 'You')
          el.dataset.testNameplateDraw = JSON.stringify({
            font: context.font,
            align: context.textAlign,
            x,
            y,
            compressed: maxWidth !== undefined,
          })
        if (maxWidth === undefined) draw(text, x, y)
        else draw(text, x, y, maxWidth)
      }) as typeof context.fillText
    })
    await openMapSettings(page)
    await page.getByRole('checkbox', { name: 'Ambient animation', exact: true }).uncheck()
    const slider = page.getByRole('slider', { name: 'Zoom level', exact: true })
    for (const zoom of [35, 140, 100]) {
      if (zoom === 35) await slider.press('Home')
      else if (zoom === 140) await slider.press('End')
      else for (let i = 0; i < 40; i++) await slider.press('ArrowLeft')
      await expect(slider).toHaveValue(String(zoom))
      await expect
        .poll(() => canvas.evaluate((el) => Number(el.dataset.tileSize)))
        .toBeCloseTo(
          ((await canvas.evaluate((el) => (el.clientWidth < 600 ? 48 : 64))) * zoom) / 100,
        )
      await expect.poll(() => canvas.getAttribute('data-test-nameplate-draw')).not.toBeNull()
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
      expect(metrics.compressed).toBe(false)
      expect(metrics.align).toBe('left')
      expect(Number(/(\d+)px/.exec(metrics.font)![1])).toBeGreaterThanOrEqual(11)
      for (const value of [metrics.left, metrics.top, metrics.x, metrics.y])
        expect(value * metrics.density).toBeCloseTo(Math.round(value * metrics.density), 4)
      expect(metrics.width * metrics.density).toBeCloseTo(metrics.backingWidth, 1)
      expect(metrics.height * metrics.density).toBeCloseTo(metrics.backingHeight, 1)
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
    await enter(page)
    const canvas = page.locator('canvas[data-world-stage]')
    await canvas.evaluate((el) => {
      const context = document
          .querySelector<HTMLCanvasElement>('canvas[data-world-identity]')!
          .getContext('2d')!,
        draw = context.drawImage.bind(context),
        fillText = context.fillText.bind(context),
        portrait = new URL(el.dataset.portrait!, location.href).href
      context.fillText = ((text: string, x: number, y: number, maxWidth?: number) => {
        if (text === 'You')
          el.dataset.testNameplateDraw = JSON.stringify({
            font: context.font,
            align: context.textAlign,
            x,
            y,
            compressed: maxWidth !== undefined,
          })
        if (maxWidth === undefined) fillText(text, x, y)
        else fillText(text, x, y, maxWidth)
      }) as typeof context.fillText
      context.drawImage = ((image: CanvasImageSource, ...args: number[]) => {
        if (
          image instanceof HTMLImageElement &&
          image.src === portrait &&
          context.strokeStyle === '#ead399' &&
          args.length === 8
        ) {
          el.dataset.testPortraitDraw = JSON.stringify({
            width: args.at(-2),
            height: args.at(-1),
            ratio: context.getTransform().a,
          })
        }
        ;(draw as (...args: unknown[]) => void)(image, ...args)
      }) as typeof context.drawImage
    })
    const verifyPortraitZoom = async (zoom: number) => {
      await expect(canvas).toHaveAttribute('data-tile-size', String((64 * zoom) / 100))
      await expect
        .poll(() =>
          canvas.evaluate((el) => {
            if (!el.dataset.testPortraitDraw) return false
            const { width, height, ratio } = JSON.parse(el.dataset.testPortraitDraw) as {
              width: number
              height: number
              ratio: number
            }
            const expected = Math.round(((34 * Number(el.dataset.tileSize)) / 64) * ratio) / ratio
            return width === expected && height === expected
          }),
        )
        .toBe(true)
      const nameplate = await canvas.evaluate((el) => {
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
      expect(nameplate.compressed).toBe(false)
      expect(nameplate.align).toBe('left')
      expect(Number(/(\d+)px/.exec(nameplate.font)![1])).toBeGreaterThanOrEqual(11)
      for (const value of [nameplate.left, nameplate.top, nameplate.x, nameplate.y])
        expect(value * nameplate.density).toBeCloseTo(Math.round(value * nameplate.density), 4)
      expect(nameplate.width * nameplate.density).toBeCloseTo(nameplate.backingWidth, 1)
      expect(nameplate.height * nameplate.density).toBeCloseTo(nameplate.backingHeight, 1)
      const metrics = await canvas.evaluate((el) => ({
        tileSize: Number(el.dataset.tileSize),
        ...JSON.parse(el.dataset.testPortraitDraw!),
        nameplate: JSON.parse(el.dataset.testNameplateDraw!),
      }))
      await info.attach(`portrait-zoom-${zoom}`, {
        body: JSON.stringify({ zoom, ...metrics }, null, 2),
        contentType: 'application/json',
      })
      await capture(page, info, `portrait-zoom-${zoom}`)
    }
    await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toHaveCount(0)
    await openMapSettings(page)
    const slider = page.getByRole('slider', { name: 'Zoom level', exact: true })
    await slider.press('Home')
    await expect(slider).toHaveValue('35')
    await page.getByRole('checkbox', { name: 'Ambient animation', exact: true }).uncheck()
    await expect(canvas).toHaveAttribute('data-tile-size', String(64 * 0.35))
    await verifyPortraitZoom(35)
    await slider.press('End')
    await expect(slider).toHaveValue('140')
    await verifyPortraitZoom(140)
    for (let i = 0; i < 40; i++) await slider.press('ArrowLeft')
    await expect(slider).toHaveValue('100')
    await verifyPortraitZoom(100)
    await slider.press('Home')
    await expect(slider).toHaveValue('35')
    await expect(canvas).toHaveAttribute('data-tile-size', String(64 * 0.35))
    const beforeZoom = await canvas.screenshot()
    for (let i = 0; i < 5; i++) await slider.press('ArrowRight')
    await expect(slider).toHaveValue('40')
    await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Zoom out', exact: true })).toHaveCount(0)
    // The popup blocks input, not rendering: slider changes must paint while open.
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-tile-size')))
      .toBeCloseTo(64 * 0.4)
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
    await expect(page.getByRole('slider', { name: 'Zoom level', exact: true })).toHaveValue('94')
    await closeMapSettings(page)
    await page.getByRole('button', { name: /Return to local map/ }).click()
    await openMapSettings(page)
    await page.getByRole('button', { name: 'Zoom lock On', exact: true }).click()
    await closeMapSettings(page)
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

  test('holding WASD walks repeatedly at bounded cadence and releasing the key ends the stream', async ({
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
      stage.addEventListener(
        'keydown',
        (event) => {
          if (event.key.toLowerCase() === 'd' && !event.repeat)
            stage.dataset.heldDownAt = String(performance.now())
        },
        { capture: true },
      )
      stage.addEventListener(
        'keyup',
        (event) => {
          if (event.key.toLowerCase() === 'd') stage.dataset.heldUpAt = String(performance.now())
        },
        { capture: true },
      )
    })
    await canvas.focus()
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
    await expect(canvas).toHaveAttribute('data-tile-size', String(48 * 0.35))
    expect([
      await canvas.getAttribute('data-camera-x'),
      await canvas.getAttribute('data-camera-y'),
    ]).toEqual(camera)
    await capture(page, info, 'mobile-map-max-zoom-out')
    await openMapSettings(page)
    await expect(page.getByRole('slider', { name: 'Zoom level', exact: true })).toHaveValue('35')
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
