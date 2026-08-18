import { execFileSync } from 'node:child_process'

import { expect, test } from '@playwright/test'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Wayfarer ${letters}`
}

test('resolves a readable authoritative player and Recruit combat loop', async ({
  page,
}, testInfo) => {
  test.slow()

  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `p26-${projectSlug}-${Date.now()}@example.com`
  const password = 'P26-browser-battle-2026!'
  const characterName = uniqueCharacterName()

  await page.goto('/')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account', exact: true }).last().click()

  await expect(page).toHaveURL(/\/game$/)
  await expect(page.getByTestId('character-creation')).toBeVisible()

  await page.getByLabel('Character name').fill(characterName)
  await page.getByRole('button', { name: 'Choose your foundation' }).click()
  await page.getByRole('button', { name: 'Review character' }).click()
  await page.getByRole('button', { name: 'Create permanent character' }).click()
  await expect(page.getByTestId('character-established')).toContainText(characterName)

  const tacticalHallLink = page.getByRole('link', { name: 'Tactical Hall' })
  await tacticalHallLink.focus()
  await expect(tacticalHallLink).toBeFocused()
  await tacticalHallLink.press('Enter')

  await expect(page).toHaveURL(/\/game\/battle$/)
  await expect(page.getByRole('heading', { name: 'Choose a practice' })).toBeVisible()
  await expect(
    page.locator('[data-media-status="requested"][data-media-request="ART-UI-001"]'),
  ).toBeVisible()
  expect(await hasHorizontalOverflow(page)).toBe(false)

  await page.getByRole('button', { name: /GUIDED LESSON.*Strike Drill/ }).click()
  await page.getByRole('button', { name: 'Start Strike Drill' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const battlefield = page.getByRole('region', { name: 'Tactical battlefield' })
  const commandDeck = page.getByRole('region', { name: 'Command Deck' })
  const attackButton = commandDeck.getByRole('button', { name: /Basic Attack/ })
  const endTurnButton = commandDeck.getByRole('button', { name: /Finish Turn/ })
  const confirmButton = commandDeck.getByRole('button', { name: /Confirm action/ })
  const completion = page.getByTestId('tactical-hall-result')

  await expect(battlefield).toBeVisible()
  await expect(commandDeck).toBeVisible()
  await expect(page.getByRole('button', { name: /^Tile / })).toHaveCount(15)
  await expect(page.getByRole('button', { name: 'Inspect Wayfarer' })).toContainText('ACTIVE TURN')
  await expect(page.getByRole('button', { name: 'Inspect Wayfarer' })).toContainText('HP')
  await expect(page.getByRole('button', { name: 'Inspect Recruit' })).toContainText('HP')
  await expect(page.getByTestId('battle-log-toggle')).toContainText('Combat Log')
  await expectBattlefieldReadable(page)
  expect(await hasHorizontalOverflow(page)).toBe(false)

  await commandDeck.getByRole('button', { name: /Move/ }).click()
  await expect(page.getByTestId('combat-mode-instruction')).toContainText(
    'Green tiles are reachable',
  )
  await expect(page.getByTestId('combat-mode-instruction')).toContainText(
    'moving does NOT spend your Action',
  )
  await page.getByRole('button', { name: /Tile 4, 2; open-ground; elevation 0/ }).click()
  await expect(page.getByText(/Move preview: costs 4 Movement and leaves 0/)).toBeVisible()
  await expect(commandDeck.getByText('Action after')).toBeVisible()
  await expect(commandDeck.getByText('READY', { exact: true })).toBeVisible()
  await confirmButton.click()
  await expect(
    page.getByText(/Moved to 4,2\. 0\/4 Movement remains\. Action is still READY/),
  ).toBeVisible()
  await expectBattlefieldReadable(page)

  await attackButton.click()
  await page
    .getByRole('button', {
      name: /Tile 5, 2; open-ground; elevation 0; occupied by Recruit/,
    })
    .click()
  await expect(commandDeck.getByText('Hit chance')).toBeVisible()
  await expect(commandDeck.getByText('Damage', { exact: true })).toBeVisible()
  await confirmButton.click()
  await expect(page.getByText(/Basic Attack (hit for|resolved with no HP loss)/)).toBeVisible()
  await expect(attackButton).toBeDisabled()

  await page.getByTestId('battle-log-toggle').click()
  const battleLog = page.getByTestId('battle-log-panel')
  await expect(battleLog).toContainText('Combat Log')
  await expect(battleLog).toContainText('Wayfarer moved')
  await expect(battleLog).toContainText('Wayfarer used Basic Attack.')
  await expect(battleLog).not.toContainText('rollBasisPoints')
  await page.getByTestId('battle-log-toggle').click()

  await endTurnButton.click()
  await page.getByRole('button', { name: 'Face east' }).click()

  await expect(page.getByText(/Recruit turn:/)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Inspect Wayfarer' })).toContainText('ACTIVE TURN')
  await expect(attackButton).toBeEnabled()
  await expectBattlefieldReadable(page)

  await page.getByTestId('battle-log-toggle').click()
  await expect(battleLog).toContainText('Recruit chose')
  await expect(battleLog).toContainText(/Recruit ended the activation/)
  await expect(battleLog).not.toContainText('candidateCount')
  await expect(battleLog).not.toContainText('tieBreakSeed')
  await expect(battleLog).not.toContainText('profileId')
  await page.getByTestId('battle-log-toggle').click()

  for (
    let playerActivation = 0;
    playerActivation < 20 && !(await completion.isVisible());
    playerActivation += 1
  ) {
    await expect(attackButton).toBeEnabled()
    await attackButton.click()
    await page.getByRole('button', { name: /occupied by Recruit/ }).click()
    await expect(confirmButton).toBeEnabled()
    await confirmButton.click()

    await waitForCompletionOrEndTurn(page, completion, endTurnButton)
    if (await completion.isVisible()) break

    await endTurnButton.click()
    await page.getByRole('button', { name: 'Face east' }).click()

    await waitForCompletionOrNextPlayerTurn(page, completion, attackButton)
  }

  await expect(completion).toBeVisible({ timeout: 15_000 })
  await expect(completion).toContainText(/Victory|Defeat|Draw/)
  await expect(page.getByTestId('practice-no-rewards')).toContainText(
    'no Character XP, Mastery, loot, Crowns, PvP rating',
  )

  const progressionState = queryLocalDatabase(`
    select character.xp::text || '|' || count(grant_row.id)::text
    from public.characters character
    join auth.users account on account.id = character.user_id
    left join app_private.character_xp_grants grant_row on grant_row.character_id = character.id
    where account.email = '${escapeSqlLiteral(email)}'
    group by character.id, character.xp;
  `)
  expect(progressionState).toBe('0|0')

  const completedUrl = page.url()
  await page.getByRole('button', { name: 'Retry same drill' }).click()
  await expect(page).not.toHaveURL(completedUrl)
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('button', { name: 'Inspect Wayfarer' })).toContainText('ACTIVE TURN')
  await expect(page.getByTestId('tactical-hall-result')).toHaveCount(0)
  await expectBattlefieldReadable(page)
  expect(await hasHorizontalOverflow(page)).toBe(false)
})

async function waitForCompletionOrEndTurn(
  page: import('@playwright/test').Page,
  completion: import('@playwright/test').Locator,
  endTurnButton: import('@playwright/test').Locator,
): Promise<void> {
  await expect
    .poll(
      async () => {
        if (await completion.isVisible()) return 'completed'
        if (await endTurnButton.isEnabled()) return 'end-turn-ready'
        return 'waiting'
      },
      { timeout: 15_000 },
    )
    .not.toBe('waiting')
}

async function waitForCompletionOrNextPlayerTurn(
  page: import('@playwright/test').Page,
  completion: import('@playwright/test').Locator,
  attackButton: import('@playwright/test').Locator,
): Promise<void> {
  await expect
    .poll(
      async () => {
        if (await completion.isVisible()) return 'completed'
        if (await attackButton.isEnabled()) return 'player-ready'
        return 'waiting'
      },
      { timeout: 15_000 },
    )
    .not.toBe('waiting')
}

async function expectBattlefieldReadable(page: import('@playwright/test').Page): Promise<void> {
  const battlefield = page.getByRole('region', { name: 'Tactical battlefield' })
  const box = await battlefield.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return
  expect(box.width).toBeGreaterThan(280)
  expect(box.height).toBeGreaterThan(180)
  await expect(page.getByRole('button', { name: /^Tile / }).first()).toBeVisible()
}

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
