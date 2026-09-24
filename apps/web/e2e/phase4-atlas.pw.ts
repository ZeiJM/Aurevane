import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

test.use({ trace: 'on' })

test('Mastery authority remains available while Discipline Management uses the compact Nexus layout', async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000)
  const suffix = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(97 + Number(digit)))
    .join('')
  await provisionAccountAndEnterCharacter({
    page,
    email: `atlas-${testInfo.project.name}-${Date.now()}@example.com`,
    password: 'Atlas-disposable-browser-2026!',
    characterName: `Atlas ${suffix}`,
  })

  await page.goto('/game/nexus')
  await expect(page.locator('[data-arsenal-workspace]')).toBeVisible()

  const mastery = await page.evaluate(async () => {
    const response = await fetch('/api/character/mastery')
    return { status: response.status, body: await response.json() }
  })
  expect(mastery.status).toBe(200)
  expect(mastery.body.atlas.totalDisciplines).toBe(36)
  expect(mastery.body.atlas.publishedDisciplines).toBe(17)
  expect(mastery.body.atlas.testingAccess).toBe(true)
  expect(mastery.body.atlas.entries).toHaveLength(36)
  expect(
    mastery.body.atlas.entries.filter(
      (entry: { disciplineId: string | null }) => entry.disciplineId === null,
    ),
  ).toHaveLength(6)

  const launcher = page.getByRole('button', { name: /Manage Disciplines/ })
  await launcher.click()
  const management = page.getByRole('dialog', { name: 'Discipline Management', exact: true })
  await expect(management).toBeVisible()
  await expect(management).toContainText('Currently Committed')
  await expect(management).toContainText('Select New Discipline')
  await expect(management.getByLabel('Primary Discipline')).toBeVisible()
  await expect(management.getByLabel('Secondary Discipline')).toBeVisible()
  expect(
    await management.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  ).toBe(true)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true)

  await testInfo.attach(`discipline-management-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  })

  await management.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(management).toHaveCount(0)
  await expect(launcher).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(management).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(management).toHaveCount(0)
  await expect(launcher).toBeFocused()
})

test('illustrated Manual Atlas is public and fits each supported viewport', async ({
  page,
}, testInfo) => {
  await page.goto('/manual/disciplines-mastery')
  await expect(page.getByRole('heading', { name: 'The Discipline Atlas', level: 1 })).toBeVisible()
  await expect(page.getByText(/17 are currently published for Phase-4 testing/)).toBeVisible()
  await expect(page.getByText('Ordinary sparring grants no Mastery XP.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Mastery Trial guide' })).toHaveAttribute(
    'href',
    '/manual/battle-hall#mastery-trials',
  )
  const cards = page.locator('article[data-family]')
  await expect(cards).toHaveCount(36)
  await expect(
    cards.locator('dd').filter({ hasText: /^Playable in the current test$/ }),
  ).toHaveCount(17)

  for (const name of ['Vanguard', 'Cinderweaver', 'Chronist', 'Spellwright']) {
    const card = cards.filter({ has: page.getByRole('heading', { name, exact: true }) })
    await card.scrollIntoViewIfNeeded()
    expect(await card.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
      true,
    )
  }
  const painted = cards.filter({
    has: page.getByRole('heading', { name: 'Cinderweaver', exact: true }),
  })
  await painted.scrollIntoViewIfNeeded()
  await expect
    .poll(() =>
      painted
        .locator('img')
        .first()
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true)
  await testInfo.attach(`manual-atlas-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
})
