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

test('the same Guard hotkey repeats with fresh authority until AP is insufficient', async ({
  page,
}) => {
  test.slow()
  await enterBattle(page)
  const guard = page.locator('[data-battle-command="guard"]')
  const economy = page.getByRole('progressbar', { name: 'Action Economy remaining' })
  let commits = 0
  const previewVersions: number[] = []
  page.on('request', (request) => {
    if (request.method() !== 'POST') return
    const path = new URL(request.url()).pathname
    if (/\/(intents|commit)$/.test(path)) commits++
    if (path.endsWith('/preview'))
      previewVersions.push(request.postDataJSON().expectedBattleVersion)
  })
  await page.mouse.move(0, 0)
  await page.locator('main[data-unified-battle="true"]').focus()
  await page.keyboard.press('Digit3')
  await expect(page.getByLabel('Action preview', { exact: true })).toContainText('30 AP')
  expect(commits).toBe(0)

  for (const remaining of [70, 40, 10]) {
    const previousPreviewCount = previewVersions.length
    await page.keyboard.press('Digit3')
    await expect(economy).toHaveAttribute('aria-valuenow', String(remaining))
    await expect(guard).toHaveAttribute('data-active', 'true')
    await expect.poll(() => previewVersions.length).toBeGreaterThan(previousPreviewCount)
    expect(previewVersions.at(-1)).toBeGreaterThan(previewVersions[previousPreviewCount - 1]!)
    if (remaining >= 30) await expect(guard).toBeEnabled()
    else await expect(guard).toBeDisabled()
  }
  expect(commits).toBe(3)
  await page.keyboard.press('Digit3')
  await expect(page.getByLabel('Action preview', { exact: true })).toContainText(
    /AP|legal|economy/i,
  )
  expect(commits).toBe(3)
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

test('a rapid second self cast re-arms its forecast at the newly committed version', async ({
  page,
}) => {
  test.slow()
  await enterBattle(page)
  const requests: { endpoint: string; version: number }[] = []
  page.on('request', (request) => {
    const endpoint = new URL(request.url()).pathname.split('/').at(-1)!
    if (request.method() === 'POST' && ['preview', 'intents', 'commit'].includes(endpoint))
      requests.push({ endpoint, version: request.postDataJSON().expectedBattleVersion })
  })
  await page.mouse.move(0, 0)
  await page.locator('main[data-unified-battle="true"]').focus()
  await page.keyboard.press('Digit3')
  await expect(page.getByLabel('Action preview', { exact: true })).toContainText('30 AP')
  const initialVersion = requests[0]!.version
  const rearmedPreview = page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname.endsWith('/preview') &&
      request.postDataJSON().expectedBattleVersion === initialVersion + 1,
  )
  await page.keyboard.press('Digit3')
  await rearmedPreview
  // Execute as soon as the informational forecast starts, before waiting for its response.
  const secondCommit = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/(intents|commit)$/.test(new URL(response.url()).pathname) &&
      response.request().postDataJSON().expectedBattleVersion === initialVersion + 1,
  )
  await page.keyboard.press('Digit3')
  const response = await secondCommit
  expect(response.status()).toBe(200)
  const acceptedVersion = (await response.json()).battle.battleVersion as number
  const secondCommitIndex = requests.findIndex(
    (request) => request.endpoint !== 'preview' && request.version === initialVersion + 1,
  )
  expect(secondCommitIndex).toBeGreaterThanOrEqual(0)
  await expect
    .poll(() =>
      requests
        .slice(secondCommitIndex + 1)
        .filter((request) => request.endpoint === 'preview')
        .map((request) => request.version),
    )
    .toEqual([acceptedVersion])
  await expect(page.locator('[data-battle-command="guard"]')).toHaveAttribute('data-active', 'true')
})
