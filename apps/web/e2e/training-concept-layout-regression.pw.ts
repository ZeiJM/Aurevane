import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

test('training uses the approved character rail and parchment three-workspace composition', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['127.0.0.1', 'localhost'].includes(host)) {
    throw new Error('Training layout review requires disposable local Supabase.')
  }
  const mobile = testInfo.project.name === 'mobile-chromium'
  const width = mobile ? 390 : testInfo.project.name === 'laptop-chromium' ? 1366 : 1728
  await page.setViewportSize({ width, height: mobile ? 844 : 887 })
  await provisionAccountAndEnterCharacter({
    page,
    email: `training-concept-${testInfo.project.name}-${Date.now()}@example.test`,
    password: 'Disposable-layout-review-2026!',
    characterName: mobile ? 'Lyra Dawn' : width === 1366 ? 'Lyra Reed' : 'Lyra Vale',
  })
  await page.goto('/game/training')

  const frame = page.locator('[data-training-concept]')
  const identity = page.locator('[data-av-game-rail]')
  const planner = page.getByTestId('practice-plan-card')
  const current = page.getByRole('region', { name: 'Current training activity' })
  const report = page.getByRole('complementary', { name: 'Training report workspace' })

  await expect(frame).toBeVisible()
  await expect(identity).toBeVisible()
  await expect(planner).toBeVisible()
  await expect(current).toBeVisible()
  await expect(report).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Training sections' })).toHaveCount(0)
  await expect(frame.locator('[data-training-scene] img')).toHaveCount(1)
  const railBox = await identity.boundingBox()
  expect(railBox).not.toBeNull()
  if (!mobile) expect(railBox!.width).toBeCloseTo(190, 0)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1)

  const durationCards = page.locator('[aria-label="Passive Training durations"] article')
  await expect(durationCards).toHaveCount(3)
  const durationImages = durationCards.locator('img')
  const durationImageSources = await durationImages.evaluateAll((images) =>
    images.map((image) => image.getAttribute('src')),
  )
  expect(new Set(durationImageSources).size).toBe(3)
  const durationImageShapes = await durationImages.evaluateAll((images) =>
    images.map((image) => {
      const bounds = image.getBoundingClientRect()
      return { width: bounds.width, height: bounds.height }
    }),
  )
  for (const shape of durationImageShapes) {
    expect(Math.abs(shape.width - shape.height)).toBeLessThanOrEqual(1)
  }
  const imageToCopyBalance = await durationCards.evaluateAll((cards) =>
    cards.map((card) => {
      const media = card.querySelector<HTMLElement>('img')
      const heading = card.querySelector<HTMLElement>('div > div > strong')?.parentElement
      const description = heading?.parentElement?.querySelector<HTMLElement>('p')
      const rewards = heading?.parentElement?.querySelector<HTMLElement>('dl')
      if (!media || !heading || !description || !rewards) return null
      const mediaBounds = media.getBoundingClientRect()
      const top = Math.min(
        heading.getBoundingClientRect().top,
        description.getBoundingClientRect().top,
        rewards.getBoundingClientRect().top,
      )
      const bottom = Math.max(
        heading.getBoundingClientRect().bottom,
        description.getBoundingClientRect().bottom,
        rewards.getBoundingClientRect().bottom,
      )
      return { mediaHeight: mediaBounds.height, copyHeight: bottom - top }
    }),
  )
  for (const balance of imageToCopyBalance) {
    expect(balance).not.toBeNull()
    if (!balance) continue
    expect(balance.mediaHeight).toBeGreaterThanOrEqual(balance.copyHeight - 8)
  }
  for (const number of ['01', '02', '03']) {
    await expect(durationCards.getByText(number, { exact: true })).toHaveCount(0)
  }

  const rewardValues = page.locator('[aria-label="Passive Training durations"] dd')
  await expect(rewardValues).toHaveCount(6)
  const obscuredRewards = await durationCards.evaluateAll((cards) =>
    cards.flatMap((card) => {
      const button = card.querySelector('button')?.getBoundingClientRect()
      if (!button) return ['Missing duration action']
      return Array.from(card.querySelectorAll('dl dt, dl dd')).flatMap((label) => {
        const bounds = label.getBoundingClientRect()
        const overlaps =
          bounds.left < button.right &&
          bounds.right > button.left &&
          bounds.top < button.bottom &&
          bounds.bottom > button.top
        return overlaps ? [label.textContent] : []
      })
    }),
  )
  expect(obscuredRewards, 'Duration actions must not cover reward labels or values').toEqual([])
  expect(
    await rewardValues
      .first()
      .evaluate((element) => Number.parseInt(getComputedStyle(element).fontWeight, 10)),
  ).toBeLessThanOrEqual(500)
  await expect(
    page.getByRole('button', { name: /Load Preset|Apply Plan|View History/ }),
  ).toHaveCount(0)
  await expect(page.getByText('How Passive Training works', { exact: true })).toHaveCount(0)
})
