import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Secondary ${letters}`
}

async function recordMastery(characterId: string, disciplineId: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl || !secretKey) {
    throw new Error('Local Supabase admin credentials are required for the P3.2 browser proof.')
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: masteryError } = await admin.rpc('record_character_discipline_mastery_v1', {
    p_character_id: characterId,
    p_discipline_id: disciplineId,
    p_source_kind: 'system',
    p_source_id: 'browser-proof.p3.2',
  })
  if (masteryError) throw masteryError
}

test('Nexus equips a mastered Secondary with independent attunement authority', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One authenticated Chromium proof covers the P3.2 Secondary authority flow.',
  )

  const slug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const characterName = uniqueCharacterName()
  await provisionAccountAndEnterCharacter({
    page,
    email: `p32-secondary-${slug}-${Date.now()}@example.com`,
    password: 'P32-secondary-build-2026!',
    characterName,
  })

  const selectedCharacterCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'aurevane_selected_character',
  )
  if (!selectedCharacterCookie) {
    throw new Error('The selected character cookie is unavailable for the P3.2 browser proof.')
  }

  await recordMastery(selectedCharacterCookie.value, 'aetherist')
  await page.reload()

  const maxHpBeforeSecondary = await page
    .getByTestId('derived-stat-maxHp')
    .locator('strong')
    .innerText()

  await page.goto('/game/nexus')
  await expect(page.locator('[data-arsenal-workspace]')).toBeVisible()

  const panel = page.getByTestId('primary-build-panel')
  const launcher = panel.getByRole('button', { name: /Manage Disciplines/ })
  const primaryDisciplineChip = page.getByTestId('primary-discipline-chip')
  const secondaryDisciplineChip = page.getByTestId('secondary-discipline-chip')
  const maxHp = page.locator('[data-character-resource="hp"] b')

  await expect(launcher).toHaveText(/Manage Disciplines/)
  await expect(primaryDisciplineChip).toHaveText('Vanguard')

  await launcher.click()
  const dialog = page.getByRole('dialog', { name: 'Discipline Management' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Currently Committed')
  await expect(dialog).toContainText('Vanguard')
  await expect(dialog).toContainText('Secondary Discipline')
  await expect(dialog).toContainText('Locked')

  const primarySelect = dialog.getByLabel('Primary Discipline')
  const secondarySelect = dialog.getByLabel('Secondary Discipline')

  await expect(primarySelect).toBeEnabled()
  await expect(secondarySelect).toBeEnabled()
  await expect(secondarySelect.locator('option[value=""]')).toHaveText('None')
  await expect(secondarySelect.locator('option[value="aetherist"]')).toHaveText('Aetherist')
  await expect(secondarySelect.locator('option[value="vanguard"]')).toHaveCount(0)

  await secondarySelect.selectOption('aetherist')
  const preview = dialog.locator('[aria-label="Discipline stat preview"]')
  await expect(preview).toBeVisible()
  await expect(preview).toContainText('Preview Secondary')
  await expect(preview).toContainText('Aetherist')

  await dialog.getByRole('button', { name: /Confirm Change/ }).click()
  await expect(page.getByRole('status')).toContainText('Discipline changes committed.')
  await expect(launcher).toHaveText(/Manage Disciplines/)
  await expect(primaryDisciplineChip).toHaveText('Vanguard')
  await expect(secondaryDisciplineChip).toHaveText('Aetherist')
  await expect(maxHp).toContainText(maxHpBeforeSecondary)

  await primarySelect.selectOption('lifebinder')
  await expect(preview).toContainText('Preview Primary')
  await expect(preview).toContainText('Lifebinder')

  await dialog.getByRole('button', { name: /Confirm Change/ }).click()
  await expect(page.getByRole('status')).toContainText('Discipline changes committed.')
  await expect(primaryDisciplineChip).toHaveText('Lifebinder')
  await expect(secondaryDisciplineChip).toHaveText('Aetherist')

  await page.reload()
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Lifebinder')
  await expect(dialog).toContainText('Aetherist')
  await expect(primarySelect).toBeEnabled()
  await expect(secondarySelect).toBeEnabled()

  await page.goto('/game/character')
  await expect(page.getByText('Resonance Build', { exact: true })).toBeVisible()
})

test('mobile Character keeps its portrait readable and Nexus centers Discipline Management', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-chromium',
    'This proof targets the mobile Profile and modal layout.',
  )

  const characterName = uniqueCharacterName()
  await provisionAccountAndEnterCharacter({
    page,
    email: `profile-mobile-polish-${Date.now()}@example.com`,
    password: 'Profile-mobile-polish-2026!',
    characterName,
  })

  const profile = page.getByTestId('character-profile')
  const portrait = profile.locator('.character-portrait-media').locator('..')
  await expect(portrait).toBeVisible()
  const portraitBox = await portrait.boundingBox()
  if (!portraitBox) throw new Error('Character portrait geometry is unavailable')
  expect(Math.abs(portraitBox.width - portraitBox.height)).toBeLessThanOrEqual(1)
  await expect(page.locator('[data-character-resource="hp"]')).toBeVisible()
  await expect(page.locator('[data-character-resource="mp"]')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  )

  await page.goto('/game/nexus')
  await expect(page.locator('[data-arsenal-workspace]')).toBeVisible()
  const launcher = page
    .getByTestId('primary-build-panel')
    .getByRole('button', { name: /Manage Disciplines/ })
  await launcher.click()
  const dialog = page.getByRole('dialog', { name: 'Discipline Management' })
  await expect(dialog).toBeVisible()

  const dialogBox = await dialog.boundingBox()
  const viewport = page.viewportSize()
  if (!dialogBox || !viewport) {
    throw new Error('The mobile Discipline dialog geometry is unavailable.')
  }
  expect(dialogBox.x).toBeGreaterThanOrEqual(0)
  expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(dialogBox.y).toBeGreaterThanOrEqual(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    viewport.width + 1,
  )
})
