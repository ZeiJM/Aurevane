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

  // Profile build panels intentionally persist through refresh via URL state. Confirm that
  // persisted panel is restored, then close it so the next buildcraft step can open the other
  // authoritative panel rather than clicking through a modal backdrop.
  const openDialog = page.getByRole('dialog')
  if ((await openDialog.count()) > 0) {
    const dialog = openDialog.first()
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toHaveCount(0)
  }
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
  const techniquesOverlay = page.locator('body > [data-techniques-overlay="true"]')
  await expect(techniquesOverlay).toBeVisible()
  await expect(techniquesOverlay.getByRole('dialog', { name: 'Techniques' })).toBeVisible()
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe(
    'hidden',
  )
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

  // Tagged Techniques must keep the cockpit slot's keyboard contract and receive the same
  // authoritative preview chips as the original basic actions after a skill swap.
  const techniquesDialog = page.getByRole('dialog', { name: 'Techniques' })
  await techniquesDialog.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Navigation' }).click()
  await page.getByRole('link', { name: /Battle Hall/ }).click()
  await expect(page).toHaveURL(/\/game\/battle$/)
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const commandDeck = page.getByRole('region', { name: 'Command Deck' })
  const commandContext = commandDeck.locator(':scope > div').first()
  const attackCard = commandDeck.locator('[data-command-card="attack"]')
  const attackAction = attackCard.locator('button[data-command-slot="attack"]')
  const attackArtwork = attackCard.getByRole('button', { name: /Choose Attack skill/i })

  await attackArtwork.click()
  const attackSelector = page.getByRole('listbox', { name: 'Attack skills' })
  await expect(attackSelector.getByRole('option', { name: /Forceful Strike/ })).toBeVisible()
  await attackSelector.getByRole('option', { name: /Forceful Strike/ }).click()
  await expect(attackAction).toContainText('Forceful Strike')

  await page.keyboard.press('Digit3')
  await expect(attackAction).toHaveAttribute('data-battle-active', 'true')

  // Directional keyboard targeting must use the swapped Technique's live target relation rather
  // than the old one-tile Basic Attack helper. The first legal direction previews; pressing that
  // same direction again commits through the exact same Confirm Action path as mouse input.
  let attackDirection: string | null = null
  for (const key of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
    await page.keyboard.press(key)
    try {
      await expect(commandContext).toContainText('Hit ', { timeout: 1500 })
      attackDirection = key
      break
    } catch {
      // Try the next cardinal direction until the current battle layout yields a legal enemy.
    }
  }

  expect(attackDirection).not.toBeNull()
  await expect(commandContext).toContainText('Forceful Strike')
  await expect(commandContext).toContainText(/Hit \d+%/)
  await expect(commandContext).toContainText(/On hit \d+ dmg/)
  const confirmAction = page.getByRole('button', { name: /Confirm Action/ })
  await expect(confirmAction).toBeEnabled()

  await page.keyboard.press(attackDirection!)
  await expect(confirmAction).toBeDisabled({ timeout: 8000 })
  await expect(attackAction).not.toHaveAttribute('data-battle-active', 'true', { timeout: 8000 })

  // Space still enters final-facing authority, but its retired inline control row must remain
  // visually hidden so it cannot draw guide lines across the command cards.
  await page.keyboard.press('Space')
  const legacyFacingRow = page.locator('[data-unified-facing-pad="true"]')
  await expect(legacyFacingRow).toHaveAttribute('data-open', '')
  await expect(legacyFacingRow).toBeHidden()
})
