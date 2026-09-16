import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

async function settle(page: Page) {
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

test(
  'Titles keeps the approved dark two-column account composition at normal desktop zoom',
  async ({ page }, info) => {
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
      const saveBox = saveButton.getBoundingClientRect()
      return {
        root: rect('[data-character-concept="titles"]'),
        personal: rect('section[aria-labelledby="personal-title-heading"]'),
        current: rect('section[aria-labelledby="current-title-heading"]'),
        profileImage: rect('section[aria-labelledby="profile-image-heading"]'),
        save: { y: saveBox.y, bottom: saveBox.bottom },
        footerTop: footer.top,
        background: getComputedStyle(root).backgroundColor,
        overflow: document.documentElement.scrollWidth - innerWidth,
      }
    })

    expect.soft(metrics.overflow, 'no horizontal overflow').toBeLessThanOrEqual(1)
    expect.soft(maxRgbChannel(metrics.background), 'dark Titles workspace').toBeLessThan(90)
    expect.soft(metrics.personal.x, 'title workflow is left').toBeLessThan(metrics.current.x)
    expect
      .soft(
        Math.abs(metrics.current.x - metrics.profileImage.x),
        'profile display and configuration share the right column',
      )
      .toBeLessThanOrEqual(2)
    expect
      .soft(metrics.current.height, 'profile preview stays compact')
      .toBeLessThanOrEqual(320)
    expect
      .soft(metrics.save.bottom, 'profile image action stays above footer')
      .toBeLessThanOrEqual(metrics.footerTop + 1)
    expect
      .soft(metrics.root.bottom, 'Titles board stays above footer')
      .toBeLessThanOrEqual(metrics.footerTop + 1)

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
  },
)

test(
  'Titles stacks cleanly on phone without inventing desktop-only overflow',
  async ({ page }, info) => {
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
    await expect(concept).toBeVisible()
    await settle(page)

    const metrics = await page.evaluate(() => {
      const rect = (selector: string) => {
        const box = document.querySelector(selector)!.getBoundingClientRect()
        return {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          bottom: box.bottom,
        }
      }
      const root = document.querySelector<HTMLElement>('[data-character-concept="titles"]')!
      return {
        rootBackground: getComputedStyle(root).backgroundColor,
        current: rect('section[aria-labelledby="current-title-heading"]'),
        personal: rect('section[aria-labelledby="personal-title-heading"]'),
        profileImage: rect('section[aria-labelledby="profile-image-heading"]'),
        overflow: document.documentElement.scrollWidth - innerWidth,
      }
    })

    expect.soft(metrics.overflow, 'phone has no horizontal overflow').toBeLessThanOrEqual(1)
    expect
      .soft(maxRgbChannel(metrics.rootBackground), 'phone workspace stays dark')
      .toBeLessThan(90)
    expect
      .soft(Math.abs(metrics.current.x - metrics.personal.x), 'phone sections share one column')
      .toBeLessThanOrEqual(2)
    expect
      .soft(
        Math.abs(metrics.personal.x - metrics.profileImage.x),
        'profile config shares the stack',
      )
      .toBeLessThanOrEqual(2)
    expect
      .soft(metrics.current.height, 'phone profile preview stays compact')
      .toBeLessThanOrEqual(360)

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
  },
)
