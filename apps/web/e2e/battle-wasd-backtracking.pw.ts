import { expect, test, type Locator } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

interface PathPoint {
  index: number
  x: number
  y: number
}

function uniqueCharacterName(): string {
  const suffix = Date.now().toString(36).replace(/[^a-z]/gi, '').slice(-7) || 'walker'
  return `Backtrack ${suffix}`
}

async function plottedPath(battlefield: Locator): Promise<PathPoint[]> {
  return battlefield.locator('button[data-path-index]').evaluateAll((tiles) =>
    tiles
      .map((tile) => {
        const match = (tile.getAttribute('aria-label') ?? '').match(/^Tile (\d+), (\d+);/)
        return {
          index: Number(tile.getAttribute('data-path-index')),
          x: match ? Number(match[1]) : Number.NaN,
          y: match ? Number(match[2]) : Number.NaN,
        }
      })
      .filter(
        (point) =>
          Number.isFinite(point.index) && Number.isFinite(point.x) && Number.isFinite(point.y),
      )
      .sort((left, right) => left.index - right.index),
  )
}

function wasdKey(from: PathPoint, to: PathPoint): string {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (dx === 1 && dy === 0) return 'KeyD'
  if (dx === -1 && dy === 0) return 'KeyA'
  if (dx === 0 && dy === 1) return 'KeyS'
  if (dx === 0 && dy === -1) return 'KeyW'
  throw new Error(`Expected a cardinal path step, received ${from.x},${from.y} -> ${to.x},${to.y}`)
}

async function plotMultiStepPath(battlefield: Locator): Promise<PathPoint[]> {
  const candidates = battlefield.locator("button[aria-label^='Tile '][data-reachable]")
  const count = await candidates.count()

  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index)
    const label = await candidate.getAttribute('aria-label')
    if (!label) continue
    await battlefield.getByRole('button', { name: label, exact: true }).click()
    const path = await plottedPath(battlefield)
    if (path.length >= 3) return path

    const origin = battlefield.locator("button[data-path-index='0']")
    if ((await origin.count()) > 0) await origin.click()
  }

  throw new Error('The seeded Recruit battle did not expose a multi-step movement path.')
}

test('WASD walks a Move preview backward one tile at a time', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One desktop Chromium proof covers physical keyboard WASD retraction.',
  )
  test.slow()

  await provisionAccountAndEnterCharacter({
    page,
    email: `wasd-backtrack-${Date.now()}@example.com`,
    password: 'WASD-backtrack-2026!',
    characterName: uniqueCharacterName(),
  })

  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const battlefield = page.getByRole('region', { name: 'Tactical battlefield' })
  const commandDeck = page.getByRole('region', { name: 'Command Deck' })
  await commandDeck.locator('button[data-command-slot="move"]').click()

  const path = await plotMultiStepPath(battlefield)
  for (let index = path.length - 1; index > 0; index -= 1) {
    await page.keyboard.press(wasdKey(path[index]!, path[index - 1]!))
    await expect(battlefield.locator('button[data-path-index]')).toHaveCount(index === 1 ? 0 : index)
  }

  await expect(page.locator('[data-battle-notice="true"]')).toContainText(
    'Move preview returned to your current tile.',
  )
})
