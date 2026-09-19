import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Launcher ${letters}`
}

test('Arsenal build launchers stay centered and typographically matched', async ({
  page,
}, testInfo) => {
  const characterName = uniqueCharacterName()
  const slug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()

  await provisionAccountAndEnterCharacter({
    page,
    email: `profile-launchers-${slug}-${Date.now()}@example.com`,
    password: 'Profile-launchers-2026!',
    characterName,
  })

  await page.goto('/game/arsenal')
  await expect(page.locator('[data-arsenal-workspace]')).toBeVisible()

  const disciplineLauncher = page
    .getByTestId('primary-build-panel')
    .getByRole('button', { name: /Manage Primary Discipline/ })
  const techniquesLauncher = page
    .getByTestId('skill-build-panel')
    .getByRole('button', { name: /Manage Techniques/ })
  const disciplineLabel = disciplineLauncher.getByText('Discipline Management', { exact: true })
  const techniquesLabel = techniquesLauncher.locator('strong')

  await expect(disciplineLauncher).toBeVisible()
  await expect(techniquesLauncher).toBeVisible()
  await expect(page.locator('#arsenal-disciplines-heading')).toHaveText('Disciplines')
  await expect(page.locator('#arsenal-techniques-heading')).toHaveText('Techniques')
  await expect(page.getByText(/\d+ \/ \d+ tagged/)).toHaveCount(0)

  const navigation = page.getByRole('navigation', {
    name: 'Primary game navigation',
    exact: true,
  })
  await expect(navigation.getByRole('link', { name: 'Arsenal', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(navigation.getByRole('link', { name: 'Character', exact: true })).toHaveAttribute(
    'href',
    '/game/character',
  )
  await expect(navigation.getByRole('link', { name: 'Battle Hall', exact: true })).toHaveAttribute(
    'href',
    '/game/battle',
  )
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    'The Arsenal remains within the viewport with long character names',
  ).toBe(true)
  await testInfo.attach(`arsenal-workspace-${testInfo.project.name}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })

  const rekindling = page.getByRole('button', { name: /^Rekindling Cycle / })
  const cycleLabel = await rekindling.locator('small').boundingBox()
  const cycleValue = await rekindling.locator('strong').boundingBox()
  expect(cycleLabel).not.toBeNull()
  expect(cycleValue).not.toBeNull()
  expect(
    Math.abs(cycleLabel!.x + cycleLabel!.width / 2 - cycleValue!.x - cycleValue!.width / 2),
    'The cycle number stays centered beneath its label on desktop and mobile',
  ).toBeLessThanOrEqual(1)
  await rekindling.click()
  const cycleDialog = page.getByRole('dialog', { name: /^Rekindling Cycle / })
  await expect(cycleDialog).toBeVisible()
  await cycleDialog.getByRole('button', { name: 'Close', exact: true }).click()

  const [buttonBox, labelBox] = await Promise.all([
    techniquesLauncher.boundingBox(),
    techniquesLabel.boundingBox(),
  ])
  if (!buttonBox || !labelBox) {
    throw new Error('The Techniques launcher geometry is unavailable.')
  }

  expect(
    Math.abs(buttonBox.x + buttonBox.width / 2 - (labelBox.x + labelBox.width / 2)),
  ).toBeLessThanOrEqual(2)

  const [techniquesFontSize, disciplineFontSize] = await Promise.all([
    techniquesLabel.evaluate((element) => getComputedStyle(element).fontSize),
    disciplineLabel.evaluate((element) => getComputedStyle(element).fontSize),
  ])
  expect(techniquesFontSize).toBe(disciplineFontSize)

  const serverNavigations: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname === '/game/arsenal' && request.headers().rsc === '1') {
      serverNavigations.push(request.url())
    }
  })

  await techniquesLauncher.click()
  const techniquesDialog = page.getByRole('dialog', { name: 'Techniques' })
  await expect(techniquesDialog).toBeVisible()
  await expect(page).toHaveURL(/profilePanel=techniques/)
  await techniquesDialog.getByRole('button', { name: 'Close' }).click()

  await disciplineLauncher.click()
  const disciplineDialog = page.getByRole('dialog', { name: 'Discipline Management' })
  await expect(disciplineDialog).toBeVisible()
  await expect(page).toHaveURL(/profilePanel=disciplines/)
  await page.waitForTimeout(100)

  expect(
    serverNavigations,
    'Arsenal management panels should open without an RSC navigation',
  ).toEqual([])
})
