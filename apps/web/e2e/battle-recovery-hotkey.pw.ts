import { execFileSync } from 'node:child_process'

import { expect, test, type Page } from '@playwright/test'
import type { BattleSessionView } from '../src/server/battle/battle-session-service'

import { targetForecast } from './refined-battle-helpers'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Recovery ${letters}`
}

async function prepareInjuredActor(page: Page) {
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['localhost', '127.0.0.1'].includes(host))
    throw new Error('Recovery setup requires disposable local Supabase.')
  const sessionId = new URL(page.url()).pathname.split('/').at(-1)!
  expect(sessionId).toMatch(/^[0-9a-f-]{36}$/i)
  const response = await page.request.get(`/api/battles/${sessionId}`)
  expect(response.ok()).toBe(true)
  const before = (await response.json()).battle as BattleSessionView
  expect(before.battleVersion).toBe(1)
  const actorIndex = before.snapshot.tactical.battle.combatants.findIndex(
    (unit) => unit.id === before.snapshot.tactical.battle.currentTurn?.combatantId,
  )
  expect(actorIndex).toBeGreaterThanOrEqual(0)
  const actor = before.snapshot.tactical.battle.combatants[actorIndex]!
  const hp = Math.floor(actor.maxHp / 2)
  expect(hp).toBeGreaterThan(0)
  const container = execFileSync(
    'docker',
    ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')[0]
  if (!container) throw new Error('Disposable local Supabase database is required.')
  // Keep the disposable initial snapshot and current state coherent for commit provenance.
  // Change only actor HP; retain the pinned rules/build and original battle version.
  const updated = execFileSync(
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
      `with prepared_session as (
        update app_private.battle_sessions
        set current_snapshot = jsonb_set(current_snapshot, '{tactical,battle,combatants,${actorIndex},hp}', '${hp}'::jsonb)
        where id = '${sessionId}'::uuid and current_version = 1
        returning id, current_version, current_snapshot
      ), prepared_snapshot as (
        update app_private.battle_snapshots snapshot
        set snapshot = session.current_snapshot
        from prepared_session session
        where snapshot.battle_session_id = session.id
          and snapshot.battle_version = session.current_version
        returning snapshot.battle_version
      )
      select jsonb_build_object(
        'sessions', (select count(*) from prepared_session),
        'snapshots', (select count(*) from prepared_snapshot)
      );`,
    ],
    { encoding: 'utf8' },
  )
  expect(JSON.parse(updated.trim())).toEqual({ sessions: 1, snapshots: 1 })
  await page.reload()
  const prepared = await page.request.get(`/api/battles/${sessionId}`)
  expect(prepared.ok()).toBe(true)
  const battle = (await prepared.json()).battle as BattleSessionView
  expect(battle.battleVersion).toBe(before.battleVersion)
  expect(battle.snapshot.tactical.battle.combatants[actorIndex]!.hp).toBe(hp)
  return battle
}

test('retains default HP Recovery keyboard input without exposing the deferred Recovery menu', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop keyboard shortcut contract')
  test.slow()

  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `recovery-hotkey-${projectSlug}-${Date.now()}@example.com`
  const password = 'Recovery-hotkey-2026!'
  const characterName = uniqueCharacterName()

  await createAccountAndEnterCharacter({ page, email, password, characterName })
  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const root = page.locator("main[data-unified-battle='true'][data-battle-kind='pve']")
  await expect(root).toBeVisible()
  const deck = root.getByRole('region', { name: 'Command Deck' })
  const economy = root.getByRole('progressbar', { name: 'Action Economy remaining' })
  await expect(root.locator('[data-battle-secondary-actions]')).toHaveCount(0)
  let commits = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/intents'))
      commits += 1
  })
  const unavailablePreview = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname.endsWith('/preview'),
  )
  await page.keyboard.press('KeyR')
  const unavailableResponse = await unavailablePreview
  expect(unavailableResponse.ok()).toBe(true)
  expect((await unavailableResponse.json()).battlePreview.preview).toMatchObject({
    legal: false,
    actionId: 'basic.recover',
    issues: [expect.objectContaining({ code: 'requirement-not-met' })],
  })
  await expect(targetForecast(page)).toContainText('HP Recovery')
  await expect(root.getByRole('button', { name: 'Forecast details', exact: true })).toBeVisible()
  await expect(economy).toHaveAttribute('aria-valuenow', '100')
  await root.focus()
  await page.keyboard.press('Enter')
  expect(commits).toBe(0)
  await root.getByRole('button', { name: 'Cancel Action' }).click()
  const prepared = await prepareInjuredActor(page)
  await expect(root).toHaveAttribute('data-local-turn', 'true')
  // Focus the battle's keyboard root so Enter remains a battle shortcut.
  await root.focus()
  const readyPreview = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname.endsWith('/preview'),
  )
  await page.keyboard.press('KeyR')
  const readyResponse = await readyPreview
  expect(readyResponse.ok()).toBe(true)
  expect((await readyResponse.json()).battlePreview.preview).toMatchObject({
    legal: true,
    actionId: 'basic.recover',
    actionEconomyCost: 50,
  })
  await expect(targetForecast(page)).toContainText('HP Recovery')
  await expect(root.getByRole('button', { name: 'Forecast details', exact: true })).toBeVisible()
  await expect(economy).toHaveAttribute('aria-valuenow', '100')
  await expect(deck.locator('[data-battle-skill-slot]')).toHaveCount(4)
  await expect(root).toBeFocused()
  const committed = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname.endsWith('/intents'),
  )
  await page.keyboard.press('Enter')
  const committedResponse = await committed
  const committedPayload = await committedResponse.json()
  expect(committedResponse.ok(), JSON.stringify(committedPayload)).toBe(true)
  expect(committedResponse.request().postDataJSON().intent).toEqual({
    kind: 'action',
    actionId: 'basic.recover',
    target: { kind: 'self' },
  })
  const after = committedPayload.battle as BattleSessionView
  expect(after.battleVersion).toBe(prepared.battleVersion + 1)
  const actorId = prepared.snapshot.tactical.battle.currentTurn!.combatantId
  const beforeActor = prepared.snapshot.tactical.battle.combatants.find(
    (unit) => unit.id === actorId,
  )!
  const afterActor = after.snapshot.tactical.battle.combatants.find((unit) => unit.id === actorId)!
  expect(afterActor.hp).toBeGreaterThan(beforeActor.hp)
  expect(commits).toBe(1)
  await expect(economy).toHaveAttribute('aria-valuenow', '50')
  await expect(root.locator('[data-battle-secondary-actions]')).toHaveCount(0)
})
