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

test('custom Attack labels never restore a stale Move selection after selecting the Basic Attack shortcut', async ({
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

  await page
    .getByRole('navigation', { name: 'Primary game navigation', exact: true })
    .getByRole('link', { name: /Battle/ })
    .click()
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const commandDeck = page.getByRole('region', { name: 'Command Deck' })
  const move = commandDeck.locator('button[data-battle-command="move"]')
  const attack = commandDeck.locator('button[data-battle-command="attack"]')
  await move.click()
  await expect(move).toHaveAttribute('data-battle-active', 'true')
  await attack.locator(':scope > strong').evaluate((label) => {
    label.textContent = 'Forceful Strike'
  })
  await attack.click()
  await expect(attack).toHaveAttribute('data-battle-active', 'true')
  await page.keyboard.press('Digit2')
  await expect(attack).toHaveAttribute('data-battle-active', 'true')
  await expect(move).not.toHaveAttribute('data-battle-active', 'true')
  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '100',
  )
})
