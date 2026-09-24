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
  await expect(launcher.locator('img')).toBeVisible()

  await launcher.click()
  const dialog = page.getByRole('dialog', { name: 'Discipline Management' })
  await expect(dialog).toBeVisible()
  const committedSigil = dialog.locator('[aria-label="Currently committed"] img').first()
  const renderedSigilSrc = await committedSigil.getAttribute('src')
  expect(renderedSigilSrc).not.toBeNull()
  expect(decodeURIComponent(renderedSigilSrc!)).toContain(disciplineArt[0]!.src)
  await expect(committedSigil).toBeVisible()
})
