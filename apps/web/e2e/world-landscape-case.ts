import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { atlasSectors, ATLAS_COLUMNS } from '../src/world/atlas'
import { GRID_WIDTH } from '../src/world/catalog'
import type { WorldView, WorldPosition } from '../src/world/types'

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
    await page.route('**/api/world', async (route) => {
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
    await page.getByRole('button', { name: 'Map settings', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Ambient animation', exact: true }).uncheck()
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(canvas).toHaveAttribute('data-terrain-motes', '0')
    await expect(canvas).toHaveAttribute('data-precipitation-particles', '0')
    await expect(canvas).toHaveAttribute('data-clouds', '0')
  })
}
