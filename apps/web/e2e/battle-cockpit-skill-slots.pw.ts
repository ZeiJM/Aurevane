import { expect, test } from '@playwright/test'

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
  await page.getByTestId('skill-build-panel').getByRole('button').click()
  const techniques = page.getByRole('dialog', { name: 'Techniques', exact: true })
  await expect(techniques).toBeVisible()
  const clear = techniques.getByRole('button', { name: /Clear Selections/ })
  if (await clear.isEnabled()) await clear.click()
  await expect(techniques.getByTestId('skill-capacity')).toContainText('0 / 4 selected')
  await techniques.getByRole('button', { name: 'Close', exact: true }).click()

  await page
    .getByRole('navigation', { name: 'Primary game navigation', exact: true })
    .getByRole('link', { name: /Battle/ })
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
  await expect(controls).toHaveCount(11)
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
  for (let index = 0; index < (await controls.count()); index++) {
    const info = controls.nth(index).getByRole('button')
    await info.hover()
    await expect(page.locator('[data-battle-info-panel]')).toHaveCount(0)
    await info.click()
    const panel = page.locator('[data-battle-info-panel]')
    await expect(panel).toBeVisible()
    await expect(panel).not.toHaveText('')
    const box = await panel.boundingBox()
    const viewport = page.viewportSize()!
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1)
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1)
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(info).toBeFocused()
  }
  await controls.first().getByRole('button').click()
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
