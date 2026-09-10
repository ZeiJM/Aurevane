import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

const DISCIPLINE_ART = [
  'disc_vanguard_icon_v01.svg',
  'disc_farstrider_icon_v01.svg',
  'disc_shadehand_icon_v01.svg',
  'disc_ironfist_icon_v01.svg',
  'disc_aetherist_icon_v01.svg',
  'disc_lifebinder_icon_v01.svg',
] as const

function uniqueCharacterName(project: string): string {
  const seed = `${Date.now()}${Math.floor(Math.random() * 100_000)}`
  return `Sigil ${project.replace(/[^a-z]/gi, '').slice(0, 6)} ${seed.slice(-6)}`
}

test('Foundation Discipline sigils resolve to production artwork on desktop and mobile', async ({
  page,
  request,
}, testInfo) => {
  test.skip(
    !['desktop-chromium', 'mobile-chromium'].includes(testInfo.project.name),
    'Profile Discipline artwork is checked at both target viewport classes.',
  )

  for (const filename of DISCIPLINE_ART) {
    const response = await request.get(`/media/art/disciplines/${filename}`)
    expect(response.ok(), `${filename} should be served`).toBe(true)
    expect(response.headers()['content-type']).toContain('image/svg+xml')
    expect((await response.text()).length).toBeGreaterThan(500)
  }

  await provisionAccountAndEnterCharacter({
    page,
    email: `discipline-sigil-${testInfo.project.name}-${Date.now()}@example.com`,
    password: 'Discipline-sigil-2026!',
    characterName: uniqueCharacterName(testInfo.project.name),
  })

  const launcher = page.getByRole('button', { name: /Manage Primary Discipline and Secondary Discipline/ })
  await expect(launcher).toBeVisible()
  const vanguardImage = launcher.locator('img[src*="disc_vanguard_icon_v01.svg"]')
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
  await expect(dialog.locator('img[src*="disc_vanguard_icon_v01.svg"]').first()).toBeVisible()
  await expect(dialog.locator('svg').filter({ has: page.locator('path') })).toHaveCount(0)
})
