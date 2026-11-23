import { createPv1fBasicAttackDefinition } from '@aurevane/game-core/combat/pv1f-action-economy'
import { expect, type Page } from '@playwright/test'
import { battleTargetReachTiles } from '../src/components/battle/battle-attack-path'
import type { BattleSessionView } from '../src/server/battle/battle-session-service'

/** Check mounted potential range against the authoritative board, independent of occupants. */
export async function expectBasicAttackPotentialRange(page: Page) {
  const battleId = new URL(page.url()).pathname.split('/').at(-1)!
  const response = await page.request.get(`/api/battles/${battleId}`)
  expect(response.status()).toBe(200)
  const { battle } = (await response.json()) as { battle: BattleSessionView }
  const tactical = battle.snapshot.tactical
  const actorId = tactical.battle.currentTurn!.combatantId
  const placement = tactical.placements.find((row) => row.combatantId === actorId)!
  const expected = [
    ...battleTargetReachTiles(
      tactical,
      placement.position,
      createPv1fBasicAttackDefinition(1).target,
      [],
      { aimSource: 'implicit' },
      { tactical, actorId, terrainOverlays: battle.snapshot.terrainOverlays },
    ),
  ].sort()
  expect(expected.length).toBeGreaterThan(0)
  await expect
    .poll(() =>
      page.locator('#battlefield [data-attack-path]').evaluateAll((tiles) =>
        tiles
          .map((tile) => {
            const match = tile.getAttribute('aria-label')!.match(/^Tile (\d+), (\d+)/)!
            return `${Number(match[1]) - 1}:${Number(match[2]) - 1}`
          })
          .sort(),
      ),
    )
    .toEqual(expected)
}
