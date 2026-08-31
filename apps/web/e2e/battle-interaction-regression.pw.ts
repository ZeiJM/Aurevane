import { expect, test, type Page } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

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

async function enterGuidedBattle(page: Page, prefix: string) {
  const identity = uniqueIdentity(prefix)
  await provisionAccountAndEnterCharacter({
    page,
    email: identity.email,
    password: 'AurevaneTest!42',
    characterName: identity.characterName,
  })

  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('guided-fundamentals')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const coach = page.getByRole('dialog', { name: 'Complete the tactical fundamentals' })
  await expect(coach).toBeVisible()
  await coach.getByRole('button', { name: 'Continue training' }).click()

  const root = page.locator("main[data-unified-battle='true'][data-battle-kind='pve']")
  await expect(root).toBeVisible()
  await expect(root).toHaveAttribute('data-local-turn', 'true')
  return { identity, root }
}

function directionalKey(dx: number, dy: number): 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' {
  if (dx === 1 && dy === 0) return 'ArrowRight'
  if (dx === -1 && dy === 0) return 'ArrowLeft'
  if (dx === 0 && dy === 1) return 'ArrowDown'
  if (dx === 0 && dy === -1) return 'ArrowUp'
  throw new Error(`Expected an adjacent target, received delta ${dx}, ${dy}`)
}

test('desktop Move leaves unavailable cells neutral and directional Attack previews before commit', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop keyboard regression')
  test.slow()

  const { identity, root } = await enterGuidedBattle(page, 'KeyboardPreview')

  await root.getByRole('button', { name: 'Move', exact: true }).click()
  await expect(root).toHaveAttribute('data-battle-action-mode', 'move')

  const movePalette = await root
    .locator('#battlefield button[aria-label^="Tile "]')
    .evaluateAll((tiles) => {
      const rgb = (value: string) =>
        value
          .match(/[\d.]+/g)
          ?.slice(0, 3)
          .map(Number) ?? [0, 0, 0]
      const unreachable = tiles.filter(
        (tile) =>
          !tile.hasAttribute('data-reachable') &&
          !tile.hasAttribute('data-path') &&
          !tile.querySelector('[data-active]'),
      )
      const reachable = tiles.filter((tile) => tile.hasAttribute('data-reachable'))
      return {
        unreachable: unreachable.map((tile) => rgb(getComputedStyle(tile).borderColor)),
        reachable: reachable.map((tile) => rgb(getComputedStyle(tile).borderColor)),
      }
    })

  expect(movePalette.unreachable.length).toBeGreaterThan(0)
  expect(movePalette.reachable.length).toBeGreaterThan(0)
  for (const [red, green, blue] of movePalette.unreachable) {
    expect(red > green * 1.45 && red > blue * 1.45).toBe(false)
  }
  expect(movePalette.reachable.some(([red, green]) => green > red)).toBe(true)

  await root.getByRole('button', { name: 'Cancel Action' }).click()
  await root.getByRole('button', { name: 'Basic Attack', exact: true }).click()
  await expect(root).toHaveAttribute('data-battle-action-mode', 'attack')

  const positions = await root.locator('#battlefield').evaluate((battlefield, playerName) => {
    const tiles = Array.from(
      battlefield.querySelectorAll<HTMLButtonElement>('button[aria-label^="Tile "]'),
    )
    const coordinate = (label: string | null) => {
      const match = label?.match(/^Tile\s+(\d+),\s*(\d+)/i)
      return match ? { x: Number(match[1]), y: Number(match[2]) } : null
    }
    const actor = tiles.find((tile) =>
      (tile.getAttribute('aria-label') ?? '').includes(`occupied by ${playerName}`),
    )
    const target = tiles.find((tile) =>
      (tile.getAttribute('aria-label') ?? '').includes('occupied by Recruit'),
    )
    return {
      actor: coordinate(actor?.getAttribute('aria-label') ?? null),
      target: coordinate(target?.getAttribute('aria-label') ?? null),
    }
  }, identity.characterName)

  expect(positions.actor).not.toBeNull()
  expect(positions.target).not.toBeNull()
  const key = directionalKey(
    positions.target!.x - positions.actor!.x,
    positions.target!.y - positions.actor!.y,
  )
  const economy = root.locator('[data-battle-shared-economy="true"]')
  const beforeEconomy = (await economy.textContent())?.trim() ?? ''
  const confirm = root.getByRole('button', { name: /Confirm Action/ })

  await page.keyboard.press(key)
  await expect(confirm).toBeEnabled()
  await expect(root.locator('[data-battle-target-preview="true"]')).toBeVisible()
  await expect(economy).toContainText(beforeEconomy.match(/\d+\s*AP/i)?.[0] ?? '100 AP')

  await page.keyboard.press(key)
  await expect
    .poll(async () => (await economy.textContent())?.trim() ?? '', { timeout: 10_000 })
    .not.toBe(beforeEconomy)
})

test('desktop Finish Turn handoff keeps battlefield and command deck geometry fixed', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop geometry regression')
  test.slow()

  const { root } = await enterGuidedBattle(page, 'TurnGeometry')
  const battlefield = root.locator('#battlefield')
  const commandDeck = root.locator('[data-unified-command-deck="true"]')
  await expect(battlefield).toBeVisible()
  await expect(commandDeck).toBeVisible()

  await root.evaluate((element) => {
    const state = window as typeof window & {
      __turnGeometrySamples?: Array<{ battlefield: number; deck: number }>
      __stopTurnGeometrySamples?: boolean
    }
    const battlefieldElement = element.querySelector<HTMLElement>('#battlefield')
    const deckElement = element.querySelector<HTMLElement>('[data-unified-command-deck="true"]')
    if (!battlefieldElement || !deckElement) throw new Error('Battle geometry elements are missing')

    state.__turnGeometrySamples = []
    state.__stopTurnGeometrySamples = false
    const sample = () => {
      state.__turnGeometrySamples?.push({
        battlefield: battlefieldElement.getBoundingClientRect().height,
        deck: deckElement.getBoundingClientRect().height,
      })
      if (!state.__stopTurnGeometrySamples) window.requestAnimationFrame(sample)
    }
    sample()
  })

  const finalTurnResponse = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/final-turn'),
  )
  const recruitTurnResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().includes('/recruit-turn'),
  )
  const finish = root.getByRole('button', { name: /Finish Turn/ })
  await finish.click()
  await finish.press('KeyD')
  await finalTurnResponse
  await recruitTurnResponse
  await expect(root).toHaveAttribute('data-local-turn', 'true', { timeout: 15_000 })

  const samples = await page.evaluate(() => {
    const state = window as typeof window & {
      __turnGeometrySamples?: Array<{ battlefield: number; deck: number }>
      __stopTurnGeometrySamples?: boolean
    }
    state.__stopTurnGeometrySamples = true
    return state.__turnGeometrySamples ?? []
  })

  expect(samples.length).toBeGreaterThan(5)
  const battlefieldHeights = samples.map((sample) => sample.battlefield)
  const deckHeights = samples.map((sample) => sample.deck)
  expect(Math.max(...battlefieldHeights) - Math.min(...battlefieldHeights)).toBeLessThanOrEqual(1)
  expect(Math.max(...deckHeights) - Math.min(...deckHeights)).toBeLessThanOrEqual(1)
})
