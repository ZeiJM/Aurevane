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

test('Profile equips a mastered Secondary with independent attunement authority', async ({
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

  const panel = page.getByTestId('primary-build-panel')
  const launcher = panel.getByRole('button', { name: /Manage Primary Discipline/ })
  const disciplineBuildLabel = page.locator('#build-disciplines-heading').locator('..').locator('strong')
  const maxHp = page.getByTestId('derived-stat-maxHp').locator('strong')
  const maxHpBeforeSecondary = await maxHp.innerText()
  await expect(launcher).toHaveText('Discipline Management')
  await expect(disciplineBuildLabel).toHaveText('Vanguard')

  await launcher.click()
  const dialog = page.getByRole('dialog', { name: 'Discipline Management' })
  const primary = dialog
    .locator('label')
    .filter({ hasText: /^Proposed Primary/ })
    .locator('select')
  const secondary = dialog
    .locator('label')
    .filter({ hasText: /^Proposed Secondary/ })
    .locator('select')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Committed Primary')
  await expect(dialog).toContainText('Vanguard')
  await expect(dialog).not.toContainText('Committed Secondary')
  await expect(dialog.locator('[aria-label="Choose a proposed Primary"]')).toHaveCount(0)
  await expect(primary).toBeEnabled()
  await expect(secondary).toBeEnabled()
  await expect(secondary.locator('option[value=""]')).toHaveText('None')
  await expect(secondary.locator('option[value="aetherist"]')).toHaveText('Aetherist')
  await expect(secondary.locator('option[value="vanguard"]')).toHaveCount(0)
  await expect(page.getByTestId('secondary-attunement-status')).toHaveCount(0)

  await secondary.selectOption('aetherist')
  await expect(primary.locator('option[value="aetherist"]')).toHaveCount(0)
  const preview = page.getByTestId('primary-build-preview')
  await expect(preview).toBeVisible()
  await expect(preview).toContainText('Vanguard + Aetherist')
  await expect(preview).not.toContainText('Build v1')
  await expect(preview).toContainText('Core stats')
  await expect(preview).toContainText('Adventure stats')
  await expect(preview).not.toContainText('Personal allocation is preserved')
  await expect(page.getByTestId('secondary-attunement-status')).toHaveCount(0)

  await page.getByRole('button', { name: 'Commit Discipline changes' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Aetherist is now the committed Secondary Discipline.',
  )
  await expect(launcher).toHaveText('Discipline Management')
  await expect(disciplineBuildLabel).toHaveText('Vanguard + Aetherist')
  await expect(maxHp).toHaveText(maxHpBeforeSecondary)
  await expect(secondary).toBeEnabled()
  await expect(primary).toBeEnabled()
  await expect(page.getByTestId('secondary-attunement-status')).toHaveCount(0)
  await expect(page.getByTestId('primary-attunement-status')).toHaveCount(0)

  await primary.selectOption('lifebinder')
  await expect(preview).toBeVisible()
  await expect(preview).toContainText('Lifebinder + Aetherist')
  await expect(preview).not.toContainText('Build v2')
  await page.getByRole('button', { name: 'Commit Lifebinder as Primary' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Lifebinder is now the committed Primary Discipline.',
  )
  await expect(launcher).toHaveText('Discipline Management')
  await expect(disciplineBuildLabel).toHaveText('Lifebinder + Aetherist')
  await expect(primary).toBeEnabled()
  await expect(secondary).toBeEnabled()
  await expect(page.getByTestId('primary-attunement-status')).toHaveCount(0)
  await expect(page.getByTestId('secondary-attunement-status')).toHaveCount(0)

  await page.reload()
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Committed Primary')
  await expect(dialog).toContainText('Lifebinder')
  await expect(dialog).toContainText('Committed Secondary')
  await expect(dialog).toContainText('Aetherist')
  await expect(primary).toBeEnabled()
  await expect(secondary).toBeEnabled()
})
