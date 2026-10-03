import { expectBattlePreviewFits } from './battle-reference-layout-helpers'
import { expect, test, type Locator, type Page } from '@playwright/test'

import { selectDiscipline } from './discipline-library-helpers'
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
  await selectDiscipline(disciplineDialog, 'Secondary', 'Lifebinder')
  await expect(page.getByTestId('primary-build-preview')).toContainText('Lifebinder')
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
  const resonancePreview = page.getByRole('dialog', { name: "Resonance: Mercy's Edge" })
  await expect(resonancePreview).toBeVisible()
  await resonancePreviewAnchor.press('Enter')
  if (testInfo.project.name === 'desktop-chromium') {
    for (const viewport of [
      { width: 1280, height: 720 },
      { width: 1024, height: 576 },
      { width: 1366, height: 768 },
      { width: 1536, height: 614 },
      { width: 1920, height: 1080 },
    ]) {
      await page.setViewportSize(viewport)
      await expect
        .poll(async () =>
          resonancePreview.evaluate((panel) => {
            const rect = panel.getBoundingClientRect()
            return (
              panel.scrollHeight <= panel.clientHeight + 1 &&
              rect.top >= 7 &&
              rect.bottom <= innerHeight - 7 &&
              rect.left >= 7 &&
              rect.right <= innerWidth - 7
            )
          }),
        )
        .toBe(true)
        .catch(async (error) => {
          console.error(
            'Nexus report geometry',
            viewport,
            await resonancePreview.evaluate((panel) => ({
              rect: panel.getBoundingClientRect().toJSON(),
              scroll: panel.scrollHeight,
              client: panel.clientHeight,
              layout: panel.getAttribute('data-battle-info-layout'),
              page: panel.getAttribute('data-battle-info-page'),
              viewport: { width: innerWidth, height: innerHeight, scrollY },
            })),
          )
          throw error
        })
    }
    // A resized/scrolling workspace may move the source artwork offscreen while its reader stays open.
    const priorTriggerStyle = await resonancePreviewAnchor.getAttribute('style')
    try {
      await resonancePreviewAnchor.evaluate((trigger) => {
        trigger.style.transform = 'translateY(2000px)'
        window.dispatchEvent(new Event('resize'))
      })
      expect(
        await resonancePreviewAnchor.evaluate(
          (trigger) => trigger.getBoundingClientRect().top > innerHeight,
        ),
      ).toBe(true)
      await expect
        .poll(() =>
          resonancePreview.evaluate((panel) => {
            const rect = panel.getBoundingClientRect()
            return rect.top >= 7 && rect.bottom <= innerHeight - 7
          }),
        )
        .toBe(true)
    } finally {
      await resonancePreviewAnchor.evaluate((trigger, priorStyle) => {
        if (priorStyle === null) trigger.removeAttribute('style')
        else trigger.setAttribute('style', priorStyle)
        window.dispatchEvent(new Event('resize'))
      }, priorTriggerStyle)
    }
  }
  const resonanceField = (label: string) =>
    resonancePreview
      .locator('dt', { hasText: new RegExp(`^${label}$`) })
      .locator('..')
      .locator('dd')
  await expect(resonanceField('Requirements')).toHaveText('Lifebinder · heal')
  await expect(resonancePreview.locator('dt', { hasText: /^(Mode|Setup|Trigger)$/ })).toHaveCount(0)
  await expect(resonanceField('Effects').locator(':scope > div')).toHaveText([
    'Vanguard · attack + melee: Dmg [6] → Trigger Skill selected unit',
    'Vanguard · attack + melee: Healing [4] [Instant]',
  ])
  await expect(resonancePreview.getByRole('list', { name: 'Effect explanations' })).toContainText(
    'Restores HP to you.',
  )
  for (const field of [
    'Cost',
    'Cooldown',
    'Range',
    'Target Method',
    'Target Elevation',
    'Line of Sight',
  ]) {
    await expect(resonanceField(field)).toHaveText('N/A')
  }
  await expect(resonancePreview).not.toContainText('Payoff')
  await page.keyboard.press('Escape')
  await expect(resonancePreview).not.toBeVisible()

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
  await skillRow(page, 'Barrier').hover()
  const nexusBarrierPreview = page.getByTestId('technique-preview')
  await expect(nexusBarrierPreview.locator('strong').first()).toHaveText('Barrier')
  const nexusBarrierParameters = await nexusBarrierPreview
    .locator('dl > div')
    .evaluateAll((rows) =>
      rows.map(
        (row) => `${row.querySelector('dt')!.textContent}: ${row.querySelector('dd')!.textContent}`,
      ),
    )

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

  if (testInfo.project.name === 'desktop-chromium') {
    // Reports remain readable on a locked battle route even in a short landscape viewport.
    const priorViewport = page.viewportSize()!
    await commandDeck.getByRole('button', { name: "About Mercy's Edge", exact: true }).click()
    const report = page.getByRole('dialog', { name: "Mercy's Edge", exact: true })
    await page.setViewportSize({ width: 844, height: 400 })
    // Give the compact report a clear fit margin, independent of fractional font metrics.
    await expect(report).toHaveAttribute('data-battle-info-page', 'false')
    await expect
      .poll(() =>
        report.evaluate((panel) => {
          const bounds = panel.getBoundingClientRect()
          return (
            getComputedStyle(panel).position === 'fixed' &&
            bounds.top >= 8 &&
            bounds.bottom <= innerHeight - 7 &&
            panel.scrollHeight <= panel.clientHeight + 1
          )
        }),
      )
      .toBe(true)
    expect(
      await page.evaluate(() =>
        [document.documentElement, document.body].every(
          (node) => getComputedStyle(node).overflowY === 'hidden',
        ),
      ),
    ).toBe(true)
    // Retain the complete oversized-report fallback in a genuinely shorter viewport.
    await page.setViewportSize({ width: 844, height: 200 })
    await expect(report).toHaveAttribute('data-battle-info-page', 'true')
    await expect
      .poll(() =>
        page.evaluate(() =>
          [document.documentElement, document.body].every(
            (node) => getComputedStyle(node).overflowY === 'auto',
          ),
        ),
      )
      .toBe(true)
    expect(await report.evaluate((panel) => panel.scrollHeight <= panel.clientHeight + 1)).toBe(
      true,
    )
    await page.mouse.move(400, 80)
    await page.mouse.wheel(0, 1000)
    await expect
      .poll(() =>
        report.evaluate((panel) => panel.getBoundingClientRect().bottom <= innerHeight + 1),
      )
      .toBe(true)
    await expect(report.getByRole('list', { name: 'Effect explanations' })).toBeInViewport()
    await page.keyboard.press('Escape')
    await expect(report).toHaveCount(0)
    expect(
      await page.evaluate(() =>
        [document.documentElement, document.body].every(
          (node) => getComputedStyle(node).overflowY === 'hidden',
        ),
      ),
    ).toBe(true)
    await page.setViewportSize(priorViewport)
  }

  const guardPreview = page.waitForResponse((response) => response.url().endsWith('/preview'))
  await commandDeck.getByRole('button', { name: 'Guard, 30 AP', exact: true }).click()
  expect((await guardPreview).request().postDataJSON().intent.target).toEqual({ kind: 'self' })
  await expect(actionEconomy).toHaveAttribute('aria-valuenow', '100')
  await commandDeck.getByRole('button', { name: 'Selected Barrier, 40 AP', exact: true }).click()
  const forecast = page.locator('[data-battle-preview-strip] [aria-label="Action preview"]')
  await expect(forecast).toContainText('40 AP')
  await expect(
    forecast.locator('[data-battle-preview-chip]').filter({ hasText: /^Range:/ }),
  ).toHaveText('Range: 3')
  await expect(forecast).not.toContainText('Success 100%')
  await expect(battlefield.locator('button[data-target="friendly"]')).toHaveCount(0)
  const parameterTrigger = forecast.getByRole('button', {
    name: 'Show Barrier parameters',
    exact: true,
  })
  await parameterTrigger.click()
  const barrierParameters = page.getByRole('dialog', { name: 'Barrier parameters', exact: true })
  await expect(barrierParameters).toBeVisible()
  await expect(
    barrierParameters
      .locator('dl > div')
      .filter({ has: page.getByText('Target', { exact: true }) })
      .locator('dd'),
  ).toHaveText('Ally')
  await expect(
    barrierParameters
      .locator('dl > div')
      .filter({ has: page.getByText('Range', { exact: true }) })
      .locator('dd'),
  ).toHaveText('3')
  expect(
    await barrierParameters
      .locator('dl > div')
      .evaluateAll((rows) =>
        rows.map(
          (row) =>
            `${row.querySelector('dt')!.textContent}: ${row.querySelector('dd')!.textContent}`,
        ),
      ),
  ).toEqual(nexusBarrierParameters)
  await page.keyboard.press('Escape')
  await expect(barrierParameters).toHaveCount(0)
  await expect(parameterTrigger).toBeFocused()
  await expect(actionEconomy).toHaveAttribute('aria-valuenow', '100')
  await commandDeck.getByRole('button', { name: 'About Barrier', exact: true }).click()
  const skillDetails = page.getByRole('dialog', { name: 'Barrier', exact: true })
  await expect(skillDetails).toContainText('Guarded [11%] [2 Turns]')
  await expect(skillDetails).toContainText(
    'Each stack reduces incoming damage by 11%, up to three stacks. Reapplying adds a stack and refreshes the duration.',
  )
  await page.keyboard.press('Escape')
  await expect(skillDetails).toHaveCount(0)
  await commandDeck.getByRole('button', { name: 'Guard, 30 AP', exact: true }).click()
  await expect(forecast).toContainText('Success 100%')
  await expectBattlePreviewFits(page)
  await page.getByRole('button', { name: 'Cancel Action', exact: true }).click()

  // Current Forceful Strike is melee at equal elevation. Keep the player on the
  // protected flat spawn while the real Recruit approaches; adjacency alone can
  // otherwise select an illegal raised target on a randomized standard map.
  const playerTile = battlefield.getByRole('button', {
    name: new RegExp(`occupied by ${characterName}`),
  })
  const playerSpawn = tileCoordinates(await playerTile.getAttribute('aria-label'))
  expect(playerSpawn).not.toBeNull()
  for (let approachTurn = 0; approachTurn < 3; approachTurn += 1) {
    const recruitTile = battlefield.getByRole('button', { name: /occupied by Recruit/ })
    const playerPosition = tileCoordinates(await playerTile.getAttribute('aria-label'))
    const recruitPosition = tileCoordinates(await recruitTile.getAttribute('aria-label'))
    expect(playerPosition).toEqual(playerSpawn)
    expect(recruitPosition).not.toBeNull()
    if (tileDistance(playerPosition!, recruitPosition!) === 1) break

    await finishAction.click()
    const finalTurn = page.waitForResponse('**/api/battles/*/final-turn')
    const recruitTurn = page.waitForResponse('**/api/battles/*/recruit-turn')
    await finishAction.press('KeyD')
    const handedOff = await finalTurn
    expect(handedOff.status()).toBe(200)
    const handedOffVersion = (await handedOff.json()).battle.battleVersion as number
    const returned = await recruitTurn
    expect(returned.status()).toBe(200)
    expect(returned.request().postDataJSON().expectedBattleVersion).toBe(handedOffVersion)
    expect((await returned.json()).battle.battleVersion).toBeGreaterThan(handedOffVersion)
    await expect(battleRoot).toHaveAttribute('data-local-turn', 'true')
    await expect(actionEconomy).toHaveAttribute('aria-valuenow', '100')
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
  expect(adjacentPlayer).toEqual(playerSpawn)
  expect(tileDistance(adjacentPlayer!, adjacentRecruit!)).toBe(1)
  await expect(playerTile).toHaveAttribute('aria-label', /; elevation 0;/)
  await expect(battlefield.getByRole('button', { name: /occupied by Recruit/ })).toHaveAttribute(
    'aria-label',
    /; elevation 0;/,
  )

  const technique = commandDeck.getByRole('button', {
    name: /^Selected Forceful Strike, 45 AP(?:,|$)/,
  })
  const skillPreview = page.waitForResponse('**/api/battles/*/preview')
  await technique.click()
  const forecastResponse = await skillPreview
  expect(forecastResponse.status()).toBe(200)
  const legalForecast = (await forecastResponse.json()).battlePreview
  expect(legalForecast.preview, JSON.stringify(legalForecast)).toMatchObject({
    actionId: 'vanguard.forceful-strike',
    legal: true,
    actionEconomyBefore: 100,
    actionEconomyAfter: 55,
  })
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
  const skillCommit = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/(intents|commit)$/.test(new URL(response.url()).pathname),
  )
  await page.keyboard.press(direction)
  const committedSkill = await skillCommit
  expect(committedSkill.status()).toBe(200)
  expect(committedSkill.request().postDataJSON()).toMatchObject({
    expectedBattleVersion: legalForecast.battleVersion,
    intent: { kind: 'action', actionId: 'vanguard.forceful-strike' },
  })
  expect((await committedSkill.json()).battle.battleVersion).toBe(legalForecast.battleVersion + 1)
  await expect(actionEconomy).toHaveAttribute('aria-valuenow', '55', { timeout: 8000 })
  // The committed cooldown replaces the armed preview; no unusable Skill stays selected.
  await expect(technique).toBeDisabled()
  await expect(technique).toHaveAttribute('aria-pressed', 'false')
  await expect(technique).toHaveAccessibleName(/Cooldown: [1-3] turns? remaining$/)
  await expect(technique.locator('[data-battle-cooldown-countdown]')).toHaveText(/^[1-3]$/)
  await expect(moveAction).not.toHaveAttribute('data-battle-active', 'true')
  await expect(commandContext).toContainText('Choose your action')

  // Space opens the visible final-facing controls without ending on the first press.
  await page.keyboard.press('Space')
  const legacyFacingRow = page.locator('[data-unified-facing-pad="true"]')
  await expect(legacyFacingRow).toHaveAttribute('data-open', 'true')
  await expect(legacyFacingRow).toBeVisible()
})
