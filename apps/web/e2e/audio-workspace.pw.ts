import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

test('Audio uses separate volume and current-track panels with real playback controls', async ({
  page,
}, info) => {
  const suffix = `${Date.now()}${info.workerIndex}`
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  await provisionAccountAndEnterCharacter({
    page,
    email: `audio-workspace-${Date.now()}-${info.workerIndex}@example.test`,
    password: 'Disposable-audio-workspace-2026!',
    characterName: `Auria ${suffix}`,
  })
  await page.goto('/game/settings/audio')
  await expect(page.getByRole('heading', { name: 'Volume settings', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Now playing', exact: true })).toBeVisible()
  const player = page.getByTestId('site-music-player')
  await expect
    .poll(() => player.evaluate((element) => (element as HTMLAudioElement).currentSrc))
    .not.toBe('')
  const playback = page.locator('[data-music-playback]')
  await expect(playback).toBeEnabled()
  if (await player.evaluate((element) => (element as HTMLAudioElement).paused))
    await playback.click()
  await expect
    .poll(() => player.evaluate((element) => (element as HTMLAudioElement).paused))
    .toBe(false)
  await expect(playback).toHaveText('Pause music')
  await playback.click()
  await expect(playback).toHaveText('Play music')
  const volume = page.getByTestId('audio-volume-music')
  await volume.fill('35')
  await expect
    .poll(() => player.evaluate((element) => (element as HTMLAudioElement).volume))
    .toBeCloseTo(0.35)
  expect(await player.evaluate((element) => (element as HTMLAudioElement).paused)).toBe(true)
  await playback.click()
  await expect
    .poll(() => player.evaluate((element) => (element as HTMLAudioElement).paused))
    .toBe(false)
  await expect(page.getByRole('progressbar', { name: 'Track progress' })).toBeVisible()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1)
  if (info.project.name !== 'mobile-chromium') {
    expect(
      await page
        .locator('#game-main')
        .evaluate((element) => element.scrollHeight - element.clientHeight),
    ).toBeLessThanOrEqual(1)
  }
})
