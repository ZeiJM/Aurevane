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

async function reloadProfile(page: Page): Promise<void> {
  await page.reload()
  await expect(page.getByTestId('character-profile')).toBeVisible()
}

test('PV-2 Profile flow compares pure four-Technique Essence with mixed 2+2 Resonance', async ({
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

  // The owner-only PV-2 preparation API remains available in explicit test mode, but its old
  // Profile card was intentionally removed when the right rail became the Build workspace.
  const prepared = await page.evaluate(async () => {
    const response = await fetch('/api/character/build/pv2-test-kit', { method: 'POST' })
    return { ok: response.ok, body: await response.json() }
  })
  expect(prepared.ok).toBe(true)
  expect(prepared.body).toMatchObject({
    result: { masteredDisciplines: 2, learnedSkills: 14 },
  })
  await reloadProfile(page)

  await page.getByRole('button', { name: /Tag Techniques/ }).click()
  await expect(page.getByTestId('skill-capacity')).toHaveText('0 / 4')
  await expect(page.getByTestId('active-essence')).toContainText('Unbroken Strike')
  await expect(page.getByTestId('active-resonance')).toHaveCount(0)

  for (const skill of ['Forceful Strike', 'Cleave', 'Brace', 'Shield Bash']) {
    await setSkill(page, skill, true)
  }

  await expect(page.getByTestId('skill-capacity')).toHaveText('4 / 4')
  await page.getByRole('button', { name: 'Commit tagged Techniques' }).click()
  await expect(page.getByRole('status')).toContainText('Tagged Techniques committed')
  await reloadProfile(page)

  await page.getByRole('button', { name: /Manage Primary Discipline/ }).click()
  await page.getByLabel('Proposed Secondary').selectOption('lifebinder')
  await expect(page.getByTestId('primary-build-preview')).toContainText('Vanguard + Lifebinder')
  await page.getByRole('button', { name: 'Commit Discipline changes' }).click()
  await expect(page.getByTestId('primary-build-panel')).toContainText('Vanguard + Lifebinder')
  await reloadProfile(page)

  await page.getByRole('button', { name: /Tag Techniques/ }).click()
  await expect(page.getByTestId('skill-capacity')).toHaveText('2 / 4')
  await expect(page.getByTestId('mixed-technique-split')).toContainText('Vanguard')
  await expect(page.getByTestId('mixed-technique-split')).toContainText('2 / 2')
  await expect(page.getByTestId('active-resonance')).toContainText("Mercy's Edge")
  await expect(page.getByTestId('active-essence')).toHaveCount(0)

  await setSkill(page, 'Mending Light', true)
  await setSkill(page, 'Barrier', true)

  await expect(page.getByTestId('skill-capacity')).toHaveText('4 / 4')
  await expect(page.getByTestId('mixed-technique-split')).toContainText('Lifebinder')
  await page.getByRole('button', { name: 'Commit tagged Techniques' }).click()
  await expect(page.getByRole('status')).toContainText('Tagged Techniques committed')

  await reloadProfile(page)
  await page.getByRole('button', { name: /Tag Techniques/ }).click()
  await expect(page.getByTestId('skill-capacity')).toHaveText('4 / 4')
  await expect(page.getByTestId('active-resonance')).toContainText("Mercy's Edge")
  await expect(page.getByTestId('active-essence')).toHaveCount(0)
  await expect(skillRow(page, 'Forceful Strike').getByRole('checkbox')).toBeChecked()
  await expect(skillRow(page, 'Cleave').getByRole('checkbox')).toBeChecked()
  await expect(skillRow(page, 'Mending Light').getByRole('checkbox')).toBeChecked()
  await expect(skillRow(page, 'Barrier').getByRole('checkbox')).toBeChecked()
})
