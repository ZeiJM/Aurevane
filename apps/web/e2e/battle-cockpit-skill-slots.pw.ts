import { expect, test } from '@playwright/test'
import { openBattleInfoMenu } from './battle-info-menu-helpers'

import { expectRefinedCockpit } from './refined-battle-helpers'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'
import { expectBattleHeaderAndArtworkGeometry } from './battle-reference-layout-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Wayfarer ${letters}`
}

test('keeps square empty Skill slots and consistent cockpit info controls without spending AP', async ({
  page,
}, testInfo) => {
  test.slow()

  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `skill-slot-${projectSlug}-${Date.now()}@example.com`
  const password = 'Skill-slot-browser-2026!'
  const characterName = uniqueCharacterName()

  await createAccountAndEnterCharacter({ page, email, password, characterName })

  await page.goto('/game/nexus')
  const attunementPreview = page.getByRole('button', { name: /^Preview Essence:/ }).first()
  const hoverReader = page.locator('[data-battle-info-panel]')
  await attunementPreview.hover()
  await expect(hoverReader).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(hoverReader).toHaveCount(0)
  // Wait for the exposed trigger's next paint while leaving the pointer stationary.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  await expect(hoverReader).toHaveCount(0)
  await expect(attunementPreview).toBeFocused()
  await page.mouse.move(1, 1)
  await attunementPreview.hover()
  await expect(hoverReader).toBeVisible()
  await page.mouse.move(1, 1)
  // Escape restored the trigger's keyboard focus. Pointer exit must not close
  // a reader still owned by that focus; leaving both trigger and panel does.
  await expect(attunementPreview).toBeFocused()
  await expect(hoverReader).toBeVisible()
  await page.getByRole('button', { name: 'Account', exact: true }).focus()
  await expect(hoverReader).toHaveCount(0)
  await attunementPreview.click()
  await expect(hoverReader).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(hoverReader).toHaveCount(0)
  await page.keyboard.press('Tab')
  await expect(attunementPreview).not.toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(attunementPreview).toBeFocused()
  await expect(hoverReader).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(hoverReader).toHaveCount(0)
  await page.getByTestId('skill-build-panel').getByRole('button').click()
  const techniques = page.getByRole('dialog', { name: 'Techniques', exact: true })
  await expect(techniques).toBeVisible()
  const clear = techniques.getByRole('button', { name: /Clear Selections/ })
  if ((await clear.count()) && (await clear.isVisible()) && (await clear.isEnabled()))
    await clear.click()
  await expect(techniques.getByTestId('skill-capacity')).toContainText('0 / 4 selected')
  await techniques.getByRole('button', { name: 'Close', exact: true }).click()

  await page
    .getByRole('navigation', { name: 'Primary game navigation', exact: true })
    .getByRole('link', { name: /Arena/ })
    .click()
  await expect(page).toHaveURL(/\/game\/battle$/)

  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  await expectRefinedCockpit(page)
  await expect(page.getByLabel('Empty selected Skill slot')).toHaveCount(4)
  await testInfo.attach('empty-cockpit-skill-slots.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  await expectBattleHeaderAndArtworkGeometry(page)
  const deck = page.getByRole('region', { name: 'Command Deck' })
  await expect(
    deck.locator('[data-command-card="inspect"] [data-battle-command-hotkey]'),
  ).toHaveText('I')
  const before = await deck.boundingBox()
  await expect(page.locator('[data-battle-secondary-actions]')).toHaveCount(0)
  const controls = page.locator('[data-battle-cockpit-controls]')
  await expect(controls).toHaveCount(12)
  const menu = page.locator('[data-battle-preview-info]')
  const mobile = (await menu.evaluate((element) => getComputedStyle(element).display)) !== 'none'
  const readers = mobile
    ? menu.locator('[data-battle-info-trigger]')
    : controls.locator('[data-battle-info-trigger]')
  await expect(readers).toHaveCount(12)
  if (mobile) {
    for (const control of await controls.all()) await expect(control).toBeHidden()
    for (const hotkey of await deck.locator('[data-battle-command-hotkey]').all())
      await expect(hotkey).toBeHidden()
    await expect(deck.locator('[data-battle-info-trigger]')).toHaveCount(0)
  } else {
    const geometry = await controls.evaluateAll((rows) =>
      rows.map((row) => {
        const name = row.parentElement!.querySelector(':scope > button > strong, :scope > strong')!
        const info = row.querySelector('button')!
        const key = row.querySelector(':scope > span')!
        return {
          name: name.getBoundingClientRect().toJSON(),
          row: row.getBoundingClientRect().toJSON(),
          info: info.getBoundingClientRect().toJSON(),
          key: key.getBoundingClientRect().toJSON(),
        }
      }),
    )
    await testInfo.attach('cockpit-control-rows.json', {
      body: JSON.stringify(geometry, null, 2),
      contentType: 'application/json',
    })
    for (const item of geometry) {
      expect(item.row.top, 'information row sits below the Skill name').toBeGreaterThanOrEqual(
        item.name.bottom - 1,
      )
      expect(item.info.right, 'information comes before the hotkey').toBeLessThanOrEqual(
        item.key.left,
      )
      expect(
        Math.abs(item.info.y + item.info.height / 2 - (item.key.y + item.key.height / 2)),
      ).toBeLessThanOrEqual(1)
    }
  }
  for (let index = 0; index < (await readers.count()); index++) {
    await openBattleInfoMenu(page, (await readers.nth(index).getAttribute('aria-label'))!)
    const info = readers.nth(index)
    await info.hover()
    await expect(page.locator('[data-battle-info-panel]')).toHaveCount(0)
    await info.click()
    const panel = page.locator('[data-battle-info-panel]')
    await expect(panel).toBeVisible()
    await expect(panel).not.toHaveText('')
    await expect(panel).not.toContainText('Arm this action')
    await expect(panel).not.toContainText('Arm Move')
    for (const effect of await panel.locator('[data-compact-skill-effect]').all())
      await expect(effect).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    const viewport = page.viewportSize()!
    // A stable scrollbar gutter can narrow the fixed containing block even when
    // html's minimum width makes clientWidth equal innerWidth on a 320px phone.
    await expect
      .poll(async () =>
        panel.evaluate((element) => {
          const viewportProbe = document.createElement('div')
          viewportProbe.style.cssText =
            'position:fixed;inset:0;visibility:hidden;pointer-events:none'
          document.body.append(viewportProbe)
          const usableWidth = viewportProbe.getBoundingClientRect().width
          viewportProbe.remove()
          const bounds = element.getBoundingClientRect()
          const border = document.elementFromPoint(
            bounds.right - 1,
            bounds.top + Math.min(20, bounds.height / 2),
          )
          return (
            bounds.left >= 8 &&
            bounds.right <= usableWidth - 7 &&
            border !== null &&
            (border === element || element.contains(border))
          )
        }),
      )
      .toBe(true)
    const height = await panel.evaluate((element) => element.getBoundingClientRect().height)
    if (height > viewport.height - 16) {
      await expect(panel).toHaveAttribute('data-battle-info-page', 'true')
      expect(
        await panel.evaluate((element) => element.scrollHeight <= element.clientHeight + 1),
      ).toBe(true)
      await panel.locator('header').scrollIntoViewIfNeeded()
      await expect(panel.locator('header')).toBeInViewport()
      await panel.locator(':scope > :last-child').scrollIntoViewIfNeeded()
      await expect(panel.locator(':scope > :last-child')).toBeInViewport()
    } else {
      await expect
        .poll(async () => {
          const box = await panel.boundingBox()
          return !!box && box.y >= 0 && box.y + box.height <= viewport.height + 1
        })
        .toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(
      mobile ? info : page.locator('main[data-battle-keyboard-focus-root="true"]'),
    ).toBeFocused()
  }
  await openBattleInfoMenu(page, (await readers.first().getAttribute('aria-label'))!)
  await readers.first().click()
  await testInfo.attach('cockpit-info-popup.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  await page.locator('[data-unified-battle-header]').click({ position: { x: 5, y: 5 } })
  await expect(page.locator('[data-battle-info-panel]')).toHaveCount(0)
  const after = await deck.boundingBox()
  expect(after?.width).toBe(before?.width)
  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '100',
  )
})
