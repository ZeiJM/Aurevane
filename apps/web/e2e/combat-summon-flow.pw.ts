import { expect, test, type Page, type TestInfo } from '@playwright/test'

import type { BattleSessionView } from '../src/server/battle/battle-session-service'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

test.use({ trace: 'on', actionTimeout: 15_000 })

async function provision(page: Page, testInfo: TestInfo): Promise<string> {
  const seed = `${Date.now()}${Math.floor(Math.random() * 10000)}`
  const name = `Summoner ${seed
    .slice(-8)
    .split('')
    .map((digit) => String.fromCharCode(97 + Number(digit)))
    .join('')}`

  await provisionAccountAndEnterCharacter({
    page,
    email: `summon-${testInfo.project.name}-${seed}@example.com`,
    password: 'Combat-summon-disposable-2026!',
    characterName: name,
  })

  return name
}

async function equipRenewingHerbs(page: Page): Promise<void> {
  await page.goto('/game/nexus')
  await expect(page.locator('[data-arsenal-workspace]')).toBeVisible()

  await page.getByRole('button', { name: /Manage Disciplines/ }).click()
  const management = page.getByRole('dialog', { name: 'Discipline Management', exact: true })
  await management.getByLabel('Primary Discipline').selectOption('wildwarden')
  await management.getByRole('button', { name: /Confirm Change/ }).click()
  await expect(page.getByTestId('primary-discipline-chip')).toHaveText('Wildwarden')
  await management.getByRole('button', { name: 'Close', exact: true }).click()

  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  const techniques = page.getByRole('dialog', { name: 'Techniques', exact: true })
  const herbs = techniques.locator('article').filter({ hasText: 'Renewing Herbs' })
  const checkbox = herbs.getByRole('checkbox')
  const coarsePointer = await page.evaluate(
    () => window.matchMedia('(hover: none), (pointer: coarse)').matches,
  )

  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/character/build/skills') &&
      response.request().method() === 'PUT',
  )
  if (coarsePointer) {
    await herbs.locator('label').dblclick()
  } else {
    await checkbox.check()
  }
  expect((await saved).status()).toBe(200)
  await techniques.getByRole('button', { name: 'Close', exact: true }).click()
}

async function readBattle(page: Page, sessionId: string): Promise<BattleSessionView> {
  const response = await page.request.get(`/api/battles/${sessionId}`)
  expect(response.status()).toBe(200)
  return (await response.json()).battle as BattleSessionView
}

test('current Renewing Herbs summons, inspects and survives reload with its pinned profile', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000)
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    'Desktop Inspect contract is covered here.',
  )

  const characterName = await provision(page, testInfo)
  await equipRenewingHerbs(page)

  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByLabel('AI sparring arena').selectOption('crossroads-court')
  await page.getByRole('button', { name: 'Enter Battle', exact: true }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const root = page.locator('main[data-unified-battle="true"]')
  await expect(root).toHaveAttribute('data-local-turn', 'true')
  const sessionId = new URL(page.url()).pathname.split('/').at(-1)!
  const before = await readBattle(page, sessionId)
  const actorId = before.snapshot.tactical.battle.currentTurn?.combatantId
  expect(actorId).toBeTruthy()
  const actorPlacement = before.snapshot.tactical.placements.find(
    (placement) => placement.combatantId === actorId,
  )
  expect(actorPlacement).toBeTruthy()

  await root.getByRole('button', { name: /Choose Heal skill/ }).click()
  await page.getByRole('option', { name: /Renewing Herbs 45 AP/ }).click()
  await root.locator('[data-battle-command="recover"]').click()

  const candidates = before.snapshot.tactical.tiles.filter((tile) => {
    if (!actorPlacement) return false
    const distance =
      Math.abs(tile.position.x - actorPlacement.position.x) +
      Math.abs(tile.position.y - actorPlacement.position.y)
    return (
      distance >= 1 &&
      distance <= 3 &&
      !before.snapshot.tactical.placements.some(
        (placement) =>
          placement.position.x === tile.position.x && placement.position.y === tile.position.y,
      )
    )
  })

  let chosen: (typeof candidates)[number] | null = null
  for (const candidate of candidates) {
    const tile = root.getByRole('button', {
      name: new RegExp(`^Tile ${candidate.position.x + 1}, ${candidate.position.y + 1};`),
    })
    const previewResponse = page.waitForResponse(
      (response) => response.url().endsWith('/preview') && response.request().method() === 'POST',
    )
    await tile.click()
    const preview = (await (await previewResponse).json()).battlePreview.preview
    if (preview.legal) {
      chosen = candidate
      break
    }
  }

  expect(chosen).not.toBeNull()
  await expect(root.getByRole('button', { name: 'Confirm Action', exact: true })).toBeEnabled()

  const committed = page.waitForResponse(
    (response) =>
      /\/(intents|commit)$/.test(response.url()) && response.request().method() === 'POST',
  )
  await root.getByRole('button', { name: 'Confirm Action', exact: true }).click()
  const commitResponse = await committed
  expect(commitResponse.status()).toBe(200)
  const after = (await commitResponse.json()).battle as BattleSessionView

  const summon = after.snapshot.effectState?.summons?.find(
    (entry) => entry.ownerCombatantId === actorId,
  )
  expect(summon).toMatchObject({
    sourceSkillId: 'wildwarden.renewing-herbs',
    turnsCompleted: 0,
    profile: {
      id: 'summon.wildwarden.verdant-stalker',
      name: 'Verdant Stalker',
      lifetimeTurns: 5,
    },
  })
  expect(summon?.profile.abilities.map((ability) => ability.name)).toEqual([
    'Thorn Rake',
    'Verdant Mend',
  ])

  const placement = after.snapshot.tactical.placements.find(
    (entry) => entry.combatantId === summon?.combatantId,
  )
  expect(placement?.position).toEqual(chosen!.position)
  expect(after.snapshot.tactical.battle.initiativeOrder).not.toContain(summon?.combatantId)
  expect(after.snapshot.tactical.battle.deferredInitiativeCombatantIds).toContain(
    summon?.combatantId,
  )

  const summonTile = root.getByRole('button', {
    name: new RegExp(
      `^Tile ${placement!.position.x + 1}, ${placement!.position.y + 1};.*occupied by Verdant Stalker`,
    ),
  })
  await expect(summonTile).toBeVisible()
  await expect(summonTile.locator('[data-team="0"]')).toHaveCount(1)

  await expect(
    page.getByRole('button', { name: 'Inspect Verdant Stalker', exact: true }),
  ).toHaveCount(0)

  await root.getByRole('button', { name: /^Inspect,/ }).click()
  await summonTile.click()

  const inspect = page.getByRole('dialog', { name: 'Verdant Stalker battle details', exact: true })
  await expect(inspect).toBeVisible()
  await expect(inspect).toContainText(`Summoner: ${characterName}`)
  await expect(inspect).toContainText('5/5 turns')
  await expect(inspect).toContainText('Thorn Rake')
  await expect(inspect).toContainText('Verdant Mend')
  await page.keyboard.press('Escape')
  await expect(inspect).toHaveCount(0)

  await page.reload()
  const reloaded = await readBattle(page, sessionId)
  expect(reloaded.snapshot.effectState?.summons).toContainEqual(
    expect.objectContaining({
      combatantId: summon?.combatantId,
      sourceSkillId: 'wildwarden.renewing-herbs',
      profile: expect.objectContaining({
        id: 'summon.wildwarden.verdant-stalker',
        lifetimeTurns: 5,
      }),
    }),
  )

  const reloadedRoot = page.locator('main[data-unified-battle="true"]')
  await reloadedRoot.getByRole('button', { name: /^Inspect,/ }).click()
  const reloadedSummonTile = reloadedRoot.getByRole('button', {
    name: new RegExp(
      `^Tile ${placement!.position.x + 1}, ${placement!.position.y + 1};.*occupied by Verdant Stalker`,
    ),
  })
  await expect(reloadedSummonTile).toBeVisible()
  await reloadedSummonTile.click()
  const reloadedInspect = page.getByRole('dialog', {
    name: 'Verdant Stalker battle details',
    exact: true,
  })
  await expect(reloadedInspect).toContainText('5/5 turns')
  await expect(reloadedInspect).toContainText('Thorn Rake')
  await expect(reloadedInspect).toContainText('Verdant Mend')

  await testInfo.attach(`summon-flow-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
})
