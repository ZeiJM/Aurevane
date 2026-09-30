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
  await page.goto('/game/battle')
  releasePreview()
  // Presence polling prevents network-idle; settle the held response after the battle unmounts.
  await expect(page.locator('[data-battle-layout="refined"]')).toHaveCount(0)
  await Promise.all(previewHandlers)
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )
  expect(commits).toBe(0)
})
