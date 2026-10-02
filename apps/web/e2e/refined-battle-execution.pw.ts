import { expect, test, type Page } from '@playwright/test'
import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

async function enterBattle(page: Page) {
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
  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page.locator('[data-battle-layout="refined"]')).toBeVisible()
  return page.getByRole('button', { name: new RegExp(`occupied by ${name}`) })
}

test('single target input executes Guard once and repeated keys do not dispatch', async ({
  page,
}) => {
  test.slow()
  const localTile = await enterBattle(page)
  let commits = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/(intents|commit)$/.test(new URL(request.url()).pathname))
      commits++
  })
  await page.keyboard.press('Digit3')
  await expect(page.getByLabel('Action preview', { exact: true })).toContainText('30 AP')
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
    '70',
  )
  expect(commits).toBe(1)
})

test('leaving during a slow target preview cannot submit a late action', async ({ page }) => {
  test.slow()
  const localTile = await enterBattle(page)
  let commits = 0
  page.on('request', (request) => {
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
  await page.keyboard.press('Digit3')
  const executionPreview = page.waitForRequest('**/api/battles/*/preview')
  await localTile.click()
  await executionPreview
  await expect(page.getByRole('button', { name: /^Basic Attack,/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Account', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Controls & Keybinds', exact: true }).click()
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
  expect(commits).toBe(0)
})

test('Guard re-arms at fresh authority but its cooldown blocks further deliberate hotkeys', async ({
  page,
}) => {
  test.slow()
  await enterBattle(page)
  const guard = page.locator('[data-battle-command="guard"]')
  const economy = page.getByRole('progressbar', { name: 'Action Economy remaining' })
  let commits = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/(intents|commit)$/.test(new URL(request.url()).pathname))
      commits++
  })
  await page.mouse.move(0, 0)
  await page.locator('main[data-unified-battle="true"]').focus()
  const initialPreview = page.waitForResponse('**/api/battles/*/preview')
  await page.keyboard.press('Digit3')
  const initialVersion = (await initialPreview).request().postDataJSON()
    .expectedBattleVersion as number
  await expect(page.getByLabel('Action preview', { exact: true })).toContainText('30 AP')
  expect(commits).toBe(0)

  const rearmedPreview = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname.endsWith('/preview') &&
      response.request().postDataJSON().expectedBattleVersion === initialVersion + 1,
  )
  await page.keyboard.press('Digit3')
  const forecast = (await (await rearmedPreview).json()).battlePreview.preview
  expect(forecast).toMatchObject({ actionId: 'basic.guard', legal: false })
  expect(forecast.issues).toEqual(
    expect.arrayContaining([expect.objectContaining({ code: 'cooldown-active' })]),
  )
  await expect(economy).toHaveAttribute('aria-valuenow', '70')
  await expect(guard).toHaveAttribute('data-active', 'true')
  expect(commits).toBe(1)

  for (const key of ['Digit3', 'Digit3', 'KeyD']) {
    const blockedPreview = page.waitForResponse('**/api/battles/*/preview')
    await page.keyboard.press(key)
    const response = await blockedPreview
    expect(response.request().postDataJSON().expectedBattleVersion).toBe(initialVersion + 1)
    const blocked = (await response.json()).battlePreview.preview
    expect(blocked.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'cooldown-active' })]),
    )
    await expect(economy).toHaveAttribute('aria-valuenow', '70')
    await expect(guard).toHaveAttribute('data-active', 'true')
    expect(commits).toBe(1)
  }
  await page.keyboard.press('Escape')
  await expect(guard).not.toHaveAttribute('data-active', 'true')
})

test('Move shows and commits adjacent steps while staying armed for the next step', async ({
  page,
}) => {
  test.slow()
  const localTile = await enterBattle(page)
  const move = page.locator('[data-battle-command="move"]')
  let commits = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/(intents|commit)$/.test(new URL(request.url()).pathname))
      commits++
  })
  await page.mouse.move(0, 0)
  await page.locator('main[data-unified-battle="true"]').focus()
  await page.keyboard.press('Digit1')
  const origin = (await localTile.getAttribute('aria-label'))!.match(/^Tile (\d+), (\d+)/)!
  const reachable = page.locator('#battlefield [data-reachable="true"]')
  const labels = await reachable.evaluateAll((tiles) =>
    tiles.map((tile) => tile.getAttribute('aria-label')!),
  )
  expect(labels.length).toBeGreaterThan(0)
  expect(labels.length).toBeLessThanOrEqual(4)
  for (const label of labels) {
    const point = label.match(/^Tile (\d+), (\d+)/)!
    expect(
      Math.abs(Number(point[1]) - Number(origin[1])) +
        Math.abs(Number(point[2]) - Number(origin[2])),
    ).toBe(1)
  }
  const distant = await page.locator('#battlefield button').evaluateAll(
    (tiles, origin) => {
      return tiles
        .find((tile) => {
          const xy = tile.getAttribute('aria-label')?.match(/^Tile (\d+), (\d+)/)
          return (
            xy &&
            Math.abs(Number(xy[1]) - origin.x) + Math.abs(Number(xy[2]) - origin.y) > 1 &&
            !tile.hasAttribute('data-reachable')
          )
        })
        ?.getAttribute('aria-label')
    },
    { x: Number(origin[1]), y: Number(origin[2]) },
  )
  expect(distant).toBeTruthy()
  await page.getByRole('button', { name: distant!, exact: true }).click()
  expect(commits).toBe(0)
  for (let step = 0; step < 2; step++) {
    const response = page.waitForResponse(
      (result) =>
        result.request().method() === 'POST' &&
        /\/(intents|commit)$/.test(new URL(result.url()).pathname),
    )
    await reachable.first().click()
    expect((await response).status()).toBe(200)
    await expect(move).toHaveAttribute('data-active', 'true')
    await expect(move).toBeEnabled()
    expect(commits).toBe(step + 1)
  }
  await expect(page.locator('#battlefield [data-path-index]')).toHaveCount(0)
})

test('a second pointer or hotkey during a pending commit cannot queue another action', async ({
  page,
}) => {
  test.slow()
  const localTile = await enterBattle(page)
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
  await page.keyboard.press('Digit3')
  await expect(page.getByLabel('Action preview', { exact: true })).toContainText('30 AP')
  try {
    await localTile.click()
    await expect(page.locator('[data-battle-command="guard"]')).toBeDisabled()
    await localTile.dispatchEvent('click')
    await page.keyboard.press('Digit3')
    expect(commits).toBe(1)
  } finally {
    release()
  }
  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '70',
  )
  await expect(page.locator('[data-battle-command="guard"]')).toHaveAttribute('data-active', 'true')
  expect(commits).toBe(1)
})

test('a rapid second Basic Attack supersedes its held informational forecast at fresh authority', async ({
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
  expect((await initial.json()).battlePreview.preview.legal).toBe(true)
  await expect(page.getByLabel('Action preview', { exact: true })).toContainText('30 AP')
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
    // The deliberate second execution must fetch fresh authority while its older informational
    // receipt remains held. Releasing that receipt afterward must not replace the latest forecast.
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
    const response = await secondCommit
    expect(response.status()).toBe(200)
    const accepted = (await response.json()).battle
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
    const freshForecast = (await (await latestPreview).json()).battlePreview
    expect(freshForecast.battleVersion).toBe(acceptedVersion)
    expect(freshForecast.preview).toMatchObject({ actionEconomyBefore: 40, actionEconomyAfter: 10 })
    const forecast = page.getByLabel('Action preview', { exact: true })
    await expect(forecast).toContainText('10 AP left')
    await expect(forecast).not.toContainText('40 AP left')
    releasePreview()
    await Promise.all(handlers)
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    )
    await expect(forecast).toContainText('10 AP left')
    await expect(forecast).not.toContainText('40 AP left')
    await expect
      .poll(() =>
        requests
          .slice(secondCommitIndex + 1)
          .filter((request) => request.endpoint === 'preview')
          .map((request) => request.version),
      )
      .toEqual([acceptedVersion])
    await expect(attack).toHaveAttribute('data-active', 'true')
  } finally {
    releasePreview()
    await Promise.all(handlers)
  }
})
