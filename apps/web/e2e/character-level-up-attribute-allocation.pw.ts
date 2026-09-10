import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Levelup ${letters}`
}

async function grantLevelUp(characterId: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl || !secretKey) {
    throw new Error('Local Supabase admin credentials are required for the level-up browser proof.')
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const idempotencyKey = randomUUID()
  const { error } = await admin.rpc('grant_character_xp_v1', {
    p_character_id: characterId,
    p_idempotency_key: idempotencyKey,
    p_request_fingerprint: `browser.level-up:${idempotencyKey}`,
    p_authority_key: 'system:browser-level-up-proof',
    p_source_kind: 'system',
    p_source_id: 'browser.level-up-proof',
    p_reason_tag: 'progression.level-up-proof',
    p_amount: 100,
  })

  if (error) throw error
}

test('level-up forces Core Stat allocation until every gained point is committed', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One authenticated Chromium proof covers forced level-up Core Stat allocation.',
  )

  await provisionAccountAndEnterCharacter({
    page,
    email: `level-up-attributes-${Date.now()}@example.com`,
    password: 'Level-up-attributes-2026!',
    characterName: uniqueCharacterName(),
  })

  const selectedCharacterCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'aurevane_selected_character',
  )
  if (!selectedCharacterCookie) {
    throw new Error('The selected character cookie is unavailable for the level-up browser proof.')
  }

  const might = page.getByTestId('profile-attribute-might').locator('strong')
  const mightBefore = Number(await might.innerText())

  await grantLevelUp(selectedCharacterCookie.value)
  await page.reload()

  const dialog = page.getByRole('dialog', { name: 'Spend Core Stat Points' })
  const backdrop = page.getByTestId('attribute-allocation-backdrop')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Level gained')
  await expect(dialog).toContainText('1 point remaining')
  await expect(dialog.getByRole('button', { name: 'Close' })).toHaveCount(0)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await backdrop.dispatchEvent('pointerdown')
  await expect(dialog).toBeVisible()

  await dialog.getByRole('button', { name: 'Increase Might' }).click()
  await expect(dialog).toContainText('0 points remaining')
  const commit = dialog.getByRole('button', { name: 'Commit Attribute Points' })
  await expect(commit).toBeEnabled()
  await commit.click()

  await expect(dialog).toHaveCount(0)
  await expect(might).toHaveText(String(mightBefore + 1))

  await page.reload()
  await expect(page.getByRole('dialog', { name: 'Spend Core Stat Points' })).toHaveCount(0)
  await expect(page.getByTestId('profile-attribute-might').locator('strong')).toHaveText(
    String(mightBefore + 1),
  )
})
