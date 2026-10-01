import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import { expect, test, type Locator } from '@playwright/test'

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

async function expectAttributeCardsAndPortraitName(dialog: Locator, characterName: string) {
  const portraitPanel = dialog.getByTestId('attribute-redistribution-portrait').locator('..')
  const name = portraitPanel.getByText(characterName, { exact: true })
  await expect(name).toBeVisible()
  const panelBox = await portraitPanel.boundingBox()
  const nameBox = await name.boundingBox()
  expect(panelBox).not.toBeNull()
  expect(nameBox).not.toBeNull()
  expect(nameBox!.x).toBeGreaterThanOrEqual(panelBox!.x)
  expect(nameBox!.x + nameBox!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width)
  expect(nameBox!.y).toBeGreaterThanOrEqual(panelBox!.y)
  expect(nameBox!.y + nameBox!.height).toBeLessThanOrEqual(panelBox!.y + panelBox!.height)
  expect(
    Math.abs(nameBox!.x + nameBox!.width / 2 - (panelBox!.x + panelBox!.width / 2)),
    'the character name centers inside the portrait panel',
  ).toBeLessThanOrEqual(1)
  expect(await name.evaluate((element) => getComputedStyle(element).textAlign)).toBe('center')
  const cards = dialog.locator('[data-focus]')
  await expect(cards).toHaveCount(6)
  const metrics = await cards.evaluateAll((elements) =>
    elements.map((element) => ({
      box: element.getBoundingClientRect().toJSON(),
      border: getComputedStyle(element).borderTopWidth,
      contentFits: element.scrollWidth <= element.clientWidth + 1,
    })),
  )
  for (const [index, card] of metrics.entries()) {
    expect(card.box.width).toBeGreaterThan(0)
    expect(card.box.height).toBeGreaterThan(0)
    expect(parseFloat(card.border), 'each attribute has its own card boundary').toBeGreaterThan(0)
    expect(card.contentFits).toBe(true)
    for (const other of metrics.slice(index + 1)) {
      const horizontalGap = Math.max(
        card.box.left - other.box.right,
        other.box.left - card.box.right,
      )
      const verticalGap = Math.max(card.box.top - other.box.bottom, other.box.top - card.box.bottom)
      expect(
        Math.max(horizontalGap, verticalGap),
        'stat cards have clear space between them',
      ).toBeGreaterThanOrEqual(8)
    }
  }
  for (const label of ['Might', 'Finesse', 'Vitality', 'Agility', 'Intellect', 'Resolve']) {
    const card = cards.filter({ hasText: label })
    await expect(card).toHaveCount(1)
    await expect(card).toContainText(label)
    await expect(card.getByRole('button', { name: `Increase ${label}`, exact: true })).toBeVisible()
  }
}

test('level-up forces Core Stat allocation until every gained point is committed', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One authenticated Chromium proof covers forced level-up Core Stat allocation.',
  )

  const characterName = uniqueCharacterName()
  await provisionAccountAndEnterCharacter({
    page,
    email: `level-up-attributes-${Date.now()}@example.com`,
    password: 'Level-up-attributes-2026!',
    characterName,
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
  const remaining = dialog.locator('[aria-live="polite"]')
  await expect(dialog).toBeVisible()
  await expectAttributeCardsAndPortraitName(dialog, characterName)
  await expect(dialog).toContainText('Level gained')
  await expect(dialog).toContainText('Cap 60')
  await expect(dialog).toContainText('Cap 40')
  await expect(dialog).not.toContainText('Primary focus')
  const lowerArt = dialog.getByTestId('attribute-redistribution-lower-art')
  await expect(dialog.getByText('A sharper mind.', { exact: true })).toBeVisible()
  await expect(lowerArt).toBeVisible()
  await expect(lowerArt.locator('img')).toBeVisible()
  await expect(dialog.getByTestId('attribute-redistribution-atmosphere')).toBeVisible()

  const lowerArtBox = await lowerArt.boundingBox()
  const quoteBox = await dialog.getByText('A sharper mind.', { exact: true }).boundingBox()
  expect(lowerArtBox).not.toBeNull()
  expect(quoteBox).not.toBeNull()
  expect(quoteBox!.y).toBeGreaterThanOrEqual(lowerArtBox!.y)

  const portraitFrame = dialog.getByTestId('attribute-redistribution-portrait')
  const portraitBox = await portraitFrame.boundingBox()
  expect(portraitBox).not.toBeNull()
  expect(
    Math.abs(portraitBox!.width - portraitBox!.height),
    'The redistribution portrait remains square',
  ).toBeLessThanOrEqual(2)

  await expect(remaining.locator('strong')).toHaveText('1')
  await expect(remaining.locator('span')).toHaveText('point remaining')
  await expect(dialog.getByRole('button', { name: 'Close' })).toHaveCount(0)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await backdrop.dispatchEvent('pointerdown')
  await expect(dialog).toBeVisible()

  await dialog.getByRole('button', { name: 'Increase Might' }).click()
  await expect(remaining.locator('strong')).toHaveText('0')
  await expect(remaining.locator('span')).toHaveText('points remaining')
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
  await page.getByRole('button', { name: 'Reset Stats', exact: true }).click()
  const reset = page.getByRole('dialog', { name: 'Redistribute Attributes', exact: true })
  await expect(reset).toBeVisible()
  await expectAttributeCardsAndPortraitName(reset, characterName)
  const railPortrait = page.locator('[data-av-game-rail] [data-character-portrait-frame]')
  const railName = page.locator('[data-av-game-rail] [data-character-identity-copy] > strong')
  const resetPortrait = reset.getByTestId('attribute-redistribution-portrait')
  const portraitMetrics = await Promise.all([
    railPortrait.boundingBox(),
    railName.boundingBox(),
    resetPortrait.boundingBox(),
  ])
  await testInfo.attach('reset-navigation-portrait-sizing.json', {
    body: JSON.stringify(portraitMetrics, null, 2),
    contentType: 'application/json',
  })
  await testInfo.attach('reset-navigation-portrait-sizing.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  const [railBox, nameBox, resetBox] = portraitMetrics
  if (!railBox || !nameBox || !resetBox) throw new Error('Portrait sizing is unavailable')
  expect(
    Math.abs(railBox.x - nameBox.x),
    'rail portrait starts in line with the name',
  ).toBeLessThanOrEqual(1)
  expect(
    Math.abs(railBox.width - resetBox.width),
    'reset and navigation portraits have equal width',
  ).toBeLessThanOrEqual(1)
  expect(
    Math.abs(railBox.height - resetBox.height),
    'reset and navigation portraits have equal height',
  ).toBeLessThanOrEqual(1)
  for (const label of ['Might', 'Finesse', 'Vitality', 'Agility', 'Intellect', 'Resolve']) {
    await expect(
      reset.getByRole('button', { name: `Decrease ${label}`, exact: true }),
    ).toBeVisible()
  }
  await reset.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByTestId('profile-attribute-might').locator('strong')).toHaveText(
    String(mightBefore + 1),
  )
})
