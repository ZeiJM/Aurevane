import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type Page, type TestInfo } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

async function enterDirectory(page: Page, testInfo: TestInfo, group: string) {
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['localhost', '127.0.0.1'].includes(host)) throw new Error('Local review database only.')
  const mobile = testInfo.project.name === 'mobile-chromium'
  await page.setViewportSize({
    width: mobile ? 390 : testInfo.project.name === 'laptop-chromium' ? 1366 : 1728,
    height: mobile ? 844 : testInfo.project.name === 'laptop-chromium' ? 768 : 887,
  })
  const unique = String(Date.now()).replace(/\d/g, (digit) => String.fromCharCode(65 + +digit))
  await provisionAccountAndEnterCharacter({
    page,
    email: `directory-${group}-${testInfo.project.name}-${Date.now()}@example.test`,
    password: 'Disposable-directory-review-2026!',
    characterName: `Liora ${unique}`,
  })
  await page.goto('/game/online')
  return mobile
}

const names = ['Eira Vale', 'Kael Thorn', 'Lyra Dawn', 'Darius Ash', 'Miri Rowan', 'Elowen Frost']
const characters = Array.from({ length: 60 }, (_, index) => ({
  characterId: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  name: names[index] ?? `Wayfarer ${String(index + 1).padStart(2, '0')}`,
  level: 10 + (index % 20),
  lastSeenAt: index === 59 ? null : new Date(Date.now() - index * 60_000).toISOString(),
  portraitRef: null,
  disciplineId: index % 2 === 0 ? 'vanguard' : 'lifebinder',
  personalTitle: index === 0 ? 'Moonlit Wayfarer' : null,
  imageUrl: index < 4 ? `/media/art/concept-ui/portrait-0${index + 1}-v01.webp` : null,
  isOnline: index % 2 === 0,
  secretAccountName: 'PRIVATE_FIELD_SENTINEL',
}))

async function capture(page: Page, testInfo: TestInfo, state: string) {
  const output = process.env.LAYOUT_REVIEW_OUTPUT
  if (!output) return
  await mkdir(output, { recursive: true })
  const metrics = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    overflow: document.documentElement.scrollWidth - innerWidth,
    listScroll: (() => {
      const list = document.querySelector('[data-directory-list]')
      return list ? list.scrollHeight - list.clientHeight : 0
    })(),
  }))
  const stem = `directory-${state}-${testInfo.project.name}`
  await writeFile(path.join(output, `${stem}.json`), JSON.stringify(metrics, null, 2))
  await page.screenshot({ path: path.join(output, `${stem}.png`) })
}

test('directory becomes readable rows while keeping retry, filtering, sorting and every entry reachable', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  const mobile = await enterDirectory(page, testInfo, 'rows')
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  let attempt = 0
  await page.route('**/api/presence/directory', (route) => {
    attempt += 1
    return route.fulfill(attempt === 1 ? { status: 503, json: {} } : { json: { characters } })
  })
  await expect(page.getByRole('heading', { name: 'Online Users', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Show all characters' }).click()
  await expect(
    page.getByText('The full character directory is unavailable right now.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  const list = page.locator('[data-directory-list]')
  await expect(list.getByRole('button')).toHaveCount(60)
  await expect(page.getByRole('list', { name: 'Adventurer rows' })).toBeVisible()
  await expect(list.getByRole('button').first()).toContainText('Eira Vale')
  await capture(page, testInfo, 'all')
  const bg = await page
    .locator('[data-directory-roster]')
    .evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(Math.max(...(bg.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number))).toBeLessThan(65)
  if (!mobile) {
    const [first, second] = await list.getByRole('button').evaluateAll((rows) =>
      rows.slice(0, 2).map((el) => {
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y, bottom: r.bottom, width: r.width }
      }),
    )
    expect(Math.abs(first.x - second.x)).toBeLessThan(1)
    expect(second.y).toBeGreaterThanOrEqual(first.bottom - 1)
    expect(first.width).toBeGreaterThan(600)
    expect(await list.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(0)
    await list.getByRole('button').last().focus()
    await expect(list.getByRole('button').last()).toBeInViewport({ ratio: 1 })
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  }
  await page.getByRole('combobox', { name: 'Class', exact: true }).selectOption('lifebinder')
  await expect(list.getByRole('button')).toHaveCount(30)
  await page.getByRole('combobox', { name: 'Sort', exact: true }).selectOption('oldest')
  await expect(list.getByRole('button').last()).toContainText('Never seen')
  await page.getByRole('combobox', { name: 'Sort', exact: true }).selectOption('alphabetical')
  await expect(list.getByRole('button').first()).toContainText('Darius Ash')
  await page.getByRole('button', { name: 'Show online only' }).click()
  await expect(page.getByRole('region', { name: 'Online character roster' })).toBeVisible()
  await expect(page.getByRole('combobox')).toHaveCount(0)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1)
  if (mobile) {
    for (const width of [320, 375, 760]) {
      await page.setViewportSize({ width, height: 844 })
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(1)
    }
  }
  expect(errors).toEqual([])
})

test('public profile is a native focus-contained dialog with only public identity and square art', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  await enterDirectory(page, testInfo, 'profile')
  await page.route('**/api/presence/directory', (route) => route.fulfill({ json: { characters } }))
  await page.getByRole('button', { name: 'Show all characters' }).click()
  const opener = page.locator('[data-directory-list]').getByRole('button').first()
  await expect(opener).toContainText('Eira Vale')
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Eira Vale', exact: true })
  await expect(dialog).toBeVisible()
  expect(await dialog.evaluate((node) => node.matches(':modal'))).toBe(true)
  await expect(dialog).toContainText('Moonlit Wayfarer')
  await expect(dialog).toContainText('Vanguard')
  await expect(dialog).not.toContainText('PRIVATE_FIELD_SENTINEL')
  await expect(dialog).not.toContainText('Pronouns')
  for (const button of await dialog.getByRole('button', { name: /Planned/ }).all())
    await expect(button).toBeDisabled()
  const portrait = dialog.getByRole('img')
  expect(
    await portrait.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return r.width / r.height
    }),
  ).toBeCloseTo(1, 2)
  for (const key of ['Tab', 'Shift+Tab', 'Tab']) {
    await page.keyboard.press(key)
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true)
  }
  await capture(page, testInfo, 'profile')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
  await opener.click()
  await page.getByRole('button', { name: 'Close public character profile' }).click()
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
})
