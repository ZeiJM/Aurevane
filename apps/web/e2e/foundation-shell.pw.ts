import { AUDIO_SETTINGS_STORAGE_KEY } from '@aurevane/audio'
import { expect, test } from '@playwright/test'

test('foundation shell is responsive, keyboard reachable, and media-safe', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId('game-shell')).toBeVisible()
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
