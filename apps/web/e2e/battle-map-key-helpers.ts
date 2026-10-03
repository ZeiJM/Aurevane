import { expect, type Page } from '@playwright/test'

export async function expectTerrainKey(page: Page) {
  const key = page.getByRole('region', { name: 'Terrain Key', exact: true })
  await expect(key).toBeVisible()
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
    const actual = Array.from(document.querySelectorAll('[data-battle-terrain-key="true"] button'))
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
  const rows = await key.locator('button').evaluateAll((entries) =>
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
  for (let i = 1; i < rows.length; i++) {
    expect(Math.abs(rows[i]!.x - rows[0]!.x)).toBeLessThanOrEqual(1)
    expect(rows[i]!.y).toBeGreaterThanOrEqual(rows[i - 1]!.bottom - 1)
  }

  for (const { name: label } of projection.actual) {
    const entry = key.getByRole('button', { name: label, exact: true })
    await entry.focus()
    await entry.press('Enter')
    const panel = page.getByRole('dialog', { name: label, exact: true })
    await expect(panel).toBeVisible()
    await expect(panel.locator('p')).not.toBeEmpty()
    const fit = await panel.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return (
        rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight
      )
    })
    expect(fit).toBe(true)
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(entry).toBeFocused()
    await entry.click()
    await panel.getByRole('button', { name: `Close ${label}`, exact: true }).click()
    await expect(panel).toHaveCount(0)
    await expect(entry).toBeFocused()
    await entry.click()
    await page.locator('main > header').click({ position: { x: 5, y: 5 } })
    await expect(panel).toHaveCount(0)
  }
}
