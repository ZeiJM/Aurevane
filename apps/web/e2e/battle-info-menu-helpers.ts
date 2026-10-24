import type { Page } from '@playwright/test'

/** Touch layouts keep all parameter readers in the preview's information menu. */
export async function openBattleInfoMenu(page: Page) {
  const menu = page.locator('[data-battle-preview-info]')
  if ((await menu.isVisible()) && (await menu.getAttribute('open')) === null)
    await menu.locator('summary').click()
}
