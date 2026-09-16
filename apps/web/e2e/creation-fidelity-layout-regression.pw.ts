import { expect, test } from '@playwright/test'

import { createVerifiedAccountAndSignIn } from './pv1f-test-helpers'

test('Creation keeps the desktop portrait gallery and selected preview in deliberate balance', async ({
  page,
}, info) => {
  test.setTimeout(120_000)
  test.skip(info.project.name === 'mobile-chromium', 'Desktop fidelity is covered separately.')

  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['localhost', '127.0.0.1'].includes(host))
    throw new Error('Creation review requires disposable local Supabase.')

  await createVerifiedAccountAndSignIn({
    page,
    email: `creation-fidelity-${info.project.name}-${Date.now()}@example.test`,
    password: 'Disposable-creation-fidelity-2026!',
  })
  await page.getByRole('link', { name: 'Create Character', exact: true }).click()

  const creation = page.getByTestId('character-creation')
  const sizes = [
    { width: 1728, height: 887 },
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
  ]

  for (const size of sizes) {
    await page.setViewportSize(size)
    await page.evaluate(async () => {
      await document.fonts.ready
      scrollTo(0, 0)
    })

    const metrics = await creation.evaluate((element) => {
      const library = element.querySelector('[data-portrait-library]')!.getBoundingClientRect()
      const preview = element
        .querySelector('[aria-label="Selected portrait preview"] img')!
        .getBoundingClientRect()
      return {
        libraryWidth: library.width,
        previewWidth: preview.width,
        previewHeight: preview.height,
        overflow: document.documentElement.scrollWidth - innerWidth,
      }
    })
    const label = `${info.project.name}-${size.width}x${size.height}`
    const minimumPreviewWidth = size.height <= 800 ? 208 : 280

    expect
      .soft(
        metrics.previewWidth,
        `${label}: preview remains a substantial desktop focal point`,
      )
      .toBeGreaterThanOrEqual(minimumPreviewWidth)
    expect
      .soft(
        metrics.libraryWidth / metrics.previewWidth,
        `${label}: gallery does not overpower preview`,
      )
      .toBeLessThanOrEqual(3.2)
    expect
      .soft(metrics.previewWidth / metrics.previewHeight, `${label}: preview stays square`)
      .toBeCloseTo(1, 2)
    expect.soft(metrics.overflow, `${label}: no horizontal overflow`).toBeLessThanOrEqual(1)
  }
})
