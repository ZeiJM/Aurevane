import { expect, type Page } from '@playwright/test'
import type { BattleSessionView } from '../src/server/battle/battle-session-service'

/**
 * Assert that the currently displayed round matches a fresh, authoritative battle snapshot.
 * Desktop uses the permanent Chronicle heading; mobile uses the fixed action timeline's
 * pinned round badge (the old expandable Chronicle toggle was intentionally removed).
 */
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

  const mobileTimeline = page.locator('[data-battle-mobile-chronicle-strip]')
  const mobile = await mobileTimeline.isVisible()
  const surface = mobile ? mobileTimeline : page.locator('[data-battle-chronicle-heading]')
  if (mobile) {
    await expect(mobileTimeline.locator('[data-battle-action-strip]')).toBeVisible()
    await expect(page.locator('[data-battle-mobile-chronicle-toggle]')).toHaveCount(0)
  }

  const badge = surface.locator('[data-battle-round]')
  await expect(badge).toBeVisible()
  await expect(page.locator('[data-battle-preview-strip] [data-battle-round]')).toHaveCount(0)
  await expect(badge).toHaveAttribute('data-battle-round', String(round))
  await expect(badge).toHaveAttribute('aria-label', `Current battle round ${round}`)
  const geometry = await badge.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const container = element.closest(
      '[data-battle-mobile-chronicle-strip], [data-battle-chronicle-heading]',
    )
    if (!container) return { contained: false, pointerEvents: '' }
    const strip = container.getBoundingClientRect()
    return {
      contained:
        box.left >= strip.left - 1 &&
        box.right <= strip.right + 1 &&
        box.top >= strip.top - 1 &&
        box.bottom <= strip.bottom + 1,
      pointerEvents: getComputedStyle(element).pointerEvents,
    }
  })
  expect(geometry.contained).toBe(true)
  expect(geometry.pointerEvents).toBe('none')
  return round
}
