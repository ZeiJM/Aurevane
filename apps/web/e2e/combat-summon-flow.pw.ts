import { execFileSync } from 'node:child_process'
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import {
  terrainAdjustedDefense,
  terrainEvasionBonusBasisPoints,
} from '@aurevane/game-core/combat/combat-stat-balance'

import type { BattleSessionView } from '../src/server/battle/battle-session-service'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function readPersistedDeferredInitiative(sessionId: string): readonly string[] {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new Error('Invalid test battle ID')
  const container = execFileSync(
    'docker',
    ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')[0]
  if (!container) throw new Error('Disposable test database is unavailable')
  const value = execFileSync(
    'docker',
    [
      'exec',
      container,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-Atqc',
      `select current_snapshot #> '{tactical,battle,deferredInitiativeCombatantIds}' from app_private.battle_sessions where id = '${sessionId}'::uuid;`,
    ],
    { encoding: 'utf8' },
  ).trim()
  return JSON.parse(value) as readonly string[]
}

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

async function equipInvocation(page: Page): Promise<void> {
  await page.goto('/game/nexus')
  await expect(page.locator('[data-arsenal-workspace]')).toBeVisible()

  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  const techniques = page.getByRole('dialog', { name: 'Techniques', exact: true })
  const invocation = techniques
    .getByRole('radiogroup', { name: 'Support Action' })
    .locator('article')
    .filter({ hasText: 'Invocation' })
  const radio = invocation.getByRole('radio', { name: 'Invocation', exact: true })
  const coarsePointer = await page.evaluate(
    () => window.matchMedia('(hover: none), (pointer: coarse)').matches,
  )

  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/character/build/support-action') &&
      response.request().method() === 'POST',
  )
  if (coarsePointer) {
    await invocation.locator('label').click()
    await page.getByRole('button', { name: 'Use as Support Action', exact: true }).click()
  } else {
    await radio.check()
  }
  expect((await saved).status()).toBe(200)
  await expect(radio).toBeChecked()
  await techniques.getByRole('button', { name: 'Close', exact: true }).click()
}

async function readBattle(page: Page, sessionId: string): Promise<BattleSessionView> {
  const response = await page.request.get(`/api/battles/${sessionId}`)
  expect(response.status()).toBe(200)
  return (await response.json()).battle as BattleSessionView
}

test('current Invocation spawns Vesper immediately, joins initiative next round and survives inspection and reload with its pinned profile', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000)
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    'Desktop Inspect contract is covered here.',
  )

  const characterName = await provision(page, testInfo)
  await equipInvocation(page)

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
  expect(
    before.snapshot.buildAuthority?.combatants.find((entry) => entry.combatantId === actorId)
      ?.supportActionId,
  ).toBe('basic.invocation')
  const actorPlacement = before.snapshot.tactical.placements.find(
    (placement) => placement.combatantId === actorId,
  )
  expect(actorPlacement).toBeTruthy()

  const armedPreview = page.waitForResponse(
    (response) => response.url().endsWith('/preview') && response.request().method() === 'POST',
  )
  await root.getByRole('button', { name: 'Invocation, 45 AP / 10 MP', exact: true }).click()
  expect((await armedPreview).status()).toBe(200)
  expect(await readBattle(page, sessionId)).toEqual(before)
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
    const previewResponse = await page.request.post(`/api/battles/${sessionId}/preview`, {
      data: {
        expectedBattleVersion: before.battleVersion,
        intent: {
          kind: 'action',
          actionId: 'basic.invocation',
          target: { kind: 'tile', position: candidate.position },
        },
      },
    })
    expect(previewResponse.status()).toBe(200)
    const preview = (await previewResponse.json()).battlePreview.preview
    if (preview.legal) {
      chosen = candidate
      break
    }
  }

  expect(chosen).not.toBeNull()

  const committed = page.waitForResponse(
    (response) =>
      /\/(intents|commit)$/.test(response.url()) && response.request().method() === 'POST',
  )
  await root
    .getByRole('button', {
      name: new RegExp(`^Tile ${chosen!.position.x + 1}, ${chosen!.position.y + 1};`),
    })
    .click()
  const commitResponse = await committed
  expect(commitResponse.status()).toBe(200)
  const after = (await commitResponse.json()).battle as BattleSessionView

  const initiativeRound = before.snapshot.tactical.battle.round + 1
  expect(after.battleVersion).toBe(before.battleVersion + 1)
  expect(after.snapshot.tactical.battle.round).toBe(before.snapshot.tactical.battle.round)
  // Invocation is Instant: placement is immediate, while its first turn waits for the next round.
  const summon = after.snapshot.effectState?.summons?.find(
    (entry) => entry.ownerCombatantId === actorId,
  )
  expect(summon).toMatchObject({
    sourceSkillId: 'basic.invocation',
    spawnedRound: before.snapshot.tactical.battle.round,
    turnsCompleted: 0,
    profile: {
      id: 'summon.vesper',
      name: 'Vesper',
      lifetimeTurns: 4,
    },
  })
  expect(summon?.profile.abilities.map((ability) => ability.name)).toEqual(['Moon Bolt'])
  expect(after.snapshot.effectState?.summons).toHaveLength(
    (before.snapshot.effectState?.summons?.length ?? 0) + 1,
  )
  expect(
    after.snapshot.tactical.placements.find((entry) => entry.combatantId === summon?.combatantId)
      ?.position,
  ).toEqual(chosen!.position)
  expect(after.snapshot.tactical.placements).toEqual(
    expect.arrayContaining([...before.snapshot.tactical.placements]),
  )
  expect(after.snapshot.tactical.placements).toHaveLength(
    before.snapshot.tactical.placements.length + 1,
  )
  expect(after.snapshot.tactical.battle.initiativeOrder).not.toContain(summon?.combatantId)
  expect(readPersistedDeferredInitiative(sessionId)).toContain(summon?.combatantId)
  expect(
    after.snapshot.statusState.find((row) => row.combatantId === actorId)?.statuses ?? [],
  ).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ statusId: 'summon', timingState: 'pending' }),
    ]),
  )
  expect(after.snapshot).not.toHaveProperty('pendingSummons')
  expect(after.snapshot).not.toHaveProperty('pendingEffects')
  expect(after.snapshot).not.toHaveProperty('pendingSkillGrants')
  const targetTile = root.getByRole('button', {
    name: new RegExp(`^Tile ${chosen!.position.x + 1}, ${chosen!.position.y + 1};`),
  })
  await expect(targetTile).toHaveAttribute('aria-label', /occupied by Vesper/)
  await page.reload()
  const deferred = await readBattle(page, sessionId)
  expect(deferred.battleVersion).toBe(after.battleVersion)
  expect(deferred.snapshot.effectState?.summons ?? []).toEqual(
    after.snapshot.effectState?.summons ?? [],
  )
  expect(deferred.snapshot.statusState).toEqual(after.snapshot.statusState)
  expect(readPersistedDeferredInitiative(sessionId)).toContain(summon?.combatantId)
  await expect(targetTile).toHaveAttribute('aria-label', /occupied by Vesper/)
  await expect(root).toHaveAttribute('data-local-turn', 'true')

  // Capture the first global-boundary transition before the summon AI can move
  // or complete its first turn. The page continues to run real Recruit/summon turns.
  const boundary = page.waitForResponse(
    async (response) => {
      if (
        !response.url().match(new RegExp(`/api/battles/${sessionId}/(final-turn|recruit-turn)$`)) ||
        response.request().method() !== 'POST' ||
        response.status() !== 200
      )
        return false
      const body = await response.json()
      return body.battle.snapshot.tactical.battle.round === initiativeRound
    },
    { timeout: 30_000 },
  )
  const finished = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/battles/${sessionId}/final-turn`) &&
      response.request().method() === 'POST',
  )
  const finish = root.getByRole('button', { name: /^End Turn,/ })
  await expect(finish).toBeEnabled()
  await finish.click()
  await finish.press('KeyD')
  expect((await finished).status()).toBe(200)
  await expect(root).not.toHaveAttribute('data-local-turn', 'true')
  const activated = (await (await boundary).json()).battle as BattleSessionView
  expect(activated.snapshot.tactical.battle.round).toBe(initiativeRound)
  expect(activated.snapshot.effectState?.summons).toContainEqual(summon)

  const spawnedPlacement = activated.snapshot.tactical.placements.find(
    (entry) => entry.combatantId === summon?.combatantId,
  )
  expect(spawnedPlacement?.position).toEqual(chosen!.position)
  expect(activated.snapshot.effectState?.summons).toHaveLength(
    (before.snapshot.effectState?.summons?.length ?? 0) + 1,
  )
  expect(activated.snapshot.tactical.battle.initiativeOrder).toContain(summon?.combatantId)
  // The already placed summon joins this round without an extra deferred-initiative wait.
  expect(readPersistedDeferredInitiative(sessionId) ?? []).not.toContain(summon?.combatantId)
  await expect(root).toHaveAttribute('data-local-turn', 'true', { timeout: 30_000 })
  const current = await readBattle(page, sessionId)
  expect(current.snapshot.tactical.battle.round).toBe(initiativeRound)
  expect(current.snapshot).not.toHaveProperty('pendingSummons')
  expect(
    current.snapshot.statusState.find((row) => row.combatantId === actorId)?.statuses ?? [],
  ).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ statusId: 'summon', timingState: 'pending' }),
    ]),
  )
  const currentSummon = current.snapshot.effectState!.summons!.find(
    (entry) => entry.combatantId === summon!.combatantId,
  )!
  expect(currentSummon).toBeTruthy()
  expect(currentSummon.turnsCompleted).toBeLessThanOrEqual(1)
  const remainingTurns = currentSummon.profile.lifetimeTurns - currentSummon.turnsCompleted
  const placement = current.snapshot.tactical.placements.find(
    (entry) => entry.combatantId === summon!.combatantId,
  )!

  await expect(page.getByRole('button', { name: 'Inspect Vesper', exact: true })).toHaveCount(0)

  const summonTile = root.getByRole('button', {
    name: new RegExp(
      `^Tile ${placement!.position.x + 1}, ${placement!.position.y + 1};.*occupied by`,
    ),
  })
  await expect(summonTile).not.toHaveAttribute('data-desktop-inspect-combatant')
  let inspectCommands = 0
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      /\/(intents|commit|final-turn|recruit-turn)$/.test(new URL(request.url()).pathname)
    )
      inspectCommands++
  })
  await root.getByRole('button', { name: /^Inspect,/ }).click()
  await expect(summonTile).not.toHaveAttribute('data-desktop-inspect-combatant')
  await summonTile.click()

  const localCard = page.locator('[data-battle-combatant-card="local"]')
  await expect(localCard).toContainText('Vesper')
  const enemyCard = page.locator('[data-battle-combatant-card="selected"]')
  await expect(enemyCard).toContainText('Recruit')
  await expect(enemyCard).not.toContainText('Vesper')
  const inspect = page.getByRole('dialog', {
    name: 'Vesper battle details',
    exact: true,
  })
  await expect(inspect).toHaveCount(0)
  const summonPortrait = localCard.getByRole('button', {
    name: 'Inspect Vesper',
    exact: true,
  })
  await expect(summonPortrait).toHaveAttribute(
    'data-desktop-inspect-combatant',
    summon!.combatantId,
  )
  await summonPortrait.click()
  await expect(inspect).toBeVisible()
  const summonCombatant = current.snapshot.tactical.battle.combatants.find(
    (entry) => entry.id === summon!.combatantId,
  )!
  const summonStats = current.snapshot.statBridge.combatants.find(
    (entry) => entry.combatantId === summon!.combatantId,
  )!
  const expectPinnedSummonStats = async (details: Locator) => {
    await expect(details).toContainText(`${summonCombatant.hp}/${summonCombatant.maxHp}`)
    await expect(details).toContainText(`${summonCombatant.mp}/${summonCombatant.maxMp}`)
    for (const [label, value] of [
      ['Initiative', String(summonCombatant.initiative)],
      ['Movement', String(summonCombatant.baseMovementBudget)],
      ['Jump', String(summonStats.jump)],
      ['Accuracy', `${Math.round(summonStats.accuracy / 100)}%`],
      [
        'Evasion',
        `${Math.round((summonStats.evasion + terrainEvasionBonusBasisPoints(current.snapshot, summon!.combatantId)) / 100)}%`,
      ],
      [
        'Physical Defense',
        String(terrainAdjustedDefense(current.snapshot, summon!.combatantId, summonStats.armor)),
      ],
      [
        'Mystic Defense',
        String(terrainAdjustedDefense(current.snapshot, summon!.combatantId, summonStats.ward)),
      ],
    ] as const) {
      await expect(
        details
          .locator('dl > div')
          .filter({ has: page.getByText(label, { exact: true }) })
          .locator('dd'),
      ).toHaveText(value)
    }
  }
  await expectPinnedSummonStats(inspect)
  await expect(inspect).toContainText(`Summoner: ${characterName}`)
  await expect(inspect).toContainText(`${remainingTurns}/4 turns`)
  await expect(inspect).toContainText('Moon Bolt')
  await page.keyboard.press('4')
  await expect(root.getByRole('button', { name: /^Inspect,/ })).toHaveAttribute(
    'data-active',
    'true',
  )
  await expect(inspect).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(inspect).toHaveCount(0)
  await expect(root.getByRole('button', { name: /^Inspect,/ })).not.toHaveAttribute(
    'data-active',
    'true',
  )
  await expect(root).toBeFocused()
  await expect(localCard).toContainText(characterName)
  await expect(localCard).not.toContainText('Vesper')
  await expect(enemyCard).toContainText('Recruit')
  await expect(summonTile).not.toHaveAttribute('data-desktop-inspect-combatant')
  expect(inspectCommands).toBe(0)
  expect(await readBattle(page, sessionId)).toEqual(current)

  await page.reload()
  const reloaded = await readBattle(page, sessionId)
  expect(reloaded.snapshot.effectState?.summons).toContainEqual(
    expect.objectContaining({
      combatantId: summon?.combatantId,
      sourceSkillId: 'basic.invocation',
      turnsCompleted: currentSummon.turnsCompleted,
      profile: expect.objectContaining({
        id: 'summon.vesper',
        lifetimeTurns: 4,
      }),
    }),
  )

  const reloadedRoot = page.locator('main[data-unified-battle="true"]')
  await reloadedRoot.getByRole('button', { name: /^Inspect,/ }).click()
  await reloadedRoot
    .getByRole('button', {
      name: new RegExp(
        `^Tile ${placement!.position.x + 1}, ${placement!.position.y + 1};.*occupied by`,
      ),
    })
    .click()
  await expect(localCard).toContainText('Vesper')
  const reloadedInspect = page.getByRole('dialog', {
    name: 'Vesper battle details',
    exact: true,
  })
  await expect(reloadedInspect).toHaveCount(0)
  await localCard.getByRole('button', { name: 'Inspect Vesper', exact: true }).click()
  await expect(enemyCard).toContainText('Recruit')
  await expect(enemyCard).not.toContainText('Vesper')
  await expect(reloadedInspect).toBeVisible()
  await expectPinnedSummonStats(reloadedInspect)
  await expect(reloadedInspect).toContainText(`${remainingTurns}/4 turns`)
  await expect(reloadedInspect).toContainText('Moon Bolt')
  expect(inspectCommands).toBe(0)
  expect(await readBattle(page, sessionId)).toEqual(reloaded)

  await testInfo.attach(`summon-flow-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
})
