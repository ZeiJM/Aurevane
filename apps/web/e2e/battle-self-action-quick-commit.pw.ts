import { expect, test, type Page } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueIdentity(prefix: string): { email: string; characterName: string } {
  const seed = `${Date.now()}${Math.floor(Math.random() * 100_000)}`
  const suffix = seed
    .slice(-7)
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')

  return {
    email: `${prefix}.${seed}@example.com`,
    characterName: `${prefix} ${suffix}`,
  }
}

async function enterGuidedBattle(page: Page) {
  const identity = uniqueIdentity('QuickGuard')
  await provisionAccountAndEnterCharacter({
    page,
    email: identity.email,
    password: 'AurevaneTest!42',
    characterName: identity.characterName,
  })

  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('guided-fundamentals')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const coach = page.getByRole('dialog', { name: 'Complete the tactical fundamentals' })
  await expect(coach).toBeVisible()
  await coach.getByRole('button', { name: 'Continue training' }).click()

  const root = page.locator("main[data-unified-battle='true'][data-battle-kind='pve']")
  await expect(root).toBeVisible()
  await expect(root).toHaveAttribute('data-local-turn', 'true')
  return root
}

test('previews Guard on the first shortcut press and commits it on the second', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop keyboard shortcut contract')
  test.slow()

  const root = await enterGuidedBattle(page)
  const deck = root.getByRole('region', { name: 'Command Deck' })
  const guard = deck.getByRole('button', { name: /Guard/ })
  const confirm = root.getByRole('button', { name: 'Confirm Action' })
  const economy = root.getByRole('progressbar', { name: 'Action Economy remaining' })

  await expect(guard).toContainText('4')
  await expect(economy).toHaveAttribute('aria-valuenow', '100')

  await page.keyboard.press('Digit4')
  await expect(confirm).toBeEnabled()
  await expect(economy).toHaveAttribute('aria-valuenow', '100')

  const commitResponse = page.waitForResponse((response) => {
    const request = response.request()
    return request.method() === 'POST' && new URL(response.url()).pathname.endsWith('/intents')
  })

  await page.keyboard.press('Digit4')
  expect((await commitResponse).status()).toBe(200)
  await expect(economy).toHaveAttribute('aria-valuenow', '70')
})
