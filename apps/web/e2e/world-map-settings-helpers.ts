import type { Page } from '@playwright/test'

// On phones the gear lives inside the Details sheet (the header gear was removed),
// so open Details first when the gear is not already reachable.
export async function openMapSettings(page: Page): Promise<void> {
  const gear = page.getByRole('button', { name: 'Map settings', exact: true })
  if (!(await gear.isVisible())) {
    await page.getByRole('button', { name: 'Details', exact: true }).click()
  }
  await gear.click()
}

export async function closeMapSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  const close = page.getByRole('button', { name: 'Close details', exact: true })
  if (await close.isVisible()) await close.click()
}
