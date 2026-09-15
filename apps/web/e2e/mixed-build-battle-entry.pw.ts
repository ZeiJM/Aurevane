import { expect, test, type Page } from '@playwright/test'

async function skillRow(page: Page, skillName: string) {
  return page.getByTestId('skill-row').filter({ hasText: skillName })
}

async function setSkill(page: Page, skillName: string, selected: boolean) {
  const row = await skillRow(page, skillName)
  const checkbox = row.getByRole('checkbox')
  if ((await checkbox.isChecked()) !== selected) await checkbox.click()
}

async function setFavorite(page: Page, skillName: string) {
  const row = await skillRow(page, skillName)
  const favorite = row.getByRole('button', { name: /Favorite/ })
  if ((await favorite.getAttribute('aria-pressed')) !== 'true') await favorite.click()
}

async function openGameNavigation(page: Page) {
  const toggle = page.getByRole('button', { name: 'Navigation' })
  if (await toggle.isVisible()) await toggle.click()
}

test('legal Vanguard 3 + Lifebinder 1 mixed build can enter AI Sparring with favorite cockpit defaults', async ({
  page,
}) => {
  await page.goto('/game/character')

  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  const techniquesDialog = page.getByRole('dialog', { name: 'Techniques' })

  for (const skill of ['Forceful Strike', 'Cleave', 'Brace', 'Mending Light']) {
    await setSkill(page, skill, true)
  }

  await expect(skillRow(page, 'Forceful Strike').getByRole('checkbox')).toBeChecked()
  await expect(skillRow(page, 'Cleave').getByRole('checkbox')).toBeChecked()
  await expect(skillRow(page, 'Brace').getByRole('checkbox')).toBeChecked()
  await expect(skillRow(page, 'Mending Light').getByRole('checkbox')).toBeChecked()

  await page.getByRole('button', { name: 'Commit Selected Techniques' }).click()
  await expect(page.getByRole('status')).toContainText('Selected Techniques committed')

  await setFavorite(page, 'Forceful Strike')
  await setFavorite(page, 'Brace')
  await setFavorite(page, 'Mending Light')

  await techniquesDialog.getByRole('button', { name: 'Close' }).click()

  await openGameNavigation(page)
  await page
    .getByRole('navigation', { name: 'Game navigation', exact: true })
    .getByRole('link', { name: /Battle Hall/ })
    .click()
  await expect(page).toHaveURL(/\/game\/battle$/)
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()

  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/, { timeout: 15000 })
  await expect(page.locator('[data-unified-battle="true"]')).toBeVisible()

  const commandDeck = page.getByRole('region', { name: 'Command Deck' })
  await expect(commandDeck.locator('button[data-command-slot="attack"]')).toContainText(
    'Forceful Strike',
    { timeout: 8000 },
  )
  await expect(commandDeck.locator('button[data-command-slot="guard"]')).toContainText('Brace')
  await expect(commandDeck.locator('button[data-command-slot="recover"]')).toContainText(
    'Mending Light',
  )
})
