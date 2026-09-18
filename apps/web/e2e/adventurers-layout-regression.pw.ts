import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type Page, type TestInfo } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

async function enter(page: Page, info: TestInfo) {
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['localhost', '127.0.0.1'].includes(host))
    throw new Error('Adventurers review requires disposable local Supabase.')
  const suffix = `${Date.now()}${info.workerIndex}`
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  await provisionAccountAndEnterCharacter({
    page,
    email: `adventurers-${info.project.name}-${Date.now()}@example.test`,
    password: 'Disposable-roster-review-2026!',
    characterName: `Liora ${suffix}`,
  })
  await page.goto('/game/online')
  await expect(page.getByRole('heading', { name: 'Online Users', exact: true })).toBeVisible()
}

async function capture(page: Page, info: TestInfo, state: string) {
  const output = process.env.LAYOUT_REVIEW_OUTPUT
  if (!output) return
  await mkdir(output, { recursive: true })
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  await page.screenshot({
    path: path.join(output, `adventurers-${state}-${info.project.name}.png`),
    fullPage: true,
  })
  await page.screenshot({
    path: path.join(output, `adventurers-${state}-${info.project.name}-viewport.png`),
  })
}

test('Adventurers roster preserves browsing and public-profile privacy in the new composition', async ({
  page,
}, info) => {
  test.setTimeout(90_000)
  const mobile = info.project.name === 'mobile-chromium'
  const viewport = {
    width: mobile ? 390 : info.project.name === 'laptop-chromium' ? 1366 : 1728,
    height: mobile ? 844 : info.project.name === 'laptop-chromium' ? 768 : 887,
  }
  await page.setViewportSize(viewport)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await enter(page, info)
  const hero = page.locator('[data-online-users-heading="true"]')
  await expect(
    hero.getByRole('button', { name: 'Show all characters', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Different paths. A shared world.', { exact: true })).toHaveCount(0)
  await expect(page.getByText(/^\d+ online$/)).toHaveCount(0)
  await capture(page, info, 'online')
  // The initial authenticated roster is real. Only the public directory response is a cosmetic
  // fixture so titles, missing images, stale presence and large rosters are deterministic.
  const fixture = Array.from({ length: 60 }, (_, index) => ({
    characterId: `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    name: `Adventurer ${String(index + 1).padStart(2, '0')}`,
    level: 1 + (index % 50),
    lastSeenAt: index === 59 ? null : new Date(Date.now() - index * 60000).toISOString(),
    portraitRef: null,
    disciplineId: index % 2 === 0 ? 'vanguard' : 'lifebinder',
    personalTitle: index === 0 ? 'Keeper of the Last Light' : null,
    imageUrl: index === 0 ? '/media/art/concept-ui/portrait-01-v01.webp' : null,
    isOnline: index % 3 === 0,
    email: 'private-account-sentinel@example.test',
    requestedCharacterXp: 'private-progression-sentinel',
  }))
  await page.route('**/api/presence/directory', (route) =>
    route.fulfill({ json: { characters: fixture } }),
  )
  await page.getByRole('button', { name: 'Show all characters', exact: true }).click()
  const roster = page.getByRole('region', { name: 'All character directory' })
  const list = roster.locator('[data-directory-list]')
  await expect(list.locator('[data-directory-character]')).toHaveCount(60)
  await expect(hero.getByRole('combobox', { name: 'Class', exact: true })).toBeVisible()
  await expect(hero.getByRole('combobox', { name: 'Sort', exact: true })).toBeVisible()
  await expect(hero.getByText('60 shown', { exact: true })).toBeVisible()
  await expect(page.getByText('The realm', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Known adventurers', { exact: true })).toHaveCount(0)
  await expect(
    page.getByText('Browse public identities by class or recent activity.', { exact: true }),
  ).toHaveCount(0)
  await expect(page.getByText('60 of 60 characters', { exact: true })).toHaveCount(0)
  await hero.getByRole('combobox', { name: 'Sort', exact: true }).selectOption('alphabetical')
  const metrics = await roster.evaluate((node) => {
    const list = node.querySelector('[data-directory-list]')!
    const first = list.querySelector('button')!
    const second = list.querySelectorAll('button')[1]!
    const a = first.getBoundingClientRect()
    const b = second.getBoundingClientRect()
    return {
      background: getComputedStyle(node).backgroundColor,
      first: { x: a.x, y: a.y, bottom: a.bottom },
      second: { x: b.x, y: b.y },
      listOverflow: list.scrollHeight - list.clientHeight,
      documentOverflow: document.documentElement.scrollWidth - innerWidth,
    }
  })
  expect(
    Math.max(...(metrics.background.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)),
  ).toBeLessThan(65)
  expect(Math.abs(metrics.first.x - metrics.second.x)).toBeLessThan(1)
  expect(metrics.second.y).toBeGreaterThanOrEqual(metrics.first.bottom)
  expect(metrics.documentOverflow).toBeLessThanOrEqual(1)
  if (!mobile) expect(metrics.listOverflow).toBeGreaterThan(0)
  await capture(page, info, 'directory')
  if (info.project.name === 'desktop-chromium') {
    for (const shortViewport of [
      { width: 1024, height: 576 },
      { width: 768, height: 576 },
    ]) {
      await page.setViewportSize(shortViewport)
      const shortList = await list.boundingBox()
      expect(shortList!.height, 'short windows retain a usable roster').toBeGreaterThanOrEqual(80)
      await expect(hero.getByRole('combobox', { name: 'Class', exact: true })).toBeVisible()
      await expect(hero.getByRole('combobox', { name: 'Sort', exact: true })).toBeVisible()
      const last = list.getByRole('button').last()
      await last.scrollIntoViewIfNeeded()
      await expect(last).toBeInViewport({ ratio: 1 })
      await last.click({ trial: true })
      await list.evaluate((node) => node.scrollTo({ top: 0, behavior: 'instant' }))
      await capture(page, info, `directory-${shortViewport.width}x${shortViewport.height}`)
    }
    await page.setViewportSize(viewport)
  }
  const first = list.getByRole('button').first()
  await first.click()
  const dialog = page.getByRole('dialog', { name: 'Adventurer 01', exact: true })
  await expect(dialog).toBeVisible()
  expect(await dialog.evaluate((node) => node.matches('dialog:modal'))).toBe(true)
  await expect(dialog.getByText('Keeper of the Last Light', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Send Direct Message/ })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: /Add Friend/ })).toBeDisabled()
  await expect(page.locator('body')).not.toContainText('private-account-sentinel')
  await expect(page.locator('body')).not.toContainText('private-progression-sentinel')
  const portrait = dialog.getByRole('img', { name: 'Adventurer 01 portrait' })
  const box = await portrait.boundingBox()
  expect(box!.width / box!.height).toBeCloseTo(1, 2)
  await capture(page, info, 'profile')
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let n = 0; n < 5; n += 1) {
      await page.keyboard.press(key)
      expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true)
    }
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(first).toBeFocused()
  await list.getByRole('button').last().click()
  const lastDialog = page.getByRole('dialog', { name: 'Adventurer 60', exact: true })
  await expect(lastDialog.getByText('Never seen', { exact: true })).toBeVisible()
  await lastDialog.getByRole('button', { name: 'Close public character profile' }).click()
  await expect(lastDialog).toHaveCount(0)
  await hero.getByRole('combobox', { name: 'Class', exact: true }).selectOption('vanguard')
  await expect(list.getByRole('button')).toHaveCount(30)
  await hero.getByRole('combobox', { name: 'Sort', exact: true }).selectOption('oldest')
  await expect(list.getByRole('button').first().locator('strong')).toHaveText('Adventurer 59')
  await hero.getByRole('combobox', { name: 'Sort', exact: true }).selectOption('recent')
  await expect(list.getByRole('button').first().locator('strong')).toHaveText('Adventurer 01')
  if (process.env.LAYOUT_REVIEW_OUTPUT)
    await writeFile(
      path.join(process.env.LAYOUT_REVIEW_OUTPUT, `adventurers-${info.project.name}.json`),
      JSON.stringify(metrics, null, 2),
    )
  if (mobile) {
    for (const width of [320, 760]) {
      await page.setViewportSize({ width, height: 740 })
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(1)
      await list.getByRole('button').last().click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.keyboard.press('Escape')
    }
  }
  expect(pageErrors).toEqual([])
})

test('Adventurers loading, retry and empty-directory states remain usable', async ({
  page,
}, info) => {
  test.setTimeout(60_000)
  await enter(page, info)
  let requestCount = 0
  let releaseRequest: () => void = () => undefined
  const gate = new Promise<void>((resolve) => {
    releaseRequest = resolve
  })
  await page.route('**/api/presence/directory', async (route) => {
    requestCount += 1
    if (requestCount === 1) {
      await gate
      await route.fulfill({ status: 503, json: { error: 'Unavailable' } })
    } else await route.fulfill({ json: { characters: [] } })
  })
  await page.getByRole('button', { name: 'Show all characters' }).click()
  await expect(page.getByText('Loading character directory…')).toBeVisible()
  releaseRequest()
  await expect(
    page.getByText('The full character directory is unavailable right now.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByText('No characters match the selected filters.')).toBeVisible()
  await capture(page, info, 'empty')
  await page.getByRole('button', { name: 'Show online only' }).click()
  await expect(page.getByRole('region', { name: 'Online character roster' })).toBeVisible()
  await expect(page.locator('[data-directory-character]').first()).toBeVisible()
})
