import { expect, test, type Locator, type Page } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const suffix =
    Date.now()
      .toString(36)
      .replace(/[^a-z]/gi, '')
      .slice(-7) || 'tester'
  return `Mixed Entry ${suffix}`
}

function skillRow(page: Page, name: string): Locator {
  return page.getByTestId('learned-skill-list').locator('article').filter({ hasText: name }).first()
}

async function setSkill(page: Page, name: string, checked: boolean): Promise<void> {
  const checkbox = skillRow(page, name).getByRole('checkbox')
  if ((await checkbox.isChecked()) !== checked) await checkbox.click()
}

async function closeOpenDialog(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog')
  if ((await dialog.count()) === 0) return
  await dialog.first().getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toHaveCount(0)
}

test('legal Vanguard 3 + Lifebinder 1 mixed build can enter AI Sparring', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.AUREVANE_PV2_TEST_MODE !== '1',
    'Mixed build entry regression requires the explicit local PV-2 test kit.',
  )
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One authenticated Chromium proof covers mixed-build battle entry.',
  )

  await provisionAccountAndEnterCharacter({
    page,
    email: `mixed-battle-entry-${Date.now()}@example.com`,
    password: 'Mixed-battle-entry-2026!',
    characterName: uniqueCharacterName(),
  })

  const prepared = await page.evaluate(async () => {
    const response = await fetch('/api/character/build/pv2-test-kit', { method: 'POST' })
    return { ok: response.ok, body: await response.json() }
  })
  expect(prepared.ok).toBe(true)
  expect(prepared.body).toMatchObject({ result: { masteredDisciplines: 6, learnedSkills: 16 } })

  await page.reload()
  await expect(page.getByTestId('character-profile')).toBeVisible()
  await closeOpenDialog(page)

  const disciplinePanel = page.getByTestId('primary-build-panel')
  await disciplinePanel.getByRole('button', { name: /Manage Primary Discipline/ }).click()
  const disciplineDialog = page.getByRole('dialog', { name: 'Discipline Management' })
  await expect(disciplineDialog).toBeVisible()
  await page.getByLabel('Proposed Secondary').selectOption('lifebinder')
  await page.getByRole('button', { name: 'Commit Discipline changes' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Lifebinder is now the committed Secondary Discipline.',
  )
  await disciplineDialog.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  await expect(page.getByRole('dialog', { name: 'Techniques' })).toBeVisible()

  for (const skill of ['Forceful Strike', 'Cleave', 'Brace', 'Barrier']) {
    await setSkill(page, skill, true)
  }

  await expect(skillRow(page, 'Forceful Strike').getByRole('checkbox')).toBeChecked()
  await expect(skillRow(page, 'Cleave').getByRole('checkbox')).toBeChecked()
  await expect(skillRow(page, 'Brace').getByRole('checkbox')).toBeChecked()
  await expect(skillRow(page, 'Barrier').getByRole('checkbox')).toBeChecked()

  await page.getByRole('button', { name: 'Commit Selected Techniques' }).click()
  await expect(page.getByRole('status')).toContainText('Selected Techniques committed')
  await page
    .getByRole('dialog', { name: 'Techniques' })
    .getByRole('button', { name: 'Close' })
    .click()

  await page.getByRole('button', { name: 'Navigation' }).click()
  await page.getByRole('link', { name: /Battle Hall/ }).click()
  await expect(page).toHaveURL(/\/game\/battle$/)
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()

  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/, { timeout: 15000 })
  await expect(page.locator('[data-unified-battle="true"]')).toBeVisible()
})
