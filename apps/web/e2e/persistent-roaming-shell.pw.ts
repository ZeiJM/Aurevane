import { Buffer } from 'node:buffer'

import { expect, test, type Page, type TestInfo } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueLetters(info: TestInfo): string {
  return `${Date.now()}${info.workerIndex}`
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
    .slice(-10)
}

function desktopOnly(info: TestInfo): void {
  test.skip(
    info.project.name !== 'desktop-chromium',
    'Persistent layout identity is viewport-independent; responsive parity stays in layout suites.',
  )
}

async function rememberRoamingShell(page: Page, key: string): Promise<void> {
  await page.evaluate((memoryKey) => {
    const shell = document.querySelector('[data-testid="authenticated-shell"]')
    if (!shell) throw new Error('Authenticated shell is missing.')
    ;(window as unknown as Record<string, unknown>)[memoryKey] = shell
  }, key)
}

async function isRememberedShellCurrent(page: Page, key: string): Promise<boolean> {
  return page.evaluate(
    (memoryKey) =>
      (window as unknown as Record<string, unknown>)[memoryKey] ===
      document.querySelector('[data-testid="authenticated-shell"]'),
    key,
  )
}

test('normal roaming navigation preserves the authenticated shell DOM instance', async ({
  page,
}, info) => {
  desktopOnly(info)
  test.setTimeout(180_000)
  const suffix = uniqueLetters(info)
  const characterName = `Roamer ${suffix}`

  await provisionAccountAndEnterCharacter({
    page,
    email: `persistent-roaming-${info.workerIndex}-${Date.now()}@example.test`,
    password: 'Persistent-roaming-2026!',
    characterName,
  })

  await rememberRoamingShell(page, '__aurevaneRoamingShell')

  const rail = page.getByRole('navigation', { name: 'Primary game navigation', exact: true })

  await rail.getByRole('link', { name: 'Arsenal', exact: true }).click()
  await expect(page).toHaveURL(/\/game\/arsenal$/)
  expect(await isRememberedShellCurrent(page, '__aurevaneRoamingShell')).toBe(true)
  await expect(rail.getByRole('link', { name: 'Arsenal', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )

  await rail.getByRole('link', { name: /Passive Training/ }).click()
  await expect(page).toHaveURL(/\/game\/training$/)
  expect(await isRememberedShellCurrent(page, '__aurevaneRoamingShell')).toBe(true)

  await page.getByRole('button', { name: 'Account', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Controls & Keybinds' }).click()
  await expect(page).toHaveURL(/\/game\/settings\/controls$/)
  expect(await isRememberedShellCurrent(page, '__aurevaneRoamingShell')).toBe(true)

  await page.getByRole('button', { name: 'Account', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Titles & Profile Display' }).click()
  await expect(page).toHaveURL(/\/game\/account\/titles$/)
  expect(await isRememberedShellCurrent(page, '__aurevaneRoamingShell')).toBe(true)

  await page.getByRole('link', { name: /Online Users/ }).click()
  await expect(page).toHaveURL(/\/game\/online$/)
  expect(await isRememberedShellCurrent(page, '__aurevaneRoamingShell')).toBe(true)
})

test('switching characters crosses the persistent-shell boundary', async ({ page }, info) => {
  desktopOnly(info)
  test.setTimeout(180_000)
  const characterName = `Switch ${uniqueLetters(info)}`

  await provisionAccountAndEnterCharacter({
    page,
    email: `persistent-switch-${info.workerIndex}-${Date.now()}@example.test`,
    password: 'Persistent-switch-2026!',
    characterName,
  })

  await rememberRoamingShell(page, '__beforeCharacterSwitch')

  await page.getByRole('button', { name: 'Account', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Switch Character' }).click()
  await expect(page).toHaveURL(/\/game$/)
  await expect(page.getByTestId('authenticated-shell')).toHaveCount(0)

  await page.getByRole('link', { name: `Play ${characterName}`, exact: true }).click()
  await expect(page).toHaveURL(/\/game\/character$/)
  await expect(page.getByTestId('authenticated-shell')).toBeVisible()
  expect(await isRememberedShellCurrent(page, '__beforeCharacterSwitch')).toBe(false)
})

test('battle transitions leave roaming persistence and return with fresh shell state', async ({
  page,
}, info) => {
  desktopOnly(info)
  test.setTimeout(180_000)

  await provisionAccountAndEnterCharacter({
    page,
    email: `persistent-battle-${info.workerIndex}-${Date.now()}@example.test`,
    password: 'Persistent-battle-2026!',
    characterName: `Battler ${uniqueLetters(info)}`,
  })

  await rememberRoamingShell(page, '__beforeBattle')

  await page
    .getByRole('navigation', { name: 'Primary game navigation', exact: true })
    .getByRole('link', { name: /Battle Hall/ })
    .click()
  await expect(page).toHaveURL(/\/game\/battle$/)
  expect(await isRememberedShellCurrent(page, '__beforeBattle')).toBe(false)

  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
  await expect(page.getByTestId('authenticated-shell')).toHaveCount(0)

  await page.getByRole('button', { name: 'Surrender', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Surrender this battle?' })).toBeVisible()
  await page.getByRole('button', { name: 'Confirm Surrender' }).click()
  await expect(page.getByTestId('battle-result-overlay')).toBeVisible()
  await page.getByRole('button', { name: 'Return to Battle Hall' }).click()
  await expect(page).toHaveURL(/\/game\/battle$/)

  await page
    .getByRole('navigation', { name: 'Primary game navigation', exact: true })
    .getByRole('link', { name: 'Character', exact: true })
    .click()
  await expect(page).toHaveURL(/\/game\/character$/)
  expect(await isRememberedShellCurrent(page, '__beforeBattle')).toBe(false)
})

test('profile display refresh updates the persistent shell without remounting it', async ({
  page,
}, info) => {
  desktopOnly(info)
  test.setTimeout(180_000)
  const portraitUrl = 'https://assets.example.test/aurevane-test-portrait.png'
  const onePixelPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7e2cAAAAASUVORK5CYII=',
    'base64',
  )

  await page.route(portraitUrl, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng }),
  )

  await provisionAccountAndEnterCharacter({
    page,
    email: `persistent-profile-${info.workerIndex}-${Date.now()}@example.test`,
    password: 'Persistent-profile-2026!',
    characterName: `Portrait ${uniqueLetters(info)}`,
  })

  await rememberRoamingShell(page, '__beforeProfileRefresh')

  await page.getByRole('button', { name: 'Account', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Titles & Profile Display' }).click()
  await expect(page).toHaveURL(/\/game\/account\/titles$/)

  await page.getByLabel('Direct image URL').fill(portraitUrl)
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/account/profile-display') &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Save Profile Image' }).click()
  expect((await saved).status()).toBe(200)
  await expect(page.getByText('Profile image saved.', { exact: true })).toBeVisible()

  expect(await isRememberedShellCurrent(page, '__beforeProfileRefresh')).toBe(true)
  await expect(
    page
      .getByTestId('authenticated-shell')
      .locator('header .character-portrait-media')
      .first(),
  ).toHaveAttribute('src', portraitUrl)
})
