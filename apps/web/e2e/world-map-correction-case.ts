import { createHash, randomUUID } from 'node:crypto'
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
import { matchesWorldWalk } from './world-presence-diagnostics'
import { UNCHARTED_VEIL_FOCUS } from '../src/components/world/globe-veil'
import {
  WORLD_MAX_ZOOM,
  WORLD_MIN_ZOOM,
  worldZoomFromPercent,
  worldZoomPercent,
} from '../src/components/world/world-zoom'

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
  const desired = worldZoomPercent(value)
  if (Number(await control.inputValue()) !== desired) await control.fill(String(desired))
  await expect(control).toHaveValue(String(desired))
  await closeMapSettings(page)
  const canvas = page.locator(stage)
  const baseTile = await canvas.evaluate((el) => (el.clientWidth < 600 ? 48 : 64))
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-tile-size')))
    .toBeCloseTo(baseTile * worldZoomFromPercent(desired), 0)
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
    const load = async (spec: CorrectionScene, identityMode: 'clear' | 'occluded' = 'clear') => {
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
      if (spec.expect === 'lavafall')
        expect(terrain.some((s) => s.cells.some((c) => c.terrain === 'l' && !c.walkable))).toBe(
          true,
        )
      if (spec.expect === 'arena') {
        const identity = await observation(page)
        expect(identity.selfPaints).toBeGreaterThan(0)
        if (identityMode === 'occluded') expect(identity.selfGhostPaints).toBeGreaterThan(0)
        else expect(identity.selfGhostPaints).toBe(0)
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
        await zoom(page, WORLD_MIN_ZOOM)
        const minimum = await page
          .locator('[data-world-workspace]')
          .screenshot({ animations: 'disabled' })
        await savePair(info, `art-${spec.id}-correction-normal-minimum`, normal, minimum)
        expect(
          new Set(view.sectors.filter((s) => s.townId === spec.position.sectorId).map((s) => s.id))
            .size,
        ).toBeGreaterThan(1)
        await run.record(spec.id, view, {
          pairOrder: 'normal above minimum',
          zooms: [1, WORLD_MIN_ZOOM],
        })
      }
    } finally {
      await run.finish(info)
    }
  })

  test('@map-correction major artwork has legal detail viewpoints at normal and maximum zoom', async ({
    page,
  }, info) => {
    test.skip(info.project.name === 'laptop-chromium', 'Review detail once per desktop and phone.')
    test.setTimeout(120000)
    const scenes = correctionScenes().discoveries.filter((scene) => scene.detailPosition)
    expect(scenes).toHaveLength(2)
    const run = await setup(page)
    try {
      for (const spec of scenes) {
        // This legal rear-wall viewpoint deliberately differs from the open
        // arena floor. The player remains readable through normal occlusion.
        const view = await run.load(
          {
            ...spec,
            position: spec.detailPosition!,
            zoom: 1,
            assets: [
              ...spec.assets,
              ...(spec.id === 'remote-colosseum' ? ['colosseum-rear-detail-v01.webp'] : []),
            ],
          },
          spec.detailIdentity ?? 'clear',
        )
        const normal = await page
          .locator('[data-world-workspace]')
          .screenshot({ animations: 'disabled' })
        await zoom(page, WORLD_MAX_ZOOM)
        await expect.poll(async () => (await observation(page)).selfPaints).toBeGreaterThan(0)
        const maximum = await page
          .locator('[data-world-workspace]')
          .screenshot({ animations: 'disabled' })
        await savePair(info, `art-surfaces-${spec.id}-detail-normal-maximum`, normal, maximum)
        expect((await harness.world(page)).position).toEqual(view.position)
        if (spec.expect === 'arena') {
          const identity = await observation(page)
          if (spec.detailIdentity === 'occluded')
            expect(identity.selfGhostPaints).toBeGreaterThan(0)
          else expect(identity.selfGhostPaints).toBe(0)
        }
        await run.record(`${spec.id}-legal-detail-view`, view, {
          pairOrder: 'normal above maximum',
          zooms: [1, WORLD_MAX_ZOOM],
        })
      }
    } finally {
      await run.finish(info)
    }
  })

  test('@map-correction colosseum lateral masonry stays registered at maximum zoom', async ({
    page,
  }, info) => {
    test.skip(info.project.name === 'laptop-chromium', 'Review detail once per desktop and phone.')
    test.setTimeout(120000)
    const spec = correctionScenes().discoveries.find((scene) => scene.id === 'remote-colosseum')!
    expect(spec.detailSides).toHaveLength(2)
    const run = await setup(page)
    try {
      for (const side of spec.detailSides ?? []) {
        const sideView = await run.load(
          {
            ...spec,
            position: side.position,
            zoom: WORLD_MAX_ZOOM,
            assets: [...spec.assets, side.asset],
          },
          side.identity,
        )
        await saveScene(page, info, `art-surfaces-${spec.id}-${side.id}-detail-maximum`)
        expect((await harness.world(page)).position).toEqual(sideView.position)
        await run.record(`${spec.id}-${side.id}-legal-detail-view`, sideView, {
          zoom: WORLD_MAX_ZOOM,
        })
      }
    } finally {
      await run.finish(info)
    }
  })

  test('@map-correction landscape, water, discoveries and moat crossing have native acceptance views', async ({
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
        if (spec.moatCrossing) {
          const { deck, water, arrival } = spec.moatCrossing
          const own = view.sectors.find((sector) => sector.id === deck.sectorId)!
          expect(own.townId).toBe('umbral-march')
          expect(own.landmarks).toContainEqual(
            expect.objectContaining({ kind: 'bridge', x: deck.x, y: deck.y }),
          )
          const cellAt = ({ x, y }: WorldPosition) =>
            own.cells.find((cell) => cell.x === x && cell.y === y)
          expect(cellAt(water)).toMatchObject({ terrain: '~', walkable: false })
          expect(cellAt(deck)).toMatchObject({ walkable: true })

          const blocked = await page.request.post('/api/world', {
            data: {
              characterId: view.characterId,
              expectedVersion: view.version,
              commandId: randomUUID(),
              intent: { kind: 'walk', destination: water },
            },
          })
          expect(blocked.status()).toBe(400)
          expect(await blocked.json()).toMatchObject({
            error: {
              code: 'INVALID_REQUEST',
              message: 'There is no known walkable route to that location.',
            },
          })
          expect((await harness.world(page)).position).toEqual(spec.position)

          const approved = page.waitForResponse(
            (response) =>
              response.request().method() === 'POST' &&
              new URL(response.url()).pathname === '/api/world' &&
              matchesWorldWalk(response.request().postDataJSON(), arrival) &&
              response.status() !== 409,
          )
          await harness.stageWalk(page, arrival)
          const receipt = await approved
          expect(receipt.ok()).toBe(true)
          const { route } = (await receipt.json()) as Pick<WorldView, 'route'>
          expect(route).toContainEqual(expect.objectContaining({ position: deck }))
          expect(route.at(-1)?.position).toEqual(arrival)
          await expect.poll(async () => (await harness.world(page)).position).toEqual(arrival)
          await expect
            .poll(async () => profile(await observation(page)).movingFrames)
            .toBeGreaterThan(0)
          await run.record(`${spec.id}-moving-profile`, await harness.world(page))
          const moving = await page
            .locator('[data-world-workspace]')
            .screenshot({ animations: 'disabled' })
          await page.emulateMedia({ reducedMotion: 'reduce' })
          await harness.stageWalk(page, spec.position)
          await expect.poll(async () => (await harness.world(page)).position).toEqual(spec.position)
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
        // Record the real shared coastline at three orientations on both native
        // backends and both applicable viewports. A screenshot is evidence for
        // visual review, never an automatic natural-coast acceptance result.
        const rotate = async (steps: number) => {
          for (let turn = 0; turn < Math.abs(steps); turn++)
            await globe.press(steps < 0 ? 'ArrowLeft' : 'ArrowRight')
        }
        for (const view of [
          { name: 'center', steps: 0 },
          { name: 'east', steps: 4 },
          { name: 'west', steps: -8 },
        ]) {
          await rotate(view.steps)
          if (view.steps) {
            await expect(globe).toBeFocused()
            const focus = await globe.evaluate((element) => {
              const style = getComputedStyle(element)
              return { outline: parseFloat(style.outlineWidth), radius: style.borderTopLeftRadius }
            })
            expect(focus.outline).toBeGreaterThanOrEqual(2)
            expect(focus.radius).toBe('6px')
          }
          await saveScene(page, info, `art-surfaces-correction-globe-${backend}-coast-${view.name}`)
        }
        await rotate(4) // Restore the original geographic camera before veil checks.
        // Centre the deliberate public veil using native keyboard rotation.
        // These are illustrative globe angles, not hidden sector coordinates.
        const current = globeView.sectors.find(
          (sector) => sector.id === globeView.position.sectorId,
        )!
        const longitude =
          ((current.atlasColumn! + (globeView.position.x + 0.5) / 13) * 360) / 128 - 180
        const latitude = 90 - ((current.atlasRow! + (globeView.position.y + 0.5) / 9) * 180) / 64
        const horizontal = Math.round(
          (((UNCHARTED_VEIL_FOCUS.longitude - longitude + 540) % 360) - 180) / 10,
        )
        const vertical = Math.round((UNCHARTED_VEIL_FOCUS.latitude - latitude) / 10)
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
          page.getByRole('button', { name: 'Focus Uncharted Lands', exact: true }),
        ).toHaveCount(0)
        await expect(page.getByText('Uncharted Lands', { exact: true })).toBeVisible()
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
