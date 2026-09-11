import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

const rosterListSelector =
  "[data-character-directory] > section > div:last-child:has(> button):not([role='status'])"

const desktopSizes = [
  { width: 1920, height: 1080 },
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
    await expect(tabs.getByRole('button', { pressed: true })).toHaveCount(1)
    expect(await tabs.innerText()).not.toMatch(/\b0[123]\b|[›>]/)
    for (const button of await tabs.getByRole('button').all()) {
      expect(await button.evaluate((element) => getComputedStyle(element).textAlign)).toBe('center')
    }
    if (size.width >= 1440) {
      const panel = await page.locator('#battle-launch').boundingBox()
      expect(panel!.width).toBeLessThanOrEqual(1248)
      expect(
        panel!.height,
        'An empty selection must not stretch into a blank full-height card',
      ).toBeLessThan(460)
    }
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
  await testInfo.attach('Attributes-dialog', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  await allocation.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(allocation).toBeHidden()

  await page.getByTestId('primary-build-panel').getByRole('button').click()
  const disciplines = page.getByRole('dialog', { name: 'Discipline Management', exact: true })
  await expect(disciplines).toBeVisible()
  await readable(disciplines.locator('select').first(), 14)
  await testInfo.attach('Disciplines-dialog', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  await disciplines.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByTestId('skill-build-panel').getByRole('button').click()
  const techniques = page.getByRole('dialog', { name: 'Techniques', exact: true })
  await expect(techniques).toBeVisible()
  await readable(techniques.getByTestId('learned-skill-list').locator('small').first(), 12)
  await testInfo.attach('Techniques-dialog', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  await page.setViewportSize({ width: 1280, height: 576 })
  const rail = techniques.locator('[class*="buildRail"]')
  await rail.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  const railBox = await rail.boundingBox()
  const lastRailCard = await rail.locator(':scope > *').last().boundingBox()
  expect(lastRailCard!.y + lastRailCard!.height).toBeLessThanOrEqual(
    railBox!.y + railBox!.height + 1,
  )
  await testInfo.attach('Techniques-short-window', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
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

test('mobile build dialogs keep readable copy and reachable actions', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Phone portal presentation')
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 393, height: 740 })
  await provisionAccountAndEnterCharacter({
    page,
    email: `mobile-dialogs.${Date.now()}@example.com`,
    password: 'AurevaneTest!42',
    characterName: 'Dialog Wayfarer',
  })
  for (const [panel, name] of [
    ['primary-build-panel', 'Discipline Management'],
    ['skill-build-panel', 'Techniques'],
  ]) {
    await page.getByTestId(panel!).getByRole('button').click()
    const dialog = page.getByRole('dialog', { name: name!, exact: true })
    await expect(dialog).toBeVisible()
    if (name === 'Techniques') {
      await readable(dialog.locator('p').first(), 14)
      await dialog
        .getByRole('button', { name: 'Commit Selected Techniques' })
        .scrollIntoViewIfNeeded()
      await testInfo.attach('mobile-techniques-actions', {
        body: await page.screenshot(),
        contentType: 'image/png',
      })
    }
    const close = dialog.getByRole('button', { name: 'Close', exact: true })
    await close.scrollIntoViewIfNeeded()
    await close.click({ trial: true })
    expect(
      await dialog.evaluate((element) => element.scrollWidth - element.clientWidth),
    ).toBeLessThanOrEqual(1)
    await testInfo.attach(`mobile-${panel}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
    await close.click()
    await expect(dialog).toBeHidden()
  }
})

test('phone pages and pure/mixed skill controls have balanced readable layouts', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Phone presentation review')
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 393, height: 740 })
  await page.goto('/')
  await expect(page.getByTestId('account-shell')).toBeVisible()
  await testInfo.attach('phone-account', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  await provisionAccountAndEnterCharacter({
    page,
    email: `phone-polish.${Date.now()}@example.com`,
    password: 'AurevaneTest!42',
    characterName: 'Polished Wayfarer',
  })

  for (const width of [360, 430]) {
    await page.setViewportSize({ width, height: 800 })
    for (const path of [
      '/game/character',
      '/game/battle',
      '/game/training',
      '/game/account/titles',
      '/game/settings/controls',
      '/game/online',
      '/game',
      '/game/create/1',
      '/news',
      '/manual',
      '/manual/battle-hall',
      '/rules',
    ]) {
      await page.goto(path)
      await expect(page.locator('main')).toBeVisible()
      await settle(page)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        path,
      ).toBeLessThanOrEqual(1)
      const copy = page.locator('main p:visible').first()
      if (await copy.count()) await readable(copy, 14)
      await testInfo.attach(`phone-${width}${path.replaceAll('/', '-')}`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      })
    }
  }

  await page.goto('/game/battle')
  await page
    .getByRole('navigation', { name: 'Battle Hall sections' })
    .getByRole('button', { name: /Player vs Player/ })
    .click()
  await page.getByLabel('Battle format').selectOption('3v3')
  await testInfo.attach('phone-pvp-settings', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  await page.getByRole('button', { name: 'Create Battle Lobby' }).click()
  const lobby = page.locator('[role="dialog"][aria-labelledby="pvp-lobby-title"]')
  await expect(lobby).toBeVisible()
  await testInfo.attach('phone-pvp-lobby', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  await lobby.getByRole('button', { name: 'Close Lobby', exact: true }).click()
  await expect(lobby).toBeHidden()
  await page.goto('/game/character')
  for (const [trigger, name] of [
    [page.getByTestId('derived-stat-maxHp'), 'phone-stat-details'],
    [page.getByRole('button', { name: 'Reset / Redistribute Attributes' }), 'phone-attributes'],
  ] as const) {
    await trigger.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' })
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  }
  await page.getByRole('button', { name: 'Account', exact: true }).click()
  await testInfo.attach('phone-account-menu', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  await page.getByRole('button', { name: 'Sound settings' }).click()
  const audio = page.getByRole('dialog', { name: 'Audio settings' })
  await expect(audio).toBeVisible()
  await testInfo.attach('phone-audio', { body: await page.screenshot(), contentType: 'image/png' })
  await audio.getByRole('button', { name: 'Close audio settings' }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Navigation', exact: true }).click()
  await testInfo.attach('phone-navigation', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  await page.keyboard.press('Escape')
  for (const mixed of [false, true]) {
    if (mixed) {
      const characterId = (await page.context().cookies()).find(
        (cookie) => cookie.name === 'aurevane_selected_character',
      )!.value
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      )
      const { error } = await admin.rpc('record_character_discipline_mastery_v1', {
        p_character_id: characterId,
        p_discipline_id: 'lifebinder',
        p_source_kind: 'system',
        p_source_id: 'browser-proof.mobile-polish',
      })
      if (error) throw error
      await page.reload()
      await page.getByTestId('primary-build-panel').getByRole('button').click()
      const discipline = page.getByRole('dialog', { name: 'Discipline Management' })
      await discipline.getByLabel('Proposed Secondary').selectOption('lifebinder')
      await discipline.getByRole('button', { name: 'Commit Discipline changes' }).click()
      await expect(page.getByRole('status')).toContainText(
        'Lifebinder is now the committed Secondary Discipline.',
      )
      await testInfo.attach('phone-discipline-preview', {
        body: await page.screenshot(),
        contentType: 'image/png',
      })
      await discipline.getByRole('button', { name: 'Close', exact: true }).click()
    }
    for (const width of [360, 393, 1366]) {
      await page.setViewportSize({ width, height: 800 })
      const hero = page.getByTestId('character-profile')
      if (width < 760) {
        const portrait = await hero.locator(':scope > div:first-child').boundingBox()
        const identity = await hero.locator(':scope > div:last-child').boundingBox()
        expect(
          Math.abs(portrait!.y + portrait!.height / 2 - identity!.y - identity!.height / 2),
        ).toBeLessThanOrEqual(1)
        await testInfo.attach(`phone-hero-${width}-${mixed}`, {
          body: await page.screenshot(),
          contentType: 'image/png',
        })
      }
      await page.getByTestId('skill-build-panel').getByRole('button').click()
      const dialog = page.getByRole('dialog', { name: 'Techniques', exact: true })
      await expect(dialog).toBeVisible()
      await settle(page)
      const findings = await dialog.evaluate((element) => {
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')!
        function luminance(color: string) {
          context.clearRect(0, 0, 1, 1)
          context.fillStyle = color
          context.fillRect(0, 0, 1, 1)
          const values = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map((c) => {
            const v = c / 255
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
          })
          return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722
        }
        const text = [
          ...element.querySelectorAll<HTMLElement>(
            '[data-testid="skill-capacity"] span, [data-testid="skill-capacity"] strong, small, p',
          ),
        ].filter((e) => e.checkVisibility())
        return text.map((e) => ({
          text: e.textContent,
          size: parseFloat(getComputedStyle(e).fontSize),
          contrast: (luminance(getComputedStyle(e).color) + 0.05) / (luminance('#242d39') + 0.05),
        }))
      })
      for (const item of findings) {
        expect(
          item.contrast,
          `${item.text}: contrast against the light panel tone`,
        ).toBeGreaterThanOrEqual(4.5)
        expect(item.size, `${item.text}: minimum label size`).toBeGreaterThanOrEqual(11)
      }
      for (const card of await dialog.getByTestId('learned-skill-list').locator('article').all()) {
        const title = await card.locator('label strong').boundingBox()
        const star = card.locator('[data-favorite-technique-star]')
        if (await star.count()) {
          const starBox = await star.boundingBox()
          // Padding reserves the favourite control's column for wrapped names.
          const textRight = await card.locator('label strong').evaluate((e) => {
            const r = document.createRange()
            r.selectNodeContents(e)
            return Math.max(...[...r.getClientRects()].map((rect) => rect.right))
          })
          expect(textRight, 'Technique name must not collide with favourite').toBeLessThanOrEqual(
            starBox!.x,
          )
          if (width < 760) expect(starBox!.width).toBeGreaterThanOrEqual(44)
        }
        expect(title!.x).toBeGreaterThanOrEqual(0)
      }
      await testInfo.attach(`skills-${width}-${mixed ? 'mixed' : 'pure'}`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      })
      await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    }
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
  // Use one timestamp so a millisecond boundary cannot change the last-seen sort order.
  const directoryTimestamp = new Date().toISOString()
  const characters = Array.from({ length: 60 }, (_, index) => ({
    characterId: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    name: `Adventurer ${String(index + 1).padStart(2, '0')}`,
    level: 10,
    lastSeenAt: directoryTimestamp,
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
    await expect(last.locator('strong')).toHaveText('Adventurer 60')
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
