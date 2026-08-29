import { execFileSync } from 'node:child_process'

import { expect, test } from '@playwright/test'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Scout ${letters}`
}

test('proves account keybinds, readable Duel Yard flow and authoritative Surrender', async ({
  page,
}, testInfo) => {
  test.slow()

  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `p27-${projectSlug}-${Date.now()}@example.com`
  const password = 'P27-browser-usability-2026!'
  const characterName = uniqueCharacterName()

  await createAccountAndEnterCharacter({ page, email, password, characterName })

  await page.getByRole('button', { name: 'Account' }).click()
  await page.getByRole('menuitem', { name: 'Controls & Keybinds' }).click()
  await expect(page).toHaveURL(/\/game\/settings\/controls$/)
  await page.getByRole('button', { name: 'Change Move keybind' }).click()
  await page.keyboard.press('m')
  await expect(page.getByTestId('keybind-move')).toContainText('M')
  await expect(page.getByTestId('keybind-recover')).toContainText('5')
  await page.getByRole('button', { name: 'Save Controls' }).click()
  await expect(page.getByRole('status')).toContainText('Combat controls saved to your account.')

  const persistedMoveKey = queryLocalDatabase(`
    select profile.combat_keybinds->'move'->>'code'
    from public.player_profiles profile
    join auth.users account on account.id = profile.user_id
    where account.email = '${escapeSqlLiteral(email)}';
  `)
  expect(persistedMoveKey).toBe('KeyM')

  await page.getByRole('link', { name: 'Back to Character Profile' }).click()
  await expect(page).toHaveURL(/\/game\/character$/)
  await page.getByRole('button', { name: 'Navigation' }).click()
  await page.getByRole('link', { name: /Battle Hall/ }).click()
  await expect(page).toHaveURL(/\/game\/battle$/)

  await expect(page.getByRole('heading', { name: 'Choose your arena.' })).toBeVisible()

  await page.getByRole('button', { name: 'Player vs Player' }).click()
  const pvpMode = page.getByLabel('Battle format')
  const pvpSummary = page
    .locator('article[data-pvp-create-card] p')
    .filter({ hasText: 'combatants' })
  await expect(pvpMode).toBeVisible()
  await expect(pvpMode).toHaveValue('1v1')
  await expect(pvpMode.locator('option')).toHaveCount(6)
  await expect(pvpMode.locator('option[value="1v1v1"]')).toContainText('Three-Way')
  await expect(pvpSummary).toContainText('Two combatants · one per side')
  await expect(page.getByRole('button', { name: 'Create Battle Lobby' })).toBeEnabled()

  await pvpMode.selectOption('1v1v1')
  await expect(pvpSummary).toContainText('Three lone combatants · three factions')
  await pvpMode.selectOption('1v1')
  await expect(pvpSummary).toContainText('Two combatants · one per side')

  await page.getByRole('button', { name: 'AI Battles' }).click()
  const battleMode = page.getByLabel('Battle mode')
  await expect(battleMode).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Enter Battle' })).toHaveCount(0)

  await battleMode.selectOption('recruit-sparring')
  await expect(page.getByText('Duel Yard', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'AI Sparring' })).toBeVisible()
  const enterBattle = page.getByRole('button', { name: 'Enter Battle' })
  await expect(enterBattle).toBeEnabled()
  await enterBattle.click()

  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
  const battlefield = page.getByRole('region', { name: 'Tactical battlefield' })
  const commandDeck = page.getByRole('region', { name: 'Command Deck' })
  const commandContext = commandDeck.getByTestId('combat-mode-instruction')
  await expect(battlefield).toBeVisible()
  await expectVictoryConditionsBesideActionEconomy(page)
  await expect(
    page.getByRole('button', { name: new RegExp(`Tile 2, 4;.*occupied by ${characterName}`) }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /Tile 8, 4;.*occupied by Recruit/ })).toBeVisible()
  await expect(
    page.getByRole('button', { name: /Tile 4, 3; rough-ground; elevation 0/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /Tile 5, 2; open-ground; elevation 1/ }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /^Tile / })).toHaveCount(63)
  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '100',
  )
  await expect(commandDeck.getByRole('button', { name: /Move/ })).toContainText('M · WASD')
  await expect(commandDeck.getByRole('button', { name: /Basic Attack/ })).toContainText('3')
  await expect(commandDeck.getByRole('button', { name: /Guard/ })).toContainText('4')
  await expect(commandDeck.getByRole('button', { name: /Recover/ })).toContainText('5')
  expect(await hasHorizontalOverflow(page)).toBe(false)
  if (testInfo.project.name !== 'mobile-chromium') {
    expect(await hasVerticalPageOverflow(page)).toBe(false)
  }

  await page.keyboard.press('m')
  await expect(commandContext).toContainText('Move · 25 AP per normal tile')
  await expect(commandContext).toContainText('Rough ground costs 50 AP')

  const beforeKeyboardMove = page.getByRole('button', {
    name: new RegExp(`Tile 2, 4;.*occupied by ${characterName}`),
  })
  await expect(beforeKeyboardMove).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(commandContext).toContainText('25 AP')
  await expect(commandContext).toContainText('75 AP left')
  await page.getByRole('button', { name: 'Cancel Action' }).click()

  await commandDeck.getByRole('button', { name: /Inspect/ }).click()
  await expect(commandContext).toContainText('Review terrain and unit details')
  await page.getByRole('button', { name: /Tile 4, 3; rough-ground; elevation 0/ }).click()
  await expect(commandContext).toContainText('Rough ground')
  await expect(commandContext).toContainText('50 AP')

  const battleUrl = page.url()
  await page.getByRole('button', { name: 'Surrender', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Surrender this battle?' })).toBeVisible()
  await page.getByRole('button', { name: 'Stay in battle' }).click()
  await expect(page).toHaveURL(battleUrl)

  await page.getByRole('button', { name: 'Surrender', exact: true }).click()
  const surrenderResponsePromise = page.waitForResponse((response) => {
    const request = response.request()
    return request.method() === 'POST' && new URL(response.url()).pathname.endsWith('/surrender')
  })
  await page.getByRole('button', { name: 'Confirm Surrender' }).click()
  const surrenderResponse = await surrenderResponsePromise
  expect(surrenderResponse.status()).toBe(200)
  await expect(page).toHaveURL(battleUrl)
  await expect(page.getByTestId('battle-result-overlay')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Defeat' })).toBeVisible()

  const persistedState = queryLocalDatabase(`
    select battle.lifecycle || '|' || count(grant_row.id)::text
    from app_private.battle_sessions battle
    join app_private.battle_participants participant
      on participant.battle_session_id = battle.id
    join public.characters character
      on character.id = participant.character_id
    join auth.users account on account.id = character.user_id
    left join app_private.character_xp_grants grant_row
      on grant_row.character_id = character.id
    where account.email = '${escapeSqlLiteral(email)}'
    group by battle.id, battle.lifecycle, battle.created_at
    order by battle.created_at desc
    limit 1;
  `)
  expect(persistedState).toBe('completed|0')

  const surrenderEvent = queryLocalDatabase(`
    select event.event ->> 'event'
    from app_private.battle_events event
    join app_private.battle_sessions battle
      on battle.id = event.battle_session_id
    join app_private.battle_participants participant
      on participant.battle_session_id = battle.id
    join public.characters character
      on character.id = participant.character_id
    join auth.users account on account.id = character.user_id
    where account.email = '${escapeSqlLiteral(email)}'
      and event.event ->> 'event' = 'ai_combatant_surrendered'
    order by event.created_at desc
    limit 1;
  `)
  expect(surrenderEvent).toBe('ai_combatant_surrendered')

  const winningTeam = queryLocalDatabase(`
    select event.event ->> 'winningTeamId'
    from app_private.battle_events event
    join app_private.battle_sessions battle
      on battle.id = event.battle_session_id
    join app_private.battle_participants participant
      on participant.battle_session_id = battle.id
    join public.characters character
      on character.id = participant.character_id
    join auth.users account on account.id = character.user_id
    where account.email = '${escapeSqlLiteral(email)}'
      and event.event ->> 'event' = 'battle_completed'
    order by event.created_at desc
    limit 1;
  `)
  expect(winningTeam).toBe('opponents')
})

async function expectVictoryConditionsBesideActionEconomy(
  page: import('@playwright/test').Page,
): Promise<void> {
  const economyTrack = page.getByRole('progressbar', { name: 'Action Economy remaining' })
  const victoryConditions = page.getByRole('button', { name: /Victory conditions/i })
  await expect(victoryConditions).toBeVisible()

  const [economyBox, victoryBox] = await Promise.all([
    economyTrack.boundingBox(),
    victoryConditions.boundingBox(),
  ])
  expect(economyBox).not.toBeNull()
  expect(victoryBox).not.toBeNull()
  if (!economyBox || !victoryBox) return

  const economyRight = economyBox.x + economyBox.width
  const horizontalGap = victoryBox.x - economyRight
  expect(horizontalGap).toBeGreaterThanOrEqual(-1)
  expect(horizontalGap).toBeLessThanOrEqual(24)

  const economyCenterY = economyBox.y + economyBox.height / 2
  const victoryCenterY = victoryBox.y + victoryBox.height / 2
  expect(Math.abs(economyCenterY - victoryCenterY)).toBeLessThanOrEqual(10)
}

async function hasHorizontalOverflow(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
}

async function hasVerticalPageOverflow(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
  )
}

function queryLocalDatabase(sql: string): string {
  const dbContainer = execFileSync(
    'docker',
    ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')[0]

  if (!dbContainer) throw new Error('Local Supabase database container is unavailable.')

  return execFileSync(
    'docker',
    [
      'exec',
      dbContainer,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-Atqc',
      sql,
    ],
    { encoding: 'utf8' },
  ).trim()
}

function escapeSqlLiteral(value: string): string {
  return value.replaceAll("'", "''")
}
