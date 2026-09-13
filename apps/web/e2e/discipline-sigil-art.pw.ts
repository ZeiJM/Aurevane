import { expect, test } from '@playwright/test'

import { getFoundationDisciplineImageAsset } from '../src/media/disciplines'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

const FOUNDATION_DISCIPLINES = [
  'vanguard',
  'farstrider',
  'shadehand',
  'ironfist',
  'aetherist',
  'lifebinder',
] as const

function uniqueCharacterName(): string {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 100_000)}`
    .slice(-8)
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Sigil ${suffix}`
}

test('Foundation Discipline sigils resolve to production artwork on desktop and mobile', async ({
  page,
}, testInfo) => {
  test.skip(
    !['desktop-chromium', 'mobile-chromium'].includes(testInfo.project.name),
    'Profile Discipline artwork is checked at both target viewport classes.',
  )

  const disciplineArt = FOUNDATION_DISCIPLINES.map((id) => {
    const asset = getFoundationDisciplineImageAsset(id)
    if (asset?.status !== 'approved' || !asset.src) {
      throw new Error(`${id} must have approved Discipline artwork.`)
    }
    return { id, src: asset.src }
  })

  await provisionAccountAndEnterCharacter({
    page,
    email: `discipline-sigil-${testInfo.project.name}-${Date.now()}@example.com`,
    password: 'Discipline-sigil-2026!',
    characterName: uniqueCharacterName(),
  })

  // Decode the currently registered assets, including embedded SVGs, rather than checking
  // retired URLs that the Profile no longer uses.
  const loadedArt = await page.evaluate(
    async (artworks) =>
      Promise.all(
        artworks.map(async (artwork) => {
          const image = new Image()
          image.src = artwork.src
          await image.decode()
          return { id: artwork.id, width: image.naturalWidth, height: image.naturalHeight }
        }),
      ),
    disciplineArt,
  )
  for (const artwork of loadedArt) {
    expect(artwork.width, `${artwork.id} artwork should decode`).toBeGreaterThan(0)
    expect(artwork.height, `${artwork.id} artwork should decode`).toBeGreaterThan(0)
  }

  const launcher = page.getByRole('button', {
    name: /Manage Primary Discipline and Secondary Discipline/,
  })
  await expect(launcher).toBeVisible()
  const vanguardImage = launcher.locator('img')
  await expect(vanguardImage).toHaveAttribute('src', disciplineArt[0]!.src)
  await expect(vanguardImage).toBeVisible()
  await expect(vanguardImage).toHaveJSProperty('complete', true)

  const dimensions = await vanguardImage.evaluate((image) => {
    const element = image as HTMLImageElement
    const box = element.getBoundingClientRect()
    return {
      naturalWidth: element.naturalWidth,
      naturalHeight: element.naturalHeight,
      renderedWidth: box.width,
      renderedHeight: box.height,
    }
  })
  expect(dimensions.naturalWidth).toBeGreaterThan(0)
  expect(dimensions.naturalHeight).toBeGreaterThan(0)
  expect(dimensions.renderedWidth).toBeGreaterThanOrEqual(24)
  expect(dimensions.renderedHeight).toBeGreaterThanOrEqual(24)

  await launcher.click()
  const dialog = page.getByRole('dialog', { name: 'Discipline Management' })
  await expect(dialog).toBeVisible()
  const committedSigil = dialog.locator('[aria-label="Committed Disciplines"] img').first()
  await expect(committedSigil).toHaveAttribute('src', disciplineArt[0]!.src)
  await expect(committedSigil).toBeVisible()
})
