import { writeFileSync } from 'node:fs'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { sceneryDressing } from '../src/components/world/map-dressing'
import { atlasSectors } from '../src/world/atlas'
import { GRID_HEIGHT, GRID_WIDTH, WORLD_REGIONS } from '../src/world/catalog'
import type { WorldPosition, WorldView } from '../src/world/types'

export function registerWorldArtReviewCases({
  enter,
  world,
  sql,
  capture,
}: {
  enter: (page: Page) => Promise<string>
  world: (page: Page) => Promise<WorldView>
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
    const dressing = sceneryDressing(sector)
    const sheets = [
      'terrain-v02',
      'buildings-v02',
      'nature-v02',
      'props-v02',
      'biomes-v02',
      'beauties-v03',
      'regional-ground-v01',
      ...(sector.charted && sector.landmarks.some(({ kind }) => kind === 'hamlet')
        ? ['hamlet-buildings-v01']
        : []),
      ...new Set(dressing.map(({ sheet }) => `${sheet}-v01`)),
      ...(sector.regionId === 'frostmere' ? ['frostmere-v01'] : []),
      ...(sector.buildings?.length ? ['regional-settlements-v01'] : []),
      ...(sector.landmarks.some(({ warpedArt }) => warpedArt !== undefined && warpedArt < 6)
        ? ['warped-landmarks-v01']
        : []),
      ...(sector.landmarks.some(({ warpedArt }) => warpedArt !== undefined && warpedArt >= 6)
        ? ['warped-refuges-v01']
        : []),
    ]
    await page.evaluate(async (names) => {
      await Promise.all(
        names.map(async (name) => {
          const image = new Image()
          image.src = `/media/art/world/runtime/${name}.webp`
          await image.decode()
        }),
      )
    }, sheets)
    const frame = await canvas.getAttribute('data-frame-now')
    await expect(canvas).not.toHaveAttribute('data-frame-now', frame ?? '')
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
