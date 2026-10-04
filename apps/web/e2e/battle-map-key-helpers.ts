import { expect, type Page } from '@playwright/test'

export async function expectTerrainKey(page: Page) {
  const toggle = page.getByRole('button', { name: 'Terrain', exact: true })
  const key = page.getByRole('region', { name: 'Terrain Key', exact: true })
  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(key).toHaveCount(0)
  await toggle.scrollIntoViewIfNeeded()
  const battlefieldGeometry = () =>
    page.locator('#battlefield').evaluate((element) => {
      const rect = element.getBoundingClientRect()
      let x = rect.x + window.scrollX
      let y = rect.y + window.scrollY
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (parent === document.scrollingElement) continue
        x += parent.scrollLeft
        y += parent.scrollTop
      }
      return { x, y, width: rect.width, height: rect.height }
    })
  const before = await battlefieldGeometry()
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(key).toBeVisible()
  expect(await battlefieldGeometry()).toEqual(before)
  const overlay = page.getByRole('dialog', { name: 'Terrain', exact: true })
  const overlayBox = await overlay.boundingBox()
  const toggleBox = await toggle.boundingBox()
  if (overlayBox!.height + 16 <= toggleBox!.y)
    expect(overlayBox!.y + overlayBox!.height).toBeLessThanOrEqual(toggleBox!.y)
  await expect(page.getByRole('button', { name: 'Map Key', exact: true })).toHaveCount(0)
  await expect(key.locator('header button')).toHaveCount(0)
  await expect(page.getByRole('switch', { name: 'Tile coordinates' })).toHaveCount(0)
  await expect(page.locator('#battlefield > [aria-label="Terrain legend"]')).toHaveCount(0)

  // All catalog entries remain visible; activity follows the rendered current board.
  const projection = await page.evaluate(() => {
    const expected = new Set<string>()
    for (const tile of document.querySelectorAll<HTMLElement>(
      '#battlefield button[aria-label^="Tile "]',
    )) {
      const label = tile.getAttribute('aria-label') ?? ''
      if (label.includes('; blocked;')) expected.add('Blocked terrain')
      else if (
        tile.dataset.terrain === 'rough' ||
        /; (?:rough-ground|difficult terrain);/.test(label)
      ) {
        expected.add('Difficult terrain')
      } else expected.add('Neutral ground')
      if (Number(label.match(/; elevation (\d+)/)?.[1] ?? 0) > 0) expected.add('Elevated ground')
      if (tile.dataset.terrainOverlay === 'frozen') expected.add('Frozen')
      if (tile.dataset.terrainOverlay === 'steam') expected.add('Steam')
    }
    const actual = Array.from(document.querySelectorAll('[data-battle-terrain-key="true"] summary'))
      .map((button) => ({
        name: button.getAttribute('aria-label')!,
        active:
          button.querySelector('[data-terrain-active]')?.getAttribute('data-terrain-active') ===
          'true',
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return { expected: [...expected].sort(), actual }
  })
  expect(projection.actual.map((entry) => entry.name).sort()).toEqual(
    [
      'Neutral ground',
      'Difficult terrain',
      'Elevated ground',
      'Blocked terrain',
      'Frozen',
      'Steam',
    ].sort(),
  )
  expect(
    projection.actual
      .filter((entry) => entry.active)
      .map((entry) => entry.name)
      .sort(),
  ).toEqual(projection.expected)
  const rows = await key.locator('summary').evaluateAll((entries) =>
    entries.map((entry) => {
      const rect = entry.getBoundingClientRect()
      return {
        x: rect.x,
        y: rect.y,
        bottom: rect.bottom,
        contentFits: Array.from(entry.children).every((child) => {
          const content = child.getBoundingClientRect()
          return (
            content.top >= rect.top - 1 &&
            content.bottom <= rect.bottom + 1 &&
            content.left >= rect.left - 1 &&
            content.right <= rect.right + 1
          )
        }),
      }
    }),
  )
  expect(rows.every((row) => row.contentFits)).toBe(true)
  for (let i = 2; i < rows.length; i++) {
    expect(Math.abs(rows[i]!.x - rows[i % 2]!.x)).toBeLessThanOrEqual(1)
    expect(rows[i]!.y).toBeGreaterThanOrEqual(rows[i - 2]!.bottom - 1)
  }
  await toggle.click()
  await expect(key).toHaveCount(0)
  expect(await battlefieldGeometry()).toEqual(before)

  await toggle.click()
  for (const { name: label } of projection.actual) {
    const entry = key.locator(`summary[aria-label="${label}"]`)
    await entry.focus()
    await entry.press('Enter')
    await expect(entry.locator('..')).toHaveAttribute('open', '')
    await expect(entry.locator('..').locator('p')).toBeVisible()
    await expect(entry.locator('..').locator('p')).not.toBeEmpty()
    await expect(page.locator('[data-battle-info-panel]')).toHaveCount(1)
    await expect(key.locator('details[open]')).toHaveCount(1)
    const fit = await overlay.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return (
        rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight
      )
    })
    expect(fit).toBe(true)
    expect(await battlefieldGeometry()).toEqual(before)
  }
  await page.keyboard.press('Escape')
  await expect(overlay).toHaveCount(0)
  await expect(toggle).toBeFocused()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await page.locator('main > header').click({ position: { x: 5, y: 5 } })
  await expect(overlay).toHaveCount(0)
  expect(await battlefieldGeometry()).toEqual(before)
}
