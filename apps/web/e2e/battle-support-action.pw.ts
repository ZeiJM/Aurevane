import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

import { expect, test, type Page } from '@playwright/test'
import type { BattleSessionView } from '../src/server/battle/battle-session-service'
import type { SupportActionId } from '@aurevane/game-core/combat/support-actions'
import { DEFAULT_COMBAT_KEYBINDS } from '@aurevane/validation/player/combat-controls'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'
import { targetForecast } from './refined-battle-helpers'

async function saveSupport(page: Page, supportActionId: SupportActionId) {
  const response = await page.request.get('/api/character/build/support-action')
  expect(response.ok()).toBe(true)
  const { context } = await response.json()
  const saved = await page.request.post('/api/character/build/support-action', {
    data: {
      characterId: context.build.characterId,
      expectedBuildVersion: context.build.buildVersion,
      supportActionId,
      idempotencyKey: randomUUID(),
    },
  })
  const body = await saved.json()
  expect(saved.ok(), JSON.stringify(body)).toBe(true)
  expect(body.context.build.supportActionId).toBe(supportActionId)
  return context.build.characterId as string
}

async function provisionSupport(page: Page, supportActionId: SupportActionId) {
  const seed = randomUUID()
  const name = `Support ${seed.replace(/[^a-z]/g, '').slice(0, 10)}`
  await provisionAccountAndEnterCharacter({
    page,
    email: `support-${seed}@example.com`,
    password: 'Support-browser-2026!',
    characterName: name,
  })
  const characterId = await saveSupport(page, supportActionId)
  // The persisted guard identifier must continue to own custom slot-3 preferences.
  const saved = await page.request.put('/api/account/controls', {
    data: { combatKeybinds: { ...DEFAULT_COMBAT_KEYBINDS, guard: { code: 'KeyG', shift: false } } },
  })
  expect(saved.ok()).toBe(true)
  return { characterId, name }
}

async function enterAi(page: Page) {
  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
  const root = page.locator('main[data-unified-battle="true"]')
  await expect(root).toHaveAttribute('data-local-turn', 'true')
  await expect(root.locator('[data-command-card="guard"] [data-battle-command-hotkey]')).toHaveText(
    'G',
  )
  return root
}

async function readBattle(page: Page): Promise<BattleSessionView> {
  const id = new URL(page.url()).pathname.split('/').at(-1)!
  const response = await page.request.get(`/api/battles/${id}`)
  expect(response.ok()).toBe(true)
  return (await response.json()).battle as BattleSessionView
}

for (const supportActionId of ['basic.recover', 'basic.recover.mp'] as const) {
  test(`Guided Guard practice remains available with ${supportActionId} and full resources`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'laptop-chromium', 'Covered on desktop and mobile')
    const { characterId } = await provisionSupport(page, supportActionId)
    await page.goto('/game/battle')
    await page.getByLabel('Battle mode').selectOption('guided-fundamentals')
    await expect(page.getByLabel('AI sparring arena').locator('option:checked')).toContainText(
      'Duel Yard · 9×7',
    )
    await page.getByRole('button', { name: 'Enter Battle' }).click()
    await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
    await page
      .getByRole('dialog', { name: 'Complete the tactical fundamentals' })
      .getByRole('button', { name: 'Continue training' })
      .click()
    const before = await readBattle(page)
    const actor = before.snapshot.tactical.battle.combatants.find(
      (unit) => unit.id === `character:${characterId}`,
    )!
    expect(actor.mp).toBe(actor.maxMp)
    const practice = page.getByRole('button', { name: 'Practice Guard, 30 AP', exact: true })
    await practice.focus()
    await page.keyboard.down('Enter')
    await expect(targetForecast(page)).toContainText('30 AP')
    await page.keyboard.down('Enter')
    expect((await readBattle(page)).battleVersion).toBe(before.battleVersion)
    await page.keyboard.up('Enter')
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('progressbar', { name: 'Action Economy remaining' }),
    ).toHaveAttribute('aria-valuenow', '70')
    const after = await readBattle(page)
    expect(after.battleVersion).toBe(before.battleVersion + 1)
    expect(after.snapshot.tactical.battle.combatants.find((unit) => unit.id === actor.id)?.mp).toBe(
      actor.maxMp,
    )
    await expect(
      page.locator('[data-command-card="guard"] [data-battle-command="guard"]'),
    ).toHaveAccessibleName(
      supportActionId === 'basic.recover' ? 'HP Recovery, 50 AP' : 'MP Recovery, 50 AP',
    )
    const progress = await page.request.get(`/api/battles/${after.battleSessionId}/guided-training`)
    expect(progress.ok()).toBe(true)
    expect((await progress.json()).progress.guard).toBe(true)
    await expect(page.locator('[data-board-auto-fit]')).toHaveAttribute(
      'data-board-auto-fit',
      '9x7',
    )
  })
}

async function lowerResources(page: Page, characterId: string) {
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['localhost', '127.0.0.1'].includes(host))
    throw new Error('Resource preparation requires disposable local Supabase.')
  const before = await readBattle(page)
  const actorIndex = before.snapshot.tactical.battle.combatants.findIndex(
    (unit) => unit.id === `character:${characterId}`,
  )
  expect(actorIndex).toBeGreaterThanOrEqual(0)
  expect(before.battleVersion).toBe(1)
  const actor = before.snapshot.tactical.battle.combatants[actorIndex]!
  const container = execFileSync(
    'docker',
    ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')[0]
  if (!container) throw new Error('Disposable local database is required.')
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
      set current_snapshot = jsonb_set(
        jsonb_set(current_snapshot, '{tactical,battle,combatants,${actorIndex},hp}', '${Math.floor(actor.maxHp / 2)}'::jsonb),
        '{tactical,battle,combatants,${actorIndex},mp}', '${Math.floor(actor.maxMp / 2)}'::jsonb)
      where id = '${before.battleSessionId}'::uuid and current_version = 1
      returning id, current_version, current_snapshot
    ), prepared_snapshot as (
      update app_private.battle_snapshots snapshot set snapshot = session.current_snapshot
      from prepared_session session where snapshot.battle_session_id = session.id
        and snapshot.battle_version = session.current_version returning snapshot.battle_version
    ) select jsonb_build_object('sessions', (select count(*) from prepared_session), 'snapshots', (select count(*) from prepared_snapshot));`,
    ],
    { encoding: 'utf8' },
  )
  expect(JSON.parse(updated.trim())).toEqual({ sessions: 1, snapshots: 1 })
  await page.reload()
  return readBattle(page)
}

for (const [supportActionId, label, cost] of [
  ['basic.guard', 'Guard', 30],
  ['basic.recover', 'HP Recovery', 50],
  ['basic.recover.mp', 'MP Recovery', 50],
] as const) {
  test(`AI slot 3 pins ${label}, respects custom keys and commits once per deliberate input`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chromium', 'Physical keyboard contract')
    test.slow()
    const { characterId } = await provisionSupport(page, supportActionId)
    const root = await enterAi(page)
    const slot = root.locator('[data-battle-command="guard"]')
    await expect(slot).toHaveAccessibleName(`${label}, ${cost} AP`)
    let commits = 0
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        /\/(intents|commit)$/.test(new URL(request.url()).pathname)
      )
        commits++
    })
    await page.mouse.move(0, 0)
    await root.focus()
    if (supportActionId !== 'basic.guard') {
      // Full HP/MP remains blocked by authoritative requirements, even on a deliberate second press.
      const blocked = page.waitForResponse('**/api/battles/*/preview')
      await page.keyboard.press('KeyG')
      expect((await (await blocked).json()).battlePreview.preview).toMatchObject({
        actionId: supportActionId,
        legal: false,
      })
      await page.keyboard.press('KeyG')
      await expect(targetForecast(page)).toContainText(label)
      expect(commits).toBe(0)
      await page.getByRole('button', { name: 'Cancel Action' }).click()
      await lowerResources(page, characterId)
    }
    const before = await readBattle(page)
    expect(
      before.snapshot.buildAuthority?.combatants.find(
        (unit) => unit.combatantId === `character:${characterId}`,
      )?.supportActionId,
    ).toBe(supportActionId)
    // Current build edits must not retarget an already-pinned battle.
    await saveSupport(page, supportActionId === 'basic.guard' ? 'basic.recover.mp' : 'basic.guard')
    await page.reload()
    await expect(slot).toHaveAccessibleName(`${label}, ${cost} AP`)
    await expect(
      root.locator('[data-command-card="guard"] [data-battle-command-hotkey]'),
    ).toHaveText('G')
    await page.mouse.move(0, 0)
    await root.focus()
    await page.keyboard.press('Digit3')
    await expect(slot).not.toHaveAttribute('data-active', 'true')
    const ready = page.waitForResponse('**/api/battles/*/preview')
    await page.keyboard.press('KeyG')
    expect((await (await ready).json()).battlePreview.preview).toMatchObject({
      actionId: supportActionId,
      legal: true,
      actionEconomyCost: cost,
    })
    expect(commits).toBe(0)
    await expect(root).toHaveAttribute(
      'data-battle-action-mode',
      supportActionId === 'basic.guard' ? 'guard' : 'recover',
    )
    await page.evaluate(() =>
      window.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'KeyG', key: 'g', repeat: true, bubbles: true }),
      ),
    )
    expect(commits).toBe(0)
    await root.getByRole('button', { name: `About ${label}`, exact: true }).click()
    await expect(page.locator('[data-battle-info-panel]')).toBeVisible()
    await page.keyboard.press('KeyG')
    expect(commits).toBe(0)
    await page.getByRole('button', { name: `Close ${label}`, exact: true }).click()
    await page.mouse.move(0, 0)
    await root.focus()
    const committed = page.waitForResponse('**/api/battles/*/intents')
    await page.keyboard.press('KeyG')
    const response = await committed
    const body = await response.json()
    expect(response.ok(), JSON.stringify(body)).toBe(true)
    expect(response.request().postDataJSON().intent).toEqual({
      kind: 'action',
      actionId: supportActionId,
      target: { kind: 'self' },
    })
    await expect(
      root.getByRole('progressbar', { name: 'Action Economy remaining' }),
    ).toHaveAttribute('aria-valuenow', `${100 - cost}`)
    expect(commits).toBe(1)
    const after = body.battle as BattleSessionView
    expect(after.battleVersion).toBe(before.battleVersion + 1)
    const beforeActor = before.snapshot.tactical.battle.combatants.find(
      (unit) => unit.id === `character:${characterId}`,
    )!
    const afterActor = after.snapshot.tactical.battle.combatants.find(
      (unit) => unit.id === beforeActor.id,
    )!
    if (supportActionId === 'basic.recover') {
      expect(afterActor.hp).toBeGreaterThan(beforeActor.hp)
      expect(afterActor.mp).toBe(beforeActor.mp)
    } else if (supportActionId === 'basic.recover.mp') {
      expect(afterActor.mp).toBeGreaterThan(beforeActor.mp)
      expect(afterActor.hp).toBe(beforeActor.hp)
    } else {
      expect(
        after.snapshot.statusState.find((row) => row.combatantId === beforeActor.id)?.statuses,
      ).toEqual(expect.arrayContaining([expect.objectContaining({ statusId: 'guarded' })]))
    }
    // The server snapshot drives the visual lock; blocked gestures send no authority request.
    await expect(slot).toBeDisabled()
    await expect(slot).toHaveAccessibleName(`${label}, ${cost} AP, Cooldown: 2 turns remaining`)
    const supportArt = root.locator('[data-command-card="guard"] [data-battle-command-artwork]')
    await expect(supportArt).toHaveAttribute('data-battle-skill-cooldown', '2')
    await expect(supportArt.locator('[data-battle-cooldown-countdown]')).toContainText('2')
    expect(
      await supportArt.locator('img').evaluate((image) => getComputedStyle(image).filter),
    ).toContain('grayscale(1)')
    if (supportActionId === 'basic.guard') {
      await page.reload()
      await expect(slot).toBeDisabled()
      await expect(slot).toHaveAccessibleName('Guard, 30 AP, Cooldown: 2 turns remaining')
    }
    const cooldownRequests: string[] = []
    const observeCooldown = (request: import('@playwright/test').Request) => {
      if (
        request.method() === 'POST' &&
        /\/(preview|intents|commit|final-turn)$/.test(new URL(request.url()).pathname)
      )
        cooldownRequests.push(request.url())
    }
    page.on('request', observeCooldown)
    try {
      await page.mouse.move(0, 0)
      await root.focus()
      await slot.evaluate((button) => (button as HTMLButtonElement).click())
      await page.keyboard.press('KeyG')
      await page.keyboard.press('KeyG')
      if (supportActionId !== 'basic.guard') {
        // HP and MP Recovery share one canonical lock, including the independent R shortcut.
        await page.keyboard.press('KeyR')
        await page.keyboard.press('KeyR')
      }
      const information = root.getByRole('button', { name: `About ${label}`, exact: true })
      await expect(information).toBeEnabled()
      await information.click()
      await expect(page.locator('[data-battle-info-panel]')).toBeVisible()
      await page.keyboard.press('Escape')
      expect(cooldownRequests).toEqual([])
      expect(commits).toBe(1)
      const unchanged = await readBattle(page)
      expect(unchanged.battleVersion).toBe(after.battleVersion)
      await expect(
        root.getByRole('progressbar', { name: 'Action Economy remaining' }),
      ).toHaveAttribute('aria-valuenow', `${100 - cost}`)
    } finally {
      page.off('request', observeCooldown)
    }
  })
}

test('PvP pins independent HP/MP Support Actions into the shared slot 3', async ({
  browser,
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One shared PvP keyboard proof')
  test.slow()
  const hostContext = await browser.newContext({ baseURL })
  const guestContext = await browser.newContext({ baseURL })
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()
  let closed: PromiseSettledResult<void>[] = []
  try {
    const hostCharacter = await provisionSupport(host, 'basic.recover.mp')
    const guestCharacter = await provisionSupport(guest, 'basic.recover')
    await host.goto('/game/battle')
    await host.getByRole('button', { name: 'PVP - Direct', exact: true }).click()
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
    await expect(host).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/, { timeout: 20_000 })
    await expect(guest).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/, { timeout: 20_000 })
    await expect(host.locator('[data-battle-command="guard"]')).toHaveAccessibleName(
      'MP Recovery, 50 AP',
    )
    await expect(guest.locator('[data-battle-command="guard"]')).toHaveAccessibleName(
      'HP Recovery, 50 AP',
    )
    await lowerResources(host, hostCharacter.characterId)
    await lowerResources(guest, guestCharacter.characterId)
    await host.reload()
    const hostStarts =
      (await host.locator('main[data-unified-battle]').getAttribute('data-local-turn')) === 'true'
    const actorPage = hostStarts ? host : guest
    const actionId = hostStarts ? 'basic.recover.mp' : 'basic.recover'
    const actorRoot = actorPage.locator('main[data-unified-battle]')
    await expect(
      actorRoot.locator('[data-command-card="guard"] [data-battle-command-hotkey]'),
    ).toHaveText('G')
    await actorPage.mouse.move(0, 0)
    await actorRoot.focus()
    const ready = actorPage.waitForResponse('**/api/battles/*/preview')
    await actorPage.keyboard.press('KeyG')
    expect((await (await ready).json()).battlePreview.preview).toMatchObject({
      legal: true,
      actionId,
    })
    const committed = actorPage.waitForResponse('**/api/battles/*/commit', { timeout: 10_000 })
    await actorPage.keyboard.press('KeyG')
    const response = await committed
    expect(response.ok()).toBe(true)
    expect(response.request().postDataJSON().intent.actionId).toBe(actionId)
    await expect(
      actorRoot.getByRole('progressbar', { name: 'Action Economy remaining' }),
    ).toHaveAttribute('aria-valuenow', '50')
  } finally {
    closed = await Promise.allSettled([hostContext.close(), guestContext.close()])
  }
  for (const result of closed) {
    if (result.status === 'rejected') throw result.reason
  }
})

test('a Support Action preview arriving while a reading panel is open cannot commit', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'Physical keyboard contract')
  test.slow()
  const { characterId } = await provisionSupport(page, 'basic.recover.mp')
  const root = await enterAi(page)
  const before = await lowerResources(page, characterId)
  await expect(root.locator('[data-command-card="guard"] [data-battle-command-hotkey]')).toHaveText(
    'G',
  )
  let commits = 0
  let previews = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/preview'))
      previews++
    if (request.method() === 'POST' && /\/(intents|commit)$/.test(new URL(request.url()).pathname))
      commits++
  })
  let releasePreview!: () => void
  const hold = new Promise<void>((resolve) => {
    releasePreview = resolve
  })
  const handlers: Promise<void>[] = []
  await page.route('**/api/battles/*/preview', async (route) => {
    let settle!: () => void
    handlers.push(
      new Promise<void>((resolve) => {
        settle = resolve
      }),
    )
    try {
      const response = await route.fetch().catch(() => null)
      await hold
      if (response) await route.fulfill({ response }).catch(() => undefined)
    } finally {
      settle()
    }
  })
  await page.mouse.move(0, 0)
  await root.focus()
  const firstPreview = page.waitForRequest('**/api/battles/*/preview')
  await page.keyboard.press('KeyG')
  await firstPreview
  await expect(root.locator('[data-battle-command="guard"]')).toHaveAttribute('data-active', 'true')
  await page.keyboard.press('KeyG')
  await expect(root.locator('[data-battle-command="guard"]')).toBeDisabled()
  expect(previews).toBe(1)
  expect(commits).toBe(0)
  await root.getByRole('button', { name: 'About MP Recovery', exact: true }).click()
  await expect(page.locator('[data-battle-info-panel]')).toBeVisible()
  releasePreview()
  await Promise.all(handlers)
  await expect(root.locator('[data-battle-command="guard"]')).toBeEnabled()
  await expect(root.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '100',
  )
  expect(previews).toBe(1)
  expect(commits).toBe(0)
  const after = await readBattle(page)
  expect(after.battleVersion).toBe(before.battleVersion)
  expect(after.snapshot.tactical.battle.combatants).toEqual(
    before.snapshot.tactical.battle.combatants,
  )
})
