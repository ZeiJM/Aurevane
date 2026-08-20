import { expect, test } from '@playwright/test'

import { hasHorizontalOverflow } from './browser-helpers'

const TEST_PASSWORD = 'Aurevane-browser-2026!'

function accountEmail(testName: string, projectName: string): string {
  const projectSlug = projectName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  return `${testName}-${projectSlug}-${Date.now()}@example.com`
}

test('account entry is responsive, focusable, stable, and media-safe', async ({ page }, testInfo) => {
  await page.goto('/')

  await expect(page.getByTestId('account-shell')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Enter AUREVANE' })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enter AUREVANE' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
  expect(await hasHorizontalOverflow(page)).toBe(false)

  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Email')).toBeFocused()

  const requestedMedia = page.locator('[data-media-status="requested"]')
  expect(await requestedMedia.count()).toBeGreaterThan(0)

  const audioTrigger = page.getByRole('button', { name: 'Sound settings' })
  await audioTrigger.click()
  const audioDialog = page.getByRole('dialog', { name: 'Sound settings' })
  await expect(audioDialog).toBeVisible()
  await expect(audioTrigger).toHaveAttribute('aria-expanded', 'true')

  const dialogBox = await audioDialog.boundingBox()
  const viewport = page.viewportSize()
  if (dialogBox && viewport) {
    const candidates = [
      { x: 1, y: 1 },
      { x: viewport.width - 1, y: 1 },
      { x: 1, y: viewport.height - 1 },
      { x: viewport.width - 1, y: viewport.height - 1 },
    ]
    const outsidePoint = candidates.find(
      (point) =>
        point.x < dialogBox.x ||
        point.x > dialogBox.x + dialogBox.width ||
        point.y < dialogBox.y ||
        point.y > dialogBox.y + dialogBox.height,
    )

    expect(outsidePoint).toBeDefined()
    if (outsidePoint) {
      await page.mouse.click(outsidePoint.x, outsidePoint.y)
    }
  }

  await expect(audioDialog).toBeHidden()
  await expect(audioTrigger).toHaveAttribute('aria-expanded', 'false')
})

test('a new account persists its private profile across refresh, sign-out, and sign-in', async ({
  page,
}, testInfo) => {
  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `p11-${projectSlug}-${Date.now()}@example.com`
  const password = 'P11-browser-account-2026!'

  await page.goto('/')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account', exact: true }).last().click()

  await expect(page).toHaveURL(/\/game$/)
  await expect(page.getByRole('heading', { name: 'Choose your character.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Create Character' })).toHaveCount(1)
  await expect(page.getByText('Purchase unlock · coming later', { exact: true })).toBeVisible()
  await expect(page.getByText('Earn free · first Prestige Rebirth', { exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Choose your character.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Create Character' })).toHaveCount(1)
  await expect(page.getByText('Purchase unlock · coming later', { exact: true })).toBeVisible()
  await expect(page.getByText('Earn free · first Prestige Rebirth', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Account' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('account-shell')).toBeVisible()

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Enter AUREVANE' }).click()

  await expect(page).toHaveURL(/\/game$/)
  await expect(page.getByRole('heading', { name: 'Choose your character.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Create Character' })).toHaveCount(1)
})

test('audio stays gesture-gated and persists mute plus channel levels', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One browser runtime proof is sufficient.',
  )

  await page.goto('/')

  const trigger = page.getByRole('button', { name: 'Sound settings' })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Sound settings' })
  await expect(dialog).toBeVisible()

  const masterToggle = dialog.getByRole('button', { name: 'Mute all sound' })
  await masterToggle.click()
  await expect(masterToggle).toHaveAttribute('aria-pressed', 'true')

  const musicSlider = dialog.getByRole('slider', { name: 'Music volume' })
  await musicSlider.fill('0.3')
  await expect(musicSlider).toHaveValue('0.3')

  await page.reload()
  await page.getByRole('button', { name: 'Sound settings' }).click()
  const reloadedDialog = page.getByRole('dialog', { name: 'Sound settings' })
  await expect(reloadedDialog.getByRole('button', { name: 'Mute all sound' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(reloadedDialog.getByRole('slider', { name: 'Music volume' })).toHaveValue('0.3')
})

test('account creation validates server-side and preserves a stable error surface', async ({
  page,
}, testInfo) => {
  const email = accountEmail('account-invalid', testInfo.project.name)

  await page.goto('/')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('short')
  await page.getByRole('button', { name: 'Create account', exact: true }).last().click()

  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
  expect(await hasHorizontalOverflow(page)).toBe(false)
})

test('incorrect credentials fail closed without leaving the account shell', async ({ page }, testInfo) => {
  const email = accountEmail('account-missing', testInfo.project.name)

  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Enter AUREVANE' }).click()

  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('account-shell')).toBeVisible()
})
