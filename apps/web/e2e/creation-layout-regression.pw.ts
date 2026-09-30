import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'

import { createVerifiedAccountAndSignIn } from './pv1f-test-helpers'

test('Creation exposes twelve portraits per gender and preserves the complete authenticated three-step journey', async ({
  page,
}, info) => {
  test.setTimeout(120_000)
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['localhost', '127.0.0.1'].includes(host))
    throw new Error('Creation review requires disposable local Supabase.')

  const suffix = `${Date.now()}${info.workerIndex}`
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  const characterName = `Aurelia ${suffix}`
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await createVerifiedAccountAndSignIn({
    page,
    email: `creation-review-${info.project.name}-${Date.now()}@example.test`,
    password: 'Disposable-creation-review-2026!',
  })
  await page.getByRole('link', { name: 'Create Character', exact: true }).click()
  const creation = page.getByTestId('character-creation')
  const name = creation.getByLabel('Character name', { exact: true })
  const next = creation.getByRole('button', { name: 'Choose your discipline', exact: true })
  await expect(next).toBeDisabled()
  await name.fill('123')
  await next.click()
  await expect(creation).toHaveAttribute('data-step', 'identity')
  await expect(name).toHaveAttribute('aria-invalid', 'true')
  await expect(creation.getByRole('alert')).toBeVisible()
  await name.fill(characterName)

  const library = creation.locator('[data-portrait-library]')
  const portraits = library.locator('input[name="portrait"]')
  await expect(library).toBeVisible()
  await expect(portraits).toHaveCount(12)
  const decoded = await library.locator('img').evaluateAll(async (images) => {
    return Promise.all(
      images.map(async (image) => {
        if (!(image instanceof HTMLImageElement)) throw new Error('Expected a portrait image.')
        image.loading = 'eager'
        try {
          await image.decode()
          return {
            loaded: true,
            width: image.naturalWidth,
            height: image.naturalHeight,
            src: image.currentSrc || image.src,
          }
        } catch {
          return {
            loaded: false,
            width: image.naturalWidth,
            height: image.naturalHeight,
            src: image.currentSrc || image.src,
          }
        }
      }),
    )
  })
  expect(decoded).toHaveLength(12)
  expect(
    decoded.every((image) => image.loaded && image.width >= 96 && image.width === image.height),
  ).toBe(true)
  expect(new Set(decoded.map((image) => image.src)).size).toBe(12)

  const sizes =
    info.project.name === 'mobile-chromium'
      ? [
          { width: 390, height: 844 },
          { width: 320, height: 740 },
        ]
      : info.project.name === 'laptop-chromium'
        ? [{ width: 1366, height: 768 }]
        : [
            { width: 1728, height: 887 },
            { width: 1440, height: 900 },
            { width: 1280, height: 720 },
            { width: 1024, height: 576 },
            { width: 980, height: 768 },
            { width: 768, height: 576 },
          ]
  const results = []
  for (const size of sizes) {
    await page.setViewportSize(size)
    await page.evaluate(async () => {
      await document.fonts.ready
      scrollTo(0, 0)
    })
    const metrics = await creation.evaluate((element) => {
      const rect = (node: Element) => {
        const box = node.getBoundingClientRect()
        return { x: box.x, y: box.y, width: box.width, height: box.height, bottom: box.bottom }
      }
      const input = element.querySelector('#creation-name')!
      const preview = element.querySelector('[aria-label="Selected portrait preview"] img')!
      const primary = Array.from(element.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('Choose your discipline'),
      )!
      return {
        library: rect(element.querySelector('[data-portrait-library]')!),
        name: rect(input),
        preview: rect(preview),
        primary: rect(primary),
        nameFont: parseFloat(getComputedStyle(input).fontSize),
        primaryFont: parseFloat(getComputedStyle(primary).fontSize),
        background: getComputedStyle(element.lastElementChild!).backgroundImage,
        overflow: document.documentElement.scrollWidth - innerWidth,
        overflowY: document.documentElement.scrollHeight - innerHeight,
      }
    })
    results.push({ viewport: size, ...metrics })
    const label = `${info.project.name}-${size.width}x${size.height}`
    expect.soft(metrics.library.width, `${label}: gallery is not hidden`).toBeGreaterThan(150)
    if (size.width >= 1100) {
      expect
        .soft(metrics.library.x, `${label}: collection sits left of the selected portrait`)
        .toBeLessThan(metrics.preview.x)
      expect
        .soft(metrics.name.y, `${label}: name follows the selected portrait`)
        .toBeGreaterThan(metrics.preview.y + metrics.preview.height)
      expect
        .soft(
          Math.abs(metrics.name.x - metrics.preview.x),
          `${label}: name belongs to the preview column`,
        )
        .toBeLessThanOrEqual(1)
    } else {
      expect
        .soft(metrics.name.y, `${label}: selected portrait precedes the name`)
        .toBeGreaterThan(metrics.preview.y + metrics.preview.height)
    }
    expect.soft(metrics.overflow, `${label}: no horizontal overflow`).toBeLessThanOrEqual(1)
    expect
      .soft(metrics.preview.width / metrics.preview.height, `${label}: square preview`)
      .toBeCloseTo(1, 2)
    if (size.width >= 1024)
      expect
        .soft(metrics.preview.width, `${label}: usable desktop preview`)
        .toBeGreaterThanOrEqual(128)
    expect.soft(metrics.nameFont, `${label}: readable name input`).toBeGreaterThanOrEqual(16)
    expect.soft(metrics.primaryFont, `${label}: readable action`).toBeGreaterThanOrEqual(14)
    expect.soft(metrics.background, `${label}: stone workspace`).toContain('linear-gradient')
    if (size.width >= 1280 && size.height >= 768)
      expect.soft(metrics.overflowY, `${label}: desktop page fits`).toBeLessThanOrEqual(1)
    if (size.width >= 1280 && size.height >= 768)
      expect
        .soft(metrics.primary.bottom, `${label}: primary fits at normal zoom`)
        .toBeLessThanOrEqual(size.height)
    await next.scrollIntoViewIfNeeded()
    await expect(next).toBeInViewport({ ratio: 1 })
    await next.click({ trial: true })
    if (process.env.LAYOUT_REVIEW_OUTPUT) {
      await mkdir(process.env.LAYOUT_REVIEW_OUTPUT, { recursive: true })
      await page.evaluate(() => scrollTo(0, 0))
      await page.screenshot({
        path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, `creation-identity-${label}.png`),
        fullPage: true,
      })
      await page.screenshot({
        path: path.join(
          process.env.LAYOUT_REVIEW_OUTPUT,
          `creation-identity-${label}-viewport.png`,
        ),
      })
    }
  }

  await portraits.last().check()
  await portraits.last().focus()
  await page.keyboard.press('ArrowLeft')
  await expect(portraits.nth(10)).toBeChecked()
  await page.keyboard.press('ArrowRight')
  await expect(portraits.last()).toBeChecked()
  await expect(portraits.last()).toBeInViewport({ ratio: 1 })
  await creation.getByRole('radio', { name: 'Female', exact: true }).check()
  await expect(portraits).toHaveCount(12)
  await portraits.last().check()
  await creation.locator('input[name="appearance"]').last().check()
  await next.click()
  await expect(creation).toHaveAttribute('data-step', 'discipline')
  if (info.project.name !== 'mobile-chromium') {
    await page.setViewportSize({ width: 1366, height: 768 })
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight))
      .toBeLessThanOrEqual(1)
  }
  await expect(creation.getByRole('heading', { level: 1 })).toBeFocused()
  const disciplines = creation.locator('input[name="discipline"]')
  await disciplines.nth(1).check()
  const decrease = creation.locator('button[aria-label^="Decrease"]:not([disabled])').first()
  const attribute = (await decrease.getAttribute('aria-label'))!.split(' ')[1]
  await decrease.click()
  await expect(creation.getByTestId('attribute-points')).toContainText(
    '1 personal points remaining',
  )
  await expect(
    creation.getByRole('button', { name: 'Review character', exact: true }),
  ).toBeDisabled()
  await creation.getByRole('button', { name: `Increase ${attribute} bonus`, exact: true }).click()
  const points = await creation.locator('output').allTextContents()
  if (process.env.LAYOUT_REVIEW_OUTPUT)
    await page.screenshot({
      path: path.join(
        process.env.LAYOUT_REVIEW_OUTPUT,
        `creation-discipline-${info.project.name}.png`,
      ),
      fullPage: true,
    })
  await creation.getByRole('button', { name: 'Review character', exact: true }).click()
  if (info.project.name !== 'mobile-chromium')
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight))
      .toBeLessThanOrEqual(1)
  await expect(creation.getByText('Portrait', { exact: true })).toBeVisible()
  await expect(creation.getByText('Female adventurer 12', { exact: true })).toBeVisible()
  await expect(creation.getByText('Lightstep travelwear', { exact: true })).toBeVisible()
  await expect(creation).not.toContainText(/pronouns/i)
  if (process.env.LAYOUT_REVIEW_OUTPUT)
    await page.screenshot({
      path: path.join(
        process.env.LAYOUT_REVIEW_OUTPUT,
        `creation-confirm-${info.project.name}.png`,
      ),
      fullPage: true,
    })
  await creation.getByRole('button', { name: 'Back', exact: true }).click()
  expect(await creation.locator('output').allTextContents()).toEqual(points)
  await expect(disciplines.nth(1)).toBeChecked()
  await creation.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(name).toHaveValue(characterName)
  await expect(portraits.last()).toBeChecked()
  await expect(creation.getByRole('radio', { name: 'Female', exact: true })).toBeChecked()
  await expect(creation.locator('input[name="appearance"]').last()).toBeChecked()
  await next.click()
  await creation.getByRole('button', { name: 'Review character', exact: true }).click()

  // Inject one transport failure to verify pending/retry UI. The retry uses the REAL API.
  const requests: { idempotencyKey: string; intent: Record<string, unknown> }[] = []
  let releaseFailure: () => void = () => {
    throw new Error('The failure gate was not initialized.')
  }
  const failureGate = new Promise<void>((resolve) => {
    releaseFailure = resolve
  })
  await page.route('**/api/character', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }
    requests.push(route.request().postDataJSON())
    if (requests.length === 1) {
      await failureGate
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Temporary test interruption.' } }),
      })
    } else await route.continue()
  })
  await creation.getByRole('button', { name: 'Create character', exact: true }).click()
  await expect(creation.getByRole('button', { name: 'Creating…', exact: true })).toBeDisabled()
  await expect(creation.getByRole('button', { name: 'Back', exact: true })).toBeDisabled()
  releaseFailure()
  await expect(creation.getByRole('alert')).toHaveText('Temporary test interruption.')
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/character') &&
      response.request().method() === 'POST' &&
      response.status() === 201,
  )
  await creation.getByRole('button', { name: 'Create character', exact: true }).click()
  const response = await responsePromise
  const payload = await response.json()
  expect(payload.character).toMatchObject({
    name: characterName,
    portraitRef: 'portrait.adventure.female-12',
    presentationId: 'feminine',
    starterAppearanceRef: 'appearance.starter.lightstep',
  })
  expect(requests).toHaveLength(2)
  expect(requests[0].idempotencyKey).toBe(requests[1].idempotencyKey)
  expect(requests[1].intent.pronounPresetId).toBe('she_her')
  await expect(page).toHaveURL(/\/game\/haven$/)
  await page.goto('/game/character')
  await expect(page.getByTestId('character-profile')).toContainText(characterName)
  await page.reload()
  await expect(page.getByTestId('character-profile')).toContainText(characterName)
  expect(pageErrors).toEqual([])
  if (process.env.LAYOUT_REVIEW_OUTPUT)
    await writeFile(
      path.join(process.env.LAYOUT_REVIEW_OUTPUT, `creation-${info.project.name}.json`),
      JSON.stringify(
        {
          metrics: results,
          decodedPortraits: decoded.length,
          authenticatedCreation: true,
          injectedFailures: 1,
          pageErrors,
        },
        null,
        2,
      ),
    )
})
