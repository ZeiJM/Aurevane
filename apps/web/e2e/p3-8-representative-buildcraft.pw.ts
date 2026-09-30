import { expectBattlePreviewFits } from './battle-reference-layout-helpers'
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
  if ((await checkbox.isChecked()) === checked) return

  const saved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/character/build/skills' &&
      response.request().method() === 'PUT',
  )
  await checkbox.click()
  expect((await saved).status()).toBe(200)
  await expect(checkbox).toBeChecked({ checked })
}

async function reloadNexus(page: Page): Promise<void> {
  if (new URL(page.url()).pathname.startsWith('/game/nexus')) {
    await page.reload()
  } else {
    await page.goto('/game/nexus')
  }
  await expect(page.locator('[data-arsenal-workspace]')).toBeVisible()
  await expect(page.locator('[data-av-game-rail]')).toBeVisible()

  // Nexus build panels intentionally persist through refresh via URL state. Confirm that
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
  await reloadNexus(page)

  const pureAttunement = page.locator('[aria-labelledby="nexus-attunement-heading"]')
  await expect(pureAttunement).toContainText('Unbroken Strike')

  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  const techniquesOverlay = page.locator('body > [data-techniques-overlay="true"]')
  await expect(techniquesOverlay).toBeVisible()
  await expect(techniquesOverlay.getByRole('dialog', { name: 'Techniques' })).toBeVisible()
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe(
    'hidden',
  )
  await expect(page.getByTestId('skill-capacity')).toContainText('0 / 4 selected')
  await expect(page.getByTestId('technique-preview')).not.toContainText('Build Signature')

  for (const skill of ['Forceful Strike', 'Cleave', 'Brace', 'Shield Bash']) {
    await setSkill(page, skill, true)
  }

  await expect(page.getByTestId('skill-capacity')).toContainText('4 / 4 selected')
  await reloadNexus(page)

  const disciplinePanel = page.getByTestId('primary-build-panel')
  const disciplineLauncher = disciplinePanel.getByRole('button', {
    name: /Manage Disciplines/,
  })
  await disciplineLauncher.click()
  const disciplineDialog = page.getByRole('dialog', { name: 'Discipline Management' })
  await expect(disciplineDialog).toBeVisible()
  await disciplineDialog
    .getByRole('combobox', { name: 'Secondary Discipline', exact: true })
    .selectOption('lifebinder')
  await expect(page.getByTestId('primary-build-preview')).toContainText('Lifebinder')
  await disciplineDialog.getByRole('button', { name: /Confirm Change/ }).click()
  await expect(page.getByRole('status')).toContainText('Discipline changes committed.')
  await expect(disciplineLauncher).toHaveText(/Manage Disciplines/)
  await expect(disciplinePanel).not.toContainText('Vanguard + Lifebinder')
  await expect(disciplineDialog).toContainText('Primary Discipline')
  await expect(disciplineDialog).toContainText('Vanguard')
  await expect(disciplineDialog).toContainText('Secondary Discipline')
  await expect(disciplineDialog).toContainText('Lifebinder')
  await reloadNexus(page)

  const mixedAttunement = page.locator('[aria-labelledby="nexus-attunement-heading"]')
  await expect(mixedAttunement).toContainText("Mercy's Edge")
  await expect(mixedAttunement).not.toContainText('Unbroken Strike')

  const resonancePreviewAnchor = mixedAttunement.getByLabel(/Preview Resonance: Mercy's Edge/)
  await resonancePreviewAnchor.hover()
  const resonancePreview = page.locator('[id^="resonance-preview-"]').filter({
    hasText: "Mercy's Edge",
  })
  await expect(resonancePreview).toBeVisible()
  await expect(resonancePreview).toContainText('Setup:')
  await expect(resonancePreview).toContainText('Trigger:')
  await expect(resonancePreview).toContainText('Result')
  await expect(resonancePreview).toContainText('Result details')
  await expect(resonancePreview).not.toContainText('Payoff')
  await resonancePreviewAnchor.evaluate((element) => (element as HTMLElement).blur())
  await page.mouse.move(0, 0)
  await expect(resonancePreview).toHaveCSS('opacity', '0')
  await expect(resonancePreview).toHaveCSS('pointer-events', 'none')

  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  const mixedCapacity = page.getByTestId('skill-capacity')
  await expect(mixedCapacity).toContainText('2 / 4 selected')

  await setSkill(page, 'Mending Light', true)
  await setSkill(page, 'Barrier', true)

  await expect(mixedCapacity).toContainText('4 / 4 selected')

  await reloadNexus(page)
  await expect(page.locator('[aria-labelledby="nexus-attunement-heading"]')).toContainText(
    "Mercy's Edge",
  )
  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  await expect(page.getByTestId('skill-capacity')).toContainText('4 / 4 selected')
  await expect(skillRow(page, 'Forceful Strike').getByRole('checkbox')).toBeChecked()
  await expect(skillRow(page, 'Cleave').getByRole('checkbox')).toBeChecked()
  await expect(skillRow(page, 'Mending Light').getByRole('checkbox')).toBeChecked()
  await expect(skillRow(page, 'Barrier').getByRole('checkbox')).toBeChecked()

  // Tagged Techniques must keep the cockpit slot's keyboard contract and reach the same
  // authoritative preview/confirm path used by mouse input after a skill swap.
  const techniquesDialog = page.getByRole('dialog', { name: 'Techniques' })
  await techniquesDialog.getByRole('button', { name: 'Close' }).click()
  await page
    .getByRole('navigation', { name: 'Primary game navigation', exact: true })
    .getByRole('link', { name: 'Battle', exact: true })
    .click()
  await expect(page).toHaveURL(/\/game\/battle$/)
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const battleRoot = page.locator('[data-unified-battle="true"]')
  const battlefield = page.getByRole('region', { name: 'Tactical battlefield' })
  const commandDeck = page.getByRole('region', { name: 'Command Deck' })
  const commandContext = page.locator('[data-battle-preview-strip]')
  const moveAction = commandDeck.locator('button[data-command-slot="move"]')
  const finishAction = commandDeck.locator('button[data-command-slot="finish"]')
  const actionEconomy = page.getByRole('progressbar', { name: 'Action Economy remaining' })

  const guardPreview = page.waitForResponse((response) => response.url().endsWith('/preview'))
  await commandDeck.getByRole('button', { name: 'Guard, 30 AP', exact: true }).click()
  expect((await guardPreview).request().postDataJSON().intent.target).toEqual({ kind: 'self' })
  await expect(actionEconomy).toHaveAttribute('aria-valuenow', '100')
  await commandDeck.getByRole('button', { name: 'Selected Barrier, 40 AP', exact: true }).click()
  const forecast = page.locator('[data-battle-preview-strip] [aria-label="Action preview"]')
  await expect(forecast).toContainText('40 AP')
  await expect(forecast).toContainText('Ally · 1–3 tiles')
  await expect(forecast).not.toContainText('Success 100%')
  await expect(battlefield.locator('button[data-target="friendly"]')).toHaveCount(0)
  await commandDeck.getByRole('button', { name: 'About Barrier', exact: true }).click()
  const skillDetails = page.getByRole('dialog', { name: 'Barrier', exact: true })
  await expect(skillDetails).toContainText('Guarded [11%] [2 Turns]')
  await expect(skillDetails).toContainText('Reduces incoming damage by 11% per stack.')
  await page.keyboard.press('Escape')
  await expect(skillDetails).toHaveCount(0)
  await commandDeck.getByRole('button', { name: 'Guard, 30 AP', exact: true }).click()
  await expect(forecast).toContainText('Success 100%')
  await expectBattlePreviewFits(page)
  await page.getByRole('button', { name: 'Cancel Action', exact: true }).click()

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

  const technique = commandDeck.getByRole('button', {
    name: 'Selected Forceful Strike, 45 AP',
    exact: true,
  })
  await technique.click()
  await expect(technique).toHaveAttribute('aria-pressed', 'true')
  await expect(actionEconomy).toHaveAttribute('aria-valuenow', '100')
  const actor = tileCoordinates(
    await battlefield
      .getByRole('button', { name: new RegExp(`occupied by ${characterName}`) })
      .getAttribute('aria-label'),
  )!
  const enemy = tileCoordinates(
    await battlefield
      .getByRole('button', { name: /occupied by Recruit/ })
      .getAttribute('aria-label'),
  )!
  const direction =
    enemy.x > actor.x ? 'KeyD' : enemy.x < actor.x ? 'KeyA' : enemy.y > actor.y ? 'KeyS' : 'KeyW'
  await page.keyboard.press(direction)
  await expect(actionEconomy).toHaveAttribute('aria-valuenow', '55', { timeout: 8000 })
  await expect(technique).toHaveAttribute('aria-pressed', 'false')
  await expect(commandContext).toContainText('Inspect')
  await technique.click()
  await expect(technique).toHaveAttribute('aria-pressed', 'true')
  await expect(moveAction).not.toHaveAttribute('data-battle-active', 'true')
  await expect(commandContext).toContainText('Forceful Strike')

  // Space opens the visible final-facing controls without ending on the first press.
  await page.keyboard.press('Space')
  const legacyFacingRow = page.locator('[data-unified-facing-pad="true"]')
  await expect(legacyFacingRow).toHaveAttribute('data-open', 'true')
  await expect(legacyFacingRow).toBeVisible()
})
