import { PV1F_ACTION_ECONOMY_RESOURCE_KEY } from '@aurevane/game-core/combat/pv1f-action-economy'
import { expect, test, type Page } from '@playwright/test'
import type { BattleSessionView } from '../src/server/battle/battle-session-service'
import type {
  BattleActionPreview,
  BattlePreviewView,
} from '../src/server/battle/battle-preview-service'
import { buildMovementPaths } from '../src/components/battle/battle-geometry'
import { createAccountAndEnterCharacter } from './pv1f-test-helpers'
import { expectNoSkillPreviewMetadata } from './battle-preview-metadata-helpers'
import { expectBasicAttackPotentialRange } from './battle-target-range-helpers'
import { equipBraceInFirstSkillSlot } from './refined-battle-helpers'

async function enterBattle(page: Page, recoveryPractice = false) {
  const name = `Wayfarer ${Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')}`
  await createAccountAndEnterCharacter({
    page,
    email: `refined-${Date.now()}@example.com`,
    password: 'Refined-browser-2026!',
    characterName: name,
  })
  await equipBraceInFirstSkillSlot(page)
  await page.goto('/game/battle')
  await page
    .getByLabel('Battle mode')
    .selectOption(recoveryPractice ? 'guided-fundamentals' : 'recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
  if (recoveryPractice) {
    await page
      .getByRole('dialog', { name: 'Complete the tactical fundamentals' })
      .getByRole('button', { name: 'Continue training' })
      .click()
  }
  await expect(page.locator('[data-battle-layout="refined"]')).toBeVisible()
  // This test's recruit sparring fixture must start with the local actor ready.
  await expect(page.locator('main[data-unified-battle="true"]')).toHaveAttribute(
    'data-local-turn',
    'true',
  )
  await expect(page.getByRole('button', { name: /^Selected Brace,/ })).toBeEnabled()
  if (recoveryPractice) {
    const id = new URL(page.url()).pathname.split('/').at(-1)!
    const response = await page.request.get(`/api/battles/${id}`)
    expect(response.ok()).toBe(true)
    const battle = (await response.json()).battle as BattleSessionView
    expect(battle.snapshot.supportActionPolicyVersion).toBe(1)
    const actor = battle.snapshot.tactical.battle.combatants.find(
      (unit) => unit.id === battle.snapshot.tactical.battle.currentTurn!.combatantId,
    )!
    // Current Guided training supplies real missing HP for its Recovery lesson.
    expect(actor.hp).toBe(Math.max(1, Math.floor(actor.maxHp * 0.75)))
    expect(actor.hp).toBeLessThan(actor.maxHp)
  }
  return page.getByRole('button', { name: new RegExp(`occupied by ${name}`) })
}

function readBraceQuote(view: BattlePreviewView): BattleActionPreview {
  expect(view.preview).toMatchObject({ kind: 'action', legal: true, actionId: 'vanguard.brace' })
  if (view.preview.kind !== 'action') throw new Error('Expected a current Brace action quote')
  expect(view.preview.actionEconomyCost).toBeGreaterThan(0)
  expect(view.preview.projectedEffects).toContainEqual(
    expect.objectContaining({ effectType: 'apply-status', statusId: 'guarded', after: 'pending' }),
  )
  return view.preview
}

function readRecoveryQuote(view: BattlePreviewView): BattleActionPreview {
  expect(view.preview).toMatchObject({ kind: 'action', legal: true, actionId: 'basic.recover' })
  if (view.preview.kind !== 'action') throw new Error('Expected a current Recovery action quote')
  expect(view.preview.actionEconomyCost).toBeGreaterThan(0)
  return view.preview
}

function recoveryCooldown(quote: BattleActionPreview) {
  const cooldown = quote.commandCooldowns?.find(
    (row) => row.actionId === 'basic.recover' && row.role === 'root',
  )
  expect(cooldown).toBeDefined()
  expect(cooldown!.ownerTurns).toBeGreaterThan(0)
  return cooldown!.ownerTurns
}

function recoveryCooldownName(quote: BattleActionPreview) {
  const turns = recoveryCooldown(quote)
  const costs = quote
    .commandCosts!.filter((cost) => cost.amount > 0)
    .map((cost) => `${cost.amount} ${cost.resource.toUpperCase()}`)
    .join(' / ')
  return `HP Recovery, ${costs}, Cooldown: ${turns} ${turns === 1 ? 'turn' : 'turns'} remaining`
}

function expectRecoveredHealth(battle: BattleSessionView, quote: BattleActionPreview) {
  const healing = quote.projectedEffects.find(
    (effect) => effect.effectType === 'healing' && effect.combatantId === quote.actorId,
  )!
  expect(healing).toBeDefined()
  expect(healing.after).toBeGreaterThan(healing.before as number)
  expect(
    battle.snapshot.tactical.battle.combatants.find((unit) => unit.id === quote.actorId)!.hp,
  ).toBe(healing.after)
}

test('mounted attack-path overlays remain visible above open, rough and raised terrain', async ({
  page,
}, testInfo) => {
  test.slow()
  await enterBattle(page)
  const board = page.locator('#battlefield')
  // Potential Attack range remains visible even with no nearby enemy or forecast.
  await page.route('**/api/battles/*/preview', (route) => route.abort())
  await page.locator('main[data-unified-battle="true"]').focus()
  await page.keyboard.press('Digit2')
  await expect(page.locator('[data-battle-command="attack"]')).toHaveAttribute(
    'data-active',
    'true',
  )
  await expectBasicAttackPotentialRange(page)
  await expect(board.locator('[data-target="enemy"]')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(board.locator('[data-attack-path]')).toHaveCount(0)
  // Presentation fixture only: shape selection is covered by battle-attack-path.
  // Exercise the real mounted stylesheet, including the terrain and mode-specific cascade.
  for (const selector of [
    "button[aria-label^='Tile '][data-terrain='open']:not([data-terrain-elevated])",
    "button[aria-label^='Tile '][data-terrain='rough']",
    "button[aria-label^='Tile '][data-terrain-elevated='true']",
  ]) {
    const tile = board.locator(selector).first()
    await expect(tile).toBeVisible()
    const before = await tile.evaluate((node) => getComputedStyle(node).backgroundImage)
    const glow = await tile.evaluate((node) => {
      node.setAttribute('data-attack-path', 'true')
      const style = getComputedStyle(node, '::after')
      return {
        content: style.content,
        background: style.backgroundColor,
        shadow: style.boxShadow,
        pointerEvents: style.pointerEvents,
        texture: getComputedStyle(node).backgroundImage,
      }
    })
    expect(glow.content).toBe('""')
    expect(glow.background).toBe('rgba(189, 38, 58, 0.22)')
    expect(glow.shadow).toContain('216, 59, 76')
    expect(glow.pointerEvents).toBe('none')
    expect(glow.texture).toBe(before)
  }
  await board.screenshot({ path: testInfo.outputPath('attack-path-terrain-glow.png') })
  await board.locator('[data-attack-path]').evaluateAll((tiles) => {
    for (const tile of tiles) tile.removeAttribute('data-attack-path')
  })
  for (const tile of await board.locator("button[aria-label^='Tile ']").all())
    expect(
      await tile.evaluate((node) => getComputedStyle(node, '::after').backgroundColor),
    ).not.toBe('rgba(189, 38, 58, 0.22)')
})

test('single target input executes Brace once and repeated keys do not dispatch', async ({
  page,
}) => {
  test.slow()
  const localTile = await enterBattle(page)
  let commits = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/(intents|commit)$/.test(new URL(request.url()).pathname))
      commits++
  })
  const initialPreview = page.waitForResponse('**/api/battles/*/preview')
  await page.keyboard.press('Digit4')
  const initial = await initialPreview
  const quote = readBraceQuote((await initial.json()).battlePreview)
  await expect(page.locator('[data-battle-combatant-card="selected"]')).toContainText('Recruit')
  await expectNoSkillPreviewMetadata(page.getByLabel('Action preview', { exact: true }))
  await expect(
    page.getByLabel('Action preview', { exact: true }).locator('[data-battle-range-forecast]'),
  ).toContainText('Guard')
  await expect(localTile).toHaveAttribute('data-self-target', 'true')
  await expect
    .poll(() => localTile.evaluate((tile) => getComputedStyle(tile).borderColor))
    .toBe('rgb(108, 145, 198)')
  const selfGlow = await localTile.evaluate((tile) => {
    const overlay = getComputedStyle(tile, '::after')
    const token = tile.querySelector<HTMLElement>(':scope > [data-team]')!
    return {
      background: overlay.backgroundColor,
      overlayLayer: Number(overlay.zIndex),
      tokenLayer: Number(getComputedStyle(token).zIndex),
      ring: getComputedStyle(token).borderColor,
      tileBorder: getComputedStyle(tile).borderColor,
      tileShadow: getComputedStyle(tile).boxShadow,
    }
  })
  expect(selfGlow.background).toBe('rgba(108, 145, 198, 0.5)')
  expect(selfGlow.tokenLayer).toBeGreaterThan(selfGlow.overlayLayer)
  expect(selfGlow.ring).toBe('rgb(208, 170, 98)')
  expect(selfGlow.tileBorder).toBe('rgb(108, 145, 198)')
  expect(selfGlow.tileShadow).toBe('none')
  expect(commits).toBe(0)
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyD', key: 'd', repeat: true, bubbles: true }),
    ),
  )
  expect(commits).toBe(0)
  await localTile.click()
  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    String(quote.actionEconomyAfter),
  )
  expect(commits).toBe(1)
  const pendingGuarded = page
    .locator('[data-battle-combatant-card="local"] [data-effect-timing="pending"]')
    .filter({ has: page.locator('[data-battle-effect-icon="guarded"]') })
    .first()
  await expect(pendingGuarded).toBeVisible()
  // Brace applies genuine pending Guarded; exercise both active tones as a CSS fixture.
  const palettes = await pendingGuarded.evaluate((effect) => {
    const button = effect.querySelector('button')!
    const read = () => {
      const css = getComputedStyle(button)
      return { border: css.borderTopColor, color: css.color, background: css.backgroundImage }
    }
    const pending = read()
    const timing = effect.getAttribute('data-effect-timing')!
    const tone = effect.getAttribute('data-tone')!
    effect.setAttribute('data-effect-timing', 'active')
    effect.setAttribute('data-tone', 'positive')
    const buff = read()
    effect.setAttribute('data-tone', 'negative')
    const debuff = read()
    effect.setAttribute('data-effect-timing', timing)
    effect.setAttribute('data-tone', tone)
    return { pending, buff, debuff }
  })
  expect(palettes.pending.border).toBe('rgb(217, 184, 84)')
  expect(palettes.pending.color).toBe('rgb(245, 221, 150)')
  expect(palettes.buff.border).toBe('rgb(108, 170, 129)')
  expect(palettes.debuff.border).toBe('rgb(167, 82, 74)')
  expect(palettes.buff.background).not.toBe(palettes.pending.background)
  expect(palettes.debuff.background).not.toBe(palettes.pending.background)
})

test('leaving during an informational preview cannot submit a late action', async ({ page }) => {
  test.slow()
  await enterBattle(page)
  let commits = 0
  let previews = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/preview'))
      previews++
    if (request.method() === 'POST' && /\/(intents|commit)$/.test(new URL(request.url()).pathname))
      commits++
  })
  let releasePreview!: () => void
  const hold = new Promise<void>((resolve) => {
    releasePreview = resolve
  })
  const previewHandlers: Promise<void>[] = []
  await page.route('**/api/battles/*/preview', async (route) => {
    let previewSettled!: () => void
    previewHandlers.push(
      new Promise<void>((resolve) => {
        previewSettled = resolve
      }),
    )
    try {
      const response = await route.fetch()
      await hold
      await route.fulfill({ response }).catch(() => undefined)
    } finally {
      previewSettled()
    }
  })
  const firstPreview = page.waitForRequest('**/api/battles/*/preview')
  await page.keyboard.press('Digit4')
  await firstPreview
  // Arming supplies information only; leaving without a target gesture must never commit.
  expect(previews).toBe(1)
  expect(commits).toBe(0)
  if (await page.locator('[data-battle-mobile-chronicle-strip]').isVisible()) {
    // Owner's mobile battle mode intentionally hides the ordinary Account header.
    await expect(page.getByRole('button', { name: 'Account', exact: true })).toHaveCount(0)
    await page.goto('/game/settings/controls')
  } else {
    await page.getByRole('button', { name: 'Account', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Controls & Keybinds', exact: true }).click()
  }
  await expect(page).toHaveURL(/\/game\/settings\/controls$/)
  // Presence polling prevents network-idle; settle the held response after the battle unmounts.
  await expect(page.locator('[data-battle-layout="refined"]')).toHaveCount(0)
  releasePreview()
  await Promise.all(previewHandlers)
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )
  expect(previews).toBe(1)
  expect(commits).toBe(0)
})

test('HP Recovery clears its armed mode and blocks deliberate inputs during its authoritative cooldown', async ({
  page,
}) => {
  test.slow()
  await enterBattle(page, true)
  const recovery = page.locator('[data-battle-command="guard"]')
  const economy = page.getByRole('progressbar', { name: 'Action Economy remaining' })
  let commits = 0
  const previewVersions: number[] = []
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.method() !== 'POST') return
    const path = new URL(request.url()).pathname
    if (/\/(preview|intents|commit|final-turn)$/.test(path)) requests.push(path)
    if (/\/(intents|commit)$/.test(path)) commits++
    if (path.endsWith('/preview'))
      previewVersions.push(request.postDataJSON().expectedBattleVersion)
  })
  await page.mouse.move(0, 0)
  await page.locator('main[data-unified-battle="true"]').focus()
  const initialPreview = page.waitForResponse('**/api/battles/*/preview')
  await page.keyboard.press('Digit3')
  const initial = await initialPreview
  const initialVersion = initial.request().postDataJSON().expectedBattleVersion as number
  const quote = readRecoveryQuote((await initial.json()).battlePreview)
  await expectNoSkillPreviewMetadata(page.getByLabel('Action preview', { exact: true }))
  await expect(
    page.getByLabel('Action preview', { exact: true }).locator('[data-battle-range-forecast]'),
  ).toContainText('Heal')
  expect(commits).toBe(0)

  const committed = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/(intents|commit)$/.test(new URL(response.url()).pathname),
  )
  await page.keyboard.press('Digit3')
  const response = await committed
  expect(response.status()).toBe(200)
  const after = (await response.json()).battle
  expect(after.battleVersion).toBe(initialVersion + 1)
  expectRecoveredHealth(after, quote)
  await expect(economy).toHaveAttribute('aria-valuenow', String(quote.actionEconomyAfter))
  await expect(recovery).toBeDisabled()
  await expect(recovery).toHaveAccessibleName(recoveryCooldownName(quote))
  await expect(recovery).not.toHaveAttribute('data-active', 'true')
  await expect(
    page.locator('[data-command-card="guard"] [data-battle-cooldown-countdown]'),
  ).toHaveText(String(recoveryCooldown(quote)))
  // The cast may refresh its legal receipt, but never re-previews the now cooling action.
  expect(previewVersions.length).toBeGreaterThanOrEqual(1)
  expect(previewVersions.every((version) => version === initialVersion)).toBe(true)
  expect(commits).toBe(1)

  const requestCount = requests.length
  for (const key of ['Digit3', 'Digit3', 'KeyD']) await page.keyboard.press(key)
  await recovery.evaluate((button) => (button as HTMLButtonElement).click())
  await page.keyboard.press('Escape')
  await expect(recovery).not.toHaveAttribute('data-active', 'true')
  await expect(recovery).toBeDisabled()
  await expect(economy).toHaveAttribute('aria-valuenow', String(quote.actionEconomyAfter))
  expect(requests).toHaveLength(requestCount)
  expect(commits).toBe(1)
  const authority = await page.request.get(`/api/battles/${after.battleSessionId}`)
  expect(authority.ok()).toBe(true)
  expect((await authority.json()).battle.battleVersion).toBe(after.battleVersion)
})

test('Move displays the full legal range and commits a multi-tile route in one gesture', async ({
  page,
}) => {
  test.slow()
  await enterBattle(page)
  const battleId = new URL(page.url()).pathname.split('/').at(-1)!
  const authority = await page.request.get(`/api/battles/${battleId}`)
  expect(authority.ok()).toBe(true)
  const before = (await authority.json()).battle as BattleSessionView
  const turn = before.snapshot.tactical.battle.currentTurn!
  const placement = before.snapshot.tactical.placements.find(
    (unit) => unit.combatantId === turn.combatantId,
  )!
  const actor = before.snapshot.tactical.battle.combatants.find(
    (unit) => unit.id === turn.combatantId,
  )!
  const economy = actor.temporaryResources.find(
    (resource) => resource.key === PV1F_ACTION_ECONOMY_RESOURCE_KEY,
  )!.current
  const paths = buildMovementPaths(before.snapshot, placement, economy)
  const longest = [...paths.values()].sort((a, b) => b.length - a.length)[0]
  expect(longest.length).toBeGreaterThan(2)
  // Read the server's canonical cost without changing the persisted encounter.
  const forecastResponse = await page.request.post(`/api/battles/${battleId}/preview`, {
    data: { expectedBattleVersion: before.battleVersion, intent: { kind: 'move', path: longest } },
  })
  expect(forecastResponse.ok()).toBe(true)
  const evaluated = (await forecastResponse.json()).battlePreview.preview
  expect(evaluated.legal).toBe(true)
  let commits = 0
  let movePreviews = 0
  page.on('request', (request) => {
    if (request.method() !== 'POST') return
    const path = new URL(request.url()).pathname
    if (/\/(intents|commit)$/.test(path)) commits++
    if (path.endsWith('/preview') && request.postDataJSON().intent.kind === 'move') movePreviews++
  })
  await page.mouse.move(0, 0)
  await page.locator('main[data-unified-battle="true"]').focus()
  await page.keyboard.press('Digit1')
  const highlighted = await page
    .locator('#battlefield [data-reachable="true"]')
    .evaluateAll((tiles) =>
      tiles
        .map((tile) => {
          const xy = tile.getAttribute('aria-label')!.match(/^Tile (\d+), (\d+)/)!
          return `${Number(xy[1]) - 1}:${Number(xy[2]) - 1}`
        })
        .sort(),
    )
  expect(highlighted).toEqual([...paths.keys()].sort())
  await expect(page.locator('[data-battle-preview-strip]')).toContainText(
    `Range: ${longest.length - 1} tiles`,
  )
  const destination = longest.at(-1)!
  const committed = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/(intents|commit)$/.test(new URL(response.url()).pathname),
  )
  await page
    .getByRole('button', { name: new RegExp(`^Tile ${destination.x + 1}, ${destination.y + 1};`) })
    .click()
  const response = await committed
  expect(response.status()).toBe(200)
  expect(response.request().postDataJSON().intent.path).toEqual(longest)
  const after = (await response.json()).battle as BattleSessionView
  expect(after.battleVersion).toBe(before.battleVersion + 1)
  expect(
    after.snapshot.tactical.placements.find((unit) => unit.combatantId === turn.combatantId)!
      .position,
  ).toEqual(destination)
  expect(after.snapshot.tactical.battle.currentTurn!.movementRemaining).toBe(
    evaluated.movementRemainingAfter,
  )
  expect(
    after.snapshot.tactical.battle.combatants
      .find((unit) => unit.id === turn.combatantId)!
      .temporaryResources.find((resource) => resource.key === PV1F_ACTION_ECONOMY_RESOURCE_KEY)!
      .current,
  ).toBe(economy - evaluated.actionEconomyCost)
  expect(commits).toBe(1)
  expect(movePreviews).toBe(0)
  await expect(page.locator('#battlefield [data-path-index]')).toHaveCount(0)
})

test('a second pointer or hotkey during a pending commit cannot queue another action', async ({
  page,
}) => {
  test.slow()
  const localTile = await enterBattle(page, true)
  let commits = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/(intents|commit)$/.test(new URL(request.url()).pathname))
      commits++
  })
  let release!: () => void
  const hold = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/battles/*/intents', async (route) => {
    const response = await route.fetch()
    await hold
    await route.fulfill({ response })
  })
  await page.mouse.move(0, 0)
  await page.locator('main[data-unified-battle="true"]').focus()
  const initialPreview = page.waitForResponse('**/api/battles/*/preview')
  await page.keyboard.press('Digit3')
  const initial = await initialPreview
  const initialVersion = initial.request().postDataJSON().expectedBattleVersion as number
  const quote = readRecoveryQuote((await initial.json()).battlePreview)
  await expectNoSkillPreviewMetadata(page.getByLabel('Action preview', { exact: true }))
  await expect(
    page.getByLabel('Action preview', { exact: true }).locator('[data-battle-range-forecast]'),
  ).toContainText('Heal')
  const committed = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/(intents|commit)$/.test(new URL(response.url()).pathname),
  )
  try {
    await localTile.click()
    await expect(page.locator('[data-battle-command="guard"]')).toBeDisabled()
    await localTile.dispatchEvent('click')
    await page.keyboard.press('Digit3')
    expect(commits).toBe(1)
  } finally {
    release()
  }
  const response = await committed
  expect(response.status()).toBe(200)
  const after = (await response.json()).battle as BattleSessionView
  expect(after.battleVersion).toBe(initialVersion + 1)
  expectRecoveredHealth(after, quote)
  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    String(quote.actionEconomyAfter),
  )
  const recovery = page.locator('[data-battle-command="guard"]')
  await expect(recovery).toBeDisabled()
  await expect(recovery).toHaveAccessibleName(recoveryCooldownName(quote))
  await expect(recovery).not.toHaveAttribute('data-active', 'true')
  await expect(
    page.locator('[data-command-card="guard"] [data-battle-cooldown-countdown]'),
  ).toHaveText(String(recoveryCooldown(quote)))
  expect(commits).toBe(1)
})

test('a rapid second Basic Attack commits without waiting for an informational forecast', async ({
  page,
}) => {
  test.slow()
  const localTile = await enterBattle(page)
  const root = page.locator('main[data-unified-battle="true"]')
  const attack = page.locator('[data-battle-command="attack"]')
  const recruitTile = page.getByRole('button', { name: /occupied by Recruit/ }).first()
  // Move and finish normal turns until the real Recruit is adjacent. No battle state is edited.
  for (let turn = 0; turn < 8; turn++) {
    const adjacent = await page.locator('#battlefield').evaluate(
      (board, label) => {
        const point = (value: string) =>
          value
            .match(/^Tile (\d+), (\d+)/)!
            .slice(1)
            .map(Number)
        const [x, y] = point(label)
        return [...board.querySelectorAll('button[aria-label*="occupied by"]')].some((tile) => {
          const target = tile.getAttribute('aria-label')!
          const [tx, ty] = point(target)
          return target !== label && Math.abs(tx - x) + Math.abs(ty - y) === 1
        })
      },
      (await localTile.getAttribute('aria-label'))!,
    )
    const ap = Number(
      await page
        .getByRole('progressbar', { name: 'Action Economy remaining' })
        .getAttribute('aria-valuenow'),
    )
    if (adjacent && ap >= 60) break
    await page.mouse.move(0, 0)
    await root.focus()
    await page.keyboard.press('Digit1')
    for (let step = 0; step < 2 && !adjacent; step++) {
      const destination = await page.locator('#battlefield').evaluate(
        (board, label) => {
          const point = (value: string) =>
            value
              .match(/^Tile (\d+), (\d+)/)!
              .slice(1)
              .map(Number)
          const enemies = [...board.querySelectorAll('button[aria-label*="occupied by"]')]
            .map((tile) => tile.getAttribute('aria-label')!)
            .filter((target) => target !== label)
            .map(point)
          return [...board.querySelectorAll('button[data-reachable="true"]')]
            .map((tile) => {
              const target = tile.getAttribute('aria-label')!,
                [x, y] = point(target)
              return {
                target,
                distance: Math.min(
                  ...enemies.map(([tx, ty]) => Math.abs(tx - x) + Math.abs(ty - y)),
                ),
              }
            })
            .sort((a, b) => a.distance - b.distance)[0]
        },
        (await localTile.getAttribute('aria-label'))!,
      )
      if (!destination) break
      const commit = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          /\/(intents|commit)$/.test(new URL(response.url()).pathname),
      )
      await page.getByRole('button', { name: destination.target, exact: true }).click()
      expect((await commit).status()).toBe(200)
      if (destination.distance === 1) break
    }
    // A new local turn provides enough AP for both repeated Basic Attacks.
    await page.mouse.move(0, 0)
    await root.focus()
    await page.keyboard.press('Space')
    const finalTurn = page.waitForResponse('**/api/battles/*/final-turn')
    const recruitTurn = page.waitForResponse('**/api/battles/*/recruit-turn')
    await page.keyboard.press('Space')
    const handedOff = await finalTurn
    expect(handedOff.status()).toBe(200)
    const handedOffVersion = (await handedOff.json()).battle.battleVersion as number
    const returned = await recruitTurn
    expect(returned.status()).toBe(200)
    expect(returned.request().postDataJSON().expectedBattleVersion).toBe(handedOffVersion)
    expect((await returned.json()).battle.battleVersion).toBeGreaterThan(handedOffVersion)
    await expect(root).toHaveAttribute('data-local-turn', 'true')
    await expect(
      page.getByRole('progressbar', { name: 'Action Economy remaining' }),
    ).toHaveAttribute('aria-valuenow', '100')
  }

  const requests: { endpoint: string; version: number }[] = []
  page.on('request', (request) => {
    const endpoint = new URL(request.url()).pathname.split('/').at(-1)!
    if (request.method() === 'POST' && ['preview', 'intents', 'commit'].includes(endpoint))
      requests.push({ endpoint, version: request.postDataJSON().expectedBattleVersion })
  })
  await page.mouse.move(0, 0)
  await root.focus()
  const initialPreview = page.waitForResponse('**/api/battles/*/preview')
  await page.keyboard.press('Digit2')
  const initial = await initialPreview
  const initialAction = (await initial.json()).battlePreview.preview
  expect(initialAction.legal).toBe(true)
  expect(initialAction.hitChanceBasisPoints).not.toBeNull()
  await expectBasicAttackPotentialRange(page)
  await expect
    .poll(() =>
      page
        .locator('#battlefield [data-attack-path]')
        .evaluateAll(
          (tiles) =>
            tiles.length > 0 &&
            tiles.every(
              (tile) =>
                getComputedStyle(tile, '::after').backgroundColor === 'rgba(189, 38, 58, 0.22)',
            ),
        ),
    )
    .toBe(true)
  await expect(page.getByLabel('Action preview', { exact: true })).toContainText(
    `Hit ${Math.round(initialAction.hitChanceBasisPoints / 100)}%`,
  )
  await expectNoSkillPreviewMetadata(page.getByLabel('Action preview', { exact: true }))
  const initialVersion = initial.request().postDataJSON().expectedBattleVersion as number
  let releasePreview!: () => void
  let informationalReady!: () => void
  const hold = new Promise<void>((resolve) => {
    releasePreview = resolve
  })
  const heldReady = new Promise<void>((resolve) => {
    informationalReady = resolve
  })
  let held = false
  let heldForecast: BattlePreviewView | undefined
  const handlers: Promise<void>[] = []
  await page.route('**/api/battles/*/preview', async (route) => {
    const payload = route.request().postDataJSON()
    if (held || payload.expectedBattleVersion !== initialVersion + 1) return route.continue()
    held = true
    let settled!: () => void
    handlers.push(
      new Promise<void>((resolve) => {
        settled = resolve
      }),
    )
    try {
      const response = await route.fetch()
      heldForecast = (await response.json()).battlePreview
      informationalReady()
      await hold
      await route.fulfill({ response }).catch(() => undefined)
    } finally {
      settled()
    }
  })
  try {
    await recruitTile.click()
    await heldReady
    // A deliberate gesture commits immediately; the server validates the accepted version.
    const secondCommit = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/(intents|commit)$/.test(new URL(response.url()).pathname) &&
        response.request().postDataJSON().expectedBattleVersion === initialVersion + 1,
    )
    const latestPreview = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/preview') &&
        response.request().postDataJSON().expectedBattleVersion === initialVersion + 2,
    )
    await recruitTile.click()
    // The held forecast has not been released when the authoritative commit completes.
    const response = await secondCommit
    expect(response.status()).toBe(200)
    const accepted = (await response.json()).battle
    await expect(
      page.getByRole('progressbar', { name: 'Action Economy remaining' }),
    ).toHaveAttribute('aria-valuenow', '40')
    expect(
      requests.filter(
        (request) => request.endpoint === 'preview' && request.version === initialVersion + 1,
      ),
    ).toHaveLength(1)
    releasePreview()
    const acceptedVersion = accepted.battleVersion as number
    expect(accepted.snapshot.tactical.battle.lifecycle).toBe('active')
    const targetId = (await initial.json()).battlePreview.preview.primaryCombatantId as string
    expect(
      accepted.snapshot.tactical.battle.combatants.find(
        (unit: { id: string; hp: number }) => unit.id === targetId,
      ).hp,
    ).toBeGreaterThan(0)
    const secondCommitIndex = requests.findIndex(
      (request) => request.endpoint !== 'preview' && request.version === initialVersion + 1,
    )
    expect(secondCommitIndex).toBeGreaterThanOrEqual(0)
    expect(
      requests
        .filter((request) => request.endpoint !== 'preview')
        .map((request) => request.version),
    ).toEqual([initialVersion, initialVersion + 1])
    expect(acceptedVersion).toBe(initialVersion + 2)
    const freshForecast = (await (await latestPreview).json()).battlePreview as BattlePreviewView
    expect(freshForecast.battleVersion).toBe(acceptedVersion)
    expect(freshForecast.preview).toMatchObject({ actionEconomyBefore: 40, actionEconomyAfter: 10 })
    const forecast = page.getByLabel('Action preview', { exact: true })
    await expect(forecast).not.toContainText(/\d+ AP left/)
    expect(heldForecast).toMatchObject({
      battleVersion: initialVersion + 1,
      preview: { actionEconomyBefore: 70, actionEconomyAfter: 40 },
    })
    const freshAction = freshForecast.preview
    if (freshAction.kind !== 'action') throw new Error('Expected an authoritative action forecast')
    expect(freshAction.primaryCombatantId).toBe(targetId)
    const targetForecast = forecast.locator(`[data-battle-range-forecast="${targetId}"]`)
    const expectLatestInlineResult = async () => {
      await expect(targetForecast).toHaveCount(1)
      const result = targetForecast.locator(':scope > span:last-child')
      if (freshAction.hitChanceBasisPoints !== null)
        await expect(result).toContainText(
          `Hit ${Math.round(freshAction.hitChanceBasisPoints / 100)}%`,
        )
      else await expect(result).not.toContainText(/Hit \d+%/)
      const damage = freshAction.projectedEffects
        .filter((effect) => effect.combatantId === targetId && effect.effectType === 'damage')
        .reduce(
          (total, effect) =>
            total +
            (typeof effect.before === 'number' && typeof effect.after === 'number'
              ? Math.max(0, effect.before - effect.after)
              : 0),
          0,
        )
      expect(damage).toBeGreaterThan(0)
      await expect(result).toContainText(`${damage} dmg`)
      await expect(forecast.getByRole('button')).toHaveCount(0)
      await expect(forecast).not.toContainText(/\d+ AP left/)
    }
    await expectLatestInlineResult()
    await Promise.all(handlers)
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    )
    await expectLatestInlineResult()
    await expect
      .poll(() =>
        requests
          .slice(secondCommitIndex + 1)
          .filter((request) => request.endpoint === 'preview')
          .map((request) => request.version),
      )
      .toEqual([acceptedVersion])
    expect(
      requests.filter(
        (request) => request.endpoint === 'preview' && request.version === initialVersion + 1,
      ),
    ).toHaveLength(1)
    await expect(attack).toHaveAttribute('data-active', 'true')
  } finally {
    releasePreview()
    await Promise.all(handlers)
  }
})
