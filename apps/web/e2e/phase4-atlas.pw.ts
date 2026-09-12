import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

test.use({ trace: 'on' })

test('Profile Atlas stays inside Discipline Management and fits each supported viewport', async ({
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

  await page.getByRole('button', { name: /Manage Primary Discipline/ }).click()
  const management = page.getByRole('dialog', { name: 'Discipline Management', exact: true })
  await expect(management).toBeVisible()
  const summary = management.locator('summary').filter({ hasText: 'Discipline Atlas & Mastery' })
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(management).toContainText('36 Disciplines')
  await expect(management).toContainText('Testing access is open.')

  const cards = management.locator('article[data-publication]')
  await expect(cards).toHaveCount(36)
  await expect(
    cards.filter({ has: page.getByText('Veiled Discipline', { exact: true }) }),
  ).toHaveCount(6)
  await expect(management.locator('article[data-publication="published"]')).toHaveCount(17)
  const bastion = cards.filter({ has: page.getByText('Bastion', { exact: true }) })
  await expect(bastion).toContainText('Vanguard Adept')
  await expect(bastion).toContainText('0/1,000 XP')
  const chronist = cards.filter({ has: page.getByText('Chronist', { exact: true }) })
  await expect(chronist).toContainText('Rekindling I')
  await expect(management).toContainText('Ordinary sparring grants no Mastery XP.')
  await expect(management.getByRole('link', { name: 'Mastery Trial guide' })).toHaveAttribute(
    'href',
    '/manual/battle-hall#mastery-trials',
  )
  await expect(management.locator('article[data-publication="planned"] progress')).toHaveCount(0)

  const search = management.getByRole('searchbox', { name: 'Search the Atlas' })
  await search.fill('  CHRONIST  ')
  await expect(cards).toHaveCount(1)
  await expect(chronist.getByRole('meter', { name: 'Reliability', exact: true })).toHaveAttribute(
    'aria-valuemax',
    '5',
  )
  await expect(chronist).toContainText('Planned Mastery Rite:')
  await search.fill('no-matching-tradition')
  await expect(cards).toHaveCount(0)
  await expect(management).toContainText('No traditions match your filters.')
  await search.fill('')
  const publishedOnly = management.getByRole('checkbox', { name: 'Published Disciplines only' })
  await publishedOnly.check()
  await expect(cards).toHaveCount(17)
  await publishedOnly.uncheck()
  await expect(cards).toHaveCount(36)

  for (const card of [bastion, chronist, cards.last()]) {
    await card.scrollIntoViewIfNeeded()
    expect(await card.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
      true,
    )
  }
  expect(
    await management.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  ).toBe(true)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true)
  await summary.scrollIntoViewIfNeeded()
  await testInfo.attach(`profile-atlas-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  await management.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(management).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Manage Primary Discipline/ })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(management).toBeFocused()
  await management.getByLabel('Proposed Secondary').focus()
  await page.keyboard.press('Tab')
  await expect(management.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(management.getByLabel('Proposed Secondary')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(management).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Manage Primary Discipline/ })).toBeFocused()
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
