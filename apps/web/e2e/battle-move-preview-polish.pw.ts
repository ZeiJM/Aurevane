import { expect, test, type Locator } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

interface PathPoint {
  index: number
  x: number
  y: number
}

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

async function readPlottedPath(battlefield: Locator): Promise<PathPoint[]> {
  return battlefield.locator('button[data-path-index]').evaluateAll((tiles) =>
    tiles
      .map((tile) => {
        const label = tile.getAttribute('aria-label') ?? ''
        const match = label.match(/^Tile (\d+), (\d+);/)
        return {
          index: Number(tile.getAttribute('data-path-index')),
          x: match ? Number(match[1]) : Number.NaN,
          y: match ? Number(match[2]) : Number.NaN,
        }
      })
      .filter(
        (point) =>
          Number.isFinite(point.index) &&
          Number.isFinite(point.x) &&
          Number.isFinite(point.y),
      )
      .sort((a, b) => a.index - b.index),
  )
}

function reverseKey(from: PathPoint, to: PathPoint): string {
  const deltaX = to.x - from.x
  const deltaY = to.y - from.y
  if (deltaX === 1 && deltaY === 0) return 'ArrowRight'
  if (deltaX === -1 && deltaY === 0) return 'ArrowLeft'
  if (deltaX === 0 && deltaY === 1) return 'ArrowDown'
  if (deltaX === 0 && deltaY === -1) return 'ArrowUp'
  throw new Error(`Non-cardinal path step ${from.x},${from.y} -> ${to.x},${to.y}`)
}

async function plotMultiStepPath(battlefield: Locator): Promise<PathPoint[]> {
  const labels = await battlefield
    .locator("button[aria-label^='Tile '][data-reachable]")
    .evaluateAll(
      (tiles) =>
        tiles.map((tile) => tile.getAttribute('aria-label')).filter(Boolean) as string[],
    )

  for (const label of labels) {
    await battlefield.getByRole('button', { name: label, exact: true }).click()
    const plotted = await readPlottedPath(battlefield)
    if (plotted.length >= 3) return plotted

    const origin = battlefield.locator("button[data-path-index='0']")
    if ((await origin.count()) > 0) await origin.click()
  }

  throw new Error('The seeded battle did not expose a multi-step reachable Move path.')
}

test('keeps Move reachable tiles rich green and supports keyboard/mouse path backtracking', async ({
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

  if (testInfo.project.name !== 'desktop-chromium') return

  const currentOrigin = battlefield.locator("button[data-path-index='0']")
  if ((await currentOrigin.count()) > 0) await currentOrigin.click()

  const keyboardPath = await plotMultiStepPath(battlefield)
  const reverseKeys: string[] = []
  for (let index = keyboardPath.length - 1; index > 0; index -= 1) {
    reverseKeys.push(reverseKey(keyboardPath[index]!, keyboardPath[index - 1]!))
  }

  await page.evaluate((keys) => {
    for (const key of keys) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    }
  }, reverseKeys)

  await expect(battlefield.locator('button[data-path-index]')).toHaveCount(0)
  await expect(page.locator('[data-battle-notice="true"]')).toContainText(
    'Move preview returned to your current tile.',
  )

  const mousePath = await plotMultiStepPath(battlefield)
  const trimIndex = Math.max(1, mousePath.length - 2)
  await battlefield.locator(`button[data-path-index='${trimIndex}']`).click()
  await expect(battlefield.locator('button[data-path-index]')).toHaveCount(trimIndex + 1)
  await expect(battlefield.locator(`button[data-path-index='${trimIndex + 1}']`)).toHaveCount(0)

  await battlefield.locator("button[data-path-index='0']").click()
  await expect(battlefield.locator('button[data-path-index]')).toHaveCount(0)
})
