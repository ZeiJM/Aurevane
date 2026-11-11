import { waitForWorldArt } from './world-art-readiness'
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { settlementComposition } from '../src/components/world/map-settlement-composition'
import { naturalDressing, sceneryDressing } from '../src/components/world/map-dressing'
import { atlasSectors } from '../src/world/atlas'
import { GRID_HEIGHT, GRID_WIDTH, WORLD_REGIONS } from '../src/world/catalog'
import type { WorldPosition, WorldView } from '../src/world/types'

export function registerWorldArtReviewCases({
  enter,
  world,
  sql,
  capture,
  stageWalk,
}: {
  enter: (page: Page) => Promise<string>
  world: (page: Page) => Promise<WorldView>
  stageWalk: (page: Page, destination: WorldPosition) => Promise<void>
  sql: (query: string) => string
  capture: (page: Page, info: TestInfo, name: string) => Promise<void>
}) {
  // The shared SQL helper rejects every non-loopback database. Survey only the
  // disposable character's current sector so private artwork uses real projection.
  async function scene(page: Page, characterId: string, position: WorldPosition, phase = 0) {
    const state = {
      position,
      safe: false,
      route: [],
      routeDestination: null,
      nextStepAt: null,
      routeObjectiveId: null,
      warpedPhase: phase,
      discoveries: {
        [position.sectorId]: Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, (_, i) => i),
      },
    }
    sql(
      `update app_private.character_world_state set state = state || '${JSON.stringify(state)}'::jsonb where character_id='${characterId}'::uuid;`,
    )
    await page.reload()
    const canvas = page.locator('canvas[data-world-stage]')
    await expect(canvas).toHaveAttribute('data-tile-size', /\d/)
    const view = await world(page)
    expect(view.position).toEqual(position)
    const sector = view.sectors.find(({ id }) => id === position.sectorId)!
    expect(sector).toBeDefined()
    const dressing = [
      ...sceneryDressing(sector),
      ...naturalDressing(sector),
      ...settlementComposition(sector),
    ]
    await waitForWorldArt(page, view)
    return { sector, dressing, environment: view.environment }
  }

  type ArtScene = Awaited<ReturnType<typeof scene>>

  for (const region of WORLD_REGIONS) {
    test(`all ${region.name} hamlets have working scenery at normal zoom`, async ({
      page,
    }, info) => {
      test.skip(info.project.name !== 'desktop-chromium', 'Capture every mainland hamlet once.')
      test.setTimeout(180_000)
      const hamlets = atlasSectors()
        .filter(({ regionId }) => regionId === region.id)
        .flatMap((sector) =>
          sector.landmarks
            .filter(({ kind }) => kind === 'hamlet')
            .map((landmark) => ({ sectorId: sector.id, landmark })),
        )
      expect(hamlets.length).toBeGreaterThan(0)
      await enter(page)
      const { characterId } = await world(page)
      const evidence: (ArtScene & { sectorId: string; name: string })[] = []
      for (const { sectorId, landmark } of hamlets) {
        await test.step(`${landmark.name} in ${sectorId}`, async () => {
          const result = await scene(page, characterId, { sectorId, x: landmark.x, y: landmark.y })
          expect(result.dressing.some(({ sheet }) => sheet === 'hamlet-dressing')).toBe(true)
          await capture(page, info, `art-hamlet-${sectorId.replaceAll(':', '-')}`)
          evidence.push({ sectorId, name: landmark.name, ...result })
        })
      }
      writeFileSync(info.outputPath('world-art-review.json'), JSON.stringify(evidence, null, 2))
    })
  }

  // Only the visual environment is overridden. Auth, projection, images and commands
  // still use the real disposable backend; this is not server-weather acceptance.
  for (const region of WORLD_REGIONS) {
    test(`${region.name} town has image-ready native weather and motion views`, async ({
      page,
    }, info) => {
      test.skip(info.project.name === 'laptop-chromium', 'Desktop and phone-sized art comparison.')
      test.setTimeout(180_000)
      await enter(page)
      const { characterId } = await world(page)
      let weather: WorldView['environment']['weather'] = 'clear'
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
      const cases: WorldView['environment']['weather'][] =
        info.project.name === 'mobile-chromium'
          ? ['clear', 'storm']
          : ['clear', 'overcast', 'wind', 'fog', 'rain', 'storm']
      const evidence: unknown[] = []
      const canvas = page.locator('canvas[data-world-stage]')
      for (const condition of cases) {
        weather = condition
        const result = await scene(page, characterId, { sectorId: region.id, x: 6, y: 4 })
        expect(result.sector.townId).toBe(region.id)
        expect(result.dressing.length).toBeGreaterThan(0)
        const precipitation =
          condition === 'rain' || condition === 'storm'
            ? region.id === 'frostmere'
              ? 'snow'
              : 'rain'
            : 'none'
        await expect(canvas).toHaveAttribute('data-precipitation', precipitation)
        if (precipitation !== 'none')
          await expect
            .poll(async () => Number(await canvas.getAttribute('data-precipitation-particles')))
            .toBeGreaterThan(0)
        const frames = []
        for (let sample = 0; sample < 2; sample++) {
          const frame = Number(await canvas.getAttribute('data-frame-now'))
          await expect
            .poll(async () => Number(await canvas.getAttribute('data-frame-now')))
            .toBeGreaterThan(frame + 240)
          // Native screenshots remain readable even when a public portrait taints Canvas.
          const pixels = await canvas.screenshot({ animations: 'disabled' })
          frames.push({
            frame: Number(await canvas.getAttribute('data-frame-now')),
            sha256: createHash('sha256').update(pixels).digest('hex'),
          })
          await capture(page, info, `art-town-${region.id}-${condition}-${sample}`)
        }
        // Rain/snow is genuinely moving, not only a weather label in scene metadata.
        if (condition === 'rain' || condition === 'storm')
          expect(frames[0]!.sha256).not.toBe(frames[1]!.sha256)
        evidence.push({
          visualFixture: { weather: condition, minuteOfDay: 720, frozen: true },
          frames,
          ...result,
        })
      }
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await expect(canvas).toHaveAttribute('data-precipitation-particles', '0')
      await capture(page, info, `art-town-${region.id}-reduced-motion`)
      writeFileSync(
        info.outputPath('world-art-review.json'),
        JSON.stringify(
          {
            scope: 'local visual weather fixture, not shared weather or human acceptance',
            evidence,
            reducedMotion: true,
          },
          null,
          2,
        ),
      )
    })
  }

  test('moving traveller keeps native identity behind settlement roofs and trees', async ({
    page,
  }, info) => {
    test.skip(info.project.name === 'laptop-chromium', 'Desktop and phone-sized movement evidence.')
    test.setTimeout(120_000)
    await enter(page)
    const { characterId } = await world(page)
    const result = await scene(page, characterId, { sectorId: 'frostmere', x: 6, y: 4 })
    const sector = result.sector
    const cases = [
      { label: 'roof', from: { x: 3, y: 1 }, to: { x: 3, y: 2 } },
      { label: 'tree', from: { x: 1, y: 6 }, to: { x: 1, y: 7 } },
    ]
    const identity = page.locator('canvas[data-world-identity]')
    const sample = async () =>
      identity.evaluate((el) => {
        const canvas = el as HTMLCanvasElement,
          style = getComputedStyle(canvas)
        return {
          width: canvas.width,
          height: canvas.height,
          opacity: Number(style.opacity),
          visible: style.display !== 'none' && style.visibility === 'visible',
        }
      })
    const evidence = []
    for (const { label, from, to } of cases) {
      const start = sector.cells.find((c) => c.x === from.x && c.y === from.y)!
      const end = sector.cells.find((c) => c.x === to.x && c.y === to.y)!
      expect(start.walkable).toBe(true)
      expect(end.walkable).toBe(true)
      if (label === 'tree') expect(start.terrain).toBe('t')
      await scene(page, characterId, { sectorId: sector.id, ...from })
      const before = await sample()
      expect(before.visible).toBe(true)
      expect(before.opacity).toBe(1)
      expect(before.width * before.height).toBeGreaterThan(0)
      // Observe the real identity painter, supporting both embodied grayscale
      // actors and the legacy opaque gray token without changing native drawing.
      await identity.evaluate((el) => {
        const context = (el as HTMLCanvasElement).getContext('2d')!,
          draw = context.drawImage,
          fill = context.fill
        context.drawImage = new Proxy(draw, {
          apply(target, receiver, args) {
            if (context.filter.includes('grayscale')) {
              el.dataset.testGhostPaints = String(Number(el.dataset.testGhostPaints ?? 0) + 1)
              el.dataset.testGhostAlpha = String(context.globalAlpha)
            }
            return Reflect.apply(target, receiver, args)
          },
        })
        context.fill = new Proxy(fill, {
          apply(target, receiver, args) {
            if (context.fillStyle === '#a6b1b0') {
              el.dataset.testGhostPaints = String(Number(el.dataset.testGhostPaints ?? 0) + 1)
              el.dataset.testGhostAlpha = String(context.globalAlpha)
            }
            return Reflect.apply(target, receiver, args)
          },
        })
      })
      const viewport = page.viewportSize()!
      await page.setViewportSize({ ...viewport, height: viewport.height - 1 })
      await expect
        .poll(async () => Number(await identity.getAttribute('data-test-ghost-paints')))
        .toBeGreaterThan(0)
      const ghostPaints = Number(await identity.getAttribute('data-test-ghost-paints'))
      const ghostAlpha = Number(await identity.getAttribute('data-test-ghost-alpha'))
      expect(ghostAlpha).toBeGreaterThan(0)
      expect(ghostAlpha).toBeLessThanOrEqual(1)
      await capture(page, info, `art-occlusion-${label}-before`)
      await stageWalk(page, { sectorId: sector.id, ...to })
      await expect
        .poll(async () => (await world(page)).position)
        .toEqual({ sectorId: sector.id, ...to })
      // Wait for the actual client traveller to catch the authoritative endpoint.
      const canvas = page.locator('canvas[data-world-stage]')
      await expect
        .poll(async () => Number(await canvas.getAttribute('data-traveller-x')))
        .toBeCloseTo((sector.atlasColumn ?? 0) * GRID_WIDTH + to.x + 0.5, 2)
      await expect
        .poll(async () => Number(await canvas.getAttribute('data-traveller-y')))
        .toBeCloseTo((sector.atlasRow ?? 0) * GRID_HEIGHT + to.y + 0.5, 2)
      const after = await sample()
      expect(after.visible).toBe(true)
      expect(after.opacity).toBe(1)
      expect(after.width * after.height).toBeGreaterThan(0)
      await capture(page, info, `art-occlusion-${label}-after`)
      evidence.push({ label, start, end, before, after, ghostPaints, ghostAlpha })
    }
    writeFileSync(
      info.outputPath('world-art-review.json'),
      JSON.stringify(
        {
          scope:
            'real authorized walks behind roof/tree on a disposable character; stills are not continuous motion or human silhouette acceptance',
          evidence,
        },
        null,
        2,
      ),
    )
  })

  test('all Void districts, rare landmarks and refuges have surveyed scenic captures', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'Capture private phase artwork once.')
    test.setTimeout(180_000)
    await enter(page)
    const { characterId } = await world(page)
    const districts = [
      'glass',
      'belfry',
      'pale',
      'orchard',
      'landing',
      'mirrors',
      'cinders',
      'verge',
      'tarn',
      'spiral',
      'geodes',
      'shale',
      'relic',
    ]
    const variants: [string, number, string][] = [
      ['tarn', 7, 'The Violet Mirror'],
      ['mirrors', 12, 'The Twin Glass'],
      ['orchard', 8, 'The Meteor Lily'],
      ['pale', 3, 'The Misaligned Gate'],
      ['geodes', 3, 'The First Resonance'],
      ['cinders', 1, 'The Unfinished Village'],
      ['relic', 3, 'Sporelight Homes'],
    ]
    const cases: [string, number, string | null][] = [
      ...districts.map((key): [string, number, string | null] => [
        key,
        0,
        key === 'verge' ? 'Lantern Refuge' : null,
      ]),
      ...variants,
    ]
    const evidence: (ArtScene & { phase: number })[] = []
    for (const [key, phase, landmark] of cases) {
      await test.step(`${key} phase ${phase}`, async () => {
        const sectorId = `uncharted-${key}`
        const result = await scene(page, characterId, { sectorId, x: 6, y: 4 }, phase)
        expect(result.sector.charted).toBe(false)
        expect(result.sector.warpedScenery).toBeDefined()
        expect(result.dressing).toHaveLength(1)
        if (landmark) expect(result.sector.landmarks.map(({ name }) => name)).toContain(landmark)
        await capture(page, info, `art-void-${key}-phase-${phase}`)
        evidence.push({ phase, ...result })
      })
    }
    writeFileSync(info.outputPath('world-art-review.json'), JSON.stringify(evidence, null, 2))
  })
}
