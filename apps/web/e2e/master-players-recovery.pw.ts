import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'
import {
  acquirePlayersFixtureOwner,
  cleanupPlayersFixture,
  type FixtureOwner,
} from './players-local-fixture'
import type { MasterPlayerView } from '../src/master/players'

function sql(query: string) {
  const names = execFileSync(
    'docker',
    ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')
  if (names.length !== 1 || !names[0]?.startsWith('supabase_db_'))
    throw new Error('Players proof requires one disposable local Supabase container.')
  return execFileSync(
    'docker',
    [
      'exec',
      names[0],
      'psql',
      '-X',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-Atqc',
      query,
    ],
    { encoding: 'utf8' },
  ).trim()
}
test('Owner corrections and whole encounter recovery reach actual PvE, both PvP participants and spectator', async ({
  browser,
  baseURL,
}, info) => {
  test.skip(
    info.project.name !== 'desktop-chromium',
    'This proof explicitly checks desktop/laptop/mobile/narrow/CSS2x.',
  )
  test.setTimeout(300000)
  expect(['localhost', '127.0.0.1']).toContain(
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname,
  )
  const contexts = await Promise.all(
    [0, 1, 2, 3].map(() => browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } })),
  )
  const [owner, host, guest, watcher] = (await Promise.all(
    contexts.map((context) => context.newPage()),
  )) as [Page, Page, Page, Page]
  const suffix = randomUUID()
    .replace(/[^a-z]/g, '')
    .slice(0, 8)
  const identities = ['Owner', 'Player', 'Peer', 'Watcher'].map((prefix) => ({
    email: `players-${prefix}-${randomUUID()}@example.test`,
    characterName: `${prefix} ${suffix}`,
  }))
  let ownerGrant: FixtureOwner | undefined
  let primaryFailure = false
  async function capture(name: string) {
    const filename = `players-r${info.repeatEachIndex}-${name}.png`
    const path = info.outputPath(filename)
    await owner.screenshot({ path, fullPage: true })
    mkdirSync('/tmp/players-task9-review', { recursive: true })
    copyFileSync(path, `/tmp/players-task9-review/${filename}`)
  }
  try {
    const accounts: { userId: string }[] = []
    for (const [index, page] of [owner, host, guest, watcher].entries())
      accounts.push(
        await provisionAccountAndEnterCharacter({
          page,
          ...identities[index]!,
          password: 'Disposable-Players-2026!',
        }),
      )
    const ownerId = accounts[0]!.userId
    ownerGrant = await acquirePlayersFixtureOwner(sql, ownerId)
    const characterId = sql(
      `select id from public.characters where user_id='${accounts[1]!.userId}'`,
    )
    expect(characterId).toMatch(/^[0-9a-f-]{36}$/u)
    await owner.goto('/master/players')
    await expect(owner.getByRole('heading', { name: 'Players', exact: true })).toBeVisible()
    await expect(
      owner.getByTestId('authenticated-shell').locator('[data-av-game-rail]'),
    ).toBeVisible()
    await owner.getByLabel('Character name', { exact: true }).fill(identities[1]!.characterName)
    await owner.getByLabel('Character name', { exact: true }).press('Enter')
    await owner
      .getByRole('button', { name: `Inspect ${identities[1]!.characterName}`, exact: true })
      .click()
    await expect(
      owner.getByRole('heading', { name: identities[1]!.characterName, exact: true }),
    ).toBeFocused()
    for (const [name, width, height, zoom] of [
      ['desktop', 1440, 900, 1],
      ['laptop', 1366, 768, 1],
      ['mobile', 390, 844, 1],
      ['narrow', 320, 740, 1],
      ['css2x', 1440, 900, 2],
    ] as const) {
      await owner.setViewportSize({ width, height })
      await owner.evaluate((zoom) => {
        document.documentElement.style.zoom = String(zoom)
      }, zoom)
      expect(
        await owner.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2),
      ).toBe(true)
      await capture(name)
    }
    await owner.evaluate(() => {
      document.documentElement.style.zoom = '1'
    })
    await owner.setViewportSize({ width: 1366, height: 768 })
    const panes = owner.locator('[data-player-pane]')
    const beforeError = await panes.evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().toJSON()),
    )
    await owner.route('**/api/master/players', (route) =>
      route.fulfill({
        status: 503,
        json: { error: { message: 'Player read temporarily unavailable' } },
      }),
    )
    await owner.getByRole('button', { name: 'Refresh player', exact: true }).click()
    await expect(owner.locator('[data-player-pane="details"]').getByRole('alert')).toContainText(
      'Player read temporarily unavailable',
    )
    const afterError = await panes.evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().toJSON()),
    )
    expect(afterError).toHaveLength(2)
    expect(afterError[1]!.x).toBeGreaterThan(afterError[0]!.right)
    expect(afterError[1]!.y).toBe(beforeError[1]!.y)
    expect(afterError[1]!.x).toBe(beforeError[1]!.x)
    await owner.unroute('**/api/master/players')
    await owner.getByRole('button', { name: 'Refresh player', exact: true }).click()
    await owner.getByLabel('Total XP', { exact: true }).fill('1')
    await owner.getByRole('button', { name: 'Review correction', exact: true }).click()
    await expect(
      owner.getByRole('heading', { name: 'Review correction', exact: true }),
    ).toBeFocused()
    const confirm = owner.getByRole('checkbox', {
      name: `I confirm this correction for ${identities[1]!.characterName}.`,
      exact: true,
    })
    await confirm.focus()
    await owner.keyboard.press('Space')
    await owner.getByRole('button', { name: 'Save confirmed correction', exact: true }).click()
    await expect(owner.getByRole('status')).toContainText('Correction saved')
    await test.step('Verify the first XP correction in SQL', async () => {
      expect(sql(`select xp from public.characters where id='${characterId}'`)).toBe('1')
    })
    // Exercise actual form→protected handler→SQL Discipline corrections before fresh admission.
    async function readPlayer() {
      return test.step('Read current Players facts through the protected API', async () => {
        const response = await owner.request.post('/api/master/players', {
          data: { operation: 'read', characterId },
        })
        expect(response.status()).toBe(200)
        return ((await response.json()) as { player: MasterPlayerView }).player
      })
    }
    const original = await readPlayer()
    const originalPrimary = original.facts.build.primary.disciplineId
    const secondary = original.disciplines.find(
      (row) => row.secondary && row.id !== originalPrimary,
    )!.id
    const nextPrimary = original.disciplines.find(
      (row) => row.primary && row.id !== originalPrimary && row.id !== secondary,
    )!.id
    const correctionGroup = owner.getByRole('button', { name: 'Disciplines', exact: true })
    async function selectDisciplineGroup() {
      await test.step('Select the Discipline correction group', async () => {
        await expect(correctionGroup).toHaveCount(1)
        await correctionGroup.click()
        await expect(correctionGroup).toHaveAttribute('aria-pressed', 'true')
      })
    }
    async function correctDisciplines(
      change: { primary?: string; secondary?: string | null },
      screenshot: string,
    ) {
      const before = await readPlayer()
      await selectDisciplineGroup()
      if (change.primary !== undefined) {
        const primary = owner.getByRole('combobox', { name: 'Primary', exact: true })
        await expect(primary).toHaveCount(1)
        await primary.selectOption(change.primary)
        await expect(primary).toHaveValue(change.primary)
      }
      if (change.secondary !== undefined) {
        const secondary = owner.getByRole('combobox', { name: 'Secondary', exact: true })
        await expect(secondary).toHaveCount(1)
        await secondary.selectOption(change.secondary ?? '')
        await expect(secondary).toHaveValue(change.secondary ?? '')
      }
      await owner.getByRole('button', { name: 'Review correction', exact: true }).click()
      await expect(
        owner.getByRole('heading', { name: 'Review correction', exact: true }),
      ).toBeFocused()
      if (change.secondary === undefined && before.facts.build.secondary) {
        const label = before.facts.build.secondary.disciplineId
          .split(/[._-]/u)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
        await expect(owner.getByText(`${label} → ${label}`, { exact: true })).toBeVisible()
      }
      await capture(screenshot)
      await owner
        .getByRole('checkbox', {
          name: `I confirm this correction for ${identities[1]!.characterName}.`,
          exact: true,
        })
        .check()
      const saved = owner.waitForResponse(
        (response) =>
          response.url().endsWith('/api/master/players') &&
          response.request().postDataJSON()?.operation === 'edit',
      )
      await owner.getByRole('button', { name: 'Save confirmed correction', exact: true }).click()
      const response = await saved
      expect(response.request().postDataJSON().command).toEqual({ kind: 'disciplines', ...change })
      expect(response.ok()).toBe(true)
      await expect(owner.getByRole('status')).toContainText('Correction saved')
      const after = await readPlayer()
      expect(after.facts.build.primary.disciplineId).toBe(
        change.primary ?? before.facts.build.primary.disciplineId,
      )
      expect(after.facts.build.secondary?.disciplineId ?? null).toBe(
        change.secondary === undefined
          ? (before.facts.build.secondary?.disciplineId ?? null)
          : change.secondary,
      )
      expect(after.facts.build.buildVersion).toBeGreaterThan(before.facts.build.buildVersion)
      expect(after.facts.xp).toBe(1)
    }
    await expect(
      owner.getByRole('button', { name: 'Stats & Progression', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(correctionGroup).toHaveAttribute('aria-pressed', 'false')
    await selectDisciplineGroup()
    await owner.getByRole('button', { name: 'Review correction', exact: true }).click()
    const correctionAlert = owner
      .locator('form')
      .filter({ has: correctionGroup })
      .getByRole('alert')
    await expect(correctionAlert).toHaveCount(1)
    await expect(correctionAlert).toHaveText('Choose a different Primary or Secondary.')
    await correctDisciplines({ secondary }, 'discipline-secondary-only-add')
    await correctDisciplines({ primary: nextPrimary }, 'discipline-primary-retains-secondary')
    // Model elapsed time between independent cases on this disposable character;
    // keep the actual attunement policy and all command validation unchanged.
    sql(
      `update app_private.character_active_builds set secondary_attunement_locked_until=now()-interval '1 day' where character_id='${characterId}'`,
    )
    await correctDisciplines({ secondary: null }, 'discipline-secondary-only-remove')
    sql(
      `update app_private.character_active_builds set primary_attunement_locked_until=now()-interval '1 day' where character_id='${characterId}'`,
    )
    await correctDisciplines({ primary: originalPrimary }, 'discipline-primary-with-none')
    expect(
      (
        await host.request.post('/api/master/players', { data: { operation: 'read', characterId } })
      ).status(),
    ).toBe(403)
    expect(
      (
        await owner.request.post('/api/master/players', {
          data: { operation: 'read', characterId, actorUserId: ownerId },
        })
      ).status(),
    ).toBe(400)
    await host.goto('/game/battle')
    await host.getByRole('button', { name: 'Enter Battle', exact: true }).click()
    await expect(host).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
    const pveId = host.url().split('/').pop()!
    const pve = await host.request.get(`/api/battles/${pveId}`)
    expect(pve.ok()).toBe(true)
    expect(JSON.stringify(await pve.json())).not.toContain('sourceHash')
    // An opening Recruit activation can commit several versions. Review recovery only
    // after that authoritative activation returns control to the player.
    const hostBattle = host.locator('main[data-unified-battle]')
    await expect(hostBattle).toHaveAttribute('data-local-turn', 'true')
    await expect(hostBattle).not.toHaveAttribute('aria-busy', 'true')
    await owner.getByRole('button', { name: 'Refresh player', exact: true }).click()
    await owner.getByRole('button', { name: 'Review encounter recovery', exact: true }).click()
    await owner
      .getByRole('checkbox', {
        name: 'I confirm ending the encounter for every participant listed above.',
        exact: true,
      })
      .check()
    await capture('pve-confirmation')
    const recovered = owner.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/master/players' &&
        response.request().postDataJSON().operation === 'recover',
    )
    await owner.getByRole('button', { name: 'End encounter without rewards', exact: true }).click()
    const recoveryResponse = await recovered
    const recoveryResult = await recoveryResponse.json()
    expect(recoveryResponse.status(), JSON.stringify(recoveryResult)).toBe(200)
    expect(recoveryResult).toMatchObject({ outcome: 'NoContest', rewards: 'NoRewards' })
    await expect(host).toHaveURL(/\/game\/battle$/, { timeout: 10000 })
    expect(sql(`select xp from public.characters where id='${characterId}'`)).toBe('1')
    expect((await host.request.post(`/api/battles/${pveId}/mastery`)).ok()).toBe(false)
    await host.getByRole('button', { name: 'PVP', exact: true }).click()
    const created = host.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/pvp/lobbies',
    )
    await host.getByRole('button', { name: 'Create Lobby', exact: true }).click()
    await host.getByRole('button', { name: 'Create Battle Lobby', exact: true }).click()
    const { lobby } = await (await created).json()
    await guest.goto(`/game/battle?join=${encodeURIComponent(lobby.lobbyKey)}`)
    await guest
      .getByRole('dialog', { name: 'The arena is waiting.' })
      .getByRole('button', { name: 'Mark Ready' })
      .click()
    await host
      .getByRole('dialog', { name: 'The arena is waiting.' })
      .getByRole('button', { name: 'Mark Ready' })
      .click()
    await expect(host).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/, { timeout: 20000 })
    await expect(guest).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/, { timeout: 20000 })
    const pvpId = host.url().split('/').pop()!
    const key = (await host.locator('[data-pvp-spectator-key] strong').textContent())!.trim()
    await watcher.goto(`/game/battle/spectate/${key}`)
    await expect(watcher.locator('[data-battle-versus]')).toBeVisible()
    let transient = true
    await watcher.route(`**/api/pvp/spectate/${key}`, async (route) => {
      if (transient) {
        transient = false
        await route.fulfill({
          status: 503,
          json: { error: { message: 'Transient test interruption' } },
        })
      } else await route.continue()
    })
    await expect(watcher.getByText('Transient test interruption')).toBeVisible()
    expect(watcher.url()).toContain('/spectate/')
    await watcher.unroute(`**/api/pvp/spectate/${key}`)
    await owner.getByRole('button', { name: 'Refresh player', exact: true }).click()
    await owner.getByRole('button', { name: 'Review encounter recovery', exact: true }).click()
    await expect(
      owner.getByRole('heading', { name: 'Confirm all participants', exact: true }),
    ).toBeFocused()
    const review = owner
      .getByRole('heading', { name: 'Confirm all participants', exact: true })
      .locator('..')
    await expect(review.getByText(identities[1]!.characterName, { exact: true })).toBeVisible()
    await expect(review.getByText(identities[2]!.characterName, { exact: true })).toBeVisible()
    await capture('pvp-all-participants')
    await owner
      .getByRole('checkbox', {
        name: 'I confirm ending the encounter for every participant listed above.',
        exact: true,
      })
      .check()
    await owner.getByRole('button', { name: 'End encounter without rewards', exact: true }).click()
    for (const participant of [host, guest, watcher])
      await expect(participant).toHaveURL(/\/game\/battle$/, { timeout: 10000 })
    expect(sql(`select xp from public.characters where id='${characterId}'`)).toBe('1')
    expect(
      sql(
        `select count(*) from app_private.discipline_trial_claims where battle_session_id in ('${pveId}','${pvpId}')`,
      ),
    ).toBe('0')
    expect(
      sql(
        `select count(*) from app_private.battle_no_contests where battle_session_id in ('${pveId}','${pvpId}')`,
      ),
    ).toBe('2')
  } catch (error) {
    primaryFailure = true
    throw error
  } finally {
    await cleanupPlayersFixture(sql, ownerGrant, contexts, primaryFailure)
  }
})
