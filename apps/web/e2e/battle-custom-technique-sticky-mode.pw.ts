import { expect, test } from '@playwright/test'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Sticky ${letters}`
}

test('custom Attack labels never restore a stale Move selection after action confirmation', async ({
  page,
}, testInfo) => {
  test.slow()

  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  await createAccountAndEnterCharacter({
    page,
    email: `sticky-technique-${projectSlug}-${Date.now()}@example.com`,
    password: 'Sticky-technique-2026!',
    characterName: uniqueCharacterName(),
  })

  await page.getByRole('button', { name: 'Navigation' }).click()
  await page.getByRole('link', { name: /Battle Hall/ }).click()
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const commandDeck = page.getByRole('region', { name: 'Command Deck' })
  const move = commandDeck.locator('button[data-battle-command="move"]')
  const attack = commandDeck.locator('button[data-battle-command="attack"]')
  const confirm = page.getByRole('button', { name: 'Confirm Action' })

  // Reproduce the legacy failure seam directly: Move was the previous repeatable command, then an
  // authored Technique changes the visible Attack label away from "Basic Attack". Before the fix,
  // the PvE keyboard helper kept the stale Move label and re-selected Move after confirmation.
  await move.click()
  await expect(move).toHaveAttribute('data-battle-active', 'true')

  await attack.locator(':scope > strong').evaluate((label) => {
    label.textContent = 'Forceful Strike'
  })
  await attack.click()
  await expect(attack).toHaveAttribute('data-battle-active', 'true')
  await expect(move).not.toHaveAttribute('data-battle-active', 'true')

  // The repeat helper listens to the confirmation event before the server response. Dispatching the
  // same bubbling click event isolates that state transition without spending AP or depending on a
  // particular battlefield spawn distance.
  await confirm.evaluate((button) => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })

  await page.waitForTimeout(250)
  await expect(attack).toHaveAttribute('data-battle-active', 'true')
  await expect(move).not.toHaveAttribute('data-battle-active', 'true')
})
