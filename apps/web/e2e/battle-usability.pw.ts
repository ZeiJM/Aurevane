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
  await expect(page.getByTestId('keybind-recover')).toContainText('R')
  await page.getByRole('button', { name: 'Save Controls' }).click()
  await expect(page.getByRole('status')).toContainText('Combat controls saved to your account.')

  const persistedMoveKey = queryLocalDatabase(`
    select profile.combat_keybinds->'move'->>'code'
    from public.player_profiles profile
    join auth.users account on account.id = profile.user_id
    where account.email = '${escapeSqlLiteral(email)}';
  `)
  expect(persistedMoveKey).toBe('KeyM')

  await page
    .getByRole('navigation', { name: 'Primary game navigation', exact: true })
    .getByRole('link', { name: 'Profile', exact: true })
    .click()
  await expect(page).toHaveURL(/\/game\/character$/)
  await page
    .getByRole('navigation', { name: 'Primary game navigation', exact: true })
    .getByRole('link', { name: /Battle/ })
    .click()
  await expect(page).toHaveURL(/\/game\/battle$/)

  await expect(page.getByRole('heading', { name: 'Choose your arena.' })).toBeVisible()

  await page.getByRole('button', { name: 'PVP - Direct', exact: true }).click()
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
  await expect(battleMode).toHaveValue('recruit-sparring')
  await expect(page.getByRole('button', { name: 'Enter Battle' })).toBeEnabled()
  const sparringArena = page.getByLabel('AI sparring arena')
  await expect(sparringArena).toBeVisible()
  await expect(sparringArena).toHaveValue('duel-yard')
  await expect(sparringArena.locator('option:checked')).toContainText('Duel Yard')
  // The concept layout displays the selected record in its mode control, not a duplicate heading.
  await expect(battleMode).toHaveValue('recruit-sparring')
  await expect(battleMode.locator('option:checked')).toHaveText('AI Sparring')
  await expect(page.locator('#ai-record-purpose')).toContainText('full duel')
  const enterBattle = page.getByRole('button', { name: 'Enter Battle' })
  await expect(enterBattle).toBeEnabled()
  await enterBattle.click()

  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
  const battlefield = page.getByRole('region', { name: 'Tactical battlefield' })
  const commandDeck = page.getByRole('region', { name: 'Command Deck' })
  const commandContext = page.locator('[data-battle-preview-strip]')
  await expect(battlefield).toBeVisible()
  await expectVictoryConditionsAndTerrainKey(page)
  await expect(
    page.getByRole('button', { name: new RegExp(`Tile 2, 4;.*occupied by ${characterName}`) }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /Tile 8, 4;.*occupied by Recruit/ })).toBeVisible()
  // Standard maps vary; inspect actual terrain instead of restoring historical fixed tiles.
  const roughGround = page
    .getByRole('button', { name: /^Tile \d+, \d+; rough-ground; elevation 0/ })
    .first()
  await expect(roughGround).toBeVisible()
  const raisedTiles = battlefield.locator('button[data-elevation]')
  expect(await raisedTiles.count()).toBeGreaterThanOrEqual(2)
  const raisedPositions = await raisedTiles.evaluateAll((tiles) =>
    tiles.map((tile) => {
      const match = tile.getAttribute('aria-label')!.match(/^Tile (\d+), (\d+);/)
      return { x: Number(match![1]), y: Number(match![2]) }
    }),
  )
  for (const position of raisedPositions) {
    expect(
      raisedPositions.some(
        (neighbor) => Math.abs(neighbor.x - position.x) + Math.abs(neighbor.y - position.y) === 1,
      ),
    ).toBe(true)
  }
  expect(
    await battlefield.locator('button[data-terrain="open"]:not([data-elevation])').count(),
  ).toBeGreaterThan(63 * 0.7)
  await expect(page.getByRole('button', { name: /^Tile / })).toHaveCount(63)
  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '100',
  )
  await expect(commandDeck.locator('[data-command-card="move"]')).toContainText('M')
  await expect(commandDeck.locator('[data-command-card="attack"]')).toContainText('2')
  await expect(commandDeck.locator('[data-command-card="guard"]')).toContainText('3')
  await expect(page.locator('[data-battle-secondary-actions]')).toHaveCount(0)
  const footerBox = await page.locator('[data-unified-battle-footer]').boundingBox()
  const surrenderBox = await page
    .getByRole('button', { name: 'Surrender', exact: true })
    .boundingBox()
  expect(footerBox).not.toBeNull()
  expect(surrenderBox).not.toBeNull()
  if (footerBox && surrenderBox) {
    const rightInset = footerBox.x + footerBox.width - (surrenderBox.x + surrenderBox.width)
    expect(rightInset).toBeGreaterThanOrEqual(0)
    expect(rightInset).toBeLessThanOrEqual(24)
  }
  expect(await hasHorizontalOverflow(page)).toBe(false)
  if (testInfo.project.name !== 'mobile-chromium') {
    expect(await hasVerticalPageOverflow(page)).toBe(false)
  }

  await page.keyboard.press('m')
  await expect(commandContext).toContainText('Move')

  const beforeKeyboardMove = page.getByRole('button', {
    name: new RegExp(`Tile 2, 4;.*occupied by ${characterName}`),
  })
  await expect(beforeKeyboardMove).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '80',
  )
  await page.getByRole('button', { name: 'Cancel Action' }).click()

  await commandDeck.getByRole('button', { name: /^Inspect,/ }).click()
  await expect(commandContext).toContainText('Choose a character or tile to inspect')
  await roughGround.click()
  await expect(commandContext).toContainText('Difficult terrain')
  await page.getByRole('button', { name: new RegExp(`occupied by ${characterName}`) }).click()
  await expect(page.locator('[data-battle-combatant-card="selected"]')).toContainText(characterName)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page
    .getByRole('button', { name: `Inspect ${characterName}`, exact: true })
    .first()
    .click()
  const combatantDetails = page.getByRole('dialog', {
    name: `${characterName} battle details`,
    exact: true,
  })
  await expect(combatantDetails).toBeVisible()
  await expect(combatantDetails).toContainText('MP')
  await page.keyboard.press('m')
  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '80',
  )
  await page.keyboard.press('Escape')
  await expect(combatantDetails).toHaveCount(0)
  await expect(commandContext).toContainText('Choose your action')
  await expect(page.locator('main[data-unified-battle="true"]')).toHaveAttribute(
    'data-battle-action-mode',
    'none',
  )
  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '80',
  )

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

async function expectVictoryConditionsAndTerrainKey(
  page: import('@playwright/test').Page,
): Promise<void> {
  await expect(page.getByRole('button', { name: 'Map Key', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Victory conditions/i })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Terrain Key', exact: true })).toBeVisible()
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
