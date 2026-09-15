import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

// Exercise real authentication, character creation, production CSS and existing dialogs.
// Only disposable accounts in the local Supabase instance are used.
test('profile identity, sheet and loadout remain readable without overlap', async ({ page }, info) => {
  test.setTimeout(180_000)
  const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid')
  expect(['127.0.0.1', 'localhost']).toContain(api.hostname)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const suffix = `${Date.now()}${info.workerIndex}`.replace(/\d/g, (digit) =>
    String.fromCharCode(65 + Number(digit)),
  )
  await provisionAccountAndEnterCharacter({
    page,
    email: `layout-${suffix.toLowerCase()}@example.com`,
    password: 'Disposable-layout-review-2026!',
    characterName: `Wayfarer ${suffix}`,
  })

  const viewports = info.project.name === 'mobile-chromium'
    ? [{ width: 390, height: 844 }, { width: 320, height: 740 }]
    : info.project.name === 'laptop-chromium'
      ? [{ width: 1366, height: 768 }, { width: 980, height: 1000 }]
      : [{ width: 1728, height: 887 }, { width: 1440, height: 900 }]

  const output = process.env.LAYOUT_REVIEW_OUTPUT
  if (output) await mkdir(output, { recursive: true })

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto('/game/character')
    await expect(page.getByTestId('character-profile')).toBeVisible()
    await page.evaluate(async () => { await document.fonts.ready })
    await expect.poll(() => page.locator('[data-testid="character-profile"] img').first()
      .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)

    const metrics = await page.evaluate(() => {
      const required = (selector: string): HTMLElement => {
        const element = document.querySelector<HTMLElement>(selector)
        if (!element) throw new Error(`Missing profile element: ${selector}`)
        return element
      }
      const rect = (element: Element) => {
        const r = element.getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }
      }
      const identity = required('[data-profile-identity-banner]')
      const hero = required('[data-testid="character-profile"]')
      const portrait = hero.querySelector('img')!
      const heading = hero.querySelector('h1')!
      const sheet = required('[data-profile-sheet]')
      const loadout = required('[data-profile-loadout]')
      const workspace = required('[data-profile-workspace]')
      const p = rect(portrait), h = rect(heading)
      return {
        identity: rect(identity), portrait: p, name: h,
        sheet: rect(sheet), loadout: rect(loadout), workspace: rect(workspace),
        overlap: Math.max(0, Math.min(p.right, h.right) - Math.max(p.x, h.x)) *
          Math.max(0, Math.min(p.bottom, h.bottom) - Math.max(p.y, h.y)),
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
        sheetOverflowX: sheet.scrollWidth - sheet.clientWidth,
        loadoutOverflowX: loadout.scrollWidth - loadout.clientWidth,
        primaryLinks: document.querySelectorAll('[aria-label="Primary game navigation"] a').length,
      }
    })
    const label = `profile-${viewport.width}x${viewport.height}`
    const screenshot = await page.screenshot({ fullPage: true })
    await info.attach(label, { body: screenshot, contentType: 'image/png' })
    if (output) {
      await writeFile(path.join(output, `${label}.png`), screenshot)
      await writeFile(path.join(output, `${label}.json`), JSON.stringify(metrics, null, 2))
    }
    expect.soft(metrics.overlap, `${label}: portrait must not cover character name`).toBe(0)
    expect.soft(metrics.overflowX, `${label}: no sideways document overflow`).toBeLessThanOrEqual(1)
    expect.soft(metrics.sheetOverflowX, `${label}: no clipped sheet`).toBeLessThanOrEqual(1)
    expect.soft(metrics.loadoutOverflowX, `${label}: no clipped loadout`).toBeLessThanOrEqual(1)
    expect.soft(metrics.primaryLinks).toBe(3)
    if (viewport.width >= 1200) {
      expect.soft(metrics.identity.width, `${label}: no empty full-width banner`)
        .toBeLessThan(metrics.workspace.width * 0.35)
      expect.soft(Math.abs(metrics.sheet.y - metrics.identity.y), `${label}: sheet starts alongside identity`)
        .toBeLessThanOrEqual(2)
      expect.soft(Math.abs(metrics.loadout.y - metrics.identity.y), `${label}: loadout starts alongside identity`)
        .toBeLessThanOrEqual(2)
      expect.soft(metrics.portrait.width, `${label}: readable portrait`).toBeGreaterThanOrEqual(150)
    }
    if (viewport.width <= 760) {
      expect.soft(metrics.sheet.y).toBeGreaterThanOrEqual(metrics.identity.bottom - 1)
      expect.soft(metrics.loadout.y).toBeGreaterThanOrEqual(metrics.sheet.bottom - 1)
    }

    // Reach and open every existing profile management surface, even when it needs scrolling.
    for (const [launcher, dialogName] of [
      ['[data-testid="primary-build-panel"] > button', 'Discipline Management'],
      ['[data-testid="skill-build-panel"] > button', 'Techniques'],
      ['section[aria-label="Attribute redistribution"] > button', 'Redistribute Attributes'],
    ]) {
      const button = page.locator(launcher!).first()
      await button.scrollIntoViewIfNeeded()
      await button.click()
      const dialog = page.getByRole('dialog', { name: dialogName!, exact: true })
      await expect(dialog).toBeVisible()
      await dialog.getByRole('button', { name: 'Close', exact: true }).click()
      await expect(dialog).toHaveCount(0)
    }
  }
  expect(errors).toEqual([])
})
