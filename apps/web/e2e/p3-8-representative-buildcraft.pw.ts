import { expect, test, type Locator, type Page } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const suffix =
    Date.now()
      .toString(36)
      .replace(/[^a-z]/gi, '')
      .slice(-7) || 'tester'
  return `Buildcraft ${suffix}`
}

function skillRow(page: Page, name: string): Locator {
  return page.getByTestId('learned-skill-list').locator('article').filter({ hasText: name }).first()
}

function tileCoordinates(label: string | null): { x: number; y: number } | null {
  const match = label?.match(/^Tile (\d+), (\d+);/)
  if (!match) return null
  return { x: Number(match[1]), y: Number(match[2]) }
}

function tileDistance(first: { x: number; y: number }, second: { x: number; y: number }): number {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y)
}

async function setSkill(page: Page, name: string, checked: boolean): Promise<void> {
  const checkbox = skillRow(page, name).getByRole('checkbox')
  if ((await checkbox.isChecked()) !== checked) await checkbox.click()
}

async function reloadProfile(page: Page): Promise<void> {
  await page.reload()
  await expect(page.getByTestId('character-profile')).toBeVisible()

  // Profile build panels intentionally persist through refresh via URL state. Confirm that
  // persisted panel is restored, then close it so the next buildcraft step can open the other
  // authoritative panel rather than clicking through a modal backdrop.
  const openDialog = page.getByRole('dialog')
  if ((await openDialog.count()) > 0) {
    const dialog = openDialog.first()
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toHaveCount(0)
  }
}

test('PV-2 Profile flow compares pure four-Technique Essence with mixed 2+2 Resonance', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.AUREVANE_PV2_TEST_MODE !== '1',
    'PV-2 representative buildcraft is available only in an explicitly enabled preview.',
  )
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One authenticated Chromium proof covers the P3.8 representative buildcraft flow.',
  )

  const characterName = uniqueCharacterName()
  await provisionAccountAndEnterCharacter({
    page,
    email: `p38-buildcraft-${Date.now()}@example.com`,
    password: 'P38-buildcraft-browser-2026!',
    characterName,
  })

  // The owner-only PV-2 preparation API remains available in explicit test mode, but its old
  // Profile card was intentionally removed when the right rail became the Build workspace.
  const prepared = await page.evaluate(async () => {
    const response = await fetch('/api/character/build/pv2-test-kit', { method: 'POST' })
    return { ok: response.ok, body: await response.json() }
  })
  expect(prepared.ok).toBe(true)
  expect(prepared.body).toMatchObject({
    result: { masteredDisciplines: 6, learnedSkills: 16 },
  })
  await reloadProfile(page)

  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  const techniquesOverlay = page.locator('body > [data-techniques-overlay="true"]')
  await expect(techniquesOverlay).toBeVisible()
  await expect(techniquesOverlay.getByRole('dialog', { name: 'Techniques' })).toBeVisible()
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe(
    'hidden',
  )
  await expect(page.getByTestId('skill-capacity')).toContainText('Vanguard')
  await expect(page.getByTestId('skill-capacity')).toContainText('0 / 4')
  await expect(page.getByTestId('active-essence')).toContainText('Unbroken Strike')
  await expect(page.getByTestId('active-resonance')).toHaveCount(0)

  for (const skill of ['Forceful Strike', 'Cleave', 'Brace', 'Shield Bash']) {
    await setSkill(page, skill, true)
  }

  await expect(page.getByTestId('skill-capacity')).toContainText('4 / 4')
  await page.getByRole('button', { name: 'Commit Selected Techniques' }).click()
  await expect(page.getByRole('status')).toContainText('Selected Techniques committed')
  await reloadProfile(page)

  const disciplinePanel = page.getByTestId('primary-build-panel')
  const disciplineLauncher = disciplinePanel.getByRole('button', {
    name: /Manage Primary Discipline/,
  })
  await disciplineLauncher.click()
  const disciplineDialog = page.getByRole('dialog', { name: 'Discipline Management' })
  await expect(disciplineDialog).toBeVisible()
  await page.getByLabel('Proposed Secondary').selectOption('lifebinder')
  await expect(page.getByTestId('primary-build-preview')).toContainText('Vanguard + Lifebinder')
  await page.getByRole('button', { name: 'Commit Discipline changes' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Lifebinder is now the committed Secondary Discipline.',
  )
  await expect(disciplineLauncher).toHaveText('Discipline Management')
  await expect(disciplinePanel).not.toContainText('Vanguard + Lifebinder')
  await expect(disciplineDialog).toContainText('Committed Primary')
  await expect(disciplineDialog).toContainText('Vanguard')
  await expect(disciplineDialog).toContainText('Committed Secondary')
  await expect(disciplineDialog).toContainText('Lifebinder')
  await reloadProfile(page)

  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  const mixedCapacity = page.getByTestId('skill-capacity')
  await expect(mixedCapacity).toContainText('Vanguard')
  await expect(mixedCapacity).toContainText('2 / 3')
  await expect(mixedCapacity).toContainText('Lifebinder')
  await expect(mixedCapacity).toContainText('0 / 2')
  await expect(page.getByTestId('active-resonance')).toContainText("Mercy's Edge")
  await expect(page.getByTestId('active-essence')).toHaveCount(0)

  await setSkill(page, 'Mending Light', true)
  await setSkill(page, 'Barrier', true)

  await expect(mixedCapacity).toContainText('Vanguard')
  await expect(mixedCapacity).toContainText('Lifebinder')
  await expect(mixedCapacity).toContainText('2 / 2')
  await page.getByRole('button', { name: 'Commit Selected Techniques' }).click()
  await expect(page.getByRole('status')).toContainText('Selected Techniques committed')

  await reloadProfile(page)
  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  await expect(page.getByTestId('skill-capacity')).toContainText('2 / 2')
  await expect(page.getByTestId('active-resonance')).toContainText("Mercy's Edge")
  await expect(page.getByTestId('active-essence')).toHaveCount(0)
  await expect(skillRow(page, 'Forceful Strike').getByRole('checkbox')).toBeChecked()
  await expect(skillRow(page, 'Cleave').getByRole('checkbox')).toBeChecked()
  await expect(skillRow(page, 'Mending Light').getByRole('checkbox')).toBeChecked()
  await expect(skillRow(page, 'Barrier').getByRole('checkbox')).toBeChecked()

  // Tagged Techniques must keep the cockpit slot's keyboard contract and reach the same
  // authoritative preview/confirm path used by mouse input after a skill swap.
  const techniquesDialog = page.getByRole('dialog', { name: 'Techniques' })
  await techniquesDialog.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Navigation' }).click()
  await page.getByRole('link', { name: /Battle Hall/ }).click()
  await expect(page).toHaveURL(/\/game\/battle$/)
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const battleRoot = page.locator('[data-unified-battle="true"]')
  const battlefield = page.getByRole('region', { name: 'Tactical battlefield' })
  const commandDeck = page.getByRole('region', { name: 'Command Deck' })
  const commandContext = commandDeck.locator(':scope > div').first()
  const moveAction = commandDeck.locator('button[data-command-slot="move"]')
  const attackCard = commandDeck.locator('[data-command-card="attack"]')
  const attackAction = attackCard.locator('button[data-command-slot="attack"]')
  const attackArtwork = attackCard.getByRole('button', { name: /Choose Attack skill/i })
  const finishAction = commandDeck.locator('button[data-command-slot="finish"]')
  const confirmAction = page.getByRole('button', { name: /Confirm Action/ })
  const actionEconomy = page.getByRole('progressbar', { name: 'Action Economy remaining' })

  // Forceful Strike is melee (range 1). Approach the Recruit through real movement/turn flow so
  // the keyboard regression test never depends on a lucky adjacent spawn.
  for (let approachTurn = 0; approachTurn < 3; approachTurn += 1) {
    const playerTile = battlefield.getByRole('button', {
      name: new RegExp(`occupied by ${characterName}`),
    })
    const recruitTile = battlefield.getByRole('button', { name: /occupied by Recruit/ })
    const playerPosition = tileCoordinates(await playerTile.getAttribute('aria-label'))
    const recruitPosition = tileCoordinates(await recruitTile.getAttribute('aria-label'))
    expect(playerPosition).not.toBeNull()
    expect(recruitPosition).not.toBeNull()
    if (!playerPosition || !recruitPosition) break
    if (tileDistance(playerPosition, recruitPosition) === 1) break

    await moveAction.click()
    const reachableTiles = battlefield.locator('button[data-reachable="true"]')
    await expect(reachableTiles.first()).toBeVisible()

    let destinationLabel: string | null = null
    let destinationDistance = Number.POSITIVE_INFINITY
    for (let index = 0; index < (await reachableTiles.count()); index += 1) {
      const candidate = reachableTiles.nth(index)
      const label = await candidate.getAttribute('aria-label')
      const position = tileCoordinates(label)
      if (!position || !label) continue
      const distance = tileDistance(position, recruitPosition)
      if (distance < destinationDistance) {
        destinationDistance = distance
        destinationLabel = label
      }
    }

    expect(destinationLabel).not.toBeNull()
    await battlefield.getByRole('button', { name: destinationLabel!, exact: true }).click()
    await expect(confirmAction).toBeEnabled()
    await confirmAction.click()
    await expect(actionEconomy).not.toHaveAttribute('aria-valuenow', '100')

    // Start the Technique proof on a fresh owner turn so its AP budget cannot depend on movement.
    await finishAction.click()
    await finishAction.press('KeyD')
    await expect(actionEconomy).toHaveAttribute('aria-valuenow', '100', { timeout: 15000 })
    await expect(battleRoot).toHaveAttribute('data-local-turn', 'true')
  }

  const adjacentPlayer = tileCoordinates(
    await battlefield
      .getByRole('button', { name: new RegExp(`occupied by ${characterName}`) })
      .getAttribute('aria-label'),
  )
  const adjacentRecruit = tileCoordinates(
    await battlefield
      .getByRole('button', { name: /occupied by Recruit/ })
      .getAttribute('aria-label'),
  )
  expect(adjacentPlayer).not.toBeNull()
  expect(adjacentRecruit).not.toBeNull()
  expect(tileDistance(adjacentPlayer!, adjacentRecruit!)).toBe(1)

  await attackArtwork.click()
  const attackSelector = page.getByRole('listbox', { name: 'Attack skills' })
  await expect(attackSelector.getByRole('option', { name: /Forceful Strike/ })).toBeVisible()
  await attackSelector.getByRole('option', { name: /Forceful Strike/ }).click()
  await expect(attackAction).toContainText('Forceful Strike')

  await page.keyboard.press('Digit3')
  await expect(attackAction).toHaveAttribute('data-battle-active', 'true')

  let attackDirection: string | null = null
  for (const key of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
    await page.keyboard.press(key)
    try {
      await expect(confirmAction).toBeEnabled({ timeout: 1500 })
      attackDirection = key
      break
    } catch {
      // Try the next cardinal direction until the current battle layout yields the legal Recruit.
    }
  }

  expect(attackDirection).not.toBeNull()
  await expect(commandContext).toContainText('Forceful Strike')
  await expect(confirmAction).toBeEnabled()

  await page.keyboard.press(attackDirection!)
  await expect(actionEconomy).toHaveAttribute('aria-valuenow', '60', { timeout: 8000 })
  await expect(confirmAction).toBeDisabled({ timeout: 8000 })
  // Authored Attack Techniques stay selected after a successful commit (the approved
  // post-attack cockpit contract). The previous Move selection must never be restored.
  await expect(attackAction).toHaveAttribute('data-battle-active', 'true', { timeout: 8000 })
  await expect(moveAction).not.toHaveAttribute('data-battle-active', 'true')

  // Space still enters final-facing authority, but the retired inline row must stay hidden.
  await page.keyboard.press('Space')
  const legacyFacingRow = page.locator('[data-unified-facing-pad="true"]')
  await expect(legacyFacingRow).toHaveAttribute('data-open', 'true')
  await expect(legacyFacingRow).toBeHidden()
})
