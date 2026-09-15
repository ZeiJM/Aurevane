import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { createVerifiedAccountAndSignIn } from './pv1f-test-helpers'

async function capture(page: Page, info: TestInfo, name: string, metrics: unknown) {
  const label = `character-entry-${info.project.name}-${name}`
  const screenshot = await page.screenshot({ fullPage: true, scale: 'css' })
  await info.attach(label, { body: screenshot, contentType: 'image/png' })
  const output = process.env.LAYOUT_REVIEW_OUTPUT
  if (output) {
    await mkdir(output, { recursive: true })
    await writeFile(path.join(output, `${label}.png`), screenshot)
    await writeFile(path.join(output, `${label}.json`), JSON.stringify(metrics, null, 2))
  }
}

test('approved entry composition preserves the real portrait library and creation flow', async ({
  page,
}, info) => {
  test.setTimeout(240_000)
  const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid')
  expect(['127.0.0.1', 'localhost']).toContain(api.hostname)
  const errors: string[] = []
  const submissions: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/character') {
      submissions.push(request.postData() ?? '')
    }
  })
  const suffix = `${Date.now()}${info.workerIndex}`.replace(/\d/g, (digit) =>
    String.fromCharCode(65 + Number(digit)),
  )
  const characterName = `Wayfarer ${suffix}`
  await createVerifiedAccountAndSignIn({
    page,
    email: `entry-${info.project.name}-${suffix.toLowerCase()}@example.com`,
    password: 'Disposable-entry-review-2026!',
  })
  const board = page.locator('[data-character-slot-board]')
  await expect(board.locator(':scope > article')).toHaveCount(3)
  await expect(board.locator('[data-locked="true"]')).toHaveCount(2)
  await page.getByRole('link', { name: 'Create Character', exact: true }).click()
  const creation = page.getByTestId('character-creation')
  await expect(creation).toBeVisible()
  const portraits = creation.locator('input[name="portrait"]')
  await expect(portraits).toHaveCount(40)
  await expect(creation.getByText(/pronouns?/i)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Choose your discipline' })).toBeDisabled()

  // Every registered catalog image must load, including entries initially outside the scrollport.
  for (let index = 0; index < 40; index += 1) {
    const label = portraits.nth(index).locator('..')
    await label.scrollIntoViewIfNeeded()
    await expect
      .poll(() =>
        label.locator('img').evaluate((image: HTMLImageElement) => {
          return image.complete && image.naturalWidth > 0
        }),
      )
      .toBe(true)
  }
  await portraits.last().check()
  await portraits.last().focus()
  await page.keyboard.press('ArrowLeft')
  await expect(portraits.nth(38)).toBeChecked()
  await page.keyboard.press('ArrowRight')
  await expect(portraits.last()).toBeChecked()
  await creation.locator('input[name="presentation"]').first().check()
  await creation.locator('input[name="appearance"]').last().check()

  // Local validation must reject an invalid name without submitting authoritative state.
  await page.getByLabel('Character name').fill('123')
  await page.getByRole('button', { name: 'Choose your discipline' }).click()
  await page.getByRole('button', { name: 'Review character' }).click()
  await page.getByRole('button', { name: 'Create character', exact: true }).click()
  await expect(creation).toHaveAttribute('data-step', 'identity')
  await expect(page.getByLabel('Character name')).toHaveAttribute('aria-invalid', 'true')
  expect(submissions).toHaveLength(0)
  await page.getByLabel('Character name').fill(characterName)

  const viewports =
    info.project.name === 'mobile-chromium'
      ? [
          { width: 390, height: 844 },
          { width: 320, height: 740 },
        ]
      : info.project.name === 'laptop-chromium'
        ? [
            { width: 1366, height: 768 },
            { width: 1024, height: 576 },
            { width: 768, height: 576 },
          ]
        : [
            { width: 1440, height: 900 },
            { width: 980, height: 768 },
          ]

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.evaluate(async () => {
      await document.fonts.ready
      window.scrollTo(0, 0)
    })
    const metrics = await creation.evaluate((root) => {
      const gallery = root.querySelector('input[name="portrait"]')!.closest('fieldset')!
      const name = root.querySelector('input[autocomplete="off"]')!.closest('label')!
      const preview = root.querySelector('[aria-label="Selected portrait preview"]')!
      const portrait = preview.querySelector('img')!.getBoundingClientRect()
      return {
        galleryTop: gallery.getBoundingClientRect().top,
        nameTop: name.getBoundingClientRect().top,
        previewTop: preview.getBoundingClientRect().top,
        portraitWidth: portrait.width,
        portraitHeight: portrait.height,
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
      }
    })
    const size = `${viewport.width}x${viewport.height}`
    await capture(page, info, `identity-${size}`, metrics)
    expect.soft(metrics.overflowX, `${size}: no horizontal overflow`).toBeLessThanOrEqual(1)
    expect
      .soft(metrics.galleryTop, `${size}: portrait library precedes identity fields`)
      .toBeLessThan(metrics.nameTop)
    expect.soft(Math.abs(metrics.portraitWidth - metrics.portraitHeight)).toBeLessThanOrEqual(1)
    if (viewport.width >= 980) {
      expect.soft(Math.abs(metrics.previewTop - metrics.galleryTop)).toBeLessThanOrEqual(2)
      expect.soft(metrics.portraitWidth).toBeGreaterThanOrEqual(144)
    }
    await page.getByRole('button', { name: 'Choose your discipline' }).click()
    await expect(page.getByTestId('attribute-points')).toContainText('0 personal points remaining')
    await capture(page, info, `discipline-${size}`, { step: 'discipline' })
    await page.getByRole('button', { name: 'Review character' }).click()
    await expect(creation.getByText(/pronouns?/i)).toHaveCount(0)
    await capture(page, info, `confirm-${size}`, { step: 'review' })
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page.getByLabel('Character name')).toHaveValue(characterName)
    await expect(portraits.last()).toBeChecked()
    await expect(creation.locator('input[name="presentation"]').first()).toBeChecked()
    await expect(creation.locator('input[name="appearance"]').last()).toBeChecked()
  }

  await page.getByRole('button', { name: 'Choose your discipline' }).click()
  await page.getByRole('button', { name: 'Decrease might bonus' }).click()
  await expect(page.getByRole('button', { name: 'Review character' })).toBeDisabled()
  await page.getByRole('button', { name: 'Increase might bonus' }).click()
  await page.getByRole('button', { name: 'Review character' }).click()
  await page.getByRole('button', { name: 'Create character', exact: true }).click()
  await expect(page).toHaveURL(/\/game\/character$/)
  await expect(page.getByTestId('character-profile')).toContainText(characterName)
  expect(submissions).toHaveLength(1)
  expect(JSON.parse(submissions[0]!).intent.pronounPresetId).toBeTruthy()

  await page.goto('/game')
  await expect(board.locator(':scope > article')).toHaveCount(3)
  await expect(board.locator('[data-locked="true"]')).toHaveCount(2)
  await expect(page.getByRole('link', { name: `Play ${characterName}` })).toBeVisible()
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.evaluate(() => window.scrollTo(0, 0))
    const metrics = await page.locator('[data-roster-stage]').evaluate((root) => {
      const hero = root.querySelector(':scope > header')!.getBoundingClientRect()
      const board = root.querySelector('[data-character-slot-board]')!.getBoundingClientRect()
      const portrait = root.querySelector('[data-character-slot-board] img')!.getBoundingClientRect()
      return {
        heroBottom: hero.bottom,
        boardTop: board.top,
        portraitWidth: portrait.width,
        portraitHeight: portrait.height,
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
      }
    })
    const size = `${viewport.width}x${viewport.height}`
    await capture(page, info, `roster-${size}`, metrics)
    expect.soft(metrics.heroBottom, `${size}: heading above roster, not a tall side banner`)
      .toBeLessThanOrEqual(metrics.boardTop + 1)
    expect.soft(metrics.overflowX).toBeLessThanOrEqual(1)
    expect.soft(Math.abs(metrics.portraitWidth - metrics.portraitHeight)).toBeLessThanOrEqual(1)
    await page.getByTestId('delete-account-button').scrollIntoViewIfNeeded()
    await page.getByTestId('delete-account-button').click()
    const accountDialog = page.getByRole('dialog', { name: 'Delete your entire AUREVANE account?' })
    await expect(accountDialog).toBeVisible()
    await expect(accountDialog.getByRole('button', { name: 'Start 24-hour account deletion' }))
      .toBeDisabled()
    await accountDialog.getByRole('button', { name: 'Never mind' }).click()
  }
  await page.getByRole('button', { name: 'Delete Character', exact: true }).click()
  const deleteDialog = page.getByRole('dialog', { name: `Schedule deletion of ${characterName}?` })
  await expect(deleteDialog.getByRole('button', { name: 'Start 24-hour deletion' })).toBeDisabled()
  await deleteDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('link', { name: `Play ${characterName}` })).toBeVisible()
  expect(errors).toEqual([])
})
