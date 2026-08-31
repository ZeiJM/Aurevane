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

async function enterGuidedBattle(page: Page) {
  const identity = uniqueIdentity('Handoff')
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
  return root
}

test('keeps desktop battlefield and footer geometry stable through Recruit handoff', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop-only geometry contract')
  test.slow()

  const root = await enterGuidedBattle(page)
  const battlefield = root.locator('[data-unified-battlefield="true"]')
  const footer = root.locator('[data-unified-battle-footer="true"]')

  await expect(footer).toHaveCSS('position', 'relative')
  const baselineBattlefield = await battlefield.boundingBox()
  const baselineFooter = await footer.boundingBox()
  expect(baselineBattlefield).not.toBeNull()
  expect(baselineFooter).not.toBeNull()

  await root.evaluate((element) => {
    const state = window as typeof window & {
      __handoffSamples?: Array<{
        battlefieldHeight: number
        footerHeight: number
        footerPosition: string
      }>
      __stopHandoffSamples?: boolean
    }

    state.__handoffSamples = []
    state.__stopHandoffSamples = false

    const sample = () => {
      const battlefieldElement = element.querySelector('[data-unified-battlefield="true"]')
      const footerElement = element.querySelector('[data-unified-battle-footer="true"]')
      if (battlefieldElement instanceof HTMLElement && footerElement instanceof HTMLElement) {
        state.__handoffSamples?.push({
          battlefieldHeight: battlefieldElement.getBoundingClientRect().height,
          footerHeight: footerElement.getBoundingClientRect().height,
          footerPosition: getComputedStyle(footerElement).position,
        })
      }
      if (!state.__stopHandoffSamples) window.requestAnimationFrame(sample)
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
      __handoffSamples?: Array<{
        battlefieldHeight: number
        footerHeight: number
        footerPosition: string
      }>
      __stopHandoffSamples?: boolean
    }
    state.__stopHandoffSamples = true
    return state.__handoffSamples ?? []
  })

  expect(samples.length).toBeGreaterThan(5)
  expect(samples.every((sample) => sample.footerPosition === 'relative')).toBe(true)

  const battlefieldHeights = samples.map((sample) => sample.battlefieldHeight)
  const footerHeights = samples.map((sample) => sample.footerHeight)
  expect(Math.max(...battlefieldHeights) - Math.min(...battlefieldHeights)).toBeLessThanOrEqual(1)
  expect(Math.max(...footerHeights) - Math.min(...footerHeights)).toBeLessThanOrEqual(1)
  expect(baselineBattlefield?.height).toBeGreaterThan(0)
  expect(baselineFooter?.height).toBeGreaterThan(0)
})
