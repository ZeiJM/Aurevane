import { expect, test } from '@playwright/test'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Wayfarer ${letters}`
}

test('swaps the equipped Heal skill without changing the cockpit slot', async ({
  page,
}, testInfo) => {
  test.slow()

  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `skill-slot-${projectSlug}-${Date.now()}@example.com`
  const password = 'Skill-slot-browser-2026!'
  const characterName = uniqueCharacterName()

  await createAccountAndEnterCharacter({ page, email, password, characterName })

  await page.getByRole('button', { name: 'Navigation' }).click()
  await page.getByRole('link', { name: /Battle Hall/ }).click()
  await expect(page).toHaveURL(/\/game\/battle$/)

  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const commandDeck = page.getByRole('region', { name: 'Command Deck' })
  const healCard = commandDeck.locator('[data-command-card="recover"]')
  const healAction = healCard.locator('button[data-battle-command="recover"]')
  const healArtwork = healCard.getByRole('button', { name: /Choose Heal skill/i })

  await expect(healAction).toContainText('HP Recovery')
  await expect(healAction).toContainText('50 AP')
  const slotHotkeyBefore = await healAction.locator(':scope > span').textContent()

  const cardGeometry = await healCard.evaluate((card) => {
    const action = card.querySelector<HTMLElement>('[data-battle-command="recover"]')
    const hotkey = action?.querySelector<HTMLElement>(':scope > span')
    const label = action?.querySelector<HTMLElement>(':scope > strong')
    const cost = action?.querySelector<HTMLElement>(':scope > small')
    const artwork = card.querySelector<HTMLElement>('button[aria-haspopup="listbox"]')
    const image = artwork?.querySelector<HTMLImageElement>('img')
    if (!action || !hotkey || !label || !cost || !artwork || !image) return null

    const actionRect = action.getBoundingClientRect()
    const hotkeyRect = hotkey.getBoundingClientRect()
    const labelRect = label.getBoundingClientRect()
    const costRect = cost.getBoundingClientRect()
    const artworkRect = artwork.getBoundingClientRect()
    const imageRect = image.getBoundingClientRect()
    return {
      actionLeft: actionRect.left,
      hotkeyDisplay: getComputedStyle(hotkey).display,
      hotkeyLeft: hotkeyRect.left,
      hotkeyTop: hotkeyRect.top,
      hotkeyBottom: hotkeyRect.bottom,
      labelLeft: labelRect.left,
      labelTop: labelRect.top,
      labelBottom: labelRect.bottom,
      costLeft: costRect.left,
      costTop: costRect.top,
      costBottom: costRect.bottom,
      artworkWidth: artworkRect.width,
      artworkHeight: artworkRect.height,
      imageWidth: imageRect.width,
      imageHeight: imageRect.height,
      artworkCenterX: (artworkRect.left + artworkRect.right) / 2,
      artworkCenterY: (artworkRect.top + artworkRect.bottom) / 2,
      imageCenterX: (imageRect.left + imageRect.right) / 2,
      imageCenterY: (imageRect.top + imageRect.bottom) / 2,
    }
  })

  expect(cardGeometry).not.toBeNull()
  if (!cardGeometry) return
  expect(cardGeometry.labelLeft).toBeGreaterThan(cardGeometry.actionLeft)
  expect(Math.abs(cardGeometry.labelLeft - cardGeometry.costLeft)).toBeLessThanOrEqual(1)
  expect(cardGeometry.imageWidth).toBeGreaterThanOrEqual(cardGeometry.artworkWidth - 2)
  expect(cardGeometry.imageHeight).toBeGreaterThanOrEqual(cardGeometry.artworkHeight - 2)
  expect(
    Math.abs(cardGeometry.imageCenterX - cardGeometry.artworkCenterX),
  ).toBeLessThanOrEqual(1)
  expect(
    Math.abs(cardGeometry.imageCenterY - cardGeometry.artworkCenterY),
  ).toBeLessThanOrEqual(1)

  if (testInfo.project.name === 'mobile-chromium') {
    expect(cardGeometry.hotkeyDisplay).toBe('none')
    expect(cardGeometry.labelBottom).toBeLessThanOrEqual(cardGeometry.costTop + 1)
  } else {
    expect(cardGeometry.hotkeyDisplay).not.toBe('none')
    expect(Math.abs(cardGeometry.hotkeyLeft - cardGeometry.labelLeft)).toBeLessThanOrEqual(1)
    expect(cardGeometry.hotkeyBottom).toBeLessThanOrEqual(cardGeometry.labelTop)
    expect(cardGeometry.labelBottom).toBeLessThanOrEqual(cardGeometry.costTop)
  }

  const initialImage = healArtwork.locator('img')
  await expect(initialImage).toHaveAttribute('src', '/media/skills/hp-recovery.jpg')
  await expect
    .poll(() =>
      initialImage.evaluate(
        (image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
      ),
    )
    .toBe(true)

  await healArtwork.click()
  const selector = page.getByRole('listbox', { name: 'Heal skills' })
  await expect(selector).toBeVisible()
  await expect(selector.getByRole('option', { name: /HP Recovery/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )

  await selector.getByRole('option', { name: /MP Recovery/ }).click()
  await expect(selector).toBeHidden()
  await expect(healAction).toContainText('MP Recovery')
  await expect(healAction).toContainText('50 AP')
  await expect(healAction.locator(':scope > span')).toHaveText(slotHotkeyBefore ?? '')
  await expect(healArtwork).toHaveAttribute('aria-label', /MP Recovery selected/i)

  const mpImage = healArtwork.locator('img')
  await expect(mpImage).toHaveAttribute('src', '/media/skills/mp-recovery.jpg')
  await expect
    .poll(() =>
      mpImage.evaluate(
        (image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
      ),
    )
    .toBe(true)

  await healArtwork.click()
  await page.getByRole('option', { name: /HP Recovery/ }).click()
  await expect(healAction).toContainText('HP Recovery')
  await expect(healAction.locator(':scope > span')).toHaveText(slotHotkeyBefore ?? '')
})
