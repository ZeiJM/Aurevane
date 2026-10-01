import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

test('Loadout opens Nexus and its Hall-style sections switch directly to Items and back', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  const suffix = `${Date.now()}${info.workerIndex}`
  await provisionAccountAndEnterCharacter({
    page,
    email: `loadout-tabs-${suffix}@example.test`,
    password: 'Loadout-tabs-2026!',
    characterName: `Loadout ${suffix.replace(/\d/g, (digit) => String.fromCharCode(65 + Number(digit))).slice(-10)}`,
  })
  await page
    .getByRole('navigation', { name: 'Primary game navigation' })
    .getByRole('link', { name: 'Loadout', exact: true })
    .click()
  await expect(page).toHaveURL(/\/game\/nexus$/)
  const tabs = page.getByRole('navigation', { name: 'Loadout sections' })
  await expect(tabs.getByRole('link', { name: 'Nexus', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.getByRole('link', { name: 'Back to Nexus and Items' })).toHaveCount(0)
  await expect(page.locator('[data-loadout="nexus"]')).toHaveCount(0)
  await tabs.getByRole('link', { name: 'Items', exact: true }).click()
  await expect(page).toHaveURL(/\/game\/loadout\/items$/)
  await expect(tabs.getByRole('link', { name: 'Items', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(
    page
      .getByRole('navigation', { name: 'Primary game navigation' })
      .getByRole('link', { name: 'Loadout', exact: true }),
  ).toHaveAttribute('aria-current', 'page')
  await expect(page.getByText('Coming Soon', { exact: true })).toBeVisible()
  const slots = page.getByLabel('Future equipment slots')
  await expect(slots.locator(':scope > div')).toHaveCount(8)
  const viewports =
    info.project.name === 'mobile-chromium'
      ? [{ width: 390, height: 844 }]
      : [
          { width: 1366, height: 768 },
          { width: 1536, height: 614 },
          { width: 1440, height: 900 },
        ]
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    const geometry = await tabs.evaluate((element) => ({
      documentOverflow: document.documentElement.scrollWidth - innerWidth,
      tabOverflow: element.scrollWidth - element.clientWidth,
      links: Array.from(element.querySelectorAll('a')).map((link) => ({
        height: link.getBoundingClientRect().height,
        overflow: link.scrollWidth - link.clientWidth,
      })),
    }))
    expect(geometry.documentOverflow).toBeLessThanOrEqual(1)
    expect(geometry.tabOverflow).toBeLessThanOrEqual(1)
    for (const link of geometry.links) {
      expect(link.height).toBeGreaterThanOrEqual(44)
      expect(link.overflow).toBeLessThanOrEqual(1)
    }
    if (viewport.width > 1100) {
      expect(
        await page
          .locator('#game-main')
          .evaluate((element) => element.scrollHeight - element.clientHeight),
      ).toBeLessThanOrEqual(1)
    }
    for (const slot of await slots.locator(':scope > div').all()) await expect(slot).toBeVisible()
  }
  await tabs.getByRole('link', { name: 'Nexus', exact: true }).click()
  await expect(page).toHaveURL(/\/game\/nexus$/)
  await expect(tabs.getByRole('link', { name: 'Nexus', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.getByTestId('skill-build-panel')).toBeVisible()
})
