import { expect, test } from '@playwright/test'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Recovery ${letters}`
}

test('routes the Recovery hotkey to the stable slot after swapping HP Recovery to MP Recovery', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop keyboard shortcut contract')
  test.slow()

  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `recovery-hotkey-${projectSlug}-${Date.now()}@example.com`
  const password = 'Recovery-hotkey-2026!'
  const characterName = uniqueCharacterName()

  await createAccountAndEnterCharacter({ page, email, password, characterName })
  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const root = page.locator("main[data-unified-battle='true'][data-battle-kind='pve']")
  await expect(root).toBeVisible()
  const deck = root.getByRole('region', { name: 'Command Deck' })
  const recoveryCard = deck.locator('[data-command-card="recover"]')
  const recovery = recoveryCard.locator('button[data-battle-command="recover"]')
  const artwork = recoveryCard.getByRole('button', { name: /Choose Heal skill/i })

  await expect(recovery).toContainText('HP Recovery')
  await expect(recovery.locator(':scope > span')).toContainText('5')

  await artwork.click()
  const selector = page.getByRole('listbox', { name: 'Heal skills' })
  await expect(selector).toBeVisible()
  await selector.getByRole('option', { name: /MP Recovery/ }).click()
  await expect(selector).toBeHidden()
  await expect(recovery).toContainText('MP Recovery')
  await expect(recovery.locator(':scope > span')).toContainText('5')

  // Count the real cockpit button invocation rather than relying on the currently equipped heal's
  // resource legality. The keyboard contract is slot-based: Digit5 must reach this same button
  // whether it currently presents HP Recovery or MP Recovery.
  await recovery.evaluate((button) => {
    const target = button as HTMLButtonElement
    const originalClick = target.click.bind(target)
    target.dataset.hotkeyClickCount = '0'
    target.click = () => {
      target.dataset.hotkeyClickCount = String(Number(target.dataset.hotkeyClickCount ?? '0') + 1)
      originalClick()
    }
  })

  await page.keyboard.press('Digit5')
  await expect(recovery).toHaveAttribute('data-hotkey-click-count', '1')
})
