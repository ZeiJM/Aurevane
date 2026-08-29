import { expect, test } from '@playwright/test'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Wayfarer ${letters}`
}

test('keeps desktop AI Victory Conditions and Combat Log visually matched without changing mobile', async ({
  page,
}, testInfo) => {
  test.slow()

  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `ai-header-shape-${projectSlug}-${Date.now()}@example.com`
  const password = 'AI-header-shape-2026!'
  const characterName = uniqueCharacterName()

  await createAccountAndEnterCharacter({ page, email, password, characterName })

  await page.getByRole('button', { name: 'Navigation' }).click()
  const battleHallLink = page.getByRole('link', { name: /Battle Hall/ })
  await battleHallLink.focus()
  await battleHallLink.press('Enter')

  await expect(page).toHaveURL(/\/game\/battle$/)
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('region', { name: 'Tactical battlefield' })).toBeVisible()

  const victoryConditions = page.getByRole('button', { name: /Victory conditions/i })
  const combatLog = page.getByRole('button', { name: /Round .*Combat Log/i })
  await expect(victoryConditions).toBeVisible()
  await expect(combatLog).toBeVisible()

  const victoryRadius = await victoryConditions.evaluate(
    (element) => window.getComputedStyle(element).borderTopLeftRadius,
  )
  const combatLogRadius = await combatLog.evaluate(
    (element) => window.getComputedStyle(element).borderTopLeftRadius,
  )
  const victoryBox = await victoryConditions.boundingBox()
  const combatLogBox = await combatLog.boundingBox()
  expect(victoryBox).not.toBeNull()
  expect(combatLogBox).not.toBeNull()

  if (testInfo.project.name === 'mobile-chromium') {
    expect(combatLogRadius).toBe('999px')
    expect(combatLogRadius).not.toBe(victoryRadius)
  } else {
    expect(combatLogRadius).toBe(victoryRadius)
    expect(combatLogRadius).not.toBe('999px')
    expect(Math.abs(victoryBox!.height - combatLogBox!.height)).toBeLessThanOrEqual(1)
    expect(victoryBox!.height).toBeGreaterThanOrEqual(33)
    expect(victoryBox!.height).toBeLessThanOrEqual(36)

    const centeredCluster = await victoryConditions.evaluate((victory) => {
      const header = victory.closest('header')!
      const economy = header.querySelector<HTMLElement>('[data-battle-shared-economy="true"]')!
      const headerRect = header.getBoundingClientRect()
      const economyRect = economy.getBoundingClientRect()
      const victoryRect = victory.getBoundingClientRect()
      const clusterLeft = Math.min(economyRect.left, victoryRect.left)
      const clusterRight = Math.max(economyRect.right, victoryRect.right)
      return {
        headerMidpoint: headerRect.left + headerRect.width / 2,
        clusterMidpoint: clusterLeft + (clusterRight - clusterLeft) / 2,
      }
    })

    expect(Math.abs(centeredCluster.clusterMidpoint - centeredCluster.headerMidpoint)).toBeLessThanOrEqual(
      2,
    )
  }
})
