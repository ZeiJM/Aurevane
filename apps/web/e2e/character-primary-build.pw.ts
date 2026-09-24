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

test('Nexus previews and commits Primary Discipline while Character preserves personal allocation', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One authenticated Chromium proof covers the P3.1 Primary authority flow.',
  )

  const slug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  await provisionAccountAndEnterCharacter({
    page,
    email: `p31-primary-${slug}-${Date.now()}@example.com`,
    password: 'P31-primary-build-2026!',
    characterName: uniqueCharacterName(),
  })

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

  await page.goto('/game/nexus')
  await expect(page.locator('[data-arsenal-workspace]')).toBeVisible()

  const panel = page.getByTestId('primary-build-panel')
  await expect(panel).toBeVisible()
  const launcher = panel.getByRole('button', { name: /Manage Disciplines/ })
  const primaryDisciplineChip = page.getByTestId('primary-discipline-chip')
  await expect(launcher).toBeVisible()
  await expect(launcher).toHaveText(/Manage Disciplines/)
  await expect(primaryDisciplineChip).toHaveText('Vanguard')

  await launcher.click()
  const dialog = page.getByRole('dialog', { name: 'Discipline Management' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Currently Committed')
  await expect(dialog).toContainText('Vanguard')
  await expect(dialog).toContainText('Secondary Discipline')
  await expect(dialog).toContainText('Locked')

  const primarySlot = dialog.getByRole('button', { name: /Primary Discipline/ })
  const secondarySlot = dialog.getByRole('button', { name: /Secondary Discipline/ })
  const proposed = dialog.locator('select')

  await secondarySlot.click()
  await expect(proposed.locator('option[value=""]')).toHaveText('None')
  await expect(proposed.locator('option[value="vanguard"]')).toHaveCount(0)
  await primarySlot.click()
  await proposed.selectOption('aetherist')

  const preview = dialog.locator('[aria-label="Discipline stat preview"]')
  await expect(preview).toBeVisible()
  await expect(preview).toContainText('Proposed Primary')
  await expect(preview).toContainText('Aetherist')
  await expect(preview).toContainText('Change Impact')

  await dialog.getByRole('button', { name: /Confirm Change/ }).click()
  await expect(page.getByRole('status')).toContainText('Discipline changes committed.')
  await expect(launcher).toHaveText(/Manage Disciplines/)
  await expect(primaryDisciplineChip).toHaveText('Aetherist')
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()

  await page.goto('/game/character')
  await expect(page.getByTestId('character-profile')).toBeVisible()

  for (const id of ATTRIBUTE_IDS) {
    const expected = expectedAetheristAttributes.get(id)
    if (!expected) throw new Error(`Missing expected ${id} value.`)
    await expect(page.getByTestId(`profile-attribute-${id}`).locator('strong')).toHaveText(expected)

    const before = Number(attributesBefore.get(id))
    const after = Number(expected)
    expect(after - aetherist.baseAttributes[id]).toBe(before - vanguard.baseAttributes[id])
  }

  const maxHp = page.getByTestId('derived-stat-maxHp').locator('strong')
  await expect(maxHp).not.toHaveText(maxHpBefore)
  const maxHpAfter = await maxHp.innerText()

  await page.goto('/game/nexus')
  await expect(page.locator('[data-arsenal-workspace]')).toBeVisible()
  await launcher.click()
  await expect(dialog).toBeVisible()
  await proposed.selectOption('vanguard')
  await expect(preview).toBeVisible()
  await expect(preview).toContainText('Vanguard')

  await page.reload()
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Currently Committed')
  await expect(dialog).toContainText('Aetherist')
  await expect(dialog).toContainText('Secondary Discipline')
  await page.mouse.click(1, 1)
  await expect(dialog).toBeHidden()

  await page.goto('/game/character')
  await expect(page.getByTestId('derived-stat-maxHp').locator('strong')).toHaveText(maxHpAfter)
  for (const id of ATTRIBUTE_IDS) {
    const expected = expectedAetheristAttributes.get(id)
    if (!expected) throw new Error(`Missing expected persisted ${id} value.`)
    await expect(page.getByTestId(`profile-attribute-${id}`).locator('strong')).toHaveText(expected)
  }
})
