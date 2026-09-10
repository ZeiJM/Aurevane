import { expect, test, type Locator, type Page } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

interface PathPoint {
  index: number
  x: number
  y: number
}

type KeyboardScheme = 'wasd' | 'arrows'

function uniqueIdentity(prefix: string): { email: string; characterName: string } {
  const seed = `${Date.now()}${Math.floor(Math.random() * 100_000)}`
  const suffix = seed
    .slice(-7)
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return {
    email: `${prefix}.${seed}@example.com`,
    characterName: `${prefix} ${suffix}`,
  }
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
  throw new Error(`Expected cardinal movement, received ${from.x},${from.y} -> ${to.x},${to.y}`)
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

  throw new Error('The live PvP board did not expose a two-tile movement preview.')
}

async function reverseWholePreview({
  page,
  root,
  battlefield,
  actorName,
  scheme,
}: {
  page: Page
  root: Locator
  battlefield: Locator
  actorName: string
  scheme: KeyboardScheme
}) {
  const path = await plotMultiStepPath(battlefield)
  const actorTile = battlefield.locator(`button[aria-label*="occupied by ${actorName}"]`)
  const actorLabel = await actorTile.getAttribute('aria-label')
  expect(actorLabel).toBeTruthy()

  for (let index = path.length - 1; index > 0; index -= 1) {
    await page.keyboard.press(reverseKey(path[index]!, path[index - 1]!, scheme), { delay: 0 })
    await expect(battlefield.locator('button[data-path-index]')).toHaveCount(
      index === 1 ? 0 : index,
    )
    await expect(root).toHaveAttribute('data-battle-action-mode', 'move')
    await expect(root).toHaveAttribute('data-local-turn', 'true')
    await expect(actorTile).toHaveAttribute('aria-label', actorLabel!)
  }
}

test('PvP shares live-path WASD/arrow backtracking and mouse trimming without committing Move', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop two-player PvP movement parity')
  test.slow()

  const password = 'AurevaneTest!42'
  const hostIdentity = uniqueIdentity('MoveHost')
  const guestIdentity = uniqueIdentity('MoveGuest')
  const hostContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' })
  const guestContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' })
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()

  try {
    await provisionAccountAndEnterCharacter({
      page: host,
      email: hostIdentity.email,
      password,
      characterName: hostIdentity.characterName,
    })
    await provisionAccountAndEnterCharacter({
      page: guest,
      email: guestIdentity.email,
      password,
      characterName: guestIdentity.characterName,
    })

    await host.goto('/game/battle')
    await host.getByRole('button', { name: /Player vs Player/ }).click()
    await host.getByRole('button', { name: 'Create Battle Lobby' }).click()

    const hostDialog = host.getByRole('dialog', { name: 'The arena is waiting.' })
    const lobbyKey = (
      await hostDialog
        .locator('button')
        .filter({ hasText: 'Lobby Key' })
        .locator('strong')
        .textContent()
    )?.trim()
    expect(lobbyKey).toMatch(/^AVL-[A-Z0-9]{4}-[A-Z0-9]{4}$/)

    await guest.goto(`/game/battle?join=${encodeURIComponent(lobbyKey!)}`)
    const guestDialog = guest.getByRole('dialog', { name: 'The arena is waiting.' })
    await guestDialog.getByRole('button', { name: 'Mark Ready' }).click()
    await hostDialog.getByRole('button', { name: 'Mark Ready' }).click()

    await expect(host).toHaveURL(/\/game\/battle\/[0-9a-f-]+$/i, { timeout: 20_000 })
    await expect(guest).toHaveURL(/\/game\/battle\/[0-9a-f-]+$/i, { timeout: 20_000 })

    const hostRoot = host.locator("main[data-pvp-battle='true']")
    const guestRoot = guest.locator("main[data-pvp-battle='true']")
    await expect(hostRoot).toBeVisible()
    await expect(guestRoot).toBeVisible()

    const hostHasTurn = (await hostRoot.getAttribute('data-local-turn')) === 'true'
    const activePage = hostHasTurn ? host : guest
    const activeRoot = hostHasTurn ? hostRoot : guestRoot
    const actorName = hostHasTurn ? hostIdentity.characterName : guestIdentity.characterName
    const battlefield = activeRoot.getByRole('region', { name: 'Tactical battlefield' })
    const commandDeck = activeRoot.getByRole('region', { name: 'Command Deck' })

    await commandDeck.locator('button[data-command-slot="move"]').click()
    await expect(activeRoot).toHaveAttribute('data-battle-action-mode', 'move')

    await reverseWholePreview({
      page: activePage,
      root: activeRoot,
      battlefield,
      actorName,
      scheme: 'wasd',
    })
    await reverseWholePreview({
      page: activePage,
      root: activeRoot,
      battlefield,
      actorName,
      scheme: 'arrows',
    })

    const mousePath = await plotMultiStepPath(battlefield)
    const trimIndex = Math.max(1, mousePath.length - 2)
    await battlefield.locator(`button[data-path-index='${trimIndex}']`).click()
    await expect(battlefield.locator('button[data-path-index]')).toHaveCount(trimIndex + 1)
    await expect(battlefield.locator(`button[data-path-index='${trimIndex + 1}']`)).toHaveCount(0)
    await battlefield.locator("button[data-path-index='0']").click()
    await expect(battlefield.locator('button[data-path-index]')).toHaveCount(0)
    await expect(activeRoot).toHaveAttribute('data-battle-action-mode', 'move')
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()])
  }
})
