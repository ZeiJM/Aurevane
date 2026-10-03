import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueIdentity(): { email: string; characterName: string } {
  const seed = `${Date.now()}${Math.floor(Math.random() * 100_000)}`
  const suffix = seed
    .slice(-7)
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return {
    email: `MobileTurnClock.${seed}@example.com`,
    characterName: `Clock ${suffix}`,
  }
}

test('keeps the authoritative mobile PvE turn clock in the shared economy header', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile battle clock regression')
  test.slow()

  const identity = uniqueIdentity()
  await provisionAccountAndEnterCharacter({
    page,
    email: identity.email,
    password: 'AurevaneTest!42',
    characterName: identity.characterName,
  })
  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const root = page.locator("main[data-unified-battle='true'][data-battle-kind='pve']")
  const title = root.locator('[data-battle-instruction-title]')
  const slot = root.locator('[data-battle-turn-clock-slot]')
  const timer = slot.locator('[data-ai-turn-clock="true"]')
  await expect(title).toHaveText(/^Choose your action$/i)
  await expect(timer).toBeVisible()
  await expect(timer).toHaveText(/^\d+s$/)
  await expect(timer).toHaveAttribute('aria-live', 'polite')
  await expect(timer).toHaveAttribute('title', /Each player turn lasts 60 seconds/)

  const geometry = await timer.evaluate((element) => {
    const clock = element.getBoundingClientRect()
    const header = element.closest('header')!.getBoundingClientRect()
    return {
      clock: clock.toJSON(),
      header: header.toJSON(),
      font: parseFloat(getComputedStyle(element).fontSize),
    }
  })
  expect(geometry.clock.left).toBeGreaterThanOrEqual(geometry.header.left)
  expect(geometry.clock.right).toBeLessThanOrEqual(geometry.header.right)
  expect(geometry.clock.top).toBeGreaterThanOrEqual(geometry.header.top)
  expect(geometry.clock.bottom).toBeLessThanOrEqual(geometry.header.bottom)
  expect(geometry.font).toBeGreaterThanOrEqual(11)
})
