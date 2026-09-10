import { getFoundationDiscipline } from '@aurevane/game-core/character/foundation-disciplines'
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

test('Profile previews and commits Primary Discipline while preserving personal allocation', async ({
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
  const launcher = panel.getByRole('button', { name: /Manage Primary Discipline/ })
  const disciplineBuildLabel = page
    .locator('#build-disciplines-heading')
    .locator('..')
    .locator('strong')
  await expect(launcher).toBeVisible()
  await expect(launcher).toHaveText('Discipline Management')
  await expect(disciplineBuildLabel).toHaveText('Vanguard')

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
  const vanguard = getFoundationDiscipline('vanguard')
  const aetherist = getFoundationDiscipline('aetherist')
  if (!vanguard || !aetherist) throw new Error('Foundation Primary profiles are unavailable.')

  const expectedAetheristAttributes = new Map(
    ATTRIBUTE_IDS.map((id) => {
      const before = Number(attributesBefore.get(id))
      const personal = before - vanguard.baseAttributes[id]
      return [id, String(aetherist.baseAttributes[id] + personal)] as const
    }),
  )

  const maxHp = page.getByTestId('derived-stat-maxHp').locator('strong')
  const maxHpBefore = await maxHp.innerText()

  await launcher.click()
  const dialog = page.getByRole('dialog', { name: 'Discipline Management' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Committed Primary')
  await expect(dialog).toContainText('Vanguard')
  await expect(dialog).not.toContainText('Committed Secondary')
  await expect(dialog.locator('[aria-label="Choose a proposed Primary"]')).toHaveCount(0)

  const primary = dialog
    .locator('label')
    .filter({ hasText: /^Proposed Primary/ })
    .locator('select')
  const secondary = dialog
    .locator('label')
    .filter({ hasText: /^Proposed Secondary/ })
    .locator('select')
  await expect(secondary.locator('option[value=""]')).toHaveText('None')
  await expect(secondary.locator('option[value="vanguard"]')).toHaveCount(0)
  await primary.selectOption('aetherist')

  const preview = page.getByTestId('primary-build-preview')
  await expect(preview).toBeVisible()
  await expect(preview).toContainText('Aetherist')
  await expect(preview).not.toContainText('Pure')
  await expect(preview).not.toContainText('Build v1')
  await expect(preview).toContainText('Core stats')
  await expect(preview).toContainText('Adventure stats')
  await expect(preview).toContainText('Maximum HP')
  await expect(preview).toContainText('Maximum MP')
  await expect(preview).not.toContainText('Personal allocation is preserved')
  await expect(preview).toContainText('Unchanged')

  await page.getByRole('button', { name: 'Commit Aetherist as Primary' }).click()
  await expect(preview).toBeHidden()
  await expect(page.getByRole('status')).toContainText(
    'Aetherist is now the committed Primary Discipline.',
  )
  await expect(launcher).toHaveText('Discipline Management')
  await expect(disciplineBuildLabel).toHaveText('Aetherist')

  for (const id of ATTRIBUTE_IDS) {
    const expected = expectedAetheristAttributes.get(id)
    if (!expected) throw new Error(`Missing expected ${id} value.`)
    await expect(page.getByTestId(`profile-attribute-${id}`).locator('strong')).toHaveText(expected)

    const before = Number(attributesBefore.get(id))
    const after = Number(expected)
    expect(after - aetherist.baseAttributes[id]).toBe(before - vanguard.baseAttributes[id])
  }

  await expect(maxHp).not.toHaveText(maxHpBefore)
  const maxHpAfter = await maxHp.innerText()

  await primary.selectOption('vanguard')
  await expect(preview).toBeVisible()
  await expect(preview).not.toContainText('Build v2')

  await page.reload()
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Committed Primary')
  await expect(dialog).toContainText('Aetherist')
  await expect(dialog).not.toContainText('Committed Secondary')
  await expect(page.getByTestId('derived-stat-maxHp').locator('strong')).toHaveText(maxHpAfter)
  for (const id of ATTRIBUTE_IDS) {
    const expected = expectedAetheristAttributes.get(id)
    if (!expected) throw new Error(`Missing expected persisted ${id} value.`)
    await expect(page.getByTestId(`profile-attribute-${id}`).locator('strong')).toHaveText(expected)
  }

  await page.mouse.click(1, 1)
  await expect(dialog).toBeHidden()
})
