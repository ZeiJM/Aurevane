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
  place(initial.characterId, 'atlas:58:28', 6, 4)
  await page.reload()
  const canvas = page.locator('canvas[data-world-stage]'),
    workspace = page.locator('[data-world-workspace]'),
    panel = page.getByRole('complementary', { name: 'World details', exact: true })
  await expect(canvas).toHaveAttribute('data-camera-x', /\d/)
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
      const map = (await canvas.boundingBox())!
      expect(Math.abs(map.y + map.height - (frame.y + frame.height - 1))).toBeLessThanOrEqual(1)
    }
    const gear = panel.getByRole('button', { name: 'Map settings', exact: true })
    await expect(gear.locator('svg')).toBeVisible()
    const bounds = (await panel.boundingBox())!,
      button = (await gear.boundingBox())!
    expect(button.y + button.height).toBeGreaterThan(bounds.y + bounds.height - 55)
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
    await expect(slider).toHaveValue('60')
    for (let i = 0; i < 5; i++) await slider.press('ArrowRight')
    await expect(slider).toHaveValue('70')
    await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Zoom out', exact: true })).toHaveCount(0)
    // The popup blocks input, not rendering: slider changes must paint while open.
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-tile-size')))
      .toBeCloseTo(64 * 0.7)
    const pixels = await canvas.evaluate((element) => {
      const canvas = element as HTMLCanvasElement
      const pixel = canvas
        .getContext('2d')!
        .getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data
      return pixel[0]! + pixel[1]! + pixel[2]!
    })
    expect(pixels).toBeGreaterThan(0)
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
    await page.getByRole('button', { name: 'Map settings', exact: true }).click()
    await page.getByRole('button', { name: 'Zoom lock Off', exact: true }).click()
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    const locked = await canvas.getAttribute('data-tile-size')
    await pinch(30)
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
