import { expect, test } from '@playwright/test'

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

test('diagnoses Guided Fundamentals geometry through finish turn', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop transition diagnostic')
  test.slow()

  const identity = uniqueIdentity('GuidedGeometry')
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
  const board = root.locator('#battlefield [data-board-auto-fit="9x7"]')
  await expect(board).toBeVisible()

  await board.evaluate((element) => {
    const state = window as typeof window & {
      __guidedGeometrySamples?: Array<Record<string, number | string>>
      __stopGuidedGeometrySamples?: boolean
    }
    state.__guidedGeometrySamples = []
    state.__stopGuidedGeometrySamples = false

    const sample = () => {
      const boardElement = element as HTMLElement
      const viewport = boardElement.parentElement as HTMLElement
      const battlefield = viewport.parentElement as HTMLElement
      const content = battlefield.parentElement as HTMLElement
      const deck = content.querySelector<HTMLElement>('section[aria-label="Command Deck"]')
      const context = deck?.firstElementChild as HTMLElement | null
      const rootElement = content.closest<HTMLElement>('main')
      const boardRect = boardElement.getBoundingClientRect()
      const viewportRect = viewport.getBoundingClientRect()
      const battlefieldRect = battlefield.getBoundingClientRect()
      const contentRect = content.getBoundingClientRect()
      const deckRect = deck?.getBoundingClientRect()
      const contextRect = context?.getBoundingClientRect()
      const rootRect = rootElement?.getBoundingClientRect()

      state.__guidedGeometrySamples?.push({
        boardWidth: boardRect.width,
        boardHeight: boardRect.height,
        viewportWidth: viewportRect.width,
        viewportHeight: viewportRect.height,
        battlefieldWidth: battlefieldRect.width,
        battlefieldHeight: battlefieldRect.height,
        contentWidth: contentRect.width,
        contentHeight: contentRect.height,
        deckHeight: deckRect?.height ?? 0,
        contextHeight: contextRect?.height ?? 0,
        rootHeight: rootRect?.height ?? 0,
        fit: boardElement.dataset.boardAutoFit ?? '',
      })
      if (!state.__stopGuidedGeometrySamples) window.requestAnimationFrame(sample)
    }

    sample()
  })

  const finalTurnResponse = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/final-turn'),
  )
  const recruitTurnResponse = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/recruit-turn'),
  )
  const finish = root.getByRole('button', { name: /Finish Turn/ })
  await finish.click()
  await finish.press('KeyD')
  await finalTurnResponse
  await recruitTurnResponse
  await expect(root).toHaveAttribute('data-local-turn', 'true', { timeout: 15_000 })

  const samples = await page.evaluate(() => {
    const state = window as typeof window & {
      __guidedGeometrySamples?: Array<Record<string, number | string>>
      __stopGuidedGeometrySamples?: boolean
    }
    state.__stopGuidedGeometrySamples = true
    return state.__guidedGeometrySamples ?? []
  })

  const numbers = [
    'boardWidth',
    'boardHeight',
    'viewportHeight',
    'battlefieldHeight',
    'contentHeight',
    'deckHeight',
    'contextHeight',
    'rootHeight',
  ] as const
  const summary = Object.fromEntries(
    numbers.map((key) => {
      const values = samples.map((sample) => Number(sample[key]))
      return [key, { min: Math.min(...values), max: Math.max(...values) }]
    }),
  )
  console.log('guided-finish-geometry', JSON.stringify(summary))
  expect(samples.length).toBeGreaterThan(5)
})
