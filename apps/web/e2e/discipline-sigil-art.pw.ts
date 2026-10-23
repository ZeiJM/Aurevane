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
    'Nexus Discipline artwork is checked at both target viewport classes.',
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

  await page.goto('/game/nexus')
  await expect(page.locator('[data-arsenal-workspace]')).toBeVisible()

  const launcher = page.getByRole('button', {
    name: /Manage Disciplines/,
  })
  await expect(launcher).toBeVisible()
  await expect(launcher).toHaveText(/Manage Disciplines/)

  await launcher.click()
  const dialog = page.getByRole('dialog', { name: 'Discipline Management' })
  await expect(dialog).toBeVisible()
  const libraryArt = dialog.locator(
    '[aria-label^="Select "][aria-label$=" as Primary Discipline"] img',
  )
  await expect(libraryArt).not.toHaveCount(0)
  const compactArtSize = await page.evaluate(() =>
    matchMedia(
      '(max-width: 760px), (max-width: 980px) and (max-height: 480px) and (pointer: coarse)',
    ).matches
      ? 2.6 * parseFloat(getComputedStyle(document.documentElement).fontSize)
      : null,
  )
  await libraryArt.evaluateAll(async (images) => {
    await Promise.all(images.map((image) => (image as HTMLImageElement).decode()))
  })
  const sizes = await libraryArt.evaluateAll((images) =>
    images.map((image) => {
      const rect = image.getBoundingClientRect()
      const button = image.closest('button')!.getBoundingClientRect()
      return {
        width: rect.width,
        height: rect.height,
        complete: (image as HTMLImageElement).complete,
        naturalWidth: (image as HTMLImageElement).naturalWidth,
        naturalHeight: (image as HTMLImageElement).naturalHeight,
        contained:
          rect.left >= button.left &&
          rect.right <= button.right &&
          rect.top >= button.top &&
          rect.bottom <= button.bottom,
      }
    }),
  )
  expect(
    Math.max(...sizes.map((image) => image.width)) - Math.min(...sizes.map((image) => image.width)),
  ).toBeLessThanOrEqual(1)
  for (const image of sizes) {
    if (compactArtSize !== null) {
      expect(
        Math.abs(image.width - compactArtSize),
        'mobile chooser keeps its compact sigil size',
      ).toBeLessThanOrEqual(1)
    } else expect(image.width).toBeGreaterThanOrEqual(72)
    expect(image.complete).toBe(true)
    expect(image.naturalWidth).toBeGreaterThan(0)
    expect(image.naturalHeight).toBeGreaterThan(0)
    expect(image.contained, 'complete sigil remains inside its choice').toBe(true)
    expect(Math.abs(image.width - image.height)).toBeLessThanOrEqual(1)
  }
  const committedSigil = dialog.locator('[aria-label="Currently committed"] img').first()
  const renderedSigilSrc = await committedSigil.getAttribute('src')
  expect(renderedSigilSrc).not.toBeNull()
  expect(decodeURIComponent(renderedSigilSrc!)).toContain(disciplineArt[0]!.src)
  await expect(committedSigil).toBeVisible()
})
