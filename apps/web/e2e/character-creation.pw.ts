import { execFileSync } from 'node:child_process'

import { expect, test } from '@playwright/test'

import {
  createAccountAndEnterCharacter,
  openOfflineTraining,
  signOutFromAccountMenu,
} from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Wayfarer ${letters}`
}

test('creates a slotted character, persists its profile, and resumes it across sign-in', async ({
  page,
}, testInfo) => {
  test.slow()

  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `p15-${projectSlug}-${Date.now()}@example.com`
  const password = 'P15-browser-character-2026!'
  const characterName = uniqueCharacterName()
  const titleProjectToken = projectSlug.replaceAll('-', '').slice(0, 6)
  const personalTitle = `Warden ${titleProjectToken} ${Date.now().toString().slice(-6)}`

  await createAccountAndEnterCharacter({ page, email, password, characterName })

  const profile = page.getByTestId('character-profile')
  await expect(profile).toContainText(characterName)
  await expect(profile).toContainText('Level 1')
  for (const attribute of ['might', 'finesse', 'vitality', 'agility', 'intellect', 'resolve']) {
    await expect(page.getByTestId(`profile-attribute-${attribute}`)).toContainText('6')
  }
  await expect(page.getByTestId('derived-stat-maxHp')).toContainText('164')
  await expect(page.getByTestId('derived-stat-maxMp')).toContainText('90')
  await expect(page.getByTestId('derived-stat-accuracy')).toContainText('74%')
  await expect(page.getByTestId('derived-stat-criticalChance')).toContainText('8%')

  const levelProgress = page.getByTestId('level-progress')
  await expect(levelProgress).toContainText('Level 2')
  await expect(levelProgress).toContainText('0 / 100 XP')
  await expect(page.getByRole('progressbar', { name: 'Level progress' })).toHaveAttribute(
    'aria-valuenow',
    '0',
  )

  const requestedCharacterArt = page.locator(
    '[data-media-status="requested"][data-media-request="ART-CHR-001"]',
  )
  expect(await requestedCharacterArt.count()).toBeGreaterThan(0)
  expect(await hasHorizontalOverflow(page)).toBe(false)
  await expect(page.getByRole('link', { name: 'Back to Character Select' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Account' }).click()
  await page.getByRole('menuitem', { name: 'Titles & Profile Display' }).click()
  await expect(page).toHaveURL(/\/game\/account\/titles$/)
  await page.getByRole('textbox', { name: /^Personal title/ }).fill(personalTitle)
  await page.getByRole('button', { name: 'Review Title' }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Confirm Final Title' }).click()
  await expect(page.getByText('Choice used')).toBeVisible()
  await expect(page.getByText(personalTitle, { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('textbox', { name: /^Personal title/ })).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('Choice used')).toBeVisible()
  await expect(page.getByText(personalTitle, { exact: true }).first()).toBeVisible()
  await page.getByRole('link', { name: 'Back to Character Profile' }).click()
  await expect(page).toHaveURL(/\/game\/character$/)
  await expect(page.getByTestId('character-profile')).toContainText(personalTitle)

  await page.getByRole('button', { name: 'Account' }).click()
  await page.getByRole('menuitem', { name: 'Switch Character' }).click()
  await expect(page).toHaveURL(/\/game$/)
  await expect(page.getByRole('link', { name: `Play ${characterName}` })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Create Character' })).toHaveCount(0)
  await expect(page.getByText('Purchase unlock · coming later', { exact: true })).toBeVisible()
  await expect(page.getByText('Earn free · first Prestige Rebirth', { exact: true })).toBeVisible()
  expect(await hasHorizontalOverflow(page)).toBe(false)

  await signOutFromAccountMenu(page)

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Enter AUREVANE' }).click()

  await expect(page).toHaveURL(/\/game$/)
  await page.getByRole('link', { name: `Play ${characterName}` }).click()
  await expect(page).toHaveURL(/\/game\/character$/)
  await expect(page.getByTestId('character-profile')).toContainText(characterName)
  await expect(page.getByTestId('character-profile')).toContainText(personalTitle)

  const characterId = queryLocalDatabase(`
    select character.id::text
    from public.characters character
    join auth.users account on account.id = character.user_id
    where account.email = '${escapeSqlLiteral(email)}'
    limit 1;
  `)
  expect(characterId).toMatch(/^[0-9a-f-]{36}$/)

  await openOfflineTraining(page)
  await expect(page.getByRole('heading', { name: 'Passive Training' })).toBeVisible()
  await expect(page.getByTestId('training-report')).toHaveCount(0)
  await expect(page.getByTestId('practice-plan-card')).toContainText('Idle')
  await page.getByRole('link', { name: 'Back to Character Profile' }).click()
  await expect(page).toHaveURL(/\/game\/character$/)

  queryLocalDatabase(`
    with boundary as (
      select clock_timestamp() - interval '96 hours' as at
    )
    update app_private.wayfarers_practice_state practice_state
    set
      last_active_at = boundary.at,
      practice_claimed_through_at = boundary.at,
      updated_at = clock_timestamp()
    from boundary
    where practice_state.character_id = '${characterId}'::uuid;
  `)

  await openOfflineTraining(page)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Passive Training' })).toBeVisible()
  await expect(page.getByTestId('training-report')).toHaveCount(0)
  await expect(page.getByTestId('practice-plan-card')).toContainText('Idle')
  await expect(page.getByText(/Training does not start automatically/)).toBeVisible()
  expect(await hasHorizontalOverflow(page)).toBe(false)

  await page.getByRole('link', { name: 'Back to Character Profile' }).click()
  await expect(page).toHaveURL(/\/game\/character$/)
  await expect(page.getByTestId('character-profile')).toContainText('Level 1')
  await expect(page.getByTestId('level-progress')).toContainText('0 / 100 XP')

  await page.getByRole('button', { name: 'Account' }).click()
  await page.getByRole('menuitem', { name: 'Switch Character' }).click()
  await expect(page).toHaveURL(/\/game$/)
  await expect(page.getByRole('link', { name: `Play ${characterName}` })).toBeVisible()
  expect(await hasHorizontalOverflow(page)).toBe(false)
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

  if (!dbContainer) {
    throw new Error('Local Supabase database container is unavailable.')
  }

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
