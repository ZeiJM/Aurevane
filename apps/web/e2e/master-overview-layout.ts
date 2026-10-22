import { expect, type Page, type TestInfo } from '@playwright/test'

export async function verifyMasterOverviewLayout(page: Page, info: TestInfo) {
  await page.goto('/master')
  const overview = page.locator('.av-master-overview')
  await expect(overview.locator(':scope > a')).toHaveCount(8)
  try {
    for (const [width, height, zoom] of [
      [1920, 1080, 1],
      [1366, 768, 1],
      [1280, 720, 1],
      [1024, 768, 1],
      [390, 844, 1],
      [320, 740, 1],
      [1440, 900, 2],
    ] as const) {
      await page.setViewportSize({ width, height })
      await page.evaluate((value) => {
        document.documentElement.style.zoom = String(value)
      }, zoom)
      await page.evaluate(() => document.fonts.ready)
      const metrics = await overview.evaluate((grid) => {
        const content = grid.parentElement!
        const main = document.getElementById('game-main')!
        const cards = Array.from(grid.children)
        return {
          contentOverflow: content.scrollHeight - content.clientHeight,
          mainOverflow: main.scrollHeight - main.clientHeight,
          documentWidth:
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
          overflowingText: cards.flatMap((card) => {
            const bounds = card.getBoundingClientRect()
            return Array.from(card.querySelectorAll('h2, p, strong, .av-eyebrow'))
              .filter((node) => {
                const range = document.createRange()
                range.selectNodeContents(node)
                const text = range.getBoundingClientRect()
                return (
                  text.top < bounds.top - 1 ||
                  text.bottom > bounds.bottom + 1 ||
                  text.left < bounds.left - 1 ||
                  text.right > bounds.right + 1
                )
              })
              .map((node) => node.textContent)
          }),
          hiddenText: cards.some((card) =>
            Array.from(card.querySelectorAll('h2, p, strong')).some((node) => {
              const style = getComputedStyle(node)
              return style.display === 'none' || style.visibility === 'hidden'
            }),
          ),
        }
      })
      const label = `${width}x${height}-zoom${zoom}`
      expect(metrics.overflowingText, `${label}: text stays inside every card`).toEqual([])
      expect(metrics.hiddenText, `${label}: all card copy remains visible`).toBe(false)
      expect(metrics.documentWidth, `${label}: no horizontal page scroll`).toBeLessThanOrEqual(1)
      if (width >= 1280 && zoom === 1) {
        expect(metrics.contentOverflow, `${label}: overview needs no scroll`).toBeLessThanOrEqual(1)
        expect(metrics.mainOverflow, `${label}: shell needs no scroll`).toBeLessThanOrEqual(1)
      }
      await info.attach(`master-overview-${label}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      })
    }
  } finally {
    await page.evaluate(() => {
      document.documentElement.style.zoom = '1'
    })
    await page.setViewportSize({ width: 1440, height: 900 })
  }
}
