import { expect, type Page } from '@playwright/test'

/** Open the actual Ground effect card before editing its shared field settings. */
export async function openGroundEffectParameters(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Effects', exact: true }).click()
  const duration = page.getByLabel('Ground duration (rounds)', { exact: true })
  const card = duration.locator('xpath=ancestor::details[@data-effect-collapsible]')
  await expect(card).toHaveCount(1)
  if ((await card.getAttribute('open')) === null) await card.locator(':scope > summary').click()
  for (const label of ['Ground duration (rounds)', 'Ground animation', 'Ground affects']) {
    await expect(page.getByLabel(label, { exact: true })).toHaveCount(1)
    await expect(card.getByLabel(label, { exact: true })).toBeVisible()
  }
}
