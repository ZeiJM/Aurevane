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
    'Shell persistence is viewport-independent; responsive parity is covered separately.',
  )
}

async function rememberShell(page: Page, key: string): Promise<void> {
  await page.evaluate((memoryKey) => {
    const shell = document.querySelector('[data-testid="authenticated-shell"]')
    if (!shell) throw new Error('Authenticated shell is missing.')
    ;(window as unknown as Record<string, unknown>)[memoryKey] = shell
  }, key)
}

async function rememberedShellIsCurrent(page: Page, key: string): Promise<boolean> {
  return page.evaluate(
    (memoryKey) =>
      (window as unknown as Record<string, unknown>)[memoryKey] ===
      document.querySelector('[data-testid="authenticated-shell"]'),
    key,
  )
}

test('roaming pages preserve one authenticated shell while Battle Hall refreshes it', async ({
  page,
}, info) => {
  desktopOnly(info)
  test.setTimeout(180_000)
  const now = Date.now()

  await provisionAccountAndEnterCharacter({
    page,
    email: `persistent-roaming-v2-${info.workerIndex}-${now}@example.test`,
    password: 'Persistent-roaming-v2-2026!',
    characterName: `Roamer ${uniqueLetters(info)}`,
  })

  await rememberShell(page, '__roamingShell')
  const rail = page.getByRole('navigation', { name: 'Primary game navigation', exact: true })

  await rail.getByRole('link', { name: 'Arsenal', exact: true }).click()
  await expect(page).toHaveURL(/\/game\/arsenal$/)
  expect(await rememberedShellIsCurrent(page, '__roamingShell')).toBe(true)

  await rail.getByRole('link', { name: /Passive Training/ }).click()
  await expect(page).toHaveURL(/\/game\/training$/)
  expect(await rememberedShellIsCurrent(page, '__roamingShell')).toBe(true)

  await rail.getByRole('link', { name: /Battle Hall/ }).click()
  await expect(page).toHaveURL(/\/game\/battle$/)
  expect(await rememberedShellIsCurrent(page, '__roamingShell')).toBe(false)

  await page
    .getByRole('navigation', { name: 'Primary game navigation', exact: true })
    .getByRole('link', { name: 'Character', exact: true })
    .click()
  await expect(page).toHaveURL(/\/game\/character$/)
  expect(await rememberedShellIsCurrent(page, '__roamingShell')).toBe(false)
})

test('switching character selection refreshes the roaming shell', async ({ page }, info) => {
  desktopOnly(info)
  test.setTimeout(180_000)
  const now = Date.now()
  const characterName = `Switcher ${uniqueLetters(info)}`

  await provisionAccountAndEnterCharacter({
    page,
    email: `persistent-switch-v2-${info.workerIndex}-${now}@example.test`,
    password: 'Persistent-switch-v2-2026!',
    characterName,
  })

  await rememberShell(page, '__beforeSwitch')
  await page.getByRole('button', { name: 'Account', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Switch Character' }).click()
  await expect(page).toHaveURL(/\/game$/)

  await page.getByRole('link', { name: `Play ${characterName}`, exact: true }).click()
  await expect(page).toHaveURL(/\/game\/character$/)
  expect(await rememberedShellIsCurrent(page, '__beforeSwitch')).toBe(false)
})
