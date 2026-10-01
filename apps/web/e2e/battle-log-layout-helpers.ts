import { expect, type Locator, type Page, type TestInfo } from '@playwright/test'

/** Exercise the real compact log, including empty actor filters, before checking its geometry. */
export async function expectReadableBattleLog(
  page: Page,
  testInfo: TestInfo,
  label: string,
  log: Locator = page.locator('[data-battle-inline-log]'),
) {
  const views = log.getByRole('group', { name: 'Battle history view', exact: true })
  const filters = log.getByRole('group', { name: 'Filter battle actions', exact: true })
  const pages = log.getByRole('group', { name: 'Battle history pages', exact: true })
  await expect(views).toBeVisible()
  for (const mode of ['Timeline', 'Text log']) {
    await views.getByRole('button', { name: mode, exact: true }).click()
    const track = log.getByRole('list', {
      name: mode === 'Timeline' ? 'Battle action timeline' : 'Battle action transcript',
      exact: true,
    })
    for (const actor of ['All', 'You', 'Opponents']) {
      await filters.getByRole('button', { name: actor, exact: true }).click()
      await testInfo.attach(`${label}-${mode}-${actor}`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      })
      await expect(views.getByRole('button', { name: mode, exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      await expect(filters.getByRole('button', { name: actor, exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      await expect(track).toBeVisible()
      await expect(pages).toBeVisible()
      const geometry = await log.evaluate((element) => {
        const rect = (node: Element) => {
          const box = node.getBoundingClientRect()
          return { top: box.top, bottom: box.bottom, left: box.left, right: box.right }
        }
        const groups = Array.from(element.querySelectorAll('[role="group"]'))
        const view = element.querySelector('[aria-label="Battle history view"]')!
        const filter = element.querySelector('[aria-label="Filter battle actions"]')!
        const pager = element.querySelector('[aria-label="Battle history pages"]')!
        const list = element.querySelector('ol')!
        return {
          log: rect(element),
          header: rect(element.querySelector(':scope > header')!),
          views: rect(view),
          filters: rect(filter),
          pager: rect(pager),
          track: rect(list),
          horizontalOverflow: list.scrollWidth - list.clientWidth,
          controls: groups.flatMap((group) => Array.from(group.querySelectorAll('button'), rect)),
          viewportHeight: window.innerHeight,
        }
      })
      expect(geometry.views.top).toBeGreaterThanOrEqual(geometry.header.bottom - 1)
      expect(geometry.filters.top).toBeGreaterThanOrEqual(geometry.views.bottom - 1)
      expect(geometry.track.top).toBeGreaterThanOrEqual(geometry.filters.bottom - 1)
      expect(geometry.pager.top).toBeGreaterThanOrEqual(geometry.track.bottom - 1)
      expect(geometry.pager.bottom).toBeLessThanOrEqual(geometry.log.bottom + 1)
      expect(geometry.track.bottom - geometry.track.top).toBeGreaterThan(24)
      expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1)
      for (const control of geometry.controls) {
        expect(control.left).toBeGreaterThanOrEqual(geometry.log.left - 1)
        expect(control.right).toBeLessThanOrEqual(geometry.log.right + 1)
      }
      if ((page.viewportSize()?.width ?? 0) > 820) {
        expect(geometry.log.top).toBeGreaterThanOrEqual(-1)
        expect(geometry.log.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1)
      }
    }
    await filters.getByRole('button', { name: 'All', exact: true }).click()
    const older = pages.getByRole('button', { name: 'Older actions', exact: true })
    if (await older.isEnabled()) {
      await older.click()
      await testInfo.attach(`${label}-${mode}-older-page`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      })
      const newer = pages.getByRole('button', { name: 'Newer actions', exact: true })
      await expect(newer).toBeEnabled()
      await newer.click()
      await expect(newer).toBeDisabled()
    }
  }
  await filters.getByRole('button', { name: 'All', exact: true }).click()
  await views.getByRole('button', { name: 'Timeline', exact: true }).click()
}
