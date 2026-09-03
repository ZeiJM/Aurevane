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
  await expect(panel).toContainText('Vanguard')
  await expect(panel).toContainText('Build v1')

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
  const maxHpBefore = await page.getByTestId('derived-stat-maxHp').locator('strong').innerText()

  await page.getByRole('button', { name: /Manage Primary Discipline/ }).click()
  await page.getByLabel('Proposed Primary').selectOption('aetherist')
  const preview = page.getByTestId('primary-build-preview')
  await expect(preview).toBeVisible()
  await expect(preview).toContainText('Aetherist')
  await expect(preview).toContainText('Max HP')
  await expect(preview).toContainText('Max MP')
  await expect(preview).toContainText('preserved exactly')

  await page.getByRole('button', { name: 'Commit Aetherist as Primary' }).click()
  await expect(preview).toBeHidden()
  await expect(page.getByRole('status')).toContainText(
    'Aetherist is now the committed Primary Discipline.',
  )
  await expect(panel).toContainText('Aetherist')
  await expect(panel).toContainText('Build v2')

  for (const [id, value] of attributesBefore) {
    await expect(page.getByTestId(`profile-attribute-${id}`).locator('strong')).toHaveText(value)
  }

  const maxHpAfter = await page.getByTestId('derived-stat-maxHp').locator('strong').innerText()
  expect(maxHpAfter).not.toBe(maxHpBefore)

  await page.reload()
  await expect(page.getByTestId('primary-build-panel')).toContainText('Aetherist')
  await expect(page.getByTestId('primary-build-panel')).toContainText('Build v2')
  await expect(page.getByTestId('derived-stat-maxHp').locator('strong')).toHaveText(maxHpAfter)
  for (const [id, value] of attributesBefore) {
    await expect(page.getByTestId(`profile-attribute-${id}`).locator('strong')).toHaveText(value)
  }
})
