import { expect, test } from '@playwright/test'

import { createDefaultSiteMusicConfig } from '../src/lib/site-music'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

test('Audio has real playback controls and loops without refreshing the game', async ({
  page,
}, info) => {
  test.setTimeout(60_000)
  const config = createDefaultSiteMusicConfig()
  // Old published configurations must also keep playing past the track boundary.
  config.defaultTrack.loop = false
  config.defaultTrack.label = 'Continuous background soundtrack'
  await page.route('**/api/site-music', (route) => route.fulfill({ json: { config } }))
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
  if (info.project.name !== 'mobile-chromium') {
    const centered = await page.locator('[data-audio-workspace]').evaluate((workspace) => {
      const scene = workspace.closest('[data-settings-scene]')!
      const workspaceRect = workspace.getBoundingClientRect()
      const sceneRect = scene.getBoundingClientRect()
      const headingRect = scene.querySelector('header')!.getBoundingClientRect()
      return {
        centerOffset: Math.abs(
          (workspaceRect.left + workspaceRect.right) / 2 - (sceneRect.left + sceneRect.right) / 2,
        ),
        workspaceTop: workspaceRect.top,
        headingBottom: headingRect.bottom,
      }
    })
    expect(centered.centerOffset).toBeLessThanOrEqual(1)
    expect(centered.workspaceTop).toBeGreaterThanOrEqual(centered.headingBottom)
  }
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

  await expect
    .poll(() => player.evaluate((element) => (element as HTMLAudioElement).loop))
    .toBe(true)
  await expect
    .poll(() => player.evaluate((element) => (element as HTMLAudioElement).duration))
    .toBeGreaterThan(2)
  const originalPlayer = await player.elementHandle()
  if (!originalPlayer) throw new Error('The background music player is missing.')
  const originalUrl = page.url()
  const originalSource = await player.evaluate(
    (element) => (element as HTMLAudioElement).currentSrc,
  )
  let navigations = 0
  let configRequests = 0
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations += 1
  })
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/site-music') configRequests += 1
  })
  await player.evaluate((element) => {
    element.dataset.loopBoundaryResets = '0'
    for (const event of ['emptied', 'loadstart', 'ended']) {
      element.addEventListener(event, () => {
        element.dataset.loopBoundaryResets = String(Number(element.dataset.loopBoundaryResets) + 1)
      })
    }
  })
  for (let boundary = 0; boundary < 2; boundary += 1) {
    await player.evaluate((element) => {
      const audio = element as HTMLAudioElement
      audio.currentTime = audio.duration - 0.8
    })
    await expect
      .poll(() => player.evaluate((element) => (element as HTMLAudioElement).currentTime), {
        timeout: 15_000,
      })
      .toBeLessThan(2)
    expect(await player.evaluate((element) => (element as HTMLAudioElement).paused)).toBe(false)
    await expect(playback).toHaveText('Pause music')
    await expect(page.getByText('Continuous background soundtrack', { exact: true })).toBeVisible()
    expect(await player.evaluate((element) => (element as HTMLAudioElement).currentSrc)).toBe(
      originalSource,
    )
    expect(
      await originalPlayer.evaluate(
        (element) => element === document.querySelector('[data-testid="site-music-player"]'),
      ),
    ).toBe(true)
    expect(page.url()).toBe(originalUrl)
    expect(navigations).toBe(0)
    expect(configRequests).toBe(0)
    await expect(player).toHaveAttribute('data-loop-boundary-resets', '0')
  }
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
