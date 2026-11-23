import type { BattleSessionView } from '@/server/battle/battle-session-service'
import type { BattleWalkReceipt } from '@/server/battle/battle-walk-receipts'
import { expect, it } from 'vitest'
import { confirmedBattlefieldWalks } from './battlefield-walks'

const origin = { x: 0, y: 0 }
const corner = { x: 1, y: 0 }
const destination = { x: 1, y: 1 }
const path = [origin, corner, destination]
const receipt = { version: 3, combatantId: 'actor', path }

function battle(
  battleVersion: number,
  position: typeof origin,
  recentWalks: readonly BattleWalkReceipt[] = [],
  battleSessionId = 'battle',
): BattleSessionView {
  return {
    battleSessionId,
    battleVersion,
    replayed: false,
    invalidation: null,
    snapshot: {
      tactical: { placements: [{ combatantId: 'actor', position }] },
      recentWalks,
    } as unknown as BattleSessionView['snapshot'],
  }
}

it('uses the authoritative traversed corners through a skipped version', () => {
  const before = battle(2, origin)
  const after = battle(4, destination, [receipt])
  const walks = confirmedBattlefieldWalks(before, after, new Map())
  expect(walks.get('actor')?.path).toEqual(path)
  expect(confirmedBattlefieldWalks(after, battle(5, destination), walks).get('actor')).toBe(
    walks.get('actor'),
  )
  const secondPath = [destination, { x: 2, y: 1 }]
  const latest = battle(6, secondPath[1]!, [
    receipt,
    { version: 5, combatantId: 'actor', path: secondPath },
  ])
  expect(confirmedBattlefieldWalks(before, latest, new Map()).get('actor')?.path).toEqual([
    ...path,
    secondPath[1],
  ])
  expect(confirmedBattlefieldWalks(after, latest, walks).get('actor')).toEqual({
    path: secondPath,
    previousPath: walks.get('actor')?.path,
  })
})

it('never infers a walk for teleports, stale receipts, or a fresh session', () => {
  const before = battle(2, origin)
  const after = battle(4, destination, [receipt])
  expect(confirmedBattlefieldWalks(before, battle(4, destination), new Map()).size).toBe(0)
  expect(confirmedBattlefieldWalks(before, battle(4, corner, [receipt]), new Map()).size).toBe(0)
  expect(
    confirmedBattlefieldWalks(before, battle(4, destination, [], 'other'), new Map()).size,
  ).toBe(0)
  expect(confirmedBattlefieldWalks(after, after, new Map()).size).toBe(0)
})
