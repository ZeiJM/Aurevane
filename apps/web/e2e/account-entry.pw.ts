import { AUDIO_SETTINGS_STORAGE_KEY } from '@aurevane/audio'
import { expect, test } from '@playwright/test'

test('account entry is responsive, keyboard reachable, and media-safe', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId('account-shell')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'AUREVANE' })).toBeVisible()
  await expect(
    page.locator('[data-media-status="requested"][data-media-request="ART-UI-001"]'),
  ).toBeVisible()

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  )
  expect(hasHorizontalOverflow).toBe(false)

  await page.keyboard.press('Tab')
  await expect(page.locator('.skip-link')).toBeFocused()
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
  await expect(page.getByTestId('authenticated-shell')).toBeVisible()
  await expect(page.getByTestId('character-state')).toContainText('No character bound')

  await page.reload()
  await expect(page.getByTestId('authenticated-shell')).toBeVisible()
  await expect(page.getByText('Private profile').first()).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('account-shell')).toBeVisible()

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Enter AUREVANE' }).click()

  await expect(page).toHaveURL(/\/game$/)
  await expect(page.getByTestId('character-state')).toContainText('No character bound')
})

test('audio stays gesture-gated and persists mute plus channel levels', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One browser runtime proof is sufficient.',
  )

  await page.goto('/')

  const settings = page.getByTestId('audio-settings')
  const summary = settings.locator('summary')
  await summary.focus()
  await summary.press('Enter')

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
  await page.getByTestId('audio-settings').locator('summary').click()

  await expect(page.getByTestId('audio-volume-music')).toHaveValue('37')
  await expect(page.getByTestId('audio-mute')).toHaveText('Unmute all')

  await page.getByTestId('audio-mute').click()
  await expect(page.getByTestId('audio-volume-music')).toHaveValue('37')
})
