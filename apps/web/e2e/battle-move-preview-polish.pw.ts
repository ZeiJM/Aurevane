import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueIdentity(project: string): { email: string; characterName: string } {
  const seed = `${Date.now()}${Math.floor(Math.random() * 100_000)}`
  const suffix = seed
    .slice(-7)
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return {
    email: `move-preview.${project}.${seed}@example.com`,
    characterName: `MovePreview ${suffix}`,
  }
}

test('keeps Move reachable tiles rich green and unreachable tiles neutral', async ({
  page,
}, testInfo) => {
  test.skip(
    !['desktop-chromium', 'mobile-chromium'].includes(testInfo.project.name),
    'Move presentation is shared across desktop and mobile',
  )
  test.slow()

  const identity = uniqueIdentity(testInfo.project.name)
  await provisionAccountAndEnterCharacter({
    page,
    email: identity.email,
    password: 'AurevaneTest!42',
    characterName: identity.characterName,
  })

  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const root = page.locator("main[data-unified-battle='true']")
  const battlefield = page.getByRole('region', { name: 'Tactical battlefield' })
  const commandDeck = page.getByRole('region', { name: 'Command Deck' })
  const moveButton = commandDeck.getByRole('button', { name: /Move/ })

  if (testInfo.project.name === 'mobile-chromium') await moveButton.tap()
  else await moveButton.click()

  await expect(root).toHaveAttribute('data-battle-action-mode', 'move')

  const reachable = battlefield.locator("button[aria-label^='Tile '][data-reachable]").first()
  const neutral = battlefield
    .locator("button[aria-label^='Tile ']:not([data-reachable]):not([data-path])")
    .filter({ hasNot: battlefield.locator('[data-target-relation]') })
    .first()
  await expect(reachable).toBeVisible()
  await expect(neutral).toBeVisible()

  const reachableStyle = await reachable.evaluate((tile) => {
    const style = getComputedStyle(tile)
    return { borderColor: style.borderColor, boxShadow: style.boxShadow }
  })
  const neutralStyle = await neutral.evaluate((tile) => {
    const style = getComputedStyle(tile)
    return { borderColor: style.borderColor, boxShadow: style.boxShadow }
  })

  expect(reachableStyle.borderColor).toBe('rgba(98, 210, 138, 0.86)')
  expect(reachableStyle.boxShadow).toContain('inset')
  expect(reachableStyle.boxShadow).toContain('98, 210, 138')
  expect(neutralStyle.borderColor).not.toContain('226, 83, 83')
  expect(neutralStyle.boxShadow).not.toContain('206, 62, 62')

  if (testInfo.project.name === 'mobile-chromium') await reachable.tap()
  else await reachable.click()

  const pathTile = battlefield.locator("button[aria-label^='Tile '][data-path]").last()
  await expect(pathTile).toBeVisible()
  const pathStyle = await pathTile.evaluate((tile) => {
    const style = getComputedStyle(tile)
    return { borderColor: style.borderColor, boxShadow: style.boxShadow }
  })

  expect(pathStyle.borderColor).toBe('rgb(124, 230, 158)')
  expect(pathStyle.boxShadow).toContain('inset')
  expect(pathStyle.boxShadow).toContain('124, 230, 158')
})
