import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

import { FOUNDATION_DISCIPLINES } from '@aurevane/game-core/character/foundation-disciplines'
import { STARTER_CHARACTER_APPEARANCES } from '@aurevane/game-core/character/starter-options'
import { createVerifiedAccountAndSignIn } from './pv1f-test-helpers'

async function openCreation(page: Page, project: string) {
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['localhost', '127.0.0.1'].includes(host))
    throw new Error('Creation review requires disposable local Supabase.')
  await createVerifiedAccountAndSignIn({
    page,
    email: `creation-hq-${project}-${Date.now()}@example.test`,
    password: 'Disposable-creation-HQ-2026!',
  })
  await page.getByRole('link', { name: 'Create Character', exact: true }).click()
  await expect(page).toHaveURL(/\/game\/create\/0$/)
}

async function capture(page: Page, label: string) {
  if (!process.env.LAYOUT_REVIEW_OUTPUT) return
  await mkdir(process.env.LAYOUT_REVIEW_OUTPUT, { recursive: true })
  await page.screenshot({
    path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, `creation-${label}.png`),
    fullPage: true,
  })
}

test('Creation leads with 40 decoded square portraits and a readable three-step workspace', async ({
  page,
}, info) => {
  test.setTimeout(120_000)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await openCreation(page, info.project.name)
  const creation = page.getByTestId('character-creation')
  const gallery = creation.getByRole('group', { name: 'Choose a starting portrait' })
  const radios = gallery.locator('input[name="portrait"]')
  await expect(radios).toHaveCount(40)
  await expect(creation.getByText(/pronouns?/i)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Choose your discipline' })).toBeDisabled()
  const decoded = await gallery.locator('img').evaluateAll(async (images) =>
    Promise.all(
      images.map(async (element) => {
        const image = element as HTMLImageElement
        image.loading = 'eager'
        try {
          await image.decode()
          return {
            alt: image.alt,
            ok: image.naturalWidth > 0 && image.naturalWidth === image.naturalHeight,
          }
        } catch {
          return { alt: image.alt, ok: false }
        }
      }),
    ),
  )
  expect
    .soft(
      decoded.filter((image) => !image.ok),
      'every actual gallery asset decodes',
    )
    .toEqual([])
  await radios.first().focus()
  await page.keyboard.press('ArrowLeft')
  await expect(radios.last()).toBeChecked()
  const preview = creation.getByRole('complementary', { name: 'Selected portrait preview' })
  await expect(preview).toContainText('Wayfarer 40')
  await expect(preview.locator('img')).toHaveAttribute(
    'src',
    (await gallery.locator('img').last().getAttribute('src')) ?? '',
  )
  await page.getByLabel('Character name', { exact: false }).fill('Aurelia Nightwind')
  await creation.locator('input[name="presentation"]').nth(1).check()
  await creation.locator('input[name="appearance"]').last().check()

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
    const label = `${info.project.name}-${size.width}x${size.height}`
    const metrics = await creation.evaluate((root) => {
      const rect = (element: Element) => {
        const box = element.getBoundingClientRect()
        return {
          x: box.x,
          y: box.y,
          right: box.right,
          bottom: box.bottom,
          width: box.width,
          height: box.height,
        }
      }
      const gallery = root.querySelector('input[name="portrait"]')!.closest('fieldset')!
      const name = root.querySelector('input:not([type="radio"])')!
      const preview = root.querySelector('[aria-label="Selected portrait preview"]')!
      const portrait = gallery.querySelector('img')!
      const content = root.querySelector('h1')!.closest('[data-av-surface]')!
      return {
        gallery: rect(gallery),
        name: rect(name),
        preview: rect(preview),
        portrait: rect(portrait),
        surface: getComputedStyle(content).backgroundColor,
        introFont: parseFloat(getComputedStyle(root.querySelector('h1 + p')!).fontSize),
        overflow: document.documentElement.scrollWidth - innerWidth,
      }
    })
    results.push({ viewport: size, ...metrics })
    await capture(page, `identity-${label}`)
    expect.soft(metrics.overflow, `${label}: no horizontal overflow`).toBeLessThanOrEqual(1)
    expect
      .soft(metrics.portrait.width / metrics.portrait.height, `${label}: square thumbnails`)
      .toBeCloseTo(1, 2)
    expect.soft(metrics.introFont, `${label}: readable supporting copy`).toBeGreaterThanOrEqual(14)
    expect
      .soft(
        Math.max(...(metrics.surface.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)),
        `${label}: dark workspace`,
      )
      .toBeLessThan(75)
    if (size.width >= 981) {
      expect
        .soft(metrics.gallery.bottom, `${label}: gallery precedes name`)
        .toBeLessThanOrEqual(metrics.name.y + 1)
      expect
        .soft(metrics.preview.x, `${label}: dedicated preview beside gallery`)
        .toBeGreaterThanOrEqual(metrics.gallery.right - 1)
      expect
        .soft(metrics.preview.width, `${label}: substantial preview`)
        .toBeGreaterThanOrEqual(200)
    }
    const next = page.getByRole('button', { name: 'Choose your discipline' })
    await next.scrollIntoViewIfNeeded()
    await expect(next).toBeInViewport({ ratio: 1 })
    await next.click()
    await expect(creation).toHaveAttribute('data-step', 'discipline')
    await expect(creation.locator('h1')).toBeFocused()
    await capture(page, `discipline-${label}`)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1)
    const review = page.getByRole('button', { name: 'Review character' })
    await review.scrollIntoViewIfNeeded()
    await expect(review).toBeInViewport({ ratio: 1 })
    await review.click()
    await expect(creation).toHaveAttribute('data-step', 'review')
    await expect(creation.getByText(/pronouns?/i)).toHaveCount(0)
    await capture(page, `confirm-${label}`)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1)
    await page.getByRole('button', { name: 'Create character', exact: true }).click({ trial: true })
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page.getByLabel('Character name')).toHaveValue('Aurelia Nightwind')
    await expect(radios.last()).toBeChecked()
    await expect(creation.locator('input[name="presentation"]').nth(1)).toBeChecked()
    await expect(creation.locator('input[name="appearance"]').last()).toBeChecked()
  }
  if (process.env.LAYOUT_REVIEW_OUTPUT)
    await writeFile(
      path.join(process.env.LAYOUT_REVIEW_OUTPUT, `creation-${info.project.name}.json`),
      JSON.stringify({ decoded, results }, null, 2),
    )
  expect(pageErrors).toEqual([])
})

test('Creation retains non-default choices through invalid input, a failed request and real retry', async ({
  page,
}, info) => {
  test.setTimeout(90_000)
  await openCreation(page, `retry-${info.project.name}`)
  const creation = page.getByTestId('character-creation')
  await page.getByLabel('Character name').fill('123')
  await creation.locator('input[name="portrait"]').last().focus()
  await page.keyboard.press('Space')
  await creation.locator('input[name="presentation"]').nth(1).check()
  await creation.locator('input[name="appearance"]').last().check()
  await page.getByRole('button', { name: 'Choose your discipline' }).click()
  await creation.locator('input[name="discipline"]').nth(1).check()
  const discipline = FOUNDATION_DISCIPLINES[1]!
  const bonusAttribute = Object.entries(discipline.startingAttributeBonuses).find(
    ([, bonus]) => bonus > 0,
  )![0]
  await page.getByRole('button', { name: `Decrease ${bonusAttribute} bonus`, exact: true }).click()
  await expect(page.getByRole('button', { name: 'Review character' })).toBeDisabled()
  await page.getByRole('button', { name: `Increase ${bonusAttribute} bonus`, exact: true }).click()
  await expect(page.getByTestId('attribute-points')).toContainText('0 personal points remaining')
  await page.getByRole('button', { name: 'Review character' }).click()
  await page.getByRole('button', { name: 'Create character', exact: true }).click()
  await expect(creation).toHaveAttribute('data-step', 'identity')
  await expect(creation.getByRole('alert')).toBeVisible()
  await expect(page.getByLabel('Character name')).toHaveAttribute('aria-invalid', 'true')
  const suffix = `${Date.now()}${info.workerIndex}`
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  const name = `Aurelia ${suffix}`
  await page.getByLabel('Character name').fill(name)
  await expect(creation.locator('input[name="portrait"]').last()).toBeChecked()
  await expect(creation.locator('input[name="appearance"]').last()).toBeChecked()
  await page.getByRole('button', { name: 'Choose your discipline' }).click()
  await expect(creation.locator('input[name="discipline"]').nth(1)).toBeChecked()
  await page.getByRole('button', { name: 'Review character' }).click()
  await expect(creation).toContainText(STARTER_CHARACTER_APPEARANCES.at(-1)!.label)
  const requests: Array<{
    idempotencyKey: string
    intent: {
      portraitRef: string
      starterAppearanceRef: string
      presentationId: string
      pronounPresetId: string
    }
  }> = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/character' && request.method() === 'POST')
      requests.push(request.postDataJSON())
  })
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/character', async (route) => {
    await gate
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { message: 'Temporary test outage. Your choices are still here.' },
      }),
    })
  })
  await page.getByRole('button', { name: 'Create character', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Creating…', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeDisabled()
  release()
  await expect(creation.getByRole('alert')).toContainText('Temporary test outage')
  await capture(page, `retry-${info.project.name}`)
  expect(requests).toHaveLength(1)
  await page.unroute('**/api/character')
  await page.getByRole('button', { name: 'Create character', exact: true }).click()
  await expect(page).toHaveURL(/\/game\/character$/)
  await expect(page.getByTestId('character-profile')).toContainText(name)
  expect(requests).toHaveLength(2)
  expect(requests[1]!.idempotencyKey).toBe(requests[0]!.idempotencyKey)
  expect(requests[1]!.intent).toMatchObject({
    portraitRef: 'portrait.starter.wayfarer-40',
    starterAppearanceRef: STARTER_CHARACTER_APPEARANCES.at(-1)!.ref,
    presentationId: 'feminine',
    pronounPresetId: 'she_her',
  })
  const portrait = page
    .getByTestId('character-profile')
    .locator('img.character-portrait-media')
    .first()
  await expect
    .poll(() =>
      portrait.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    )
    .toBe(true)
  await page.reload()
  await expect(page.getByTestId('character-profile')).toContainText(name)
})
