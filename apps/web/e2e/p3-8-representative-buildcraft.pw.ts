import { expect, test, type Locator, type Page } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const suffix =
    Date.now()
      .toString(36)
      .replace(/[^a-z]/gi, '')
      .slice(-7) || 'tester'
  return `Buildcraft ${suffix}`
}

function skillRow(page: Page, name: string): Locator {
  return page.getByTestId('learned-skill-list').locator('article').filter({ hasText: name }).first()
}

async function setSkill(page: Page, name: string, checked: boolean): Promise<void> {
  const checkbox = skillRow(page, name).getByRole('checkbox')
  if ((await checkbox.isChecked()) !== checked) await checkbox.click()
}

test('PV-2 Profile flow compares pure eight-Skill Essence with mixed six-Skill Resonance', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.AUREVANE_PV2_TEST_MODE !== '1',
    'PV-2 representative buildcraft is available only in an explicitly enabled preview.',
  )
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One authenticated Chromium proof covers the P3.8 representative buildcraft flow.',
  )

  await provisionAccountAndEnterCharacter({
    page,
    email: `p38-buildcraft-${Date.now()}@example.com`,
    password: 'P38-buildcraft-browser-2026!',
    characterName: uniqueCharacterName(),
  })

  const kit = page.getByTestId('pv2-test-kit')
  await expect(kit).toBeVisible()
  await kit.getByRole('button', { name: 'Prepare PV-2 buildcraft test' }).click()
  await expect(kit.getByRole('status')).toContainText(
    'Ready: 2 representative Disciplines and 14 Skills are available',
  )

  await page.getByRole('button', { name: /Manage Discipline Skills/ }).click()
  await expect(page.getByTestId('skill-capacity')).toHaveText('0 / 8')
  await expect(page.getByTestId('active-essence')).toContainText('Essence Skill')
  await expect(
    page.getByText('Resonance — available only to an eligible mixed build.'),
  ).toBeVisible()

  for (const skill of [
    'Forceful Strike',
    'Cleave',
    'Guard Break',
    'Brace',
    'Rally',
    'Shield Bash',
    'Second Wind',
    'Sweeping Strike',
  ]) {
    await setSkill(page, skill, true)
  }

  await expect(page.getByTestId('skill-capacity')).toHaveText('8 / 8')
  await page.getByRole('button', { name: 'Commit Skill loadout' }).click()
  await expect(page.getByRole('status')).toContainText('Discipline Skill loadout is now committed')
  await page.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: /Manage Primary Discipline/ }).click()
  await page.getByLabel('Proposed Secondary').selectOption('lifebinder')
  await expect(page.getByTestId('primary-build-preview')).toContainText('Vanguard + Lifebinder')
  await page.getByRole('button', { name: 'Commit Discipline changes' }).click()
  await expect(page.getByTestId('primary-build-panel')).toContainText('Vanguard + Lifebinder')

  await page.getByRole('button', { name: /Manage Discipline Skills/ }).click()
  await expect(page.getByTestId('skill-capacity')).toHaveText('6 / 6')
  await expect(page.getByTestId('active-resonance')).toContainText("Mercy's Edge")
  await expect(
    page.getByText('Essence — unavailable while a Secondary Discipline is active.'),
  ).toBeVisible()

  for (const skill of ['Guard Break', 'Rally', 'Shield Bash']) {
    await setSkill(page, skill, false)
  }
  for (const skill of ['Mending Light', 'Barrier', 'Renew']) {
    await setSkill(page, skill, true)
  }

  await expect(page.getByTestId('skill-capacity')).toHaveText('6 / 6')
  await page.getByRole('button', { name: 'Commit Skill loadout' }).click()
  await expect(page.getByRole('status')).toContainText('Discipline Skill loadout is now committed')

  await page.reload()
  await page.getByRole('button', { name: /Manage Discipline Skills/ }).click()
  await expect(page.getByTestId('skill-capacity')).toHaveText('6 / 6')
  await expect(page.getByTestId('active-resonance')).toContainText("Mercy's Edge")
  await expect(skillRow(page, 'Forceful Strike').getByRole('checkbox')).toBeChecked()
  await expect(skillRow(page, 'Brace').getByRole('checkbox')).toBeChecked()
  await expect(skillRow(page, 'Cleave').getByRole('checkbox')).toBeChecked()
  await expect(skillRow(page, 'Mending Light').getByRole('checkbox')).toBeChecked()
  await expect(skillRow(page, 'Barrier').getByRole('checkbox')).toBeChecked()
  await expect(skillRow(page, 'Renew').getByRole('checkbox')).toBeChecked()
})
