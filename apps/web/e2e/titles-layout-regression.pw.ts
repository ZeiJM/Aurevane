import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

async function settle(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
  })
}

function maxRgbChannel(value: string) {
  return Math.max(...(value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number))
}

test('Titles keeps the approved dark two-column account composition at normal desktop zoom', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Desktop Titles composition only')
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1366, height: 768 })
  await provisionAccountAndEnterCharacter({
    page,
    email: `titles-layout-${Date.now()}@example.com`,
    password: 'AurevaneTest!42',
    characterName: 'Title Wayfarer',
  })
  await page.goto('/game/account/titles')

  const concept = page.locator('[data-character-concept="titles"]')
  const personal = page.locator('section[aria-labelledby="personal-title-heading"]')
  const current = page.locator('section[aria-labelledby="current-title-heading"]')
  const profileImage = page.locator('section[aria-labelledby="profile-image-heading"]')
  const save = page.getByRole('button', { name: 'Save Profile Image' })
  await expect(concept).toBeVisible()
  await expect(personal).toBeVisible()
  await expect(current).toBeVisible()
  await expect(profileImage).toBeVisible()
  await expect(save).toBeVisible()
  await settle(page)

  const metrics = await page.evaluate(() => {
    const rect = (selector: string) => {
      const box = document.querySelector(selector)!.getBoundingClientRect()
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        right: box.right,
        bottom: box.bottom,
      }
    }
    const root = document.querySelector<HTMLElement>('[data-character-concept="titles"]')!
    const footer = document
      .querySelector('[data-testid="authenticated-shell"] > footer')!
      .getBoundingClientRect()
    const saveButton = Array.from(root.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Save Profile Image'),
    )!
    return {
      root: rect('[data-character-concept="titles"]'),
      personal: rect('section[aria-labelledby="personal-title-heading"]'),
      current: rect('section[aria-labelledby="current-title-heading"]'),
      profileImage: rect('section[aria-labelledby="profile-image-heading"]'),
      save: {
        ...(() => {
          const box = saveButton.getBoundingClientRect()
          return { y: box.y, bottom: box.bottom }
        })(),
      },
      footerTop: footer.top,
      background: getComputedStyle(root).backgroundColor,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }
  })

  expect.soft(metrics.overflow, 'Titles must not create horizontal overflow').toBeLessThanOrEqual(1)
  expect.soft(maxRgbChannel(metrics.background), 'Titles workspace remains dark').toBeLessThan(90)
  expect
    .soft(metrics.personal.x, 'Personal-title workflow occupies the left desktop column')
    .toBeLessThan(metrics.current.x)
  expect
    .soft(Math.abs(metrics.current.x - metrics.profileImage.x), 'Profile display/configuration share the right column')
    .toBeLessThanOrEqual(2)
  expect
    .soft(metrics.current.height, 'Current profile display stays compact instead of becoming a full-height portrait')
    .toBeLessThanOrEqual(320)
  expect
    .soft(metrics.save.bottom, 'Profile image action fits above the authenticated footer at 1366x768')
    .toBeLessThanOrEqual(metrics.footerTop + 1)
  expect.soft(metrics.root.bottom, 'Titles board fits the normal desktop game frame').toBeLessThanOrEqual(metrics.footerTop + 1)

  await page.getByPlaceholder('e.g. Dawn Warden').fill('Dawn Keeper')
  await page.getByRole('button', { name: 'Review Title' }).click()
  await expect(page.getByRole('button', { name: 'Confirm Final Title' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()

  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await mkdir(process.env.LAYOUT_REVIEW_OUTPUT, { recursive: true })
    await page.screenshot({
      path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, 'titles-desktop-1366x768.png'),
      fullPage: true,
    })
  }
})

test('Titles stacks cleanly on phone without inventing desktop-only overflow', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-chromium', 'Phone Titles composition only')
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await provisionAccountAndEnterCharacter({
    page,
    email: `titles-mobile-${Date.now()}@example.com`,
    password: 'AurevaneTest!42',
    characterName: 'Mobile Wayfarer',
  })
  await page.goto('/game/account/titles')

  const concept = page.locator('[data-character-concept="titles"]')
  const current = page.locator('section[aria-labelledby="current-title-heading"]')
  const personal = page.locator('section[aria-labelledby="personal-title-heading"]')
  const profileImage = page.locator('section[aria-labelledby="profile-image-heading"]')
  await expect(concept).toBeVisible()
  await settle(page)

  const metrics = await page.evaluate(() => {
    const rect = (selector: string) => {
      const box = document.querySelector(selector)!.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width, height: box.height, bottom: box.bottom }
    }
    return {
      rootBackground: getComputedStyle(
        document.querySelector<HTMLElement>('[data-character-concept="titles"]')!,
      ).backgroundColor,
      current: rect('section[aria-labelledby="current-title-heading"]'),
      personal: rect('section[aria-labelledby="personal-title-heading"]'),
      profileImage: rect('section[aria-labelledby="profile-image-heading"]'),
      overflow: document.documentElement.scrollWidth - innerWidth,
    }
  })

  expect.soft(metrics.overflow, 'Phone Titles must not overflow horizontally').toBeLessThanOrEqual(1)
  expect.soft(maxRgbChannel(metrics.rootBackground), 'Phone Titles workspace remains dark').toBeLessThan(90)
  expect.soft(Math.abs(metrics.current.x - metrics.personal.x), 'Phone sections share one column').toBeLessThanOrEqual(2)
  expect.soft(Math.abs(metrics.personal.x - metrics.profileImage.x), 'Phone profile configuration shares the stack').toBeLessThanOrEqual(2)
  expect.soft(metrics.current.height, 'Phone profile preview stays compact').toBeLessThanOrEqual(360)

  const save = page.getByRole('button', { name: 'Save Profile Image' })
  await save.scrollIntoViewIfNeeded()
  await expect(save).toBeInViewport({ ratio: 1 })
  await save.click({ trial: true })

  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await mkdir(process.env.LAYOUT_REVIEW_OUTPUT, { recursive: true })
    await page.screenshot({
      path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, 'titles-mobile-390x844.png'),
      fullPage: true,
    })
  }
})
