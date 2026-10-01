import { expect, test, type Locator } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Preview ${letters}`
}

test('Technique Preview keeps compact effects aligned and contained', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'Desktop Chromium proves the compact Technique Preview layout.',
  )

  await provisionAccountAndEnterCharacter({
    page,
    email: `technique-preview-v51-${Date.now()}@example.com`,
    password: 'Technique-preview-v51-2026!',
    characterName: uniqueCharacterName(),
  })

  await page.goto('/game/nexus')
  await expect(page.locator('[data-arsenal-workspace]')).toBeVisible()

  await page
    .getByTestId('skill-build-panel')
    .getByRole('button', { name: /Manage Techniques/ })
    .click()

  const dialog = page.getByRole('dialog', { name: 'Techniques' })
  const preview = dialog.getByTestId('technique-preview')
  await expect(preview).toBeVisible()

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1536, height: 614 },
  ]) {
    await page.setViewportSize(viewport)

    // Focus a known short value: initial focus follows the learned-skill order,
    // which can start with a longer effect such as Brace's Guarded parameters.
    await dialog.getByRole('checkbox', { name: 'Select Forceful Strike', exact: true }).hover()
    const effectsRow = preview.locator('dt', { hasText: 'Effects' }).locator('..')
    await expect(effectsRow.locator('ul')).toHaveCount(0)
    const compactEffects = effectsRow.locator('[data-compact-skill-effect="true"]')
    await expect(compactEffects.first()).toHaveText(/^Dmg \[\d+\]$/)
    const shortGeometry = await effectGeometry(compactEffects.first())
    expect(shortGeometry.textHeight).toBeLessThanOrEqual(shortGeometry.lineHeight + 1)
    await expectEffectsContained(compactEffects)
    await expectPreviewContained(preview)

    // Longer authored values may wrap, while retaining every parameter.
    await dialog.getByRole('checkbox', { name: 'Select Brace', exact: true }).hover()
    await expect(compactEffects.first()).toHaveText(/^Guarded \[[\d.]+%\] \[2 Turns\]$/)
    await expectEffectsContained(compactEffects)
    await expectPreviewContained(preview)

    const magnitude = preview.locator('[data-compact-effect-magnitude="true"]').first()
    const duration = preview.locator('[data-compact-effect-duration="true"]').first()
    await expect(magnitude).toBeVisible()
    await expect(duration).toBeVisible()
    const [magnitudeColor, durationColor] = await Promise.all([
      magnitude.evaluate((element) => getComputedStyle(element).color),
      duration.evaluate((element) => getComputedStyle(element).color),
    ])
    expect(durationColor).not.toBe(magnitudeColor)
  }
})

async function effectGeometry(effect: Locator) {
  return effect.evaluate((element) => {
    const styles = getComputedStyle(element)
    const text = document.createRange()
    text.selectNodeContents(element)
    const textBox = text.getBoundingClientRect()
    const box = element.getBoundingClientRect()
    const cell = element.closest('dd')!.getBoundingClientRect()
    return {
      textAlign: styles.textAlign,
      lineHeight: parseFloat(styles.lineHeight),
      textHeight: textBox.height,
      overflowX: element.scrollWidth - element.clientWidth,
      left: Math.min(box.left, textBox.left),
      right: Math.max(box.right, textBox.right),
      cellLeft: cell.left,
      cellRight: cell.right,
    }
  })
}

async function expectEffectsContained(effects: Locator) {
  expect(await effects.count()).toBeGreaterThan(0)
  for (const effect of await effects.all()) {
    await expect(effect).toBeVisible()
    const geometry = await effectGeometry(effect)
    expect(geometry.textAlign).toBe('right')
    expect(geometry.overflowX).toBe(0)
    expect(geometry.left).toBeGreaterThanOrEqual(geometry.cellLeft)
    expect(geometry.right).toBeLessThanOrEqual(geometry.cellRight)
  }
}

async function expectPreviewContained(preview: Locator) {
  const geometry = await preview.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const dialog = element.closest('[role="dialog"]')!
    const workspace = dialog.querySelector('[data-technique-workspace]')!
    const content = Array.from(element.querySelectorAll('dt, dd, li, img, strong, small'))
    return {
      contentTop: Math.min(...content.map((child) => child.getBoundingClientRect().top)),
      contentBottom: Math.max(...content.map((child) => child.getBoundingClientRect().bottom)),
      top: box.top,
      bottom: box.bottom,
      previewOverflowY: element.scrollHeight - element.clientHeight,
      dialogOverflowY: dialog.scrollHeight - dialog.clientHeight,
      workspaceOverflowY: workspace.scrollHeight - workspace.clientHeight,
    }
  })
  expect(geometry.contentTop).toBeGreaterThanOrEqual(geometry.top)
  expect(geometry.contentBottom).toBeLessThanOrEqual(geometry.bottom)
  expect(geometry.previewOverflowY).toBeLessThanOrEqual(1)
  expect(geometry.dialogOverflowY).toBeLessThanOrEqual(1)
  expect(geometry.workspaceOverflowY).toBeLessThanOrEqual(1)
}
