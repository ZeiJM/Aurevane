import type { Page } from '@playwright/test'

/** Select one touch report without activating an underlying gameplay command. */
export async function openBattleInfoMenu(page: Page, label: string) {
  const host = page.locator('[data-battle-preview-info]')
  if ((await host.evaluate((element) => getComputedStyle(element).display)) === 'none') return
  const trigger = host.getByRole('button', { name: label, exact: true, includeHidden: true })
  const key = await trigger.locator('..').getAttribute('data-battle-preview-reader')
  if (!key) throw new Error(`Missing contextual reader for ${label}`)
  const selector = key.startsWith('skill')
    ? `[data-battle-skill-slot="${key.slice(5)}"]`
    : key === 'essence'
      ? '[data-battle-special="essence"], [data-battle-special="resonance"]'
      : key === 'supernatural'
        ? '[data-battle-special="supernatural"]'
        : `[data-command-card="${key}"]`
  const box = await page.locator(`[data-unified-command-deck] ${selector}`).boundingBox()
  if (!box) throw new Error(`Missing cockpit selection for ${label}`)
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(10, box.height / 2))
  await page.mouse.down()
  await page.mouse.move(2, 2)
  await page.mouse.up()
}
