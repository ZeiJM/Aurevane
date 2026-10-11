import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

test('AI Sparring links team counts and persists six combatants on exactly two teams', async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000)
  const stamp = Date.now()
  const letters = String(stamp)
    .split('')
    .map((digit) => String.fromCharCode(97 + Number(digit)))
    .join('')
  await provisionAccountAndEnterCharacter({
    page,
    email: `sparring-teams-${testInfo.project.name}-${stamp}@example.com`,
    password: 'Sparring-teams-browser-2026!',
    characterName: `Sparring ${letters}`,
  })
  for (const allyCount of [0, 1, 2]) {
    await page.goto('/game/battle')
    const allies = page.getByLabel('AI sparring allies'),
      enemies = page.getByLabel('AI sparring enemies')
    await expect(allies).toHaveValue('0')
    await enemies.selectOption('5')
    await allies.selectOption(String(allyCount))
    await expect(enemies).toHaveValue(String(5 - allyCount))
    await expect(enemies.locator('option')).toHaveCount(5 - allyCount)
    await expect(allies).toHaveValue(String(allyCount))
    expect(1 + Number(await allies.inputValue()) + Number(await enemies.inputValue())).toBe(6)
    const receipt = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/battles') && response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Enter Battle', exact: true }).click()
    const response = await receipt
    expect(response.ok()).toBe(true)
    expect(response.request().postDataJSON()).toMatchObject({
      allyCount,
      enemyCount: 5 - allyCount,
    })
    const { battle } = await response.json()
    await expect(page).toHaveURL(new RegExp(`/game/battle/${battle.battleSessionId}$`))
    await expect(page.getByRole('region', { name: 'Tactical battlefield' })).toBeVisible()
    const root = page.locator('main[data-unified-battle="true"]')
    await expect(root).toHaveAttribute('data-local-turn', 'true')
    await expect(root).not.toHaveAttribute('aria-busy', 'true')
    await expect(root).not.toHaveAttribute('data-battle-execution-pending', 'true')
    const persisted = await page.evaluate(async (sessionId) => {
      const response = await fetch(`/api/battles/${sessionId}`, { cache: 'no-store' })
      return { status: response.status, body: await response.json() }
    }, battle.battleSessionId)
    expect(persisted.status).toBe(200)
    const state = persisted.body.battle.snapshot,
      combatants = state.tactical.battle.combatants
    expect(combatants).toHaveLength(6)
    expect(combatants.filter((row: { teamId: string }) => row.teamId === 'players')).toHaveLength(
      1 + allyCount,
    )
    expect(combatants.filter((row: { teamId: string }) => row.teamId === 'opponents')).toHaveLength(
      5 - allyCount,
    )
    expect(new Set(combatants.map((row: { teamId: string }) => row.teamId)).size).toBe(2)
    await expect(page.locator('#battlefield [data-team="0"]')).toHaveCount(1 + allyCount)
    await expect(page.locator('#battlefield [data-team="1"]')).toHaveCount(5 - allyCount)
    const surrendered = await page.evaluate(
      async ({ sessionId, version }) => {
        const response = await fetch(`/api/battles/${sessionId}/surrender`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedBattleVersion: version,
            idempotencyKey: crypto.randomUUID(),
          }),
        })
        return { status: response.status, body: await response.json() }
      },
      { sessionId: battle.battleSessionId, version: persisted.body.battle.battleVersion },
    )
    expect(surrendered.status).toBe(200)
    expect(surrendered.body.battle.snapshot.tactical.battle.lifecycle).toBe('completed')
    await page.reload()
    const rematchReceipt = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/battles') && response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Rematch Recruit', exact: true }).click()
    const rematchResponse = await rematchReceipt
    expect(rematchResponse.ok()).toBe(true)
    expect(rematchResponse.request().postDataJSON()).toMatchObject({
      allyCount,
      enemyCount: 5 - allyCount,
    })
    const rematch = (await rematchResponse.json()).battle
    expect(rematch.snapshot.tactical.battle.combatants).toHaveLength(6)
    await expect(page).toHaveURL(new RegExp(`/game/battle/${rematch.battleSessionId}$`))
    await expect(root).toHaveAttribute('data-local-turn', 'true')
    await expect(root).not.toHaveAttribute('aria-busy', 'true')
    await expect(root).not.toHaveAttribute('data-battle-execution-pending', 'true')
    const rematchState = await page.request.get(`/api/battles/${rematch.battleSessionId}`)
    expect(rematchState.status()).toBe(200)
    const currentRematch = (await rematchState.json()).battle
    const aborted = await page.evaluate(
      async ({ sessionId, version }) => {
        const response = await fetch(`/api/battles/${sessionId}/abort`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedBattleVersion: version,
            idempotencyKey: crypto.randomUUID(),
          }),
        })
        return response.status
      },
      { sessionId: rematch.battleSessionId, version: currentRematch.battleVersion },
    )
    expect(aborted).toBe(200)
  }
})
