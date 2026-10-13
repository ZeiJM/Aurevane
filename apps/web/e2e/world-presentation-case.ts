import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { GRID_WIDTH, GRID_HEIGHT } from '../src/world/catalog'
import type { WorldView } from '../src/world/types'

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
  await enter(page)
  const initial = await world(page)
  if (info.project.name === 'mobile-chromium')
    await page.getByRole('button', { name: /Details/ }).click()
  const townButton = page.getByRole('button', { name: 'View Town', exact: true })
  await expect(townButton).toBeVisible()
  await expect(
    page.locator('[data-world-panel-foot]').getByRole('button', { name: 'View Town', exact: true }),
  ).toBeVisible()
  const panorama = initial.sectors.find(
    (sector) => sector.id === initial.position.sectorId,
  )!.panorama!
  const painting = page.waitForResponse(
    (response) => new URL(response.url()).pathname === panorama && response.ok(),
  )
  await townButton.click()
  const townDialog = page.getByRole('dialog', { name: 'Verdant Expanse', exact: true })
  await expect(townDialog).toBeVisible()
  await painting
  await townDialog.getByRole('button', { name: 'Look right', exact: true }).click()
  await capture(page, info, 'view-town-from-panel-foot')
  await townDialog.getByRole('button', { name: /Return to Map/ }).click()
  await expect(townDialog).toHaveCount(0)
  await expect(townButton).toBeFocused()
  expect((await world(page)).position).toEqual(initial.position)
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
    for (const row of await panel.locator('[data-world-player]').all()) {
      const identity = await row.locator('strong').boundingBox(),
        actions = await row.locator('[data-world-player-actions]').boundingBox(),
        bounds = await row.boundingBox()
      if (!identity || !actions || !bounds) continue
      expect(actions.x).toBeGreaterThanOrEqual(identity.x + identity.width - 1)
      expect(actions.x + actions.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1)
      for (const button of await row.getByRole('button').all()) {
        const box = (await button.boundingBox())!
        expect(box.x).toBeGreaterThanOrEqual(bounds.x)
        expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1)
        expect(box.height).toBeGreaterThanOrEqual(info.project.name === 'mobile-chromium' ? 44 : 29)
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
  expect(await canvas.evaluate((el) => getComputedStyle(el).cursor)).toContain('data:image/svg+xml')
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
        await page.getByRole('button', { name: 'Map settings', exact: true }).click()
        await page.getByRole('checkbox', { name: 'Ambient animation', exact: true }).uncheck()
        await page.getByRole('button', { name: 'Done', exact: true }).click()
      }
      await canvas.evaluate((el) => {
        const ctx = (el as HTMLCanvasElement).getContext('2d')!,
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

  test('zoom controls live in Settings and the shared lock blocks map and globe wheel zoom', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'Exercise mouse/trackpad zoom once.')
    test.setTimeout(90000)
    await enter(page)
    const canvas = page.locator('canvas[data-world-stage]')
    await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Map settings', exact: true }).click()
    const slider = page.getByRole('slider', { name: 'Zoom level', exact: true })
    await slider.press('Home')
    await expect(slider).toHaveValue('35')
    await page.getByRole('checkbox', { name: 'Ambient animation', exact: true }).uncheck()
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
    await page.getByRole('button', { name: 'Done', exact: true }).click()
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
    await page.getByRole('button', { name: 'Map settings', exact: true }).click()
    await expect(page.getByRole('slider', { name: 'Zoom level', exact: true })).toHaveValue('94')
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await page.getByRole('button', { name: /Return to local map/ }).click()
    await page.getByRole('button', { name: 'Map settings', exact: true }).click()
    await page.getByRole('button', { name: 'Zoom lock On', exact: true }).click()
    await page.getByRole('button', { name: 'Done', exact: true }).click()
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
    await page.getByRole('button', { name: 'Map settings', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Map settings', exact: true })).toBeVisible()
    await page.getByRole('slider', { name: 'Zoom level', exact: true }).press('Escape')
    await expect(page.getByRole('dialog', { name: 'Map settings', exact: true })).toBeHidden()
    expect(commands).not.toContain('stop')
    await page.getByRole('button', { name: 'Map settings', exact: true }).click()
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
    let walks = 0
    page.on('request', (request) => {
      if (
        new URL(request.url()).pathname === '/api/world' &&
        request.method() === 'POST' &&
        request.postDataJSON()?.intent?.kind === 'walk'
      )
        walks++
    })
    await canvas.focus()
    await page.keyboard.down('d')
    await page.waitForTimeout(700)
    await page.keyboard.up('d')
    await expect.poll(async () => (await world(page)).route.length, { timeout: 12000 }).toBe(0)
    // A pre-release intent already queued behind authority may still finish.
    // Once that settles, key-up must create no further walking requests.
    const settledWalks = walks
    expect(settledWalks).toBeGreaterThanOrEqual(2)
    expect(settledWalks).toBeLessThanOrEqual(4)
    const arrived = (await world(page)).position
    expect(arrived.sectorId).toBe('atlas:58:28')
    expect(arrived.x).toBeGreaterThanOrEqual(8)
    await page.waitForTimeout(600)
    expect(walks).toBe(settledWalks)
    expect((await world(page)).position).toEqual(arrived)
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
    await page.getByRole('button', { name: 'Map settings', exact: true }).click()
    await expect(page.getByRole('slider', { name: 'Zoom level', exact: true })).toHaveValue('35')
    await page.getByRole('button', { name: 'Zoom lock Off', exact: true }).click()
    await page.getByRole('button', { name: 'Done', exact: true }).click()
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
