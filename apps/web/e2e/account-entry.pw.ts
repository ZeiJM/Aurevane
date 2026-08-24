import { AUDIO_SETTINGS_STORAGE_KEY } from '@aurevane/audio'
import { expect, test } from '@playwright/test'

import { createVerifiedAccountAndSignIn, signOutFromAccountMenu } from './pv1f-test-helpers'

test('account entry is responsive, focusable, stable, and media-safe', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId('account-shell')).toBeVisible()
  const title = page.getByRole('heading', { level: 1, name: 'AUREVANE' })
  await expect(title).toBeVisible()
  await expect(
    page.locator('[data-media-status="requested"][data-media-request="ART-UI-001"]'),
  ).toBeVisible()

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  )
  expect(hasHorizontalOverflow).toBe(false)

  const viewport = page.viewportSize()
  const titleBox = await title.boundingBox()
  expect(viewport).not.toBeNull()
  expect(titleBox).not.toBeNull()
  if (viewport && titleBox) {
    expect(titleBox.x).toBeGreaterThanOrEqual(-1)
    expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(viewport.width + 1)
  }

  await page.keyboard.press('Tab')
  await expect(page.locator('.skip-link')).toBeFocused()

  const email = page.getByLabel('Email')
  await expect(email).toBeEnabled()
  await email.click()
  await expect(email).toBeFocused()

  const titleDocumentYBeforeHelp = await title.evaluate(
    (element) => element.getBoundingClientRect().top + window.scrollY,
  )
  await page.getByText('Account & Security', { exact: true }).click()
  const titleDocumentYAfterHelp = await title.evaluate(
    (element) => element.getBoundingClientRect().top + window.scrollY,
  )
  expect(Math.abs(titleDocumentYAfterHelp - titleDocumentYBeforeHelp)).toBeLessThanOrEqual(1)

  const audioTrigger = page.getByRole('button', { name: 'Sound settings' })
  const audioDialog = page.getByRole('dialog', { name: 'Audio settings' })
  await audioTrigger.click()
  await expect(audioDialog).toBeVisible()

  const dialogBox = await audioDialog.boundingBox()
  const viewportSize = page.viewportSize()
  expect(dialogBox).not.toBeNull()
  expect(viewportSize).not.toBeNull()

  if (dialogBox && viewportSize) {
    const inset = 8
    const candidates = [
      { x: inset, y: inset },
      { x: viewportSize.width - inset, y: inset },
      { x: inset, y: viewportSize.height - inset },
      { x: viewportSize.width - inset, y: viewportSize.height - inset },
    ]
    const outsidePoint = candidates.find(
      ({ x, y }) =>
        x < dialogBox.x ||
        x > dialogBox.x + dialogBox.width ||
        y < dialogBox.y ||
        y > dialogBox.y + dialogBox.height,
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

  await createVerifiedAccountAndSignIn({ page, email, password })
  await expect(page.getByRole('link', { name: 'Create Character' })).toHaveCount(1)
  await expect(page.getByText('Additional character slot', { exact: true })).toBeVisible()
  await expect(
    page.getByText('Slot 2 will be available for purchase at a later time.', { exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Available later', { exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Choose your character.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Create Character' })).toHaveCount(1)
  await expect(page.getByText('Additional character slot', { exact: true })).toBeVisible()
  await expect(
    page.getByText('Slot 2 will be available for purchase at a later time.', { exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Available later', { exact: true })).toBeVisible()

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

test('duplicate email signup is denied with a visible error', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One authenticated browser runtime proof is sufficient.',
  )

  const email = `duplicate-signup-${Date.now()}@example.com`
  const password = 'Duplicate-account-2026!'

  await createVerifiedAccountAndSignIn({ page, email, password })
  await signOutFromAccountMenu(page)

  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('Different-password-2026!')
  await page.getByRole('button', { name: 'Create account', exact: true }).last().click()

  const message = page.getByTestId('account-message')
  await expect(page).toHaveURL(/\/$/)
  await expect(message).toHaveText('An account already exists with this email. Sign in instead.')
  await expect(message).toHaveAttribute('data-tone', 'error')
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
  await trigger.focus()
  await trigger.press('Enter')

  await expect(page.getByTestId('audio-state')).toContainText(
    'locked until you choose to enable it',
  )
  await page.getByTestId('audio-unlock').click()
  await expect(page.getByTestId('audio-state')).toContainText('Audio ready')

  const musicVolume = page.getByTestId('audio-volume-music')
  await musicVolume.fill('37')
  await expect(musicVolume).toHaveValue('37')

  await page.getByTestId('audio-mute').click()
  await expect(page.getByTestId('audio-mute')).toHaveText('Unmute all')

  await expect
    .poll(() =>
      page.evaluate((key) => window.localStorage.getItem(key), AUDIO_SETTINGS_STORAGE_KEY),
    )
    .toContain('"muted":true')

  await expect
    .poll(() =>
      page.evaluate((key) => window.localStorage.getItem(key), AUDIO_SETTINGS_STORAGE_KEY),
    )
    .toContain('"music":0.37')

  await page.reload()
  await page.getByRole('button', { name: 'Sound settings' }).click()

  await expect(page.getByTestId('audio-volume-music')).toHaveValue('37')
  await expect(page.getByTestId('audio-mute')).toHaveText('Unmute all')

  await page.getByTestId('audio-mute').click()
  await expect(page.getByTestId('audio-volume-music')).toHaveValue('37')

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Audio settings' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Sound settings' })).toBeFocused()
})
