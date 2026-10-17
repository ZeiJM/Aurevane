import { openMapSettings, closeMapSettings } from './world-map-settings-helpers'
import { createRequire } from 'node:module'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { atlasSectors, ATLAS_COLUMNS } from '../src/world/atlas'
import { GRID_WIDTH, GRID_HEIGHT } from '../src/world/catalog'
import { atlasNeighbor } from '../src/world/topology'
import type { WorldView, WorldPosition } from '../src/world/types'

const imageRuntime = createRequire(__filename)
// Decode native screenshots outside the page; cross-origin public portraits
// intentionally make page getImageData unavailable. Next already provides Sharp.
const sharp = imageRuntime(imageRuntime.resolve('sharp', { paths: [imageRuntime.resolve('next')] }))

interface Helpers {
  enter: (page: Page) => Promise<string>
  world: (page: Page) => Promise<WorldView>
  place: (id: string, sector: string, x: number, y: number) => void
  stageWalk: (page: Page, position: WorldPosition) => Promise<void>
  capture: (page: Page, info: TestInfo, name: string) => Promise<void>
}

export function registerWorldLandscapeCases(helpers: Helpers) {
  const { enter, world, place, stageWalk, capture } = helpers
  test('longitude seam is an actual adjacent ground crossing with continuous camera and return travel', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'Verify real seam commands once.')
    test.setTimeout(90000)
    await enter(page)
    const initial = await world(page),
      sector = atlasSectors().find(
        (s) => s.atlasColumn === ATLAS_COLUMNS - 1 && s.atlasRow === 32,
      )!,
      road = sector.roads.find((r) => r.from.y === 4 && r.to.sectorId === 'atlas:0:32')!
    expect(road).toBeDefined()
    place(initial.characterId, road.from.sectorId, road.from.x, road.from.y)
    await page.reload()
    const canvas = page.locator('canvas[data-world-stage]')
    await expect(canvas).toHaveAttribute('data-camera-x', /\d/)
    const start = Number(await canvas.getAttribute('data-camera-x'))
    expect((await world(page)).sectors.some((s) => s.id === road.to.sectorId)).toBe(true)
    // Real ground click: no atlas Travel action, teleport or intercepted response.
    await stageWalk(page, road.to)
    await expect.poll(async () => (await world(page)).position, { timeout: 12000 }).toEqual(road.to)
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-camera-x')), { timeout: 5000 })
      .toBe(start + 1)
    expect((await world(page)).route.length).toBe(0)
    await capture(page, info, 'seam-east-continuous')
    await page.getByRole('button', { name: /Open world atlas/ }).click()
    await page.getByRole('button', { name: /Return to local map/ }).click()
    await expect(canvas).toHaveAttribute('data-camera-x', String(start + 1))
    await capture(page, info, 'seam-globe-return-stable')
    await canvas.press('a')
    await expect
      .poll(async () => (await world(page)).position, { timeout: 12000 })
      .toEqual(road.from)
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-camera-x')), { timeout: 5000 })
      .toBe(start)
    await capture(page, info, 'seam-west-continuous')
    // Reload starts from canonical persisted coordinates and retains both sides.
    await page.reload()
    expect((await world(page)).position).toEqual(road.from)
    expect((await world(page)).sectors.some((s) => s.id === road.to.sectorId)).toBe(true)
    await expect(canvas).toHaveAttribute(
      'data-camera-x',
      String((ATLAS_COLUMNS - 1) * GRID_WIDTH + road.from.x + 0.5),
    )
  })

  test('biome boundaries and coastal road approaches retain continuous legal ground', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'Inspect authored terrain rendering once.')
    test.setTimeout(90000)
    await enter(page)
    const initial = await world(page),
      sectors = atlasSectors(),
      byAddress = new Map(
        sectors.map((sector) => [`${sector.atlasColumn}:${sector.atlasRow}`, sector]),
      )
    const boundary = sectors.flatMap((sector) => {
      const address = atlasNeighbor(sector.atlasColumn!, sector.atlasRow!, 1, 0),
        neighbor = address && byAddress.get(`${address.column}:${address.row}`)
      if (!neighbor || sector.regionId === neighbor.regionId || sector.townId || neighbor.townId)
        return []
      const road = sector.roads.find(
        (road) => road.from.x === 12 && road.from.y === 4 && road.to.sectorId === neighbor.id,
      )
      return road ? [{ sector, neighbor, road }] : []
    })[0]!
    expect(boundary).toBeDefined()
    place(initial.characterId, boundary.sector.id, 11, 4)
    await page.reload()
    const canvas = page.locator('canvas[data-world-stage]')
    await expect(canvas).toHaveAttribute('data-camera-x', /\d/)
    expect((await world(page)).sectors.some((sector) => sector.id === boundary.neighbor.id)).toBe(
      true,
    )
    await capture(page, info, 'biome-boundary-cached-material')
    await stageWalk(page, boundary.road.to)
    await expect
      .poll(async () => (await world(page)).position, { timeout: 12000 })
      .toEqual(boundary.road.to)
    await capture(page, info, 'biome-boundary-after-continuous-crossing')
    const coast = sectors.find((sector) => {
      const address = atlasNeighbor(sector.atlasColumn!, sector.atlasRow!, 1, 0)
      return (
        address &&
        !byAddress.has(`${address.column}:${address.row}`) &&
        sector.rows[4]![12] === '.' &&
        sector.rows[4]![11] === '.' &&
        sector.rows[4]![10] === '='
      )
    })!
    expect(coast).toBeDefined()
    place(initial.characterId, coast.id, 10, 4)
    await page.reload()
    await expect(canvas).toHaveAttribute(
      'data-camera-x',
      String(coast.atlasColumn! * GRID_WIDTH + 10.5),
    )
    const projected = await world(page),
      shore = projected.sectors.find((sector) => sector.id === coast.id)!
    expect(shore.cells.find((cell) => cell.x === 12 && cell.y === 4)).toMatchObject({
      terrain: '.',
      walkable: true,
    })
    expect(shore.exits.some((exit) => exit.from.x === 12 && exit.from.y === 4)).toBe(false)
    await capture(page, info, 'coastal-road-setback-real-shoreline')
  })

  test('four-biome corner materials meet without an order-dependent colour seam', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'Inspect actual canvas corner raster once.')
    test.setTimeout(90000)
    await enter(page)
    const initial = await world(page)
    place(initial.characterId, 'atlas:58:28', 11, 7)
    // This disposable visual-only fixture exposes the material weights with
    // original texture/scenery images absent. No fixture movement command is sent.
    await page.route('**/media/art/world/runtime/**', (route) => route.abort())
    const regions = new Map([
      ['58:28', 'verdant-expanse'],
      ['59:28', 'umbral-march'],
      ['58:29', 'frostmere'],
      ['59:29', 'glasswind-desert'],
    ])
    let receipts = 0
    await page.route('**/api/world*', async (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      const response = await route.fetch({
          url: new URL('/api/world', route.request().url()).href,
        }),
        body = (await response.json()) as WorldView
      const sectors = body.sectors
        .filter((sector) => regions.has(`${sector.atlasColumn}:${sector.atlasRow}`))
        .map((sector) => ({
          ...sector,
          regionId: regions.get(`${sector.atlasColumn}:${sector.atlasRow}`)!,
          townId: undefined,
          landscape: undefined,
          landmarks: [],
          buildings: [],
          cells: sector.cells.map((cell) => ({ ...cell, terrain: '.', walkable: true })),
        }))
      expect(sectors).toHaveLength(4)
      await route.fulfill({
        response,
        json: {
          ...body,
          sectors,
          players: [],
          environment: { ...body.environment, minuteOfDay: 720, weather: 'clear' },
        },
      })
      receipts++
    })
    await page.reload()
    await expect.poll(() => receipts, { timeout: 25000 }).toBeGreaterThan(0)
    await openMapSettings(page)
    await page.getByRole('checkbox', { name: 'Ambient animation', exact: true }).uncheck()
    await closeMapSettings(page)
    const canvas = page.locator('canvas[data-world-stage]')
    await expect(canvas).toHaveAttribute('data-clouds', '0')
    const projection = await canvas.evaluate((element) => ({
      cameraX: Number(element.dataset.cameraX),
      cameraY: Number(element.dataset.cameraY),
      tile: Number(element.dataset.tileSize),
      width: element.clientWidth,
      height: element.clientHeight,
    }))
    const { data, info: raster } = await sharp(await canvas.screenshot())
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const colours = [
      [-0.07, -0.07],
      [0.07, -0.07],
      [-0.07, 0.07],
      [0.07, 0.07],
    ].map(([dx, dy]) => {
      const x = 59 * GRID_WIDTH + dx! - projection.cameraX,
        y = 29 * GRID_HEIGHT + dy! - projection.cameraY,
        screenX = projection.width / 2 + (x - y) * projection.tile * 0.85,
        screenY = projection.height / 2 + (x + y) * projection.tile * 0.44,
        pixelX = Math.round((screenX * raster.width) / projection.width),
        pixelY = Math.round((screenY * raster.height) / projection.height),
        offset = (pixelY * raster.width + pixelX) * raster.channels
      return [...data.subarray(offset, offset + 3)] as number[]
    })
    for (let channel = 0; channel < 3; channel++) {
      const samples = colours.map((colour) => colour[channel]!)
      expect(Math.max(...samples) - Math.min(...samples)).toBeLessThanOrEqual(7)
      for (const sample of samples)
        expect(Math.abs(sample - [119, 131, 109][channel]!)).toBeLessThanOrEqual(5)
    }
    expect((await world(page)).position).toEqual({ sectorId: 'atlas:58:28', x: 11, y: 7 })
    await capture(page, info, 'four-biome-corner-palette-raster-regression')
  })

  test('globe towns and water agree with local terrain and town selection exposes legal travel', async ({
    page,
  }, info) => {
    test.skip(info.project.name === 'laptop-chromium', 'Inspect desktop and touch presentation.')
    test.setTimeout(90000)
    await enter(page)
    const initial = await world(page)
    for (const sector of initial.sectors) {
      const cell = initial.atlas!.find((c) => c.id === sector.id)!
      expect(cell.townId).toBe(sector.townId)
      for (const tile of sector.cells) {
        const liquid = tile.terrain === '~' || tile.terrain === 'l' ? tile.terrain : '.'
        expect(cell.waterTiles?.[tile.y * GRID_WIDTH + tile.x] ?? '.').toBe(liquid)
      }
    }
    await page.getByRole('button', { name: /Open world atlas/ }).click()
    const towns = page.getByRole('combobox', { name: 'Main town', exact: true })
    await expect(towns).toBeVisible()
    await expect(towns.locator('option')).toHaveCount(9)
    await towns.selectOption('frostmere')
    await expect(
      page.getByRole('region', { name: 'Selected destination', exact: true }),
    ).toContainText('Frostmere')
    await expect(
      page.getByRole('button', { name: 'Select Frostmere town', exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Travel here', exact: true })).toBeEnabled()
    await capture(page, info, 'accurate-globe-main-towns')
    const closeDetails = page.getByRole('button', { name: /Close details/ })
    if (await closeDetails.isVisible()) await closeDetails.click()
    const verdant = page.getByRole('button', { name: 'Select Verdant Expanse town', exact: true })
    const marker = await verdant.boundingBox()
    expect(marker).not.toBeNull()
    const x = marker!.x + marker!.width / 2,
      y = marker!.y + marker!.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 30, y, { steps: 4 })
    await page.mouse.move(x, y, { steps: 4 })
    await page.mouse.up()
    await expect(towns).toHaveValue('frostmere')
    const currentCoordinates = await page.locator('[data-world-coordinates] span').allTextContents()
    await verdant.click()
    await expect(page.locator('[data-world-coordinates] span')).toHaveText(currentCoordinates)
    await expect(towns).toHaveValue('verdant-expanse')
    await expect(
      page.getByRole('region', { name: 'Selected destination', exact: true }),
    ).toContainText('Verdant Expanse')
    expect((await world(page)).position).toEqual(initial.position)
  })

  test('rain falls, cold precipitation snows and terrain dust and embers are bounded and pausable', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'Inspect each environmental motion once.')
    test.setTimeout(120000)
    await enter(page)
    const initial = await world(page)
    let weather = 'rain'
    let weatherReceipts = 0
    // The disposable visual fixture alters weather only; positions/terrain and
    // every command continue through real auth, the database and World authority.
    await page.route('**/api/world*', async (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      const response = await route.fetch(),
        body = await response.json()
      await route.fulfill({
        response,
        json: { ...body, environment: { ...body.environment, weather } },
      })
      weatherReceipts++
    })
    const canvas = page.locator('canvas[data-world-stage]')
    for (const [sector, kind, count] of [
      ['verdant-expanse', 'rain', 88],
      ['frostmere', 'snow', 64],
    ] as const) {
      place(initial.characterId, sector, 6, 4)
      const previousReceipts = weatherReceipts
      await page.reload()
      // Initial SSR view is real weather. Wait for the idle GET to consume this
      // visual fixture before checking particles, rather than passing by chance.
      await expect.poll(() => weatherReceipts, { timeout: 25000 }).toBeGreaterThan(previousReceipts)
      await expect(canvas).toHaveAttribute('data-precipitation', kind)
      await expect(canvas).toHaveAttribute('data-precipitation-particles', String(count))
      const before = await canvas.screenshot()
      await page.waitForTimeout(400)
      expect((await canvas.screenshot()).equals(before)).toBe(false)
      await capture(page, info, `weather-${kind}-motion`)
    }
    weather = 'clear'
    for (const sector of ['glasswind-desert', 'emberreach']) {
      place(initial.characterId, sector, sector === 'emberreach' ? 8 : 6, 4)
      const previousReceipts = weatherReceipts
      await page.reload()
      await expect.poll(() => weatherReceipts, { timeout: 25000 }).toBeGreaterThan(previousReceipts)
      await expect(canvas).toHaveAttribute('data-precipitation-particles', '0')
      await expect
        .poll(async () => Number(await canvas.getAttribute('data-terrain-motes')))
        .toBeGreaterThan(0)
      expect(Number(await canvas.getAttribute('data-terrain-motes'))).toBeLessThanOrEqual(72)
      await capture(page, info, `terrain-motion-${sector}`)
    }
    await openMapSettings(page)
    await page.getByRole('checkbox', { name: 'Ambient animation', exact: true }).uncheck()
    await closeMapSettings(page)
    await expect(canvas).toHaveAttribute('data-terrain-motes', '0')
    await expect(canvas).toHaveAttribute('data-precipitation-particles', '0')
    await expect(canvas).toHaveAttribute('data-clouds', '0')
  })
}
