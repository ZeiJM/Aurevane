import { expect, test, type Locator, type Page } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

interface PathPoint {
  index: number
  x: number
  y: number
}

type KeyboardScheme = 'wasd' | 'arrows'

function uniqueCharacterName(): string {
  const suffix =
    Date.now()
      .toString(36)
      .replace(/[^a-z]/gi, '')
      .slice(-7) || 'walker'
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

function reverseKey(from: PathPoint, to: PathPoint, scheme: KeyboardScheme): string {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (dx === 1 && dy === 0) return scheme === 'wasd' ? 'KeyD' : 'ArrowRight'
  if (dx === -1 && dy === 0) return scheme === 'wasd' ? 'KeyA' : 'ArrowLeft'
  if (dx === 0 && dy === 1) return scheme === 'wasd' ? 'KeyS' : 'ArrowDown'
  if (dx === 0 && dy === -1) return scheme === 'wasd' ? 'KeyW' : 'ArrowUp'
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

async function reverseWholePreview({
  page,
  battlefield,
  root,
  actorName,
  scheme,
}: {
  page: Page
  battlefield: Locator
  root: Locator
  actorName: string
  scheme: KeyboardScheme
}) {
  const path = await plotMultiStepPath(battlefield)
  const committedActorTile = battlefield.locator(`button[aria-label*="occupied by ${actorName}"]`)
  const committedActorLabel = await committedActorTile.getAttribute('aria-label')
  expect(committedActorLabel).toBeTruthy()

  for (let index = path.length - 1; index > 0; index -= 1) {
    await page.keyboard.press(reverseKey(path[index]!, path[index - 1]!, scheme), { delay: 0 })
    await expect(battlefield.locator('button[data-path-index]')).toHaveCount(
      index === 1 ? 0 : index,
    )
    await expect(root).toHaveAttribute('data-battle-action-mode', 'move')
    await expect(committedActorTile).toHaveAttribute('aria-label', committedActorLabel!)
  }

  await expect(page.locator('[data-battle-notice="true"]')).toContainText(
    'Move preview returned to your current tile.',
  )
  await expect(root).toHaveAttribute('data-battle-action-mode', 'move')
}

test('WASD and arrows walk a Move preview backward one tile at a time without committing', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One desktop Chromium proof covers real keyboard Move-preview retraction.',
  )
  test.slow()

  const characterName = uniqueCharacterName()
  await provisionAccountAndEnterCharacter({
    page,
    email: `wasd-backtrack-${Date.now()}@example.com`,
    password: 'WASD-backtrack-2026!',
    characterName,
  })

  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const root = page.locator("main[data-unified-battle='true']")
  const battlefield = page.getByRole('region', { name: 'Tactical battlefield' })
  const commandDeck = page.getByRole('region', { name: 'Command Deck' })
  await commandDeck.locator('button[data-command-slot="move"]').click()
  await expect(root).toHaveAttribute('data-battle-action-mode', 'move')

  await reverseWholePreview({
    page,
    battlefield,
    root,
    actorName: characterName,
    scheme: 'wasd',
  })

  await reverseWholePreview({
    page,
    battlefield,
    root,
    actorName: characterName,
    scheme: 'arrows',
  })
})
