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

test('launches the Tactical Hall and resolves an authoritative player and Recruit round', async ({
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

  const tacticalHallLink = page.getByRole('link', { name: 'Enter Tactical Hall' })
  await tacticalHallLink.focus()
  await expect(tacticalHallLink).toBeFocused()
  await tacticalHallLink.press('Enter')

  await expect(page).toHaveURL(/\/game\/battle$/)
  await expect(page.getByRole('heading', { name: 'Enter the training field' })).toBeVisible()
  await expect(
    page.locator('[data-media-status="requested"][data-media-request="ART-UI-001"]'),
  ).toBeVisible()
  expect(await hasHorizontalOverflow(page)).toBe(false)

  await page.getByRole('button', { name: 'Begin exercise' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('region', { name: 'Tactical battlefield' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Turn Economy Tracker' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Command Deck' })).toBeVisible()
  await expect(page.getByText('Your turn', { exact: true })).toBeVisible()
  await expect(page.getByTestId('battle-facing-context')).toContainText('Recruit: front')
  expect(await hasHorizontalOverflow(page)).toBe(false)
  await expectBattlefieldAndCommandDeckInViewport(page)

  await page.getByRole('button', { name: /Move.*Position only/ }).click()
  await page.getByRole('button', { name: /Tile 2, 2; open-ground; elevation 0/ }).click()
  await expect(page.getByText('Preview ready. Confirm to commit this command.')).toBeVisible()
  await expect(page.getByText('Preview cost 1')).toBeVisible()
  await page.getByRole('button', { name: /Confirm command/ }).click()
  await expect(page.getByText(/Command committed\. Authoritative battle version 2\./)).toBeVisible()

  await page.getByRole('button', { name: /Move.*Position only/ }).click()
  await page.getByRole('button', { name: /Tile 3, 2; rough-ground; elevation 0/ }).click()
  await expect(page.getByText('Preview cost 2')).toBeVisible()
  await page.getByRole('button', { name: /Confirm command/ }).click()
  await expect(page.getByText(/Authoritative battle version 3/)).toBeVisible()

  await page.getByRole('button', { name: /Move.*Position only/ }).click()
  await page.getByRole('button', { name: /Tile 4, 2; open-ground; elevation 0/ }).click()
  await expect(page.getByText('Preview cost 1')).toBeVisible()
  await page.getByRole('button', { name: /Confirm command/ }).click()
  await expect(page.getByText(/Authoritative battle version 4/)).toBeVisible()

  const commandDeck = page.getByRole('region', { name: 'Command Deck' })
  const turnEconomy = page.getByRole('region', { name: 'Turn Economy Tracker' })
  const attackButton = commandDeck.getByRole('button', { name: /Basic Attack/ })
  const faceEast = page.getByRole('button', { name: 'Face east' })
  const completion = page.getByTestId('tactical-hall-result')

  await attackButton.click()
  await page
    .getByRole('button', {
      name: /Tile 5, 2; open-ground; elevation 0; occupied by Recruit/,
    })
    .click()
  await expect(page.getByText('Hit chance')).toBeVisible()
  await expect(page.getByText('Base damage after armor')).toBeVisible()
  await expect(page.getByText('Preview ready. Confirm to commit this command.')).toBeVisible()
  await page.getByRole('button', { name: /Confirm command/ }).click()
  await expect(page.getByText(/Authoritative battle version 5/)).toBeVisible()
  await expect(attackButton).toBeDisabled()

  await page.getByTestId('battle-log-toggle').click()
  const battleLog = page.getByTestId('battle-log-panel')
  await expect(battleLog).toContainText('Committed history')
  await expect(battleLog).toContainText('Wayfarer used Basic Attack.')
  await expect(battleLog).not.toContainText('rollBasisPoints')
  await page.getByTestId('battle-log-toggle').click()

  await faceEast.click()
  await expect(page.getByText('Preview ready. Confirm to commit this command.')).toBeVisible()
  await page.getByRole('button', { name: /Confirm command/ }).click()
  await expect(page.getByText(/Authoritative battle version 6/)).toBeVisible()
  await expect(turnEconomy.getByText('east →', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: /End Turn.*Facing required/ }).click()
  await expect(page.getByText('Preview ready. Confirm to commit this command.')).toBeVisible()
  await page.getByRole('button', { name: /Confirm command/ }).click()

  await expect(page.getByText(/Recruit turn resolved server-side:/)).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText('Your turn', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Move.*Position only/ })).toBeEnabled()
  await expect(page.getByRole('button', { name: /End Turn.*Facing required/ })).toBeEnabled()

  await page.getByTestId('battle-log-toggle').click()
  await expect(battleLog).toContainText('Recruit chose')
  await expect(battleLog).toContainText('Recruit ended the turn.')
  await expect(battleLog).not.toContainText('candidateCount')
  await expect(battleLog).not.toContainText('tieBreakSeed')
  await expect(battleLog).not.toContainText('profileId')
  await page.getByTestId('battle-log-toggle').click()

  for (let playerTurn = 0; playerTurn < 20 && !(await completion.isVisible()); playerTurn += 1) {
    await expect(attackButton).toBeEnabled()
    await attackButton.click()
    await page
      .getByRole('button', {
        name: /occupied by Recruit/,
      })
      .click()
    await expect(page.getByText('Preview ready. Confirm to commit this command.')).toBeVisible()
    await page.getByRole('button', { name: /Confirm command/ }).click()

    await waitForAttackSettlement(page, completion, faceEast)
    if (await completion.isVisible()) break

    await faceEast.click()
    await expect(page.getByText('Preview ready. Confirm to commit this command.')).toBeVisible()
    await page.getByRole('button', { name: /Confirm command/ }).click()

    const endTurn = page.getByRole('button', { name: /End Turn.*Facing required/ })
    await expect(endTurn).toBeEnabled()
    await endTurn.click()
    await expect(page.getByText('Preview ready. Confirm to commit this command.')).toBeVisible()
    await page.getByRole('button', { name: /Confirm command/ }).click()

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
  await expect(page.getByText('Your turn', { exact: true })).toBeVisible()
  await expect(page.getByTestId('tactical-hall-result')).toHaveCount(0)

  expect(await hasHorizontalOverflow(page)).toBe(false)
  await expectBattlefieldAndCommandDeckInViewport(page)
})

async function waitForAttackSettlement(
  page: import('@playwright/test').Page,
  completion: import('@playwright/test').Locator,
  facingButton: import('@playwright/test').Locator,
): Promise<void> {
  await expect
    .poll(
      async () => {
        if (await completion.isVisible()) return 'completed'
        if (await facingButton.isEnabled()) return 'player-facing'
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

async function expectBattlefieldAndCommandDeckInViewport(
  page: import('@playwright/test').Page,
): Promise<void> {
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  if (!viewport) return

  const battlefield = await page.getByRole('region', { name: 'Tactical battlefield' }).boundingBox()
  const commandDeck = await page.getByRole('region', { name: 'Command Deck' }).boundingBox()
  expect(battlefield).not.toBeNull()
  expect(commandDeck).not.toBeNull()
  if (!battlefield || !commandDeck) return

  expect(battlefield.y).toBeGreaterThanOrEqual(0)
  expect(battlefield.y).toBeLessThan(viewport.height)
  expect(commandDeck.y).toBeGreaterThanOrEqual(0)
  expect(commandDeck.y + Math.min(commandDeck.height, 48)).toBeLessThanOrEqual(viewport.height + 1)
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
