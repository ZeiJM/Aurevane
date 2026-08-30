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

test('keeps the authoritative mobile PvE turn clock on the Choose Your Action row', async ({
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
  const deck = root.getByRole('region', { name: 'Command Deck' })
  const row = deck.locator('[data-testid="combat-mode-instruction"]')
  const title = row.locator(':scope > strong')
  const timer = row.locator('[data-ai-turn-clock="true"]')

  await expect(title).toHaveText('Choose Your Action')
  await expect(timer).toBeVisible()
  await expect(timer).toHaveText(/^\d+s$/)

  const geometry = await row.evaluate((element) => {
    const titleElement = element.querySelector<HTMLElement>(':scope > strong')!
    const timerElement = element.querySelector<HTMLElement>('[data-ai-turn-clock="true"]')!
    const rowRect = element.getBoundingClientRect()
    const titleRect = titleElement.getBoundingClientRect()
    const timerRect = timerElement.getBoundingClientRect()
    return {
      rowRight: rowRect.right,
      rowCenterY: (rowRect.top + rowRect.bottom) / 2,
      titleRight: titleRect.right,
      timerLeft: timerRect.left,
      timerRight: timerRect.right,
      timerCenterY: (timerRect.top + timerRect.bottom) / 2,
    }
  })

  expect(geometry.timerLeft).toBeGreaterThan(geometry.titleRight)
  expect(geometry.rowRight - geometry.timerRight).toBeGreaterThanOrEqual(0)
  expect(geometry.rowRight - geometry.timerRight).toBeLessThanOrEqual(16)
  expect(Math.abs(geometry.timerCenterY - geometry.rowCenterY)).toBeLessThanOrEqual(4)
})
