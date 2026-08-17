import { execFileSync } from 'node:child_process'

import { expect, test } from '@playwright/test'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Scout ${letters}`
}

test('proves account keybinds, the Duel Yard and authoritative Abort Exercise', async ({
  page,
}, testInfo) => {
  test.slow()

  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `p27-${projectSlug}-${Date.now()}@example.com`
  const password = 'P27-browser-usability-2026!'
  const characterName = uniqueCharacterName()

  await page.goto('/')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account', exact: true }).last().click()

  await expect(page).toHaveURL(/\/game$/)
  await page.getByLabel('Character name').fill(characterName)
  await page.getByRole('button', { name: 'Choose your foundation' }).click()
  await page.getByRole('button', { name: 'Review character' }).click()
  await page.getByRole('button', { name: 'Create permanent character' }).click()
  await expect(page.getByTestId('character-established')).toContainText(characterName)

  await page.getByRole('link', { name: 'Controls & Keybinds' }).click()
  await expect(page).toHaveURL(/\/game\/settings\/controls$/)
  await page.getByRole('button', { name: 'Change Move keybind' }).click()
  await page.keyboard.press('m')
  await expect(page.getByTestId('keybind-move')).toContainText('M')
  await page.getByRole('button', { name: 'Save account controls' }).click()
  await expect(page.getByRole('status')).toContainText('Combat controls saved to your account.')

  const persistedMoveKey = queryLocalDatabase(`
    select profile.combat_keybinds->'move'->>'code'
    from public.player_profiles profile
    join auth.users account on account.id = profile.user_id
    where account.email = '${escapeSqlLiteral(email)}';
  `)
  expect(persistedMoveKey).toBe('KeyM')

  await page.getByRole('link', { name: 'Return to Game' }).click()
  await page.getByRole('link', { name: 'Enter Tactical Hall' }).click()
  await expect(page).toHaveURL(/\/game\/battle$/)

  const duelYard = page.getByRole('button', { name: /Duel Yard · 9×7 · Duel arena/ })
  await expect(duelYard).toBeVisible()
  await duelYard.click()
  await expect(page.getByText('Duel Yard', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Begin exercise · Duel Yard/ }).click()

  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('region', { name: 'Tactical battlefield' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Tile 2, 4;.*occupied by Wayfarer/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Tile 8, 4;.*occupied by Recruit/ })).toBeVisible()
  await expect(
    page.getByRole('button', { name: /Tile 4, 3; rough-ground; elevation 0/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /Tile 5, 2; open-ground; elevation 1/ }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /^Tile / })).toHaveCount(63)
  expect(await hasHorizontalOverflow(page)).toBe(false)
  await page.waitForLoadState('networkidle')

  await page.keyboard.press('m')
  await expect(page.getByTestId('combat-mode-instruction')).toContainText('POSITION')
  await expect(page.getByTestId('combat-mode-instruction')).toContainText(
    'does not spend your Action',
  )

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('combat-mode-instruction')).toContainText('INSPECT')
  await page.keyboard.press('2')
  await expect(page.getByTestId('combat-mode-instruction')).toContainText('INSPECT')

  await page.keyboard.press('Space')
  await expect(page.getByTestId('combat-mode-instruction')).toContainText('END TURN')
  await page.keyboard.press('a')
  await expect(
    page.getByRole('region', { name: 'Turn Economy Tracker' }).getByText('west ←', { exact: true }),
  ).toBeVisible()
  await page.keyboard.press('Escape')

  const battleUrl = page.url()
  await page.getByTestId('abort-exercise').click()
  await expect(page.getByText('Abort Exercise?', { exact: false })).toBeVisible()
  await expect(page.getByText(/no Character XP, Mastery, loot, Crowns, PvP rating/)).toBeVisible()
  await page.getByRole('button', { name: 'Stay in Battle' }).click()
  await expect(page).toHaveURL(battleUrl)

  await page.getByTestId('abort-exercise').click()
  await page.getByTestId('confirm-abort-exercise').click()
  await expect(page).toHaveURL(/\/game\/battle$/)

  const persistedState = queryLocalDatabase(`
    select battle.lifecycle || '|' || count(grant_row.id)::text
    from app_private.battle_sessions battle
    join app_private.battle_participants participant
      on participant.battle_session_id = battle.id
    join public.characters character
      on character.id = participant.character_id
    join auth.users account
      on account.id = character.user_id
    left join app_private.character_xp_grants grant_row
      on grant_row.character_id = character.id
    where account.email = '${escapeSqlLiteral(email)}'
    group by battle.id, battle.lifecycle, battle.created_at
    order by battle.created_at desc
    limit 1;
  `)
  expect(persistedState).toBe('abandoned|0')

  const terminalEvent = queryLocalDatabase(`
    select (event.event ->> 'event') || '|' || (event.event ->> 'reason')
    from app_private.battle_events event
    join app_private.battle_sessions battle
      on battle.id = event.battle_session_id
    join app_private.battle_participants participant
      on participant.battle_session_id = battle.id
    join public.characters character
      on character.id = participant.character_id
    join auth.users account
      on account.id = character.user_id
    where account.email = '${escapeSqlLiteral(email)}'
      and event.event ->> 'event' = 'battle_abandoned'
    order by event.created_at desc
    limit 1;
  `)
  expect(terminalEvent).toBe('battle_abandoned|practice-aborted')
})

async function hasHorizontalOverflow(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
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
