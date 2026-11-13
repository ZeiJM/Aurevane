import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import type { WorldPosition, WorldView } from '../src/world/types'
import { buildWaterField } from '../src/components/world/map-water'
import { buildPublicCoasts } from '../src/components/world/map-coast'
import { precipitationKind } from '../src/components/world/map-weather'
import { worldRenderTerrain } from '../src/components/world/map-render-terrain'
import { correctionScenes, type CorrectionScene } from './world-map-correction-scenes'
import {
  installCorrectionObserver,
  type CorrectionObservation,
} from './world-map-correction-observer'
import { waitForWorldArt } from './world-art-readiness'
import { openMapSettings, closeMapSettings } from './world-map-settings-helpers'

interface Harness {
  enter: (page: Page) => Promise<string>
  world: (page: Page) => Promise<WorldView>
  sql: (query: string) => string
  stageWalk: (page: Page, destination: WorldPosition) => Promise<void>
}
const stage = 'canvas[data-world-stage]'
const observation = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __mapCorrection: CorrectionObservation }).__mapCorrection,
  )
const digest = (data: Buffer) => createHash('sha256').update(data).digest('hex')

async function zoom(page: Page, value: number) {
  await openMapSettings(page)
  const control = page.getByRole('slider', { name: 'Zoom level', exact: true })
  const desired = Math.round(value * 100)
  if (Number(await control.inputValue()) !== desired) {
    await control.press('Home')
    for (let index = 35; index < desired; index++) await control.press('ArrowRight')
  }
  await expect(control).toHaveValue(String(desired))
  await closeMapSettings(page)
  await expect(page.locator(stage)).toHaveAttribute(
    'data-tile-size',
    String(
      (await page.locator(stage).evaluate((el) => el.clientWidth < 600)) ? 48 * value : 64 * value,
    ),
  )
}
async function savePair(info: TestInfo, name: string, first: Buffer, second: Buffer) {
  const a = await sharp(first).metadata(),
    b = await sharp(second).metadata()
  const path = info.outputPath(`${name}.png`)
  await sharp({
    create: {
      width: Math.max(a.width!, b.width!),
      height: a.height! + b.height!,
      channels: 4,
      background: '#071c23',
    },
  })
    .composite([
      { input: first, top: 0, left: 0 },
      { input: second, top: a.height!, left: 0 },
    ])
    .png()
    .toFile(path)
  await info.attach(name, { path, contentType: 'image/png' })
}
async function saveScene(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`)
  await page.locator('[data-world-workspace]').screenshot({ path, animations: 'disabled' })
  await info.attach(name, { path, contentType: 'image/png' })
}
function profile(evidence: CorrectionObservation) {
  const percentile = (values: number[], p: number) =>
    values.sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))] ?? null
  const frames = evidence.frames
  const moving = frames.filter((frame) => frame.presentedMoving === 1)
  return {
    coldGroundBuilds: frames.reduce((sum, frame) => sum + frame.groundBuilds!, 0),
    groundBuildMs: frames.reduce((sum, frame) => sum + frame.groundBuildMs!, 0),
    warmFrames: frames.filter((frame) => frame.groundBuilds === 0).length,
    movingFrames: moving.length,
    movingFrameWorkP50: percentile(
      moving.map((frame) => frame.completedAt! - frame.startedAt!),
      0.5,
    ),
    movingFrameWorkP95: percentile(
      moving.map((frame) => frame.completedAt! - frame.startedAt!),
      0.95,
    ),
    frameWorkP50: percentile(
      frames.map((frame) => frame.completedAt! - frame.startedAt!),
      0.5,
    ),
    frameWorkP95: percentile(
      frames.map((frame) => frame.completedAt! - frame.startedAt!),
      0.95,
    ),
    groundBuildP95: percentile(
      frames.map((frame) => frame.groundBuildMs!),
      0.95,
    ),
  }
}

export function registerWorldMapCorrectionCases(harness: Harness) {
  async function setup(page: Page) {
    const errors: string[] = [],
      failedAssets: string[] = []
    const requests: {
      at: number
      method: string
      bytes: number
      status?: number
      durationMs?: number
    }[] = []
    const pending = new WeakMap<import('@playwright/test').Request, (typeof requests)[number]>()
    let sceneStarted = Date.now()
    page.on('request', (request) => {
      if (new URL(request.url()).pathname !== '/api/world') return
      const record = {
        at: Date.now(),
        method: request.method(),
        bytes: Buffer.byteLength(request.postData() ?? ''),
      }
      pending.set(request, record)
      requests.push(record)
      if (requests.length > 1000) requests.shift()
    })
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('response', (response) => {
      const request = pending.get(response.request())
      if (request) {
        request.status = response.status()
        request.durationMs = Date.now() - request.at
      }
      if (response.status() >= 400 && response.url().includes('/media/art/world/runtime/'))
        failedAssets.push(`${response.status()} ${response.url()}`)
    })
    await page.addInitScript(installCorrectionObserver)
    await harness.enter(page)
    const original = await harness.world(page)
    let weather: 'clear' | 'storm' = 'clear'
    // Presentation fixture only: terrain, discovery, image sources, auth and all
    // movement commands remain real. This does not verify shared weather scheduling.
    await page.route('**/api/world*', async (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      const response = await route.fetch(),
        body = await response.json()
      await route.fulfill({
        response,
        json: {
          ...body,
          environment: { ...body.environment, weather, minuteOfDay: 720, frozen: true },
        },
      })
    })
    const evidence: unknown[] = []
    const place = async (position: WorldPosition) => {
      sceneStarted = Date.now()
      harness.sql(
        `update app_private.character_world_state set state = state || '${JSON.stringify({ position, safe: false, route: [], routeDestination: null, routeObjectiveId: null, nextStepAt: null })}'::jsonb where character_id='${original.characterId}'::uuid;`,
      )
      await page.reload()
      await expect(page.locator(stage)).toHaveAttribute('data-camera-x', /\d/)
      const refreshed = page.waitForResponse(
        (response) =>
          response.request().method() === 'GET' &&
          new URL(response.url()).pathname === '/api/world',
      )
      // Replay the same visibility read used when returning to the mounted map;
      // it applies the explicit visual weather fixture through normal transport.
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
      expect((await refreshed).ok()).toBe(true)
      const view = await harness.world(page)
      expect(view.position).toEqual(position)
      await waitForWorldArt(page, view)
      return view
    }
    const load = async (spec: CorrectionScene) => {
      weather = spec.storm ? 'storm' : 'clear'
      const view = await place(spec.position)
      await zoom(page, spec.zoom ?? 1)
      const current = view.sectors.find((sector) => sector.id === view.position.sectorId)!
      await expect(page.locator(stage)).toHaveAttribute(
        'data-precipitation',
        precipitationKind(weather, current.regionId) ?? 'none',
      )
      if (spec.storm)
        await expect
          .poll(async () =>
            Number(await page.locator(stage).getAttribute('data-precipitation-particles')),
          )
          .toBeGreaterThan(0)
      await expect
        .poll(
          async () => {
            const data = await observation(page)
            return spec.assets.every((asset) => (data.assets[asset]?.draws ?? 0) > 0)
          },
          { message: `${spec.id}: final decoded art must actually be painted` },
        )
        .toBe(true)
      const terrain = worldRenderTerrain(view)
      const water = buildWaterField(terrain)
      const cells = [...water.values()].flatMap((sector) => [...sector.cells.values()])
      if (spec.expect === 'rocks')
        expect(
          terrain.some(
            (sector) =>
              sector.regionId === 'frostmere' && sector.cells.some((cell) => cell.terrain === '#'),
          ),
        ).toBe(true)
      if (spec.expect === 'lake') {
        expect(cells.some((cell) => cell.basin)).toBe(true)
        expect(cells.some((cell) => (cell.depth ?? 0) > 0)).toBe(true)
      }
      if (spec.expect === 'river')
        expect(
          new Set(terrain.filter((s) => s.cells.some((c) => c.terrain === '~')).map((s) => s.id))
            .size,
        ).toBeGreaterThan(1)
      if (spec.expect === 'coast')
        expect(
          [...buildPublicCoasts({ sectors: terrain, atlas: view.atlas }).values()].some(
            (edges) => edges.length,
          ),
        ).toBe(true)
      if (spec.expect === 'bridge')
        expect(
          terrain.some(
            (s) =>
              s.townId === 'umbral-march' && s.cells.some((c) => c.terrain === 'w' && c.walkable),
          ),
        ).toBe(true)
      if (spec.expect === 'lavafall')
        expect(terrain.some((s) => s.cells.some((c) => c.terrain === 'l' && !c.walkable))).toBe(
          true,
        )
      if (spec.expect === 'arena') {
        const identity = await observation(page)
        expect(identity.selfPaints).toBeGreaterThan(0)
        expect(identity.selfGhostPaints).toBe(0)
        expect(
          await page.locator('canvas[data-world-identity]').evaluate((canvas) => ({
            opacity: getComputedStyle(canvas).opacity,
            pixels: (canvas as HTMLCanvasElement).width * (canvas as HTMLCanvasElement).height,
          })),
        ).toMatchObject({ opacity: '1', pixels: expect.any(Number) })
      }
      return view
    }
    const record = async (key: string, view?: WorldView, extra: object = {}) => {
      await expect.poll(async () => profile(await observation(page)).warmFrames).toBeGreaterThan(0)
      const data = await observation(page),
        timings = profile(data)
      expect(timings.coldGroundBuilds).toBeGreaterThan(0)
      expect(timings.warmFrames).toBeGreaterThan(0)
      expect(
        data.frames.every(
          (frame) => frame.completedAt! >= frame.startedAt! && frame.groundBuildMs! >= 0,
        ),
      ).toBe(true)
      const resources = await page.evaluate(() =>
        (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
          .filter(
            (entry) =>
              entry.name.includes('/media/art/world/runtime/') ||
              new URL(entry.name).pathname === '/api/world',
          )
          .map((entry) => ({
            name: new URL(entry.name).pathname,
            duration: entry.duration,
            transferSize: entry.transferSize,
            encodedBodySize: entry.encodedBodySize,
          })),
      )
      evidence.push({
        key,
        scope: 'native mounted app; visual weather fixture only',
        position: view?.position,
        weather,
        profile: timings,
        data,
        resources,
        requests: requests.filter((request) => request.at >= sceneStarted),
        ...extra,
      })
    }
    const finish = async (info: TestInfo) => {
      writeFileSync(
        info.outputPath('world-map-correction-acceptance.json'),
        JSON.stringify({ project: info.project.name, errors, failedAssets, evidence }, null, 2),
      )
      await page.unrouteAll({ behavior: 'wait' })
      harness.sql(
        `update app_private.character_world_state set state = state || '${JSON.stringify({ position: original.position, route: original.route, routeDestination: original.routeDestination ?? null, routeObjectiveId: original.routeObjectiveId ?? null, nextStepAt: original.nextStepAt })}'::jsonb where character_id='${original.characterId}'::uuid;`,
      )
      expect(failedAssets).toEqual([])
      expect(errors).toEqual([])
    }
    return { place, load, record, finish }
  }

  test('@map-correction all eight towns have actual normal and minimum zoom acceptance views', async ({
    page,
  }, info) => {
    test.skip(
      info.project.name === 'laptop-chromium',
      'The bounded matrix runs once per desktop and phone.',
    )
    test.setTimeout(240000)
    const matrix = correctionScenes(),
      run = await setup(page)
    try {
      for (const spec of matrix.towns) {
        const view = await run.load(spec)
        const normal = await page
          .locator('[data-world-workspace]')
          .screenshot({ animations: 'disabled' })
        await zoom(page, 0.35)
        const minimum = await page
          .locator('[data-world-workspace]')
          .screenshot({ animations: 'disabled' })
        await savePair(info, `art-${spec.id}-correction-normal-minimum`, normal, minimum)
        expect(
          new Set(view.sectors.filter((s) => s.townId === spec.position.sectorId).map((s) => s.id))
            .size,
        ).toBeGreaterThan(1)
        await run.record(spec.id, view, { pairOrder: 'normal above minimum', zooms: [1, 0.35] })
      }
    } finally {
      await run.finish(info)
    }
  })

  test('@map-correction landscape, water, discoveries and shallow movement have native acceptance views', async ({
    page,
  }, info) => {
    test.skip(
      info.project.name === 'laptop-chromium',
      'The bounded matrix runs once per desktop and phone.',
    )
    test.setTimeout(300000)
    const matrix = correctionScenes(),
      run = await setup(page)
    try {
      for (const spec of [...matrix.landscapes, ...matrix.discoveries]) {
        const view = await run.load(spec)
        let captured = false
        if (spec.storm) {
          const first = await page.locator(stage).screenshot()
          await page.waitForTimeout(350)
          expect(digest(await page.locator(stage).screenshot())).not.toBe(digest(first))
        }
        if (spec.expect === 'bridge') {
          const own = view.sectors.find((s) => s.id === view.position.sectorId)!
          const occupied = [...view.players, ...(view.npcs ?? [])].map((p) => p.position)
          const target = own.cells
            .filter(
              (c) =>
                c.terrain === 'w' &&
                c.walkable &&
                !occupied.some((p) => p.sectorId === own.id && p.x === c.x && p.y === c.y),
            )
            .map((to) => ({
              to,
              from: own.cells.find(
                (from) => from.walkable && Math.abs(from.x - to.x) + Math.abs(from.y - to.y) === 1,
              ),
            }))
            .find((pair) => pair.from)!
          expect(target).toBeDefined()
          await run.place({ sectorId: own.id, x: target.from!.x, y: target.from!.y })
          await harness.stageWalk(page, { sectorId: own.id, x: target.to.x, y: target.to.y })
          await expect
            .poll(async () => (await harness.world(page)).position)
            .toEqual({ sectorId: own.id, x: target.to.x, y: target.to.y })
          await expect
            .poll(async () => (await observation(page)).shallowRipplePaints)
            .toBeGreaterThan(0)
          await run.record(`${spec.id}-moving-profile`, await harness.world(page))
          const moving = await page
            .locator('[data-world-workspace]')
            .screenshot({ animations: 'disabled' })
          await page.emulateMedia({ reducedMotion: 'reduce' })
          const before = (await observation(page)).shallowRipplePaints
          const back = { sectorId: own.id, x: target.from!.x, y: target.from!.y }
          await harness.stageWalk(page, back)
          await expect.poll(async () => (await harness.world(page)).position).toEqual(back)
          await page.waitForTimeout(220)
          expect((await observation(page)).shallowRipplePaints).toBe(before)
          const reduced = await page
            .locator('[data-world-workspace]')
            .screenshot({ animations: 'disabled' })
          await savePair(info, `art-surfaces-correction-${spec.id}-moving-reduced`, moving, reduced)
          await page.emulateMedia({ reducedMotion: 'no-preference' })
          captured = true
        }
        if (spec.id === 'elemental-valley' || spec.id === 'remote-colosseum') {
          const minimum = await page
            .locator('[data-world-workspace]')
            .screenshot({ animations: 'disabled' })
          const beforeNormal = await observation(page)
          await zoom(page, 1)
          if (spec.normalAssets?.length) {
            await expect
              .poll(
                async () => {
                  const current = await observation(page)
                  return spec.normalAssets!.every(
                    (asset) =>
                      (current.assets[asset]?.draws ?? 0) >
                      (beforeNormal.assets[asset]?.draws ?? 0),
                  )
                },
                { message: `${spec.id}: normal-scale details must be decoded and painted` },
              )
              .toBe(true)
          }
          const normal = await page
            .locator('[data-world-workspace]')
            .screenshot({ animations: 'disabled' })
          if (spec.expect === 'arena') expect((await observation(page)).selfGhostPaints).toBe(0)
          await savePair(info, `art-surfaces-correction-${spec.id}-normal-minimum`, normal, minimum)
          captured = true
        }
        if (spec.reducedPair) {
          const storm = await page
            .locator('[data-world-workspace]')
            .screenshot({ animations: 'disabled' })
          await page.emulateMedia({ reducedMotion: 'reduce' })
          await expect(page.locator(stage)).toHaveAttribute('data-precipitation-particles', '0')
          const before = (await observation(page)).shallowRipplePaints
          const reduced = await page
            .locator('[data-world-workspace]')
            .screenshot({ animations: 'disabled' })
          await page.waitForTimeout(350)
          expect((await observation(page)).shallowRipplePaints).toBe(before)
          await savePair(info, `art-surfaces-correction-${spec.id}-storm-reduced`, storm, reduced)
          await page.emulateMedia({ reducedMotion: 'no-preference' })
        } else if (!captured) await saveScene(page, info, `art-surfaces-correction-${spec.id}`)
        await run.record(spec.id, view, { footprint: spec.footprint, artTiles: spec.artTiles })
      }
    } finally {
      await run.finish(info)
    }
  })

  test('@map-correction native WebGL and software globe both show the Uncharted supercontinent', async ({
    page,
  }, info) => {
    test.skip(
      info.project.name === 'laptop-chromium',
      'The bounded matrix runs once per desktop and phone.',
    )
    test.setTimeout(120000)
    const run = await setup(page)
    try {
      for (const backend of ['webgl', 'fallback'] as const) {
        if (backend === 'fallback') {
          await page.addInitScript(() => {
            const original = HTMLCanvasElement.prototype.getContext
            HTMLCanvasElement.prototype.getContext = function (
              this: HTMLCanvasElement,
              kind: string,
              ...args: unknown[]
            ) {
              return kind === 'webgl' ? null : Reflect.apply(original, this, [kind, ...args])
            } as typeof original
          })
          await page.reload()
        }
        const globeView = await run.place((await harness.world(page)).position)
        await run.record(`globe-${backend}-local-profile`, globeView)
        await page.getByRole('button', { name: /Open world atlas/ }).click()
        const globe = page.getByRole('group', { name: /World globe/ })
        await expect(globe).toBeVisible()
        if (backend === 'webgl') {
          await expect.poll(async () => (await observation(page)).webglContexts).toBeGreaterThan(0)
          await expect
            .poll(async () => (await observation(page)).globePaintingUploads)
            .toBeGreaterThan(0)
          await expect.poll(async () => (await observation(page)).globeDraws).toBeGreaterThan(0)
          await expect(page.locator('canvas[data-globe-fallback]')).toHaveCount(0)
        } else await expect(page.locator('canvas[data-globe-fallback]')).toBeVisible()
        // Centre the deliberate public veil using native keyboard rotation.
        // These are illustrative globe angles, not hidden sector coordinates.
        const current = globeView.sectors.find(
          (sector) => sector.id === globeView.position.sectorId,
        )!
        const longitude =
          ((current.atlasColumn! + (globeView.position.x + 0.5) / 13) * 360) / 128 - 180
        const latitude = 90 - ((current.atlasRow! + (globeView.position.y + 0.5) / 9) * 180) / 64
        const horizontal = Math.round((((180 - longitude + 540) % 360) - 180) / 10)
        const vertical = Math.round((-45 - latitude) / 10)
        for (let index = 0; index < Math.abs(vertical); index++)
          await globe.press(vertical < 0 ? 'ArrowDown' : 'ArrowUp')
        for (let index = 0; index < Math.abs(horizontal); index++)
          await globe.press(horizontal < 0 ? 'ArrowLeft' : 'ArrowRight')
        if (backend === 'fallback') {
          await expect.poll(async () => (await observation(page)).fallbackPaints).toBeGreaterThan(0)
          await expect
            .poll(() =>
              page
                .locator('canvas[data-globe-fallback]')
                .evaluate((canvas) => (canvas as HTMLCanvasElement).width),
            )
            .toBeGreaterThanOrEqual(420)
        }
        await expect(
          page.getByRole('button', { name: 'Uncharted supercontinent', exact: true }),
        ).toBeVisible()
        await expect(page.getByText('Uncharted Waters', { exact: true })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Travel here', exact: true })).toHaveCount(0)
        await saveScene(page, info, `art-surfaces-correction-globe-${backend}-supercontinent`)
        await run.record(`globe-${backend}`)
        await page.getByRole('button', { name: /Return to local map/ }).click()
      }
    } finally {
      await run.finish(info)
    }
  })
}
