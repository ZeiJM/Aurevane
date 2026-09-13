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

function expectNear(left: number, right: number): void {
  expect(Math.abs(left - right)).toBeLessThanOrEqual(1)
}

function expectOpticallyNear(left: number, right: number): void {
  expect(Math.abs(left - right)).toBeLessThanOrEqual(2)
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
  await page
    .getByRole('navigation', { name: 'Game navigation', exact: true })
    .getByRole('link', { name: /Battle Hall/ })
    .click()
  await expect(page).toHaveURL(/\/game\/battle$/)

  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const commandDeck = page.getByRole('region', { name: 'Command Deck' })
  const inspectCard = commandDeck.locator('[data-command-card="inspect"]')
  const inspectAction = inspectCard.locator('button[data-battle-command="inspect"]')
  const healCard = commandDeck.locator('[data-command-card="recover"]')
  const healAction = healCard.locator('button[data-battle-command="recover"]')
  const healArtwork = healCard.getByRole('button', { name: /Choose Heal skill/i })

  for (const [slot, src] of [
    ['inspect', '/media/skills/inspect.webp'],
    ['move', '/media/skills/move.webp'],
    ['attack', '/media/skills/basic-attack-fist.webp'],
    ['guard', '/media/skills/guard.webp'],
    ['recover', '/media/skills/hp-recovery.webp'],
    ['finish', '/media/skills/finish-turn.webp'],
  ] as const) {
    await expect(
      commandDeck.locator(`[data-command-card="${slot}"] [data-battle-command-artwork] img`),
    ).toHaveJSProperty('src', new URL(src, page.url()).href)
  }
  await expect(healAction).toContainText('HP Recovery')
  await expect(healAction).toContainText('50 AP')
  const slotHotkeyBefore = await healAction
    .locator(':scope > [data-battle-command-hotkey]')
    .textContent()

  const cardGeometry = await healCard.evaluate((card) => {
    const action = card.querySelector<HTMLElement>('[data-battle-command="recover"]')
    const hotkey = action?.querySelector<HTMLElement>(':scope > [data-battle-command-hotkey]')
    const label = action?.querySelector<HTMLElement>(':scope > strong')
    const cost = action?.querySelector<HTMLElement>(':scope > small')
    if (!action || !hotkey || !label || !cost) return null

    const actionRect = action.getBoundingClientRect()
    const hotkeyRect = hotkey.getBoundingClientRect()
    const labelRect = label.getBoundingClientRect()
    const costRect = cost.getBoundingClientRect()
    return {
      actionLeft: actionRect.left,
      actionRight: actionRect.right,
      hotkeyDisplay: getComputedStyle(hotkey).display,
      hotkeyLeft: hotkeyRect.left,
      hotkeyBottom: hotkeyRect.bottom,
      labelLeft: labelRect.left,
      labelTop: labelRect.top,
      labelBottom: labelRect.bottom,
      labelTextAlign: getComputedStyle(label).textAlign,
      costLeft: costRect.left,
      costTop: costRect.top,
      costTextAlign: getComputedStyle(cost).textAlign,
    }
  })

  expect(cardGeometry).not.toBeNull()
  if (!cardGeometry) return
  expect(cardGeometry.labelLeft).toBeGreaterThan(cardGeometry.actionLeft)
  expectNear(cardGeometry.labelLeft, cardGeometry.costLeft)
  const expectedAlignment = 'left'
  expect(cardGeometry.labelTextAlign).toBe(expectedAlignment)
  expect(cardGeometry.costTextAlign).toBe(expectedAlignment)
  expect(cardGeometry.costTop - cardGeometry.labelBottom).toBeLessThanOrEqual(8)

  if (testInfo.project.name === 'mobile-chromium') {
    expect(cardGeometry.hotkeyDisplay).toBe('none')
    expect(cardGeometry.labelBottom).toBeLessThanOrEqual(cardGeometry.costTop + 1)
  } else {
    expect(cardGeometry.hotkeyDisplay).not.toBe('none')
    expect(cardGeometry.hotkeyLeft).toBeGreaterThan(cardGeometry.actionLeft)
    expect(cardGeometry.hotkeyLeft).toBeLessThan(cardGeometry.actionLeft + 16)
    expect(cardGeometry.hotkeyBottom).toBeLessThanOrEqual(cardGeometry.labelTop)
    expect(cardGeometry.labelBottom).toBeLessThanOrEqual(cardGeometry.costTop)
  }

  const artworkGeometries = await commandDeck.locator('[data-command-card]').evaluateAll((cards) =>
    cards.map((card) => {
      const artwork = card.querySelector<HTMLElement>('[data-battle-command-artwork]')
      const image = artwork?.querySelector<HTMLImageElement>('img')
      if (!artwork || !image) return null
      const artworkRect = artwork.getBoundingClientRect()
      const imageRect = image.getBoundingClientRect()
      return {
        slot: card.getAttribute('data-command-card'),
        artworkWidth: artworkRect.width,
        cardRect: card.getBoundingClientRect().toJSON(),
        artworkRect: artworkRect.toJSON(),
        textRects: [
          ...card.querySelectorAll(
            'button[data-battle-command] > strong, button[data-battle-command] > small, [data-battle-skill-tags="command"] > span',
          ),
        ].map((text) => text.getBoundingClientRect().toJSON()),
        artworkHeight: artworkRect.height,
        imageWidth: imageRect.width,
        imageHeight: imageRect.height,
        artworkCenterX: (artworkRect.left + artworkRect.right) / 2,
        artworkCenterY: (artworkRect.top + artworkRect.bottom) / 2,
        imageCenterX: (imageRect.left + imageRect.right) / 2,
        imageCenterY: (imageRect.top + imageRect.bottom) / 2,
      }
    }),
  )

  for (const geometry of artworkGeometries) {
    expect(geometry, 'Every command card should expose artwork geometry.').not.toBeNull()
    if (!geometry) continue
    const minimumArtworkSize = testInfo.project.name === 'mobile-chromium' ? 52 : 64
    expect(
      geometry.artworkWidth,
      `${geometry.slot} artwork must remain prominent.`,
    ).toBeGreaterThanOrEqual(minimumArtworkSize)
    expectOpticallyNear(geometry.artworkWidth, artworkGeometries[0]!.artworkWidth)
    expectOpticallyNear(geometry.artworkHeight, artworkGeometries[0]!.artworkHeight)
    expect(geometry.artworkHeight).toBeGreaterThanOrEqual(
      testInfo.project.name === 'mobile-chromium' ? 52 : 60,
    )
    expect(geometry.artworkRect.right).toBeLessThanOrEqual(geometry.cardRect.right)
    expect(geometry.artworkRect.bottom).toBeLessThanOrEqual(geometry.cardRect.bottom)
    expect(
      geometry.textRects[1]!.top,
      `${geometry.slot} cost or hint must stay below its name.`,
    ).toBeGreaterThanOrEqual(geometry.textRects[0]!.bottom)
    for (const text of geometry.textRects) {
      expect(
        text.right <= geometry.artworkRect.left ||
          text.left >= geometry.artworkRect.right ||
          text.bottom <= geometry.artworkRect.top ||
          text.top >= geometry.artworkRect.bottom,
        `${geometry.slot} text must not overlap its artwork.`,
      ).toBe(true)
    }
    expect(
      geometry.imageWidth,
      `${geometry.slot} artwork should fit inside its frame.`,
    ).toBeLessThanOrEqual(geometry.artworkWidth * 1.06)
    expect(
      geometry.imageHeight,
      `${geometry.slot} artwork should fit inside its frame.`,
    ).toBeLessThanOrEqual(geometry.artworkHeight * 1.06)
    expect(geometry.imageWidth).toBeGreaterThan(geometry.artworkWidth - 6)
    expect(geometry.imageHeight).toBeGreaterThan(geometry.artworkHeight - 6)
    expectOpticallyNear(geometry.imageCenterX, geometry.artworkCenterX)
    expectOpticallyNear(geometry.imageCenterY, geometry.artworkCenterY)
  }

  const inspectGeometry = await inspectCard.evaluate((card) => {
    const action = card.querySelector<HTMLElement>('button[data-battle-command="inspect"]')
    const artwork = card.querySelector<HTMLElement>('[data-battle-command-artwork="static"]')
    const image = artwork?.querySelector<HTMLImageElement>('img')
    if (!action || !artwork || !image) return null
    const actionRect = action.getBoundingClientRect()
    const artworkRect = artwork.getBoundingClientRect()
    const imageRect = image.getBoundingClientRect()
    return {
      pointerEvents: getComputedStyle(artwork).pointerEvents,
      actionLeft: actionRect.left,
      actionTop: actionRect.top,
      actionRight: actionRect.right,
      actionBottom: actionRect.bottom,
      artworkCenterX: (artworkRect.left + artworkRect.right) / 2,
      artworkCenterY: (artworkRect.top + artworkRect.bottom) / 2,
      imageCenterX: (imageRect.left + imageRect.right) / 2,
      imageCenterY: (imageRect.top + imageRect.bottom) / 2,
    }
  })

  expect(inspectGeometry).not.toBeNull()
  if (!inspectGeometry) return
  expect(inspectGeometry.pointerEvents).toBe('none')
  expectOpticallyNear(inspectGeometry.imageCenterX, inspectGeometry.artworkCenterX)
  expectOpticallyNear(inspectGeometry.imageCenterY, inspectGeometry.artworkCenterY)
  expect(inspectGeometry.artworkCenterX).toBeGreaterThan(inspectGeometry.actionLeft)
  expect(inspectGeometry.artworkCenterX).toBeLessThan(inspectGeometry.actionRight)
  expect(inspectGeometry.artworkCenterY).toBeGreaterThan(inspectGeometry.actionTop)
  expect(inspectGeometry.artworkCenterY).toBeLessThan(inspectGeometry.actionBottom)

  if (testInfo.project.name === 'mobile-chromium') {
    const mobileCardRects = await commandDeck.locator('[data-command-card]').evaluateAll((cards) =>
      cards.map((card) => {
        const rect = card.getBoundingClientRect()
        return {
          slot: card.getAttribute('data-command-card'),
          width: rect.width,
          height: rect.height,
        }
      }),
    )
    const inspectRect = mobileCardRects.find((rect) => rect.slot === 'inspect')
    const moveRect = mobileCardRects.find((rect) => rect.slot === 'move')
    expect(inspectRect).toBeDefined()
    expect(moveRect).toBeDefined()
    if (inspectRect && moveRect) {
      expectNear(inspectRect.width, moveRect.width)
      expectNear(inspectRect.height, moveRect.height)
    }
  }

  await inspectAction.click({
    position: {
      x: inspectGeometry.artworkCenterX - inspectGeometry.actionLeft,
      y: inspectGeometry.artworkCenterY - inspectGeometry.actionTop,
    },
  })
  await expect(inspectAction).toHaveAttribute('data-battle-active', 'true')

  await healCard.getByRole('button', { name: 'About HP Recovery', exact: true }).click()
  const info = page.getByRole('dialog', { name: 'HP Recovery', exact: true })
  await expect(info).toBeVisible()
  await expect(inspectAction).toHaveAttribute('data-battle-active', 'true')
  await page.locator('main > header').click({ position: { x: 5, y: 5 } })
  await expect(info).toHaveCount(0)
  const initialImage = healCard.locator('[data-battle-command-artwork] img')
  await expect(initialImage).toHaveJSProperty(
    'src',
    new URL('/media/skills/hp-recovery.webp', page.url()).href,
  )
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
  await expect(healAction.locator(':scope > [data-battle-command-hotkey]')).toHaveText(
    slotHotkeyBefore ?? '',
  )
  await expect(healArtwork).toHaveAttribute('aria-label', /MP Recovery selected/i)

  const mpImage = healCard.locator('[data-battle-command-artwork] img')
  await expect(mpImage).toHaveJSProperty(
    'src',
    new URL('/media/skills/mp-recovery.svg', page.url()).href,
  )
  await expect
    .poll(() =>
      mpImage.evaluate(
        (image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
      ),
    )
    .toBe(true)

  await page.reload()
  const refreshedCommandDeck = page.getByRole('region', { name: 'Command Deck' })
  const refreshedHealCard = refreshedCommandDeck.locator('[data-command-card="recover"]')
  const refreshedHealAction = refreshedHealCard.locator('button[data-battle-command="recover"]')
  const refreshedHealArtwork = refreshedHealCard.getByRole('button', {
    name: /Choose Heal skill/i,
  })
  await expect(refreshedHealAction).toContainText('MP Recovery')
  await expect(refreshedHealArtwork).toHaveAttribute('aria-label', /MP Recovery selected/i)
  await expect(refreshedHealCard.locator('[data-battle-command-artwork] img')).toHaveJSProperty(
    'src',
    new URL('/media/skills/mp-recovery.svg', page.url()).href,
  )

  await refreshedHealArtwork.click()
  await page.getByRole('option', { name: /HP Recovery/ }).click()
  await expect(refreshedHealAction).toContainText('HP Recovery')
  await expect(refreshedHealAction.locator(':scope > [data-battle-command-hotkey]')).toHaveText(
    slotHotkeyBefore ?? '',
  )
})
