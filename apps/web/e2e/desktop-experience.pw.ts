import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

const rosterListSelector =
  "[data-character-directory] > section > div:last-child:has(> button):not([role='status'])"

const desktopSizes = [
  { width: 1728, height: 885 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
]

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
  })
}

async function readable(locator: Locator, minimum: number) {
  await expect(locator).toBeVisible()
  expect(
    await locator.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(minimum)
}

async function fit(page: Page, label: string, testInfo: TestInfo) {
  await settle(page)
  const metrics = await page.evaluate((rosterSelector) => {
    const footer = document
      .querySelector('[data-testid="authenticated-shell"] > footer')!
      .getBoundingClientRect()
    const main = document.querySelector('#game-main')!.getBoundingClientRect()
    const controls = [
      ...document.querySelectorAll<HTMLElement>(
        '#game-main button, #game-main input, #game-main select',
      ),
    ]
      // Roster entries intentionally scroll inside their bounded list. Check that list's
      // rectangle here and verify reaching its last entry separately below.
      .filter((element) => element.checkVisibility() && !element.closest(rosterSelector))
      .map((element) => ({
        text: (element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 60),
        rect: element.getBoundingClientRect(),
      }))
    return {
      viewport: [innerWidth, innerHeight],
      scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      footerTop: footer.top,
      mainBottom: main.bottom,
      rosterLists: [...document.querySelectorAll<HTMLElement>(rosterSelector)].map((list) => ({
        top: list.getBoundingClientRect().top,
        bottom: list.getBoundingClientRect().bottom,
        height: list.clientHeight,
        overflowY: getComputedStyle(list).overflowY,
      })),
      clipped: controls.filter(
        ({ rect }) => rect.bottom > footer.top + 1 || rect.left < -1 || rect.right > innerWidth + 1,
      ),
      overflow: getComputedStyle(document.documentElement).overflowY,
    }
  }, rosterListSelector)
  console.log('desktop-experience-fit', label, JSON.stringify(metrics))
  await testInfo.attach(label, { body: await page.screenshot(), contentType: 'image/png' })
  expect
    .soft(metrics.scroll[0], `${label}: horizontal overflow`)
    .toBeLessThanOrEqual(metrics.viewport[0]! + 1)
  expect
    .soft(metrics.scroll[1], `${label}: vertical overflow`)
    .toBeLessThanOrEqual(metrics.viewport[1]! + 1)
  expect
    .soft(metrics.mainBottom, `${label}: content frame behind footer`)
    .toBeLessThanOrEqual(metrics.footerTop + 1)
  expect.soft(metrics.clipped, `${label}: controls cut off by footer/viewport`).toEqual([])
  for (const list of metrics.rosterLists) {
    expect.soft(list.top, `${label}: list top`).toBeGreaterThanOrEqual(0)
    expect
      .soft(list.bottom, `${label}: list overlaps footer`)
      .toBeLessThanOrEqual(metrics.footerTop)
    expect.soft(list.height, `${label}: usable list area`).toBeGreaterThanOrEqual(120)
    expect.soft(list.overflowY, `${label}: list must remain scrollable`).toBe('auto')
  }
  expect
    .soft(metrics.overflow, `${label}: do not hide the scrollbar to pass this test`)
    .not.toBe('hidden')
}

async function reachable(page: Page, control: Locator) {
  await control.scrollIntoViewIfNeeded()
  const box = await control.boundingBox()
  const footer = await page.locator('[data-testid="authenticated-shell"] > footer').boundingBox()
  if (!box || !footer) throw new Error('Expected control/footer geometry')
  // Real user scrolling must be able to uncover the control, not merely move a clipped container.
  if (box.y + box.height > footer.y) await page.mouse.wheel(0, box.y + box.height - footer.y + 32)
  await expect
    .poll(async () => {
      const rect = await control.boundingBox()
      const rail = await page.locator('[data-testid="authenticated-shell"] > footer').boundingBox()
      return Boolean(rect && rail && rect.y >= 0 && rect.y + rect.height <= rail.y + 1)
    })
    .toBe(true)
  await control.click({ trial: true })
}

test('desktop Profile and every Battle Hall tab fit without sacrificing readable controls', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop document layouts only')
  test.setTimeout(180_000)
  await provisionAccountAndEnterCharacter({
    page,
    email: `desktop-fit.${Date.now()}@example.com`,
    password: 'AurevaneTest!42',
    characterName: 'Experience Vanguard',
  })

  for (const size of desktopSizes) {
    await page.setViewportSize(size)
    const suffix = `${size.width}x${size.height}`
    await page.goto('/game/character')
    await expect(page.getByTestId('character-profile')).toBeVisible()
    await readable(page.getByTestId('derived-stat-movement').locator('span').first(), 13)
    await fit(page, `Profile-${suffix}`, testInfo)
    const reset = page.getByRole('button', { name: 'Reset / Redistribute Attributes' })
    await readable(reset, 11.5)
    await reset.click({ trial: true })

    await page.goto('/game/battle')
    await expect(page.locator('#battle-launch')).toBeVisible()
    const tabs = page.getByRole('navigation', { name: 'Battle Hall sections' })
    await fit(page, `AI-empty-${suffix}`, testInfo)
    for (const mode of ['recruit-sparring', 'guided-fundamentals']) {
      await page.getByLabel('Battle mode').selectOption(mode)
      await readable(page.getByLabel('Battle mode'), 13)
      await fit(page, `AI-${mode}-${suffix}`, testInfo)
    }
    await tabs.getByRole('button', { name: /Player vs Player/ }).click()
    for (const mode of ['1v1', '2v2', '3v3', '1v1v1', 'flex-teams']) {
      await page.getByLabel('Battle format').selectOption(mode)
      await readable(page.locator('[data-pvp-setting-options] button').first(), 12)
      await fit(page, `PvP-${mode}-${suffix}`, testInfo)
    }
    await tabs.getByRole('button', { name: /Spectate/ }).click()
    await readable(page.getByPlaceholder('AVB-0000-0000'), 13)
    await fit(page, `Spectate-${suffix}`, testInfo)
  }

  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/game/character')
  await page.getByRole('button', { name: 'Reset / Redistribute Attributes' }).click()
  const allocation = page.getByRole('dialog', { name: 'Redistribute Attributes' })
  await expect(allocation).toBeVisible()
  await allocation.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(allocation).toBeHidden()

  await page.getByTestId('primary-build-panel').getByRole('button').click()
  const disciplines = page.getByRole('dialog', { name: 'Discipline Management', exact: true })
  await expect(disciplines).toBeVisible()
  await readable(disciplines.locator('select').first(), 14)
  await disciplines.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByTestId('skill-build-panel').getByRole('button').click()
  const techniques = page.getByRole('dialog', { name: 'Techniques', exact: true })
  await expect(techniques).toBeVisible()
  await readable(techniques.getByTestId('learned-skill-list').locator('small').first(), 12)
  await techniques.getByRole('button', { name: 'Close', exact: true }).click()

  // Very short windows may scroll, but cannot trap the Profile controls underneath the footer.
  await page.setViewportSize({ width: 1024, height: 576 })
  await reachable(page, page.getByRole('button', { name: 'Reset / Redistribute Attributes' }))
  await page.goto('/game/battle')
  await page
    .getByRole('navigation', { name: 'Battle Hall sections' })
    .getByRole('button', { name: /Player vs Player/ })
    .click()
  await page.getByLabel('Battle format').selectOption('flex-teams')
  await reachable(page, page.getByRole('button', { name: 'Create Battle Lobby' }))
})

test('desktop account, training, controls and public reading surfaces remain usable', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop shared typography and frame')
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1366, height: 768 })
  await provisionAccountAndEnterCharacter({
    page,
    email: `desktop-pages.${Date.now()}@example.com`,
    password: 'AurevaneTest!42',
    characterName: 'Experience Wayfarer',
  })
  for (const [name, path] of [
    ['Training', '/game/training'],
    ['Controls', '/game/settings/controls'],
    ['Titles', '/game/account/titles'],
    ['Online', '/game/online'],
  ]) {
    await page.goto(path!)
    await expect(page.locator('#game-main')).toBeVisible()
    await fit(page, name!, testInfo)
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/game/settings/controls')
  await fit(page, 'Controls-1440x900', testInfo)
  await page.setViewportSize({ width: 1366, height: 768 })
  await readable(page.locator('kbd').first(), 12)
  await page.goto('/game/account/titles')
  await page.getByPlaceholder('e.g. Dawn Warden').fill('Dawn Keeper')
  await page.getByRole('button', { name: 'Review Title' }).click()
  await expect(page.getByRole('button', { name: 'Confirm Final Title' })).toBeDisabled()
  await reachable(page, page.getByRole('button', { name: 'Edit', exact: true }))
  await page.getByRole('button', { name: 'Edit', exact: true }).click()

  for (const path of ['/game', '/game/create/1', '/news', '/manual', '/rules']) {
    await page.goto(path)
    await expect(page.locator('main')).toBeVisible()
    await settle(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    expect(overflow, path).toBeLessThanOrEqual(1)
    await testInfo.attach(path.replaceAll('/', '-') || 'account', {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
  }
})

test('supplementary presence never blocks navigation and pending navigation is announced', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Shared navigation regression')
  test.setTimeout(60_000)
  await provisionAccountAndEnterCharacter({
    page,
    email: `navigation.${Date.now()}@example.com`,
    password: 'AurevaneTest!42',
    characterName: 'Experience Navigator',
  })
  let releasePresence!: () => void
  let releaseNavigation!: () => void
  const presenceGate = new Promise<void>((resolve) => {
    releasePresence = resolve
  })
  const navigationGate = new Promise<void>((resolve) => {
    releaseNavigation = resolve
  })
  await page.route('**/api/presence', async (route) => {
    await presenceGate
    await route.fulfill({ json: { count: 7 } }).catch(() => undefined)
  })
  try {
    await page.goto('/game/character')
    await expect(page.getByTestId('character-profile')).toBeVisible()
    await expect(page.getByLabel('Loading online count')).toHaveText('—')
    await page.evaluate(() => {
      ;(window as Window & { navigationProbe?: string }).navigationProbe = 'preserved'
    })
    await page.route('**/game/battle?*', async (route) => {
      if (route.request().headers()['rsc'] === '1') await navigationGate
      await route.continue()
    })
    await page.getByRole('button', { name: /Navigation/ }).click()
    await page.getByRole('link', { name: /Battle Hall/ }).click()
    await expect(page.getByRole('button', { name: /Opening/ })).toHaveAttribute('aria-busy', 'true')
    releaseNavigation()
    await expect(page).toHaveURL(/\/game\/battle$/)
    await expect(page.locator('#battle-launch')).toBeVisible()
    expect(
      await page.evaluate(() => (window as Window & { navigationProbe?: string }).navigationProbe),
    ).toBe('preserved')
    releasePresence()
    await expect(page.getByRole('link', { name: /Online Users/ })).toContainText('7')
  } finally {
    releaseNavigation()
    releasePresence()
  }
})

test('a large desktop character directory stays inside the page and every entry is reachable', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop list containment')
  test.setTimeout(90_000)
  await provisionAccountAndEnterCharacter({
    page,
    email: `directory-fit.${Date.now()}@example.com`,
    password: 'AurevaneTest!42',
    characterName: 'Directory Navigator',
  })
  // Only the public cosmetic directory response is stubbed. Auth and page rendering remain real.
  const characters = Array.from({ length: 60 }, (_, index) => ({
    characterId: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    name: `Adventurer ${String(index + 1).padStart(2, '0')}`,
    level: 10,
    lastSeenAt: new Date().toISOString(),
    portraitRef: null,
    disciplineId: index % 2 === 0 ? 'vanguard' : 'lifebinder',
    personalTitle: null,
    imageUrl: null,
    isOnline: index % 2 === 0,
  }))
  await page.route('**/api/presence/directory', (route) => route.fulfill({ json: { characters } }))
  for (const size of [
    { width: 1366, height: 768 },
    { width: 1024, height: 576 },
  ]) {
    await page.setViewportSize(size)
    await page.goto('/game/online')
    await page.getByRole('button', { name: 'Show all characters' }).click()
    const list = page.locator(rosterListSelector)
    await expect(list.getByRole('button')).toHaveCount(60)
    await fit(page, `Directory-60-${size.width}x${size.height}`, testInfo)
    await readable(page.getByRole('button', { name: 'Show online only' }), 12)
    await expect
      .poll(() => list.evaluate((el) => el.scrollHeight - el.clientHeight))
      .toBeGreaterThan(0)
    const last = list.getByRole('button').last()
    await list.hover()
    await page.mouse.wheel(0, 100_000)
    await expect(last).toBeInViewport({ ratio: 1 })
    const scroll = await page.evaluate(() => window.scrollY)
    expect(scroll).toBe(0)
    await last.click()
    const dialog = page.getByRole('dialog', { name: 'Adventurer 60', exact: true })
    await expect(dialog).toBeVisible()
    await page.getByRole('button', { name: 'Close public character profile' }).click()
    await expect(dialog).toBeHidden()
    // Focusing a card must also reveal it to keyboard users in the internal scroller.
    await list.getByRole('button').first().focus()
    await expect(list.getByRole('button').first()).toBeInViewport({ ratio: 1 })
    await page.getByRole('combobox').first().selectOption('vanguard')
    await expect(list.getByRole('button')).toHaveCount(30)
    await fit(page, `Directory-filtered-${size.width}x${size.height}`, testInfo)
  }
})
