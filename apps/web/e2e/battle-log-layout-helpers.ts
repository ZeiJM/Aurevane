import { expect, type Locator, type Page, type TestInfo } from '@playwright/test'

/** Exercise both formats and turn navigation before checking the shared log's geometry. */
export async function expectReadableBattleLog(
  page: Page,
  testInfo: TestInfo,
  label: string,
  log: Locator = page.locator('[data-battle-inline-log]'),
) {
  await expect(log.getByRole('button', { name: 'Expand battle history', exact: true })).toHaveCount(
    0,
  )
  await expect(log.getByRole('group', { name: 'Filter battle actions', exact: true })).toHaveCount(
    0,
  )
  await expect(log.getByRole('group', { name: 'Battle history pages', exact: true })).toHaveCount(0)
  for (const mode of ['Timeline', 'Text log']) {
    const switchToMode = log.getByRole('button', { name: `Switch to ${mode}`, exact: true })
    if (await switchToMode.count()) await switchToMode.click()
    const toggle = log.locator(':scope > header button')
    await expect(toggle).toHaveCount(1)
    await expect(toggle).toHaveText(mode)
    const track = log.getByRole('list', {
      name: mode === 'Timeline' ? 'Battle action timeline' : 'Battle action transcript',
      exact: true,
    })
    await expect(track).toBeVisible()
    await testInfo.attach(`${label}-${mode}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
    const geometry = await log.evaluate((element) => {
      const rect = (node: Element) => {
        const box = node.getBoundingClientRect()
        return { top: box.top, bottom: box.bottom, left: box.left, right: box.right }
      }
      const list = element.querySelector('ol')!
      const turnControls = element.querySelector('[aria-label="Battle history turns"]')!
      return {
        log: rect(element),
        header: rect(element.querySelector(':scope > header')!),
        track: rect(list),
        turns: rect(turnControls),
        horizontalOverflow: list.scrollWidth - list.clientWidth,
        scrollbar: getComputedStyle(list).scrollbarWidth,
        controls: Array.from(
          element.querySelectorAll('header button, [aria-label="Battle history turns"] button'),
          rect,
        ),
        viewportHeight: window.innerHeight,
      }
    })
    expect(geometry.turns.top).toBeGreaterThanOrEqual(geometry.header.bottom - 1)
    expect(geometry.track.top).toBeGreaterThanOrEqual(geometry.turns.bottom - 1)
    expect(geometry.track.bottom).toBeLessThanOrEqual(geometry.log.bottom + 1)
    expect(geometry.track.bottom - geometry.track.top).toBeGreaterThan(24)
    expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1)
    expect(geometry.scrollbar).toBe('none')
    for (const control of geometry.controls) {
      expect(control.left).toBeGreaterThanOrEqual(geometry.log.left - 1)
      expect(control.right).toBeLessThanOrEqual(geometry.log.right + 1)
    }
    if ((page.viewportSize()?.width ?? 0) > 820) {
      expect(geometry.log.top).toBeGreaterThanOrEqual(-1)
      expect(geometry.log.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1)
    }
    const labelBefore = await log.locator('[data-view] > div > span').textContent()
    const older = log.getByRole('button', { name: 'Previous turn', exact: true })
    if (await older.count()) {
      await older.click()
      await expect(log.locator('[data-view] > div > span')).not.toHaveText(labelBefore!)
      await testInfo.attach(`${label}-${mode}-previous-turn`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      })
      const newer = log.getByRole('button', { name: 'Next turn', exact: true })
      await expect(newer).toBeVisible()
      if ((await older.count()) === 0) await expect(newer).toBeFocused()
      await newer.click()
      await expect(log.locator('[data-view] > div > span')).toHaveText(labelBefore!)
      await expect(newer).toHaveCount(0)
      await expect(older).toBeFocused()
    }
  }
  await log.getByRole('button', { name: 'Switch to Timeline', exact: true }).click()
}
