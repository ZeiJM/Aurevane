import { impactSite } from '../src/components/world/map-impact'
import { lavaFallSite } from '../src/components/world/map-surface-art'
import { settlementFloorIndex } from '../src/components/world/map-settlement-floor'
import { expect, type Page } from '@playwright/test'
import {
  hamletFamilyIndex,
  naturalDressing,
  regionalScenery,
  sceneryDressing,
} from '../src/components/world/map-dressing'
import { settlementComposition } from '../src/components/world/map-settlement-composition'
import { worldRenderTerrain } from '../src/components/world/map-render-terrain'
import type { WorldView } from '../src/world/types'

/** Decode every sheet used by supplied visible/neighbor ground, not only the current sector. */
export async function waitForWorldArt(page: Page, view: WorldView) {
  const sheets = new Set([
    'terrain-v02',
    'buildings-v02',
    'nature-v02',
    'props-v02',
    'biomes-v02',
    'beauties-v03',
    'regional-ground-v02',
    'living-trees-v01',
    'water-materials-v01',
  ])
  for (const sector of worldRenderTerrain(view)) {
    if (settlementFloorIndex(sector) !== undefined) sheets.add('settlement-floors-v01')
    if (sector.warpedTheme) sheets.add('void-ground-v01')
    if (impactSite(sector)) sheets.add('impact-basins-v01')
    if (lavaFallSite(sector)) sheets.add('lavafalls-v01')
    if (sector.landmarks.some((l) => l.kind === 'bridge')) sheets.add('grand-bridges-v01')
    if (sector.landmarks.some((l) => l.sceneryIndex === 4)) {
      sheets.add('waterfalls-v01')
      if (sector.cells.some((c) => c.terrain === 'l')) sheets.add('lavafalls-v01')
    }
    for (const prop of [
      ...sceneryDressing(sector),
      ...naturalDressing(sector),
      ...regionalScenery(sector),
      ...settlementComposition(sector),
    ])
      sheets.add(`${prop.sheet}-v01`)
    const hamlet =
      sector.charted &&
      sector.landmarks.some((l) => l.kind === 'hamlet' && hamletFamilyIndex(l.name) !== undefined)
    if (hamlet) sheets.add('hamlet-buildings-v01')
    if (hamlet && sector.regionId === 'frostmere') sheets.add('hamlet-buildings-winter-v01')
    if (sector.regionId === 'frostmere') sheets.add('frostmere-v01')
    if (sector.buildings?.length) sheets.add('regional-settlements-v01')
    if (sector.landmarks.some((l) => l.warpedArt !== undefined && l.warpedArt < 6))
      sheets.add('warped-landmarks-v01')
    if (sector.landmarks.some((l) => l.warpedArt !== undefined && l.warpedArt >= 6))
      sheets.add('warped-refuges-v01')
  }
  await page.evaluate(
    async (names) => {
      await Promise.all(
        names.map(async (name) => {
          const image = new Image()
          image.src = `/media/art/world/runtime/${name}.webp`
          await image.decode()
        }),
      )
    },
    [...sheets],
  )
  const canvas = page.locator('canvas[data-world-stage]'),
    frame = await canvas.getAttribute('data-frame-now')
  await expect(canvas).not.toHaveAttribute('data-frame-now', frame ?? '')
}
