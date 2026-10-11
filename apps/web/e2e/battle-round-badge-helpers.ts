import { expect, type Page } from '@playwright/test'
import type { BattleSessionView } from '../src/server/battle/battle-session-service'

/** Compare against a fresh server projection, including the read-only spectator projection. */
export async function expectRecordedBattleRound(page: Page): Promise<number> {
  const pathname = new URL(page.url()).pathname
  const key = pathname.split('/').at(-1)!
  const spectating = pathname.includes('/spectate/')
  const response = await page.request.get(
    spectating ? `/api/pvp/spectate/${encodeURIComponent(key)}` : `/api/battles/${key}`,
  )
  expect(response.ok()).toBe(true)
  const body = await response.json()
  const battle: BattleSessionView = spectating ? body.spectator.battle : body.battle
  const round = battle.snapshot.tactical.battle.round
  const badge = page.locator('[data-battle-chronicle-heading] [data-battle-round]')
  await expect(badge).toBeVisible()
  await expect(page.locator('[data-battle-preview-strip] [data-battle-round]')).toHaveCount(0)
  await expect(badge).toHaveAttribute('data-battle-round', String(round))
  await expect(badge).toHaveAttribute('aria-label', `Current battle round ${round}`)
  const geometry = await badge.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const strip = element.closest('[data-battle-chronicle-heading]')!.getBoundingClientRect()
    return {
      contained:
        box.left >= strip.left &&
        box.right <= strip.right &&
        box.top >= strip.top &&
        box.bottom <= strip.bottom,
      pointerEvents: getComputedStyle(element).pointerEvents,
    }
  })
  expect(geometry.contained).toBe(true)
  expect(geometry.pointerEvents).toBe('none')
  return round
}
