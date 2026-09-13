import { expect, type Page } from '@playwright/test'

export async function expectMapKey(page: Page) {
  const key = page.getByRole('button', { name: 'Map Key', exact: true })
  await expect(key).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Tile coordinates' })).toHaveCount(0)
  await expect(page.locator('#battlefield > [aria-label="Terrain legend"]')).toHaveCount(0)
  await key.click()
  const panel = page.getByRole('dialog', { name: 'Map Key', exact: true })
  await expect(panel).toBeVisible()
  for (const label of [
    'Difficult Terrain',
    'Elevated Ground',
    'Frozen',
    'Steam',
    'Movement path',
    'Facing',
  ]) {
    await expect(panel.locator('dt').filter({ hasText: label })).toBeVisible()
  }
  const fit = await panel.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight
  })
  expect(fit).toBe(true)
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(key).toBeFocused()
  await key.click()
  await page.locator('main > header').click({ position: { x: 5, y: 5 } })
  await expect(panel).toHaveCount(0)
}
