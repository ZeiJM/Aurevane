import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

const ATTRIBUTE_IDS = ['might', 'finesse', 'vitality', 'agility', 'intellect', 'resolve'] as const

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Primary ${letters}`
}

test('Profile previews and commits Primary Discipline without changing assigned attributes', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One authenticated Chromium proof covers the P3.1 Profile authority flow.',
  )

  const slug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  await provisionAccountAndEnterCharacter({
    page,
    email: `p31-primary-${slug}-${Date.now()}@example.com`,
    password: 'P31-primary-build-2026!',
    characterName: uniqueCharacterName(),
  })

  const panel = page.getByTestId('primary-build-panel')
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('Vanguard · Pure')

  const attributesBefore = new Map(
    await Promise.all(
      ATTRIBUTE_IDS.map(
        async (id) =>
          [
            id,
            await page.getByTestId(`profile-attribute-${id}`).locator('strong').innerText(),
          ] as const,
      ),
    ),
  )
  const maxHp = page.getByTestId('derived-stat-maxHp').locator('strong')
  const maxHpBefore = await maxHp.innerText()

  await page.getByRole('button', { name: /Manage Primary Discipline/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Discipline Management' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Committed Primary')
  await expect(dialog).toContainText('Vanguard')

  const primary = page.getByLabel('Proposed Primary')
  const secondary = page.getByLabel('Proposed Secondary')
  await expect(secondary.locator('option[value="vanguard"]')).toHaveCount(0)
  await primary.selectOption('aetherist')

  const preview = page.getByTestId('primary-build-preview')
  await expect(preview).toBeVisible()
  await expect(preview).toContainText('Aetherist')
  await expect(preview).toContainText('Build v1')
  await expect(preview).toContainText('Core stats')
  await expect(preview).toContainText('Adventure stats')
  await expect(preview).toContainText('Maximum HP')
  await expect(preview).toContainText('Maximum MP')
  await expect(preview).toContainText('Personal allocation is preserved')
  await expect(preview).toContainText('Unchanged')

  await page.getByRole('button', { name: 'Commit Aetherist as Primary' }).click()
  await expect(preview).toBeHidden()
  await expect(page.getByRole('status')).toContainText(
    'Aetherist is now the committed Primary Discipline.',
  )
  await expect(panel).toContainText('Aetherist · Pure')

  for (const [id, value] of attributesBefore) {
    await expect(page.getByTestId(`profile-attribute-${id}`).locator('strong')).toHaveText(value)
  }

  await expect(maxHp).not.toHaveText(maxHpBefore)
  const maxHpAfter = await maxHp.innerText()

  await primary.selectOption('vanguard')
  await expect(preview).toBeVisible()
  await expect(preview).toContainText('Build v2')

  await page.reload()
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Committed Primary')
  await expect(dialog).toContainText('Aetherist')
  await expect(page.getByTestId('derived-stat-maxHp').locator('strong')).toHaveText(maxHpAfter)
  for (const [id, value] of attributesBefore) {
    await expect(page.getByTestId(`profile-attribute-${id}`).locator('strong')).toHaveText(value)
  }

  await page.mouse.click(1, 1)
  await expect(dialog).toBeHidden()
})
