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

test('Profile equips a mastered Secondary with an independent attunement lock', async ({
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
  const maxHp = page.getByTestId('derived-stat-maxHp').locator('strong')
  const maxHpBeforeSecondary = await maxHp.innerText()
  await expect(panel).toContainText('Vanguard · Pure')
  await expect(panel).toContainText('Build v1')

  await page.getByRole('button', { name: /Manage Primary Discipline/ }).click()
  const primary = page.getByLabel('Proposed Primary')
  const secondary = page.getByLabel('Proposed Secondary')
  await expect(primary).toBeEnabled()
  await expect(secondary).toBeEnabled()
  await expect(secondary.locator('option[value="aetherist"]')).toHaveText('Aetherist')
  await expect(page.getByTestId('secondary-attunement-status')).toContainText('Secondary ready')

  await secondary.selectOption('aetherist')
  const preview = page.getByTestId('primary-build-preview')
  await expect(preview).toBeVisible()
  await expect(preview).toContainText('Vanguard + Aetherist')
  await expect(preview).toContainText('Secondary contributes no second base-stat profile')
  await expect(preview).toContainText('Previewing starts no timer')
  await expect(page.getByTestId('secondary-attunement-status')).toContainText('Secondary ready')

  await page.getByRole('button', { name: 'Commit Discipline changes' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Aetherist is now the committed Secondary Discipline.',
  )
  await expect(panel).toContainText('Vanguard + Aetherist')
  await expect(panel).toContainText('Build v2')
  await expect(maxHp).toHaveText(maxHpBeforeSecondary)
  await expect(secondary).toBeDisabled()
  await expect(primary).toBeEnabled()
  await expect(page.getByTestId('secondary-attunement-status')).toContainText('Secondary locked')
  await expect(page.getByTestId('primary-attunement-status')).toContainText('Primary ready')

  await primary.selectOption('lifebinder')
  await expect(preview).toBeVisible()
  await expect(preview).toContainText('Lifebinder + Aetherist')
  await page.getByRole('button', { name: 'Commit Lifebinder as Primary' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Lifebinder is now the committed Primary Discipline.',
  )
  await expect(panel).toContainText('Lifebinder + Aetherist')
  await expect(panel).toContainText('Build v3')
  await expect(primary).toBeDisabled()
  await expect(secondary).toBeDisabled()
  await expect(page.getByTestId('primary-attunement-status')).toContainText('Primary locked')
  await expect(page.getByTestId('secondary-attunement-status')).toContainText('Secondary locked')

  await page.reload()
  await expect(panel).toContainText('Lifebinder + Aetherist')
  await expect(panel).toContainText('Build v3')
  await page.getByRole('button', { name: /Manage Primary Discipline/ }).click()
  await expect(page.getByLabel('Proposed Primary')).toBeDisabled()
  await expect(page.getByLabel('Proposed Secondary')).toBeDisabled()
})
