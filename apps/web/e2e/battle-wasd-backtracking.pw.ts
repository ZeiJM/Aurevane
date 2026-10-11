import { expect, test } from '@playwright/test'
import { PV1F_ACTION_ECONOMY_RESOURCE_KEY } from '@aurevane/game-core/combat/pv1f-action-economy'
import type { BattleSessionView } from '../src/server/battle/battle-session-service'

import { moveOneStep } from './refined-battle-helpers'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  return `Walker ${
    Date.now()
      .toString(36)
      .replace(/[^a-z]/gi, '') || 'clear'
  }`
}

test('WASD and arrows each submit one authoritative adjacent Move', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One desktop Chromium proof covers real keyboard Move execution.',
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

  const economy = page.getByRole('progressbar', { name: 'Action Economy remaining' })
  await expect(economy).toHaveAttribute('aria-valuenow', '100')
  await expect(page.locator('main[data-unified-battle="true"]')).toHaveAttribute(
    'data-local-turn',
    'true',
  )
  const battleId = new URL(page.url()).pathname.split('/').at(-1)!
  const authority = await page.request.get(`/api/battles/${battleId}`)
  expect(authority.ok()).toBe(true)
  let before = (await authority.json()).battle as BattleSessionView
  const actorId = before.snapshot.tactical.battle.currentTurn!.combatantId
  const actionEconomy = (battle: BattleSessionView) =>
    battle.snapshot.tactical.battle.combatants
      .find((unit) => unit.id === actorId)!
      .temporaryResources.find((resource) => resource.key === PV1F_ACTION_ECONOMY_RESOURCE_KEY)!
      .current
  let commits = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/(intents|commit)$/.test(new URL(request.url()).pathname))
      commits++
  })
  for (const [index, scheme] of (['wasd', 'arrows'] as const).entries()) {
    const response = await moveOneStep(page, characterName, scheme)
    const after = (await response.json()).battle as BattleSessionView
    expect(commits).toBe(index + 1)
    expect(after.battleVersion).toBe(before.battleVersion + 1)
    expect(after.snapshot.tactical.battle.currentTurn!.combatantId).toBe(actorId)
    expect(after.snapshot.tactical.battle.currentTurn!.movementRemaining).toBe(
      before.snapshot.tactical.battle.currentTurn!.movementRemaining - 1,
    )
    // Terrain and ascent can cost more than the flat 20 AP per step.
    expect(actionEconomy(after)).toBeLessThan(actionEconomy(before))
    await expect(economy).toHaveAttribute('aria-valuenow', String(actionEconomy(after)))
    before = after
  }
})
