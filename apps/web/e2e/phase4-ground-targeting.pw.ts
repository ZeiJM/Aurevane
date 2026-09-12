import { expect, test, type Page, type TestInfo } from '@playwright/test'
import type { BattleSessionView } from '../src/server/battle/battle-session-service'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

test.use({ trace: 'on', actionTimeout: 15_000 })

async function provision(page: Page, prefix: string, testInfo: TestInfo) {
  const seed = `${Date.now()}${Math.floor(Math.random() * 10000)}`
  const name = `${prefix} ${seed
    .slice(-8)
    .split('')
    .map((digit) => String.fromCharCode(97 + Number(digit)))
    .join('')}`
  await provisionAccountAndEnterCharacter({
    page,
    email: `${prefix}-${testInfo.project.name}-${seed}@example.com`,
    password: 'Phase4-ground-disposable-2026!',
    characterName: name,
  })
  return name
}

async function equipMist(page: Page) {
  await page.getByRole('button', { name: /Manage Primary Discipline/ }).click()
  const management = page.getByRole('dialog', { name: 'Discipline Management', exact: true })
  await management
    .locator('label')
    .filter({ hasText: /^Proposed Primary/ })
    .locator('select')
    .selectOption('frostweaver')
  await management
    .getByRole('button', { name: 'Commit Frostweaver as Primary', exact: true })
    .click()
  await expect(page.getByTestId('primary-discipline-chip')).toHaveText('Frostweaver')
  await management.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  const skills = page.getByRole('dialog', { name: 'Techniques', exact: true })
  const mist = skills.locator('article').filter({ hasText: 'Chilling Mist' })
  await mist.getByRole('checkbox').check()
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/character/build/skills') &&
      response.request().method() === 'PUT',
  )
  await skills.getByRole('button', { name: 'Commit Selected Techniques', exact: true }).click()
  expect((await saved).status()).toBe(200)
  await skills.getByRole('button', { name: 'Close', exact: true }).click()
}

async function castOnEmptyGround(page: Page, name: string, testInfo: TestInfo) {
  const root = page.locator('main[data-unified-battle="true"]')
  await expect(root).toHaveAttribute('data-local-turn', 'true')
  const sessionId = new URL(page.url()).pathname.split('/').at(-1)!
  const read = async (): Promise<BattleSessionView> => {
    const response = await page.request.get(`/api/battles/${sessionId}`)
    expect(response.status()).toBe(200)
    return (await response.json()).battle
  }
  // The shared UI has mode-specific authoritative transports (see commitValue).
  await expect(root).toHaveAttribute('data-battle-kind', /^(pve|pvp)$/)
  const commitEndpoint =
    (await root.getAttribute('data-battle-kind')) === 'pvp' ? '/commit' : '/intents'
  const before = await read()
  const actor = before.snapshot.tactical.placements.find(
    (row) => row.combatantId === before.snapshot.tactical.battle.currentTurn?.combatantId,
  )!
  const actorBefore = before.snapshot.tactical.battle.combatants.find(
    (row) => row.id === actor.combatantId,
  )!
  await root.getByRole('button', { name: /Choose Guard skill/ }).click()
  await page.getByRole('option', { name: 'Chilling Mist 45 AP', exact: true }).click()
  await root.getByRole('button', { name: 'Chilling Mist, 45 AP', exact: true }).click()
  const candidates = before.snapshot.tactical.tiles.filter((tile) => {
    const distance =
      Math.abs(tile.position.x - actor.position.x) + Math.abs(tile.position.y - actor.position.y)
    return (
      distance >= 2 &&
      distance <= 3 &&
      tile.elevation === 0 &&
      !before.snapshot.tactical.placements.some(
        (row) =>
          Math.abs(row.position.x - tile.position.x) + Math.abs(row.position.y - tile.position.y) <=
          1,
      )
    )
  })
  expect(candidates.length).toBeGreaterThan(1)
  const audioRequests: string[] = []
  const commits: string[] = []
  page.on('request', (request) => {
    if (/\/audio\?/.test(request.url())) audioRequests.push(request.url())
    if (/\/(intents|commit|final-turn)$/.test(request.url()) && request.method() === 'POST')
      commits.push(request.url())
  })
  let chosen = candidates[0]!
  let legal = false
  // Each candidate is selected through the real board; the server decides LoS and legality.
  for (const candidate of candidates) {
    const tile = root.getByRole('button', {
      name: new RegExp(`^Tile ${candidate.position.x + 1}, ${candidate.position.y + 1};`),
    })
    const response = page.waitForResponse(
      (result) => result.url().endsWith('/preview') && result.request().method() === 'POST',
    )
    await tile.focus()
    await page.keyboard.press('Enter')
    const previewResponse = await response
    expect(previewResponse.request().postDataJSON().intent.target).toEqual({
      kind: 'tile',
      position: candidate.position,
    })
    const preview = (await previewResponse.json()).battlePreview.preview
    if (preview.legal) {
      expect(preview.projectedTerrain.length).toBeGreaterThan(0)
      expect(preview.affectedCombatantIds).toHaveLength(0)
      chosen = candidate
      legal = true
      break
    }
  }
  expect(legal).toBe(true)
  await expect(root.getByRole('button', { name: 'Confirm Action', exact: true })).toBeEnabled()
  // Enter on the already focused tile previews again. It must not commit the first preview.
  let releasePreview!: () => void
  let observedRequest!: () => void
  const held = new Promise<void>((resolve) => {
    releasePreview = resolve
  })
  const observed = new Promise<void>((resolve) => {
    observedRequest = resolve
  })
  await page.route('**/preview', async (route) => {
    observedRequest()
    await held
    await route.continue()
  })
  const again = page.waitForResponse((response) => response.url().endsWith('/preview'))
  await page.keyboard.press('Enter')
  await observed
  try {
    await expect(root.getByRole('button', { name: 'Confirm Action', exact: true })).toBeDisabled()
    expect(commits).toHaveLength(0)
  } finally {
    releasePreview()
  }
  expect((await again).status()).toBe(200)
  await page.unroute('**/preview')
  expect(commits).toHaveLength(0)
  await expect(root.getByLabel('Action preview').first()).not.toContainText('Slow')
  expect(audioRequests).toHaveLength(0)
  expect(await read()).toEqual(before)
  await root.locator('summary').filter({ hasText: 'Terrain & effect details' }).click()
  const forecast = root.getByRole('region', { name: 'Terrain and effect forecast' })
  await expect(forecast).toBeVisible()
  // A panel can have no internal/document overflow while still opening at negative x.
  // This shared cast helper checks all four viewport edges in both PvE and PvP.
  const forecastBounds = await forecast.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }
  })
  expect(forecastBounds.left).toBeGreaterThanOrEqual(0)
  expect(forecastBounds.top).toBeGreaterThanOrEqual(0)
  expect(forecastBounds.right).toBeLessThanOrEqual(forecastBounds.viewportWidth)
  expect(forecastBounds.bottom).toBeLessThanOrEqual(forecastBounds.viewportHeight)
  await expect(forecast).toContainText('Frozen')
  await expect(forecast).toContainText('2 round boundaries')
  await expect(forecast).toContainText('either team')
  expect(await forecast.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true,
  )
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true)
  await root.locator('summary').filter({ hasText: 'Terrain & effect details' }).click()
  const committed = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/battles/${sessionId}${commitEndpoint}`) &&
      response.request().method() === 'POST',
    { timeout: 15_000 },
  )
  await root.getByRole('button', { name: 'Confirm Action', exact: true }).click()
  const committedResponse = await committed
  expect(committedResponse.status()).toBe(200)
  const after = (await committedResponse.json()).battle as BattleSessionView
  expect(after.battleVersion).toBe(before.battleVersion + 1)
  expect(commits).toHaveLength(1)
  const actorAfter = after.snapshot.tactical.battle.combatants.find(
    (row) => row.id === actor.combatantId,
  )!
  const ap = (unit: typeof actorAfter) =>
    unit.temporaryResources.find((row) => row.key === 'pv1f.action-economy')!.current
  expect(ap(actorBefore) - ap(actorAfter)).toBe(45)
  const overlay = root.getByRole('button', {
    name: new RegExp(`^Tile ${chosen.position.x + 1}, ${chosen.position.y + 1};`),
  })
  await expect(overlay).toHaveAttribute('data-terrain-overlay', 'frozen')
  await expect(overlay).toHaveAttribute(
    'aria-label',
    /Frozen terrain; 2 round boundaries remaining/,
  )
  await root.getByRole('button', { name: 'Inspect, Free', exact: true }).click()
  await overlay.click()
  const instructionHost = root.locator(
    'section[aria-label="Command Deck"] > [data-battle-instruction-host="true"]',
  )
  await expect(instructionHost).toHaveCount(1)
  await expect(instructionHost).toContainText('Frozen terrain')
  await page.reload()
  await expect(overlay).toHaveAttribute('data-terrain-overlay', 'frozen')
  expect((await read()).snapshot.terrainOverlays).toEqual(after.snapshot.terrainOverlays)
  await testInfo.attach(`ground-${name}-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  return { position: chosen.position, overlays: after.snapshot.terrainOverlays }
}

test('ground Skill keyboard preview stays silent, confirms once and survives reload in PvE', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000)
  const name = await provision(page, 'Ground', testInfo)
  await equipMist(page)
  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByLabel('AI sparring arena').selectOption('crossroads-court')
  await page.getByRole('button', { name: 'Enter Battle', exact: true }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
  await castOnEmptyGround(page, name, testInfo)
})

test('PvP ground Skill uses the same forecast and spectator terrain inspection', async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(240_000)
  const guestContext = await browser.newContext({
    ...testInfo.project.use,
    baseURL: 'http://127.0.0.1:3100',
  })
  const spectatorContext = await browser.newContext({
    ...testInfo.project.use,
    baseURL: 'http://127.0.0.1:3100',
  })
  let scenarioCompleted = false
  try {
    const guest = await guestContext.newPage()
    const spectator = await spectatorContext.newPage()
    const name = await provision(page, 'GroundHost', testInfo)
    await equipMist(page)
    await provision(guest, 'GroundGuest', testInfo)
    await provision(spectator, 'GroundWatch', testInfo)
    await page.goto('/game/battle')
    await page.getByRole('button', { name: /Player vs Player/ }).click()
    await page.getByRole('button', { name: 'Create Battle Lobby' }).click()
    const hostDialog = page.getByRole('dialog', { name: 'The arena is waiting.' })
    const key = (await hostDialog
      .locator('button')
      .filter({ hasText: 'Lobby Key' })
      .locator('strong')
      .textContent())!.trim()
    await guest.goto(`/game/battle?join=${encodeURIComponent(key)}`)
    await guest
      .getByRole('dialog', { name: 'The arena is waiting.' })
      .getByRole('button', { name: 'Mark Ready' })
      .click()
    await hostDialog.getByRole('button', { name: 'Mark Ready' }).click()
    await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
    await expect(guest).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
    const root = page.locator('main[data-unified-battle="true"]')
    await expect(root).toBeVisible()
    if ((await root.getAttribute('data-local-turn')) !== 'true') {
      await guest.getByRole('button', { name: /Finish Turn, / }).click()
      await guest.getByRole('button', { name: 'Face east', exact: true }).click()
    }
    const result = await castOnEmptyGround(page, name, testInfo)
    const battleKey = (await root
      .locator('[data-pvp-spectator-key="true"] strong')
      .textContent())!.trim()
    await spectator.goto(`/game/battle/spectate/${encodeURIComponent(battleKey)}`)
    const spectatorRoot = spectator.locator('main[data-pvp-spectator="true"]')
    await expect(spectatorRoot).toBeVisible()
    const tile = spectatorRoot.getByRole('button', {
      name: new RegExp(`^Tile ${result.position.x + 1}, ${result.position.y + 1};`),
    })
    await expect(tile).toHaveAttribute('data-terrain-overlay', 'frozen')
    await spectatorRoot.getByRole('button', { name: /Inspect/ }).click()
    await tile.focus()
    await spectator.keyboard.press('Enter')
    await expect(spectatorRoot).toContainText('Frozen terrain; 2 round boundaries remaining')
    await expect(spectatorRoot).toContainText('either team')
    await testInfo.attach(`ground-spectator-${testInfo.project.name}`, {
      body: await spectator.screenshot(),
      contentType: 'image/png',
    })
    scenarioCompleted = true
  } finally {
    // Close both contexts without replacing the original assertion/transport failure.
    const cleanup = await Promise.allSettled([guestContext.close(), spectatorContext.close()])
    if (scenarioCompleted) {
      for (const result of cleanup) {
        if (result.status === 'rejected') throw result.reason
      }
    }
  }
})
